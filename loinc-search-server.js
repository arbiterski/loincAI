// server.js
require('dotenv').config();
const express = require('express');
const csv = require('csv-parse');
const fs = require("fs");
const util = require("util");
const fsPromises = {
  readdir: util.promisify(fs.readdir),
  stat: util.promisify(fs.stat),
  readFile: util.promisify(fs.readFile),
  access: util.promisify(fs.access),
  unlink: util.promisify(fs.unlink),
  mkdir: util.promisify(fs.mkdir),
  writeFile: util.promisify(fs.writeFile)
};
const fsSync = require('fs');
const path = require('path');
const cors = require('cors');
const axios = require('axios');
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors());

// Debug middleware to log all requests
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Set charset for API responses only
app.use('/api', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// Load AI provider keys
const openaiApiKey = process.env.OPENAI_API_KEY || '';
const anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';
const grokApiKey = process.env.GROK_API_KEY || '';

// Provider-agnostic translator
async function translateChineseToEnglish(text, provider = 'openai') {
  if (!text || text.trim() === '') return '';
  
  // Try Grok API first if specified and available
  if (provider === 'grok' && grokApiKey) {
    try {
      const response = await axios.post(
        'https://api.x.ai/v1/chat/completions',
        {
          model: 'grok-3',
          messages: [
            { role: 'system', content: 'You are a professional medical translator. Translate Chinese medical content to English accurately.' },
            { role: 'user', content: `Translate to English: ${text}` }
          ],
          max_tokens: 1000,
          temperature: 0.3
        },
        {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Authorization': `Bearer ${grokApiKey}`
          },
          responseType: 'json'
        }
      );
      return response.data.choices[0].message.content;
    } catch (e) {
      console.warn('Grok translation failed:', e.message);
      // Fall back to OpenAI
    }
  }
  
  // Use OpenAI as fallback or default
  if (openaiApiKey) {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4.1-nano',
          messages: [
            { role: 'system', content: 'You are a professional medical translator. Translate Chinese medical content to English accurately.' },
            { role: 'user', content: `Translate to English: ${text}` }
          ],
          max_tokens: 1000,
          temperature: 0.3
        },
        {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Authorization': `Bearer ${openaiApiKey}`
          },
          responseType: 'json'
        }
      );
      return response.data.choices[0].message.content;
    } catch (e) {
      console.warn('OpenAI translation failed:', e.message);
      return text;
    }
  }
  return text;
}

// Azure OpenAI configuration (commented out for later use)
// const azureEndpoint = "https://emrgenie.openai.azure.com/";
// const azureKey = "7970ff0f9ba34d4ba6c2022f2da8bb7e";
// const azureDeployment = "gpt-4o-mini";
// const azureApiVersion = "2023-05-15";

// OpenAI API configuration is already set above

// Search index for fast lookup
let searchIndex = null;

// Load LOINC data
let loincData = [];
fsSync.createReadStream('Loinc.csv')
  .pipe(csv.parse({ columns: true }))
  .on('data', (row) => {
    loincData.push({
      loincNum: row.LOINC_NUM,
      component: row.COMPONENT,
      specimen: row.SYSTEM,
      method: row.METHOD_TYP,
      property: row.PROPERTY,
      scale: row.SCALE_TYP,
      time: row.TIME_ASPCT,
      relatedNames2: row.RELATEDNAMES2,
      commonTestRank: row.COMMON_TEST_RANK,
      commonOrderRank: row.COMMON_ORDER_RANK,
      longCommonName: row.LONG_COMMON_NAME
    });
  })
  .on('end', () => {
    console.log('LOINC data loaded successfully');
    // Create search index after data is loaded
    buildSearchIndex();
  });

// Constants for scoring based on provided Python code
const matchScore = 15;
const misMatchScore = -10;
const gapPenalty = -7;

// Memoization cache for DP calculations
const dpCache = new Map();

// MySQL connection configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'arbiter',
    password: process.env.DB_PASSWORD || 'gimi',
    database: process.env.DB_NAME || 'loinc_search'
};

// Create MySQL connection pool
const pool = mysql.createPool(dbConfig);

// Create search_logs table if it doesn't exist
async function initializeDatabase() {
    try {
        const connection = await pool.getConnection();
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS search_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                search_terms VARCHAR(255),
                must_have_terms VARCHAR(255),
                ip_address VARCHAR(45),
                user_agent VARCHAR(255),
                result_count INT,
                search_time_ms INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create search_sessions table if it doesn't exist
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS search_sessions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                session_id VARCHAR(255) UNIQUE,
                search_terms VARCHAR(255),
                must_have_terms VARCHAR(255),
                filters JSON,
                ip_address VARCHAR(45),
                user_agent VARCHAR(255),
                result_count INT,
                search_time_ms INT,
                ai_summary TEXT,
                ai_chat_log JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        
        // Create ai_mapping_suggestions table for storing mapping suggestions
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS ai_mapping_suggestions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                session_id VARCHAR(255),
                original_search_terms VARCHAR(500),
                selected_loinc_codes JSON,
                ai_mapping_analysis TEXT,
                loinc_details JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_session_id (session_id),
                INDEX idx_created_at (created_at)
            )
        `);
        
        connection.release();
        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

// Initialize database when server starts
initializeDatabase();

function distance(string1, string2) {
    // Check for undefined or null values
    if (!string1 || !string2) {
        return 0;
    }

    // First check for exact match
    if (string1.toLowerCase() === string2.toLowerCase()) {
        return 100;
    }

    let scoreMatrix = [];
    string1 = " " + string1;
    string2 = " " + string2;
    let x = string1.length;
    let y = string2.length;
    scoreMatrix = constructNewMatrix(string1, string2);
    let similarityScore = fillScoreMatrix(string1, string2, scoreMatrix)[x - 1][y - 1];
    let averageLength = (parseFloat(x) + parseFloat(y)) / 2 - 1;
    let maxScore = averageLength * matchScore;
    let normalizeScore = 100 * similarityScore / maxScore;
    
    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, normalizeScore));
}

function constructNewMatrix(string1, string2) {
    let scoreMatrix = [];
    let x = string1.length;
    let y = string2.length;
    for (let xx = 0; xx < x; xx++) {
        let line = [];
        for (let yy = 0; yy < y; yy++) {
            line.push(0);
        }
        scoreMatrix.push(line);
    }
    return scoreMatrix;
}

function fillScoreMatrix(string1, string2, scoreMatrix) {
    let x = string1.length;
    let y = string2.length;
    for (let currentPosittionY = 0; currentPosittionY < y; currentPosittionY++) {
        for (let currentPosittionX = 0; currentPosittionX < x; currentPosittionX++) {
            let charOfString1 = string1[currentPosittionX];
            let charOfString2 = string2[currentPosittionY];

            if (currentPosittionY === 0) {
                if (currentPosittionX === 0) {
                    scoreMatrix[currentPosittionX][currentPosittionY] = 0;
                } else {
                    scoreMatrix[currentPosittionX][currentPosittionY] = scoreMatrix[currentPosittionX - 1][currentPosittionY] + gapPenalty;
                }
            } else {
                if (currentPosittionX === 0) {
                    scoreMatrix[currentPosittionX][currentPosittionY] = scoreMatrix[currentPosittionX][currentPosittionY - 1] + gapPenalty;
                } else {
                    let xShiftGapScore = scoreMatrix[currentPosittionX][currentPosittionY - 1] + gapPenalty;
                    let yShiftGapScore = scoreMatrix[currentPosittionX - 1][currentPosittionY] + gapPenalty;
                    let noShiftScore = (charOfString1 === charOfString2 ? matchScore : misMatchScore) + scoreMatrix[currentPosittionX - 1][currentPosittionY - 1];
                    
                    let result = [xShiftGapScore, yShiftGapScore, noShiftScore];
                    result.sort((a, b) => b - a);
                    let biggestScore = result[0];
                    scoreMatrix[currentPosittionX][currentPosittionY] = biggestScore;
                }
            }
        }
    }
    return scoreMatrix;
}

function wordLevelSentenceSimilarity(sentence1, sentence2) {
    if (!sentence1 || !sentence2) return 0;
    
    const words1 = sentence1.toLowerCase().split(" ");
    const words2 = sentence2.toLowerCase().split(" ");
    let totalScore = 0;
    let count = 0;
    let [shortArray, longArray] = words1.length <= words2.length ? [words1, words2] : [words2, words1];
    for (let word of shortArray) {
        let highestScore = -1000;
        for (let candidate of longArray) {
            let score = distance(word, candidate);
            if (score > highestScore) highestScore = score;
        }
        totalScore += highestScore;
        count++;
    }
    return totalScore / ((words1.length + words2.length) / 2);
}

// Build search index for fast lookup
function buildSearchIndex() {
  // Create maps for direct word lookup
  searchIndex = {
    wordMap: new Map(),  // Maps words to record indices
    componentMap: new Map(),  // Maps component words to record indices
    loincNumMap: new Map()  // Maps LOINC numbers to record indices
  };

  // Index each record
  loincData.forEach((item, index) => {
    // Index LOINC number for direct lookup
    searchIndex.loincNumMap.set(item.loincNum.toLowerCase(), index);
    
    // Index component field
    if (item.component) {
      const componentWords = item.component.toLowerCase().split(/\s+/);
      componentWords.forEach(word => {
        if (word.length < 2) return; // Skip very short words
        
        if (!searchIndex.componentMap.has(word)) {
          searchIndex.componentMap.set(word, new Set());
        }
        searchIndex.componentMap.get(word).add(index);
      });
    }
    
    // Index all searchable text
    const allText = [
      item.longCommonName,
      item.component,
      item.relatedNames2
    ].filter(Boolean).join(' ').toLowerCase();
    
    // Split into words and index each word
    const words = allText.split(/\s+/);
    words.forEach(word => {
      if (word.length < 2) return; // Skip very short words
      
      if (!searchIndex.wordMap.has(word)) {
        searchIndex.wordMap.set(word, new Set());
      }
      searchIndex.wordMap.get(word).add(index);
    });
  });
  
  console.log('Search index built successfully');
}

// Fast search using index
function fastSearch(searchTerms) {
  if (!searchIndex) {
    console.log('Search index not yet built, falling back to full scan');
    return null; // Indicate we should fall back to full scan
  }
  
  // For very short queries, use full scan for better accuracy
  if (searchTerms.length === 1 && searchTerms[0].length < 3) {
    return null;
  }

  // Find matching record indices for each term
  const matchingSets = searchTerms.map(term => {
    // Check if the term is a LOINC number
    if (term.match(/^\d+-\d+$/)) {
      const lowerTerm = term.toLowerCase();
      // Try direct lookup first
      if (searchIndex.loincNumMap.has(lowerTerm)) {
      const indexSet = new Set();
        indexSet.add(searchIndex.loincNumMap.get(lowerTerm));
      return indexSet;
      }
      
      // If not found, try a more flexible search through all LOINC numbers
      const matchingIndices = new Set();
      loincData.forEach((item, index) => {
        if (item.loincNum && item.loincNum.toLowerCase() === lowerTerm) {
          matchingIndices.add(index);
        }
      });
      
      if (matchingIndices.size > 0) {
        return matchingIndices;
      }
    }
    
    // Look for exact word matches first
    if (searchIndex.wordMap.has(term)) {
      return searchIndex.wordMap.get(term);
    }
    
    // If not found, look for words that contain this term
    const matchingIndices = new Set();
    searchIndex.wordMap.forEach((indices, word) => {
      if (word.includes(term)) {
        indices.forEach(index => matchingIndices.add(index));
      }
    });
    
    // If still no matches, look in the component map
    if (matchingIndices.size === 0 && searchIndex.componentMap.has(term)) {
      return searchIndex.componentMap.get(term);
    }
    
    return matchingIndices;
  });
  
  // Filter out empty sets
  const validSets = matchingSets.filter(set => set.size > 0);
  
  // If no valid sets, use full scan
  if (validSets.length === 0) {
    return null;
  }
  
  // Get the union of all matching indices
  const allMatchingIndices = new Set();
  validSets.forEach(set => {
    set.forEach(index => allMatchingIndices.add(index));
  });
  
  // Convert to array for easier processing
  return Array.from(allMatchingIndices);
}

// Pre-filter records that contain any of the search terms
function preFilterRecords(records, searchTerms, applyOrderRankFilter = false, applyTestRankFilter = false) {
  // Skip filtering for empty search terms
  if (!searchTerms.length) return records;
  
  // Convert search terms to lowercase for case-insensitive comparison
  const lowerTerms = searchTerms.map(term => term.toLowerCase());
  
  console.log(`Pre-filtering ${records.length} records for terms: ${lowerTerms.join(', ')}`);
  
  // Filter records that contain any of the search terms (similar to SQL LIKE '%term%')
  return records.filter(item => {
    // Apply rank filters if requested
    if (applyOrderRankFilter) {
      const rank = parseInt(item.commonOrderRank);
      if (!(rank > 0 && rank <= 300)) {
        return false;
      }
    }
    
    if (applyTestRankFilter) {
      const testRank = parseInt(item.commonTestRank);
      if (!(testRank > 0 && testRank <= 3000)) {
        return false;
      }
    }
    
    // Combine all searchable fields
    const combinedText = [
      item.longCommonName, 
      item.component, 
      item.relatedNames2
    ].filter(Boolean).join(' ').toLowerCase();
    
    // Check if any term appears in the combined text (LIKE %term%)
    for (const term of lowerTerms) {
      if (combinedText.includes(term)) {
        return true; // Early return if any term matches
      }
    }
    
    return false;
  });
}

// Simulation of SQL LIKE operator for optimizing field-specific searches
function likeSearch(records, field, pattern, isCaseSensitive = false) {
  // Prepare pattern for different LIKE patterns
  let isStartsWith = false;
  let isEndsWith = false;
  let searchPattern = pattern;
  
  if (pattern.startsWith('%') && pattern.endsWith('%')) {
    // LIKE '%term%' - contains
    searchPattern = pattern.slice(1, -1);
  } else if (pattern.startsWith('%')) {
    // LIKE '%term' - ends with
    searchPattern = pattern.slice(1);
    isEndsWith = true;
  } else if (pattern.endsWith('%')) {
    // LIKE 'term%' - starts with
    searchPattern = pattern.slice(0, -1);
    isStartsWith = true;
  }
  
  // Optimize search based on pattern type
  return records.filter(item => {
    let fieldValue = item[field] || '';
    
    if (!isCaseSensitive) {
      fieldValue = fieldValue.toLowerCase();
      searchPattern = searchPattern.toLowerCase();
    }
    
    if (isStartsWith) {
      return fieldValue.startsWith(searchPattern);
    } else if (isEndsWith) {
      return fieldValue.endsWith(searchPattern);
    } else {
      return fieldValue.includes(searchPattern);
    }
  });
}

// 標準化詞彙，處理單複數和其他變形
function normalizeSearchTerms(terms) {
  return terms.map(term => {
    // 處理簡單的英文單複數形式
    if (term.endsWith('ies')) {
      return term.substring(0, term.length - 3) + 'y';
    } else if (term.endsWith('es')) {
      return term.substring(0, term.length - 2);
    } else if (term.endsWith('s') && !term.endsWith('ss')) {
      return term.substring(0, term.length - 1);
    }
    return term;
  });
}

// 處理複合字詞，如 "HIV 1", "Hepatitis B" 等
function processCompoundTerms(inputString) {
  // 替換逗號為空格
  const rawText = inputString.toLowerCase().replace(/,/g, ' ');
  
  // 常見的複合詞模式
  const patterns = [
    /hiv\s+[0-9]/gi,            // HIV 1, HIV 2
    /hepatitis\s+[a-z]/gi,      // Hepatitis A, Hepatitis B
    /type\s+[0-9a-z]/gi,        // Type 1, Type A
    /grade\s+[0-9]/gi,          // Grade 1, Grade 2
    /class\s+[0-9a-z]/gi,       // Class 1, Class A
    /group\s+[0-9a-z]/gi,       // Group A, Group 1
    /stage\s+[0-9a-z]/gi,       // Stage 1, Stage IV
    /phase\s+[0-9]/gi,          // Phase 1, Phase 2
    /level\s+[0-9]/gi,          // Level 1, Level 2
    /factor\s+[0-9a-z]/gi       // Factor V, Factor 8
  ];
  
  // 找出所有複合詞
  let compoundTerms = [];
  patterns.forEach(pattern => {
    const matches = rawText.match(pattern);
    if (matches) {
      compoundTerms = compoundTerms.concat(matches);
    }
  });
  
  // 先根據複合詞進行分割，以保留它們
  let processedText = rawText;
  compoundTerms.forEach((term, index) => {
    // 將複合詞替換為佔位符
    processedText = processedText.replace(term, `__COMPOUND_${index}__`);
  });
  
  // 分割為單獨的詞彙
  let terms = processedText.split(/\s+/).filter(term => term.length > 0);
  
  // 替換佔位符為複合詞
  terms = terms.map(term => {
    if (term.startsWith('__COMPOUND_')) {
      const index = parseInt(term.match(/__COMPOUND_(\d+)__/)[1]);
      return compoundTerms[index];
    }
    return term;
  });
  
  // 過濾掉不屬於複合詞的單字符詞彙
  terms = terms.filter(term => term.length > 1 || compoundTerms.includes(term));
  
  return terms;
}

/**
 * Dynamic Programming algorithm for field1 to longCommonName matching
 * Based on original Python implementation by arbiter, Mark Lin (2009)
 */
function longNameDPMatch(string1, string2) {
  if (!string1 || !string2) return 0;
  
  // For exact matches, return 100%
  if (string1.toLowerCase() === string2.toLowerCase()) return 100;
  
  // Check cache first
  const cacheKey = `${string1.toLowerCase()}|${string2.toLowerCase()}`;
  if (dpCache.has(cacheKey)) {
    return dpCache.get(cacheKey);
  }
  
  // Prepare strings for DP with space prefixes as in the Python code
  string1 = " " + string1;
  string2 = " " + string2;
  
  // Get lengths
  const x = string1.length;
  const y = string2.length;
  
  // Skip very long strings that would create huge matrices
  if (x > 100 || y > 500) {
    // Use faster but less accurate method for very long strings
    const quickScore = quickStringMatch(string1.slice(1), string2.slice(1));
    dpCache.set(cacheKey, quickScore);
    return quickScore;
  }
  
  // Initialize score matrix
  const scoreMatrix = constructNewMatrix(string1, string2);
  
  // Fill the score matrix using dynamic programming
  const filledMatrix = fillScoreMatrix(string1, string2, scoreMatrix);
  
  // Get final similarity score from bottom-right cell
  const similarityScore = filledMatrix[x-1][y-1];
  
  // Normalize score as in the Python implementation
  const averageLength = ((x + y) / 2) - 1;
  const maxScore = averageLength * matchScore;
  const normalizeScore = 100 * similarityScore / maxScore;
  
  // Ensure score is between 0 and 100
  const finalScore = Math.max(0, Math.min(100, normalizeScore));
  
  // Store in cache
  dpCache.set(cacheKey, finalScore);
  
  return finalScore;
}

/**
 * Construct a new matrix for scoring
 * Direct port from Python implementation
 */
function constructNewMatrix(string1, string2) {
  const x = string1.length;
  const y = string2.length;
  const scoreMatrix = [];
  
  for (let xx = 0; xx < x; xx++) {
    const line = [];
    for (let yy = 0; yy < y; yy++) {
      line.push(0);
    }
    scoreMatrix.push(line);
  }
  
  return scoreMatrix;
}

/**
 * Fill the score matrix using dynamic programming
 * Direct port from Python implementation
 */
function fillScoreMatrix(string1, string2, scoreMatrix) {
  const x = string1.length;
  const y = string2.length;
  
  for (let currentPosittionY = 0; currentPosittionY < y; currentPosittionY++) {
    for (let currentPosittionX = 0; currentPosittionX < x; currentPosittionX++) {
      const charOfString1 = string1[currentPosittionX];
      const charOfString2 = string2[currentPosittionY];
      
      if (currentPosittionY === 0) {
        if (currentPosittionX === 0) {
          scoreMatrix[currentPosittionX][currentPosittionY] = 0;
        } else {
          scoreMatrix[currentPosittionX][currentPosittionY] = scoreMatrix[currentPosittionX - 1][currentPosittionY] + gapPenalty;
        }
      } else {
        if (currentPosittionX === 0) {
          scoreMatrix[currentPosittionX][currentPosittionY] = scoreMatrix[currentPosittionX][currentPosittionY - 1] + gapPenalty;
        } else {
          const xShiftGapScore = scoreMatrix[currentPosittionX][currentPosittionY - 1] + gapPenalty;
          const yShiftGapScore = scoreMatrix[currentPosittionX - 1][currentPosittionY] + gapPenalty;
          let noShiftScore;
          
          if (charOfString1 === charOfString2) {
            noShiftScore = matchScore + scoreMatrix[currentPosittionX - 1][currentPosittionY - 1];
          } else {
            noShiftScore = misMatchScore + scoreMatrix[currentPosittionX - 1][currentPosittionY - 1];
          }
          
          const result = [xShiftGapScore, yShiftGapScore, noShiftScore];
          result.sort((a, b) => b - a);
          const biggestScore = result[0];
          
          scoreMatrix[currentPosittionX][currentPosittionY] = biggestScore;
        }
      }
    }
  }
  
  return scoreMatrix;
}

/**
 * Calculate distance between two string arrays (e.g., words in sentences)
 * Based on the Python distanceArray function
 */
function distanceArray(string1, string2) {
  const array1 = string1.toLowerCase().split(/\s+/).filter(s => s.length > 0);
  const array2 = string2.toLowerCase().split(/\s+/).filter(s => s.length > 0);
  
  // Handle empty arrays
  if (array1.length === 0 || array2.length === 0) {
    return 0;
  }
  
  const averageLength = (array1.length + array2.length) / 2;
  
  // Determine which array is shorter
  let shortArray, longArray;
  if (array1.length <= array2.length) {
    shortArray = array1;
    longArray = array2;
  } else {
    shortArray = array2;
    longArray = array1;
  }
  
  // Calculate score by finding best matches for each term
  let totalScore = 0;
  for (const term of shortArray) {
    let highestScore = -1000;
    for (const candidate of longArray) {
      const currentScore = longNameDPMatch(term, candidate);
      if (currentScore > highestScore) {
        highestScore = currentScore;
      }
    }
    totalScore += highestScore;
  }
  
  // Normalize the total score
  const normalizeScore = totalScore / averageLength;
  return Math.max(0, Math.min(100, normalizeScore));
}

// Medical term similarity cache
const termSimilarityCache = new Map();

// Function to extract key medical terms from input
function extractKeyTerms(input) {
  if (!input) return '';
  
  let cleaned = input.trim();
  
  // Remove content in brackets and parentheses (units, qualifiers)
  cleaned = cleaned.replace(/\[.*?\]/g, '');
  cleaned = cleaned.replace(/\(.*?\)/g, '');
  
  // Remove common specimen/system indicators at the end
  cleaned = cleaned.replace(/\s+in\s+(Blood|Serum|Plasma|Urine|CSF|Stool|Tissue|Saliva)$/i, '');
  cleaned = cleaned.replace(/\s+from\s+(Blood|Serum|Plasma|Urine|CSF|Stool|Tissue|Saliva)$/i, '');
  
  // Remove common measurement units and qualifiers
  cleaned = cleaned.replace(/\s*(mass|volume|concentration|activity|presence|count|ratio)\/.*$/i, '');
  cleaned = cleaned.replace(/\s*(per|\/)\s*(volume|mass|area|time).*$/i, '');
  
  // Remove trailing whitespace
  cleaned = cleaned.trim();
  
  return cleaned;
}

// Improved function for medical term similarity with DP approach
function medicalTermSimilarity(query, target) {
  if (!query || !target) return 0;
  
  // Check cache first
  const cacheKey = `${query.toLowerCase()}|${target.toLowerCase()}`;
  if (termSimilarityCache.has(cacheKey)) {
    return termSimilarityCache.get(cacheKey);
  }
  
  // 1. Direct whole term match has highest priority
  if (query.toLowerCase() === target.toLowerCase()) {
    termSimilarityCache.set(cacheKey, 100);
    return 100;
  }
  
  // 2. Use the comprehensive distance array comparison from the Python implementation
  const score = distanceArray(query, target);
  
  // Store in cache
  termSimilarityCache.set(cacheKey, score);
  
  return score;
}

// Quick string matching for very long strings
function quickStringMatch(str1, str2) {
  // Count common character pairs
  const pairs1 = new Set();
  const pairs2 = new Set();
  
  // Generate character pairs
  for (let i = 0; i < str1.length - 1; i++) {
    pairs1.add(str1.substring(i, i + 2));
  }
  
  for (let i = 0; i < str2.length - 1; i++) {
    pairs2.add(str2.substring(i, i + 2));
  }
  
  // Count intersection
  let intersection = 0;
  for (const pair of pairs1) {
    if (pairs2.has(pair)) {
      intersection++;
    }
  }
  
  // Calculate Dice coefficient
  const dice = (2.0 * intersection) / (pairs1.size + pairs2.size);
  return dice * 100;
}

// Periodically clear cache to prevent memory issues
setInterval(() => {
  // Keep cache size manageable
  if (dpCache.size > 10000) {
    console.log(`Clearing DP cache, size was: ${dpCache.size}`);
    dpCache.clear();
  }
  
  if (termSimilarityCache.size > 5000) {
    console.log(`Clearing term similarity cache, size was: ${termSimilarityCache.size}`);
    termSimilarityCache.clear();
  }
}, 30 * 60 * 1000); // Clear every 30 minutes

// Direct LOINC code search endpoint
app.post('/api/direct-loinc', (req, res) => {
  try {
    const { loincCode } = req.body;
    
    if (!loincCode) {
      return res.json({ results: [] });
    }
    
    console.log(`Direct LOINC code search: "${loincCode}"`);
    
    // Normalize the LOINC code (trim and lowercase for comparison)
    const normalizedCode = loincCode.trim().toLowerCase();
    
    // Find exact matches directly from loincData array
    const results = loincData.filter(item => 
      item.loincNum && item.loincNum.toLowerCase() === normalizedCode
    ).map(item => {
      // Create comprehensive component field with LOINC five axes (values only)
      const comprehensiveComponent = [
        `<span style="color: #e91e63; font-weight: bold;">${item.component || 'N/A'}</span>`,
        `<span style="color: #4caf50;">${item.specimen || 'N/A'}</span>`,
        item.method || 'N/A',
        item.property || 'N/A',
        item.scale || 'N/A',
        item.time || 'N/A'
      ].join(' | ').replace(' | ', '<br>');

      return {
        loincNum: item.loincNum,
        component: comprehensiveComponent,
        relatedNames2: item.relatedNames2,
        commonTestRank: item.commonTestRank,
        commonOrderRank: item.commonOrderRank,
        longCommonName: item.longCommonName,
        similarityScore: 100 // Exact match gets 100% similarity
      };
    });
    
    console.log(`Found ${results.length} exact matches for LOINC code: ${loincCode}`);
    
    res.json({ results });
  } catch (error) {
    console.error('Direct LOINC search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search endpoint
app.post('/api/search', async (req, res) => {
  try {
    const searchStartTime = Date.now();
    const { field1, field2, componentField, systemField, useOrderRankFilter, useTestRankFilter } = req.body;
    
    // Generate session ID
    const sessionId = uuidv4();
    
    // Get client IP and user agent
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    console.log(`Search Session ${sessionId}: "${field1}" | Must have: "${field2}" | Order Rank Filter: ${useOrderRankFilter} | Test Rank Filter: ${useTestRankFilter}`);
    
    // Process compound terms and normalize search terms
    const rawTerms = processCompoundTerms(field1);
    
    // Normalize terms (account for plurals, etc.)
    const normalizedTerms = normalizeSearchTerms(rawTerms);
    
    // Combine original and normalized terms, removing duplicates
    let searchTerms = [...new Set([...rawTerms, ...normalizedTerms])];
    
    // Remove empty terms and very short terms (< 2 chars)
    searchTerms = searchTerms.filter(term => term && term.length >= 2);
    
    // Abort if no valid search terms
    if (searchTerms.length === 0) {
      return res.json({ results: [] });
    }
    
    console.log(`Processing search terms: ${searchTerms.join(', ')}`);
    
    // Control flags for applying filters
    const shouldApplyOrderRankFilter = useOrderRankFilter === 'true' || useOrderRankFilter === true;
    const shouldApplyTestRankFilter = useTestRankFilter === 'true' || useTestRankFilter === true;
    
    if (shouldApplyOrderRankFilter) {
      console.log("Applying Order Rank filter (1-300) early in the search process");
    }
    
    if (shouldApplyTestRankFilter) {
      console.log("Applying Test Rank filter (1-3000) early in the search process");
    }
    
    // First try fast search using index
    const matchingIndices = fastSearch(searchTerms);
    
    // Determine which records to process
    let recordsToProcess = matchingIndices 
      ? matchingIndices.map(index => loincData[index]) 
      : loincData;
    
    console.log(`Initial set: ${recordsToProcess.length} records`);
    
    // Apply rank filters early if requested
    const beforeCount = recordsToProcess.length;
    
    if (shouldApplyOrderRankFilter || shouldApplyTestRankFilter) {
      recordsToProcess = recordsToProcess.filter(item => {
        let keepRecord = true;
        
        if (shouldApplyOrderRankFilter) {
          const orderRank = parseInt(item.commonOrderRank);
          if (!(orderRank > 0 && orderRank <= 300)) {
            keepRecord = false;
          }
        }
        
        if (shouldApplyTestRankFilter && keepRecord) {
          const testRank = parseInt(item.commonTestRank);
          if (!(testRank > 0 && testRank <= 3000)) {
            keepRecord = false;
          }
        }
        
        return keepRecord;
      });
      
      console.log(`Early rank filters: reduced from ${beforeCount} to ${recordsToProcess.length} records`);
    }
    
    // If not using index or if there are too many records to process,
    // apply pre-filtering to reduce the number of records
    if (!matchingIndices || recordsToProcess.length > 5000) {
      const startPreFilter = Date.now();
      // Pass both filter flags to preFilterRecords
      const preFiltered = preFilterRecords(recordsToProcess, searchTerms, shouldApplyOrderRankFilter, shouldApplyTestRankFilter);
      const endPreFilter = Date.now();
      console.log(`Pre-filtered from ${recordsToProcess.length} to ${preFiltered.length} records in ${endPreFilter - startPreFilter}ms`);
      recordsToProcess = preFiltered;
    }
    
    // Apply must-have filter (field2) early if specified
    if (field2) {
      const beforeField2Count = recordsToProcess.length;
      // Process must-have terms with compound term handling
      const rawMustHaveTerms = processCompoundTerms(field2);
      // 標準化必須包含的詞
      const normalizedMustHaveTerms = normalizeSearchTerms(rawMustHaveTerms);
      // 合併原始詞和標準化詞
      const mustHaveTerms = [...new Set([...rawMustHaveTerms, ...normalizedMustHaveTerms])].filter(term => term && term.length >= 2);
      console.log('Must-have terms:', mustHaveTerms);
      
      if (mustHaveTerms.length > 0) {
        recordsToProcess = recordsToProcess.filter(item => {
          const searchText = [
        item.longCommonName,
        item.component,
        item.relatedNames2
          ].filter(Boolean).join(' ').toLowerCase();
          // 只要匹配任何一個單複數形式即可
          return mustHaveTerms.every(term => {
            const normalizedTerm = normalizeSearchTerms([term])[0];
            return searchText.includes(term) || searchText.includes(normalizedTerm);
          });
        });
        console.log(`After early must-have filter: reduced from ${beforeField2Count} to ${recordsToProcess.length} records`);
      } else {
        console.log('No valid must-have terms, skipping must-have filter.');
      }
    }

    // Limit maximum number of records to process to prevent overload
    if (recordsToProcess.length > 1500) {
      console.log(`Too many records (${recordsToProcess.length}), returning only warning message`);
      
      return res.json({
        tooManyResults: true,
        recordCount: recordsToProcess.length,
        results: [],
        message: "Too many results found. 請勾選 rank filters，或者在 must have 中加上必須出現的字眼，例如 creatine, nipple, 特定關係詞，這樣可以大幅減少搜尋到的結果"
      });
    }
    
    // Calculate scores for matching items
    const startTime = Date.now();
    const results = recordsToProcess.map(item => {
      // Extract the original field1 value and key terms
      const field1Value = field1 || '';
      const keyTerms = extractKeyTerms(field1Value);
      
      // Calculate specific comparison between field1 and longCommonName using distanceArray (Python port)
      const longNameMatchScore = distanceArray(field1Value, item.longCommonName || '');
      
      // Direct term match gets highest score
      const directMatchScore = field1Value.toLowerCase() === (item.longCommonName || '').toLowerCase() ? 100 : 0;
      
      // For component comparison, use specified component field or fallback to key terms
      let componentCompareValue = componentField && componentField.trim() ? componentField.trim() : keyTerms;
      const componentMatchScore = distance(componentCompareValue, item.component || '');
      
      // For system comparison, use specified system field or fallback to field1
      let systemCompareValue = systemField && systemField.trim() ? systemField.trim() : field1Value;
      const systemMatchScore = distance(systemCompareValue, item.specimen || '');
      
      // For related names, use key terms as well
      const relatedNamesMatchScore = distance(keyTerms, item.relatedNames2 || '');
      
      // Compute the weighted score with improved distribution
      let similarityScore = 0;
      
      if (directMatchScore > 0) {
        similarityScore = 100;
      } else {
        // Improved weight distribution: 
        // - 50% for component match (using key terms)
        // - 20% for longCommonName match (using distanceArray from Python port)
        // - 15% for system/specimen match
        // - 15% for relatedNames match (using key terms)
        similarityScore = (componentMatchScore * 0.5) + 
                          (longNameMatchScore * 0.2) + 
                          (systemMatchScore * 0.15) + 
                          (relatedNamesMatchScore * 0.15);
      }
      
      // Ensure similarity score is within 0-100 range
      similarityScore = Math.min(100, Math.max(0, similarityScore));
      
      // Add debug info for testing
      const debugInfo = {
        keyTerms,
        componentCompareValue,
        systemCompareValue,
        longNameMatchScore,
        directMatchScore,
        componentMatchScore,
        systemMatchScore,
        relatedNamesMatchScore,
        finalScore: similarityScore
      };
      
      // Create comprehensive component field with LOINC five axes (values only)
      const comprehensiveComponent = [
        `<span style="color: #e91e63; font-weight: bold;">${item.component || 'N/A'}</span>`,
        `<span style="color: #4caf50;">${item.specimen || 'N/A'}</span>`,
        item.method || 'N/A',
        item.property || 'N/A',
        item.scale || 'N/A',
        item.time || 'N/A'
      ].join(' | ').replace(' | ', '<br>');
      
      return {
        loincNum: item.loincNum,
        component: comprehensiveComponent,
        relatedNames2: item.relatedNames2,
        commonTestRank: item.commonTestRank,
        commonOrderRank: item.commonOrderRank,
        longCommonName: item.longCommonName,
        similarityScore,
        // Add debug info if needed
        debug: debugInfo
      };
    });
    const endTime = Date.now();
    console.log(`Scored ${results.length} records in ${endTime - startTime}ms`);

    // Filter and sort results
    let filteredResults = results
      .filter(item => item.similarityScore > 10) // Lower threshold to get more results
      .sort((a, b) => {
        // First sort by similarity score
        if (b.similarityScore !== a.similarityScore) {
          return b.similarityScore - a.similarityScore;
        }
        // Then sort by common test rank (lower rank = more common)
        return (parseInt(a.commonTestRank) || 999999) - (parseInt(b.commonTestRank) || 999999);
      });

    // If we have very few or no results, no need for a fallback since we're already using a low threshold
    
    // Double-check rank filters in case we missed any
    if (shouldApplyOrderRankFilter || shouldApplyTestRankFilter) {
      const beforeCount = filteredResults.length;
      filteredResults = filteredResults.filter(item => {
        let keepRecord = true;
        
        if (shouldApplyOrderRankFilter) {
          const orderRank = parseInt(item.commonOrderRank);
          if (!(orderRank > 0 && orderRank <= 300)) {
            keepRecord = false;
          }
        }
        
        if (shouldApplyTestRankFilter && keepRecord) {
          const testRank = parseInt(item.commonTestRank);
          if (!(testRank > 0 && testRank <= 3000)) {
            keepRecord = false;
          }
        }
        
        return keepRecord;
      });
      
      if (beforeCount > filteredResults.length) {
        console.log(`Final rank filters cleanup: reduced from ${beforeCount} to ${filteredResults.length} results`);
      }
    }
    
    // Log the search after getting results
    try {
      console.log('Attempting to log search session to database...');
      console.log('Search session details:', {
        session_id: sessionId,
        search_terms: field1,
        must_have_terms: field2,
        filters: JSON.stringify({
          useOrderRankFilter,
          useTestRankFilter
        }),
        ip_address: ip,
        user_agent: userAgent,
        result_count: filteredResults.length,
        search_time_ms: Date.now() - searchStartTime
      });
      
      const [result] = await pool.execute(
        'INSERT INTO search_sessions (session_id, search_terms, must_have_terms, filters, ip_address, user_agent, result_count, search_time_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [sessionId, field1, field2, JSON.stringify({ useOrderRankFilter, useTestRankFilter }), ip, userAgent, filteredResults.length, Date.now() - searchStartTime]
      );
      console.log('Search session logged successfully:', result);
    } catch (logError) {
      console.error('Error logging search session:', logError);
      console.error('Error details:', {
        message: logError.message,
        code: logError.code,
        errno: logError.errno,
        sqlState: logError.sqlState,
        sqlMessage: logError.sqlMessage
      });
    }
    
    // Log total search time
    const searchEndTime = Date.now();
    console.log(`Total search time: ${searchEndTime - searchStartTime}ms, found ${filteredResults.length} results`);

    // Return results with session ID
    res.json({ 
      sessionId,
      results: filteredResults 
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Analyze endpoint
app.post('/api/analyze', async (req, res) => {
  try {
    const { sessionId, results, searchTerms, mustHaveTerms, labDataContext, provider = 'openai' } = req.body;
    
    console.log('Analyze request received:', {
      sessionId,
      resultsCount: results ? results.length : 0,
      searchTerms,
      mustHaveTerms,
      hasLabContext: labDataContext && Object.keys(labDataContext).length > 0
    });
    
    if (labDataContext) {
      console.log('包含實驗室數據背景:', labDataContext);
    }
    
    if (!sessionId || !results || !Array.isArray(results)) {
      return res.status(400).json({ error: 'Invalid request: sessionId and results array required' });
    }

    // Check if results have the necessary fields
    const safeResults = results.map(item => ({
      loincNum: item.loincNum || 'N/A',
      component: item.component || 'N/A',
      longCommonName: item.longCommonName || 'N/A',
      relatedNames2: item.relatedNames2 || 'N/A',
      commonTestRank: item.commonTestRank || 'N/A',
      commonOrderRank: item.commonOrderRank || 'N/A',
      similarityScore: typeof item.similarityScore === 'number' ? item.similarityScore : 0
    }));
    
    // Prepare data for AI analysis
    // 構建實驗室背景資訊
    let labContextText = '';
    if (labDataContext && Object.keys(labDataContext).length > 0) {
      labContextText = `

## 實驗室背景資訊 (請結合此資訊進行更精確的 LOINC 分析):
${labDataContext.labItemName ? `- 檢測項目名稱: ${labDataContext.labItemName}` : ''}
${labDataContext.labUnit ? `- 測量單位: ${labDataContext.labUnit}` : ''}
${labDataContext.labSampleType ? `- 檢體類型: ${labDataContext.labSampleType}` : ''}
${labDataContext.labMeanValue ? `- 平均值: ${labDataContext.labMeanValue}` : ''}
${labDataContext.labMedianValue ? `- 中位數: ${labDataContext.labMedianValue}` : ''}
${labDataContext.labStandardDeviation ? `- 標準差: ${labDataContext.labStandardDeviation}` : ''}
${labDataContext.labTotalRecords ? `- 總記錄數: ${labDataContext.labTotalRecords}` : ''}
${labDataContext.labUniquePatients ? `- 獨特患者數: ${labDataContext.labUniquePatients}` : ''}
${labDataContext.institution ? `- 醫療機構: ${labDataContext.institution}` : ''}
${labDataContext.dataSource ? `- 資料來源: ${labDataContext.dataSource}` : ''}

**請特別參考以上實驗室統計數據來判斷最合適的 LOINC 代碼，特別是單位、數值範圍和檢體類型。**
`;
    }

    const prompt = `
您是一位專精於 LOINC 代碼的醫學術語專家。

搜尋查詢: "${searchTerms || ''}"
${mustHaveTerms ? `必須包含詞語: "${mustHaveTerms}"` : ''}${labContextText}

請用繁體中文回答，專業部分用英文，Based on these search terms${labContextText ? ' and lab metadata' : ''}, analyze the following LOINC code results to identify the most relevant matches:


${safeResults.map(item => `
LOINC: ${item.loincNum}
Component: ${item.component}
Long Common Name: ${item.longCommonName}
Related Names: ${item.relatedNames2}
Common Test Rank: ${item.commonTestRank}
Common Order Rank: ${item.commonOrderRank}
Similarity Score: ${item.similarityScore.toFixed(2)}%
`).join('\n')}


請提供簡明的分析，包含：
相關的 [LOINC 代碼] 以及 Component, Method, Scale, Property, Time, Specimen

**請使用以下格式進行回答，確保每個部分都有充足的換行和間距：**

## 分析結果 <br>

### 1. 最符合搜尋詞語的 LOINC 代碼<br>

（請在這裡說明最相關的代碼及原因，每個段落之間要有空行分隔）<br>

### 2. 選擇相似結果時的考量因素 <br>

（請在這裡列出選擇時應考慮的因素，每個要點之間要有空行分隔）<br>

### 3. 相關組件說明 <br>

（請在這裡簡短解釋最相關的組件，段落之間要有空行分隔）<br>

### 4. LOINC 專家分析意見<br>

（請在這裡提供專業的分析意見和代碼合理性評估，段落之間要有空行分隔）<br>

**重要提醒：**
- 每個標題後面都要有兩個換行
- 每個段落之間都要有空行分隔
- 列表項目之間要有空行分隔
- 確保內容有充足的視覺間距
- **必須在最後包含推薦的 LOINC 代碼，格式為「推薦的 LOINC 代碼：[代碼]」**

### 5. 最佳 LOINC 代碼建議<br>

**請在分析的最後明確推薦一個最佳的 LOINC 代碼，格式如下：**<br>
**推薦的 LOINC 代碼：[LOINC代碼]**<br>

在回答中，請包包含相關所有提到的 LOINC 代碼的 HTML 表格，然後最推薦的擺在第一行，然後 table 中的 cell 用紅色表示，格式如下：
<table border="1" cellspacing="0" cellpadding="3">
<tr>
<th>LOINC Code</th>
<th>Component</th>
<th>Specimen</th>
<th>Method</th>
<th>Property</th>
<th>Scale</th>
<th>Time</th>
<th>Long Common Name</th>
<th> 分析意見 </th>
</tr>
<tr>
<td>2888-6</td>
<td>Protein</td>
<td>Urine</td>
<td>方法</td>
<td>屬性</td>
<td>計量標度</td>
<td>時間點</td>
<td>Protein [Mass/volume] in Urine</td>
<td> 分析意見 </td>
</tr>
</table>

不要將表格包裹在程式碼區塊內，也請勿添加HTML、CSS以外的任何標記。直接使用HTML表格標記。不要使用 \`\`\` 或其他代碼塊標記。
確保表格使用HTML標準的border、cellspacing和cellpadding屬性。
`;

    console.log(`Using ${provider} API`);

    try {
      let response;
      
      if (provider === 'grok' && grokApiKey) {
        // Call Grok API
        response = await axios.post(
          'https://api.x.ai/v1/chat/completions',
          {
            model: "grok-3",
            messages: [
              {
                role: "system",
                content: "您是一位專精於 LOINC 代碼的醫學術語專家，請根據搜尋詞語分析 LOINC 代碼結果，提供臨床相關的繁體中文回答。"
              },
              {
                role: "user",
                content: prompt
              }
            ],
            max_tokens: 1500,
            temperature: 0.7
          },
          {
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Authorization': `Bearer ${grokApiKey}`
            },
            responseType: 'json'
          }
        );
      } else if (provider === 'claude' && anthropicApiKey) {
        // Call Claude API
        response = await axios.post(
          'https://api.anthropic.com/v1/messages',
          {
            model: 'claude-3-5-sonnet-20240620',
            max_tokens: 1500,
            temperature: 0.7,
            system: "您是一位專精於 LOINC 代碼的醫學術語專家，請根據搜尋詞語分析 LOINC 代碼結果，提供臨床相關的繁體中文回答。",
            messages: [
              { role: "user", content: prompt }
            ]
          },
          {
            headers: {
              'x-api-key': anthropicApiKey,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json; charset=utf-8'
            }
          }
        );
        // Convert Claude response format to OpenAI format
        response.data = {
          choices: [{
            message: {
              content: response.data.content[0].text
            }
          }]
        };
      } else {
        // Call OpenAI API (default)
        response = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: "gpt-4.1-nano",
            messages: [
              {
                role: "system",
                content: "您是一位專精於 LOINC 代碼的醫學術語專家，請根據搜尋詞語分析 LOINC 代碼結果，提供臨床相關的繁體中文回答。"
              },
              {
                role: "user",
                content: prompt
              }
            ],
            max_tokens: 1500,
            temperature: 0.7
          },
          {
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Authorization': `Bearer ${openaiApiKey}`
            },
            responseType: 'json'
          }
        );
      }

                  let aiSummary = response.data.choices[0].message.content;
            console.log(`Got answer from ${provider}`);
            console.log(`=== ${provider.toUpperCase()} 回應內容 ===`);
            console.log(aiSummary);
            console.log(`=== ${provider.toUpperCase()} 回應結束 ===`);
      
      // Ensure proper UTF-8 encoding and clean up the response
      if (typeof aiSummary === 'string') {
        // Remove any potential encoding issues
        aiSummary = aiSummary.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
        // Process the summary to ensure HTML tables are properly formatted
        aiSummary = aiSummary.replace(/```html/g, '');
        aiSummary = aiSummary.replace(/```/g, '');
        // Clean up any malformed characters
        aiSummary = aiSummary.replace(/[^\x20-\x7E\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g, '');
      }

      // Extract suggested LOINC code from AI analysis if available
      let suggestedLoincCode = null;
      if (aiSummary) {
        // Look for LOINC code patterns in the analysis (various formats)
        const loincPatterns = [
          /推薦的 LOINC 代碼[：:]\s*(\d+-\d+)/gi,  // 專門匹配推薦格式
          /LOINC[:\s]*(\d+-\d+)/gi,
          /(\d+-\d+)/g,  // Simple pattern for XX-XX format
          /LOINC[:\s]*(\d{5}-\d{1})/gi  // More specific LOINC format
        ];
        
        for (const pattern of loincPatterns) {
          const matches = aiSummary.match(pattern);
          if (matches && matches.length > 0) {
            // Extract the first LOINC code found
            suggestedLoincCode = matches[0].replace(/推薦的 LOINC 代碼[：:]\s*/gi, '').replace(/LOINC[:\s]*/gi, '');
            break;
          }
        }
      }

      // Update the session with AI summary
      try {
        await pool.execute(
          'UPDATE search_sessions SET ai_summary = ? WHERE session_id = ?',
          [aiSummary, sessionId]
        );
        console.log('AI summary logged successfully for session:', sessionId);
      } catch (logError) {
        console.error('Error logging AI summary:', logError);
      }

      res.json({ 
        summary: aiSummary,
        suggestedLoincCode: suggestedLoincCode
      });
    } catch (apiError) {
      console.error('OpenAI API error:', apiError.message);
      console.error('OpenAI API error details:', apiError.response && apiError.response.data ? apiError.response.data : 'No response data');
      console.error('OpenAI API error status:', apiError.response && apiError.response.status ? apiError.response.status : 'No status');
      throw new Error(`OpenAI API error: ${apiError.message}`);
    }
  } catch (error) {
    console.error('Analysis error:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ error: 'Error analyzing results', message: error.message });
  }
});

// Followup endpoint
app.post('/api/followup', async (req, res) => {
  try {
    const { sessionId, question, results, searchTerms, mustHaveTerms } = req.body;
    
    console.log('Followup request received:', {
      sessionId,
      question,
      resultsCount: results ? results.length : 0,
      searchTerms,
      mustHaveTerms
    });
    
    if (!sessionId || !question || !results) {
      return res.status(400).json({ error: 'Invalid request: sessionId, question, and results required' });
    }

    // Get the previous AI analysis from the database
    let previousAnalysis = '無先前分析';
    try {
      if (pool) {
        const [analysisRows] = await pool.execute(
          'SELECT ai_summary FROM search_sessions WHERE session_id = ?',
          [sessionId]
        );
        previousAnalysis = (analysisRows[0] && analysisRows[0].ai_summary) 
          ? analysisRows[0].ai_summary 
          : '無先前分析';
      }
    } catch (error) {
      console.error('Error retrieving previous analysis:', error);
      // Continue without previous analysis
    }

    // Check if results have the necessary fields
    const safeResults = results.map(item => ({
      loincNum: item.loincNum || 'N/A',
      component: item.component || 'N/A',
      longCommonName: item.longCommonName || 'N/A',
      relatedNames2: item.relatedNames2 || 'N/A',
      commonTestRank: item.commonTestRank || 'N/A',
      commonOrderRank: item.commonOrderRank || 'N/A',
      similarityScore: typeof item.similarityScore === 'number' ? item.similarityScore : 0
    }));
    
    // Prepare data for AI analysis with conversation history
    const prompt = `
您是一位專精於 LOINC 代碼的醫學術語專家。


搜尋查詢: "${searchTerms || ''}"
${mustHaveTerms ? `必須包含詞語: "${mustHaveTerms}"` : ''}


以下是 LOINC 代碼搜尋結果:


${safeResults.map(item => `
LOINC: ${item.loincNum}
Component: ${item.component}
Long Common Name: ${item.longCommonName}
Related Names: ${item.relatedNames2 || 'N/A'}
Common Test Rank: ${item.commonTestRank}
Common Order Rank: ${item.commonOrderRank}
Similarity Score: ${item.similarityScore.toFixed(2)}%
`).join('\n')}


您之前的分析:
${previousAnalysis}


用戶的後續問題:
${question}


請用繁體中文回答用戶的後續問題，保持專業性和簡潔性。專業術語可使用英文。

**請使用以下格式進行回答，確保每個部分都有充足的換行和間距：**

## 回答

（請在這裡提供詳細的回答，確保內容有充足的段落分隔和換行）

### 相關 LOINC 代碼比較

因為要讓使用者比較好比較，所有提過的 LOINC 代碼請用表格格式，然後最推薦的擺在第一行，然後表格中最推薦的 LOINC code 的 cell 用紅色表示，然後所有 LOINC code 都要在同一個表格中 然後一樣加上分析意見欄位。

**重要提醒：**
- 每個標題後面都要有兩個換行
- 每個段落之間都要有空行分隔
- 列表項目之間要有空行分隔
- 確保內容有充足的視覺間距


如果需要在回應中提供 LOINC 代碼表格，請使用以下 HTML 格式：
<table border="1" cellspacing="0" cellpadding="3">
<tr>
<th>LOINC Code</th>
<th>Component</th>
<th>Specimen</th>
<th>Method</th>
<th>Property</th>
<th>Scale</th>
<th>Time</th>
<th>Long Common Name</th>
</tr>
<tr>
<td>2888-6</td>
<td>Protein</td>
<td>Urine</td>
<td>方法</td>
<td>屬性</td>
<td>計量標度</td>
<td>時間點</td>
<td>Protein [Mass/volume] in Urine</td>
</tr>
</table>

不要將表格包裹在程式碼區塊內，也請勿添加HTML、CSS以外的任何標記。直接使用HTML表格標記。不要使用 \`\`\` 或其他代碼塊標記。
確保表格使用HTML標準的border、cellspacing和cellpadding屬性。
`;

    console.log('Using OpenAI API');
    
    // Call OpenAI API
    try {
    const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
      {
          model: "gpt-4.1-nano",
        messages: [
            {
              role: "system",
              content: "您是一位專精於 LOINC 代碼的醫學術語專家，請根據搜尋詞語分析 LOINC 代碼結果，提供臨床相關的繁體中文回答。"
            },
            {
              role: "user",
              content: prompt
            }
          ],
          max_tokens: 1500,
          temperature: 0.7
      },
      {
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Authorization': `Bearer ${openaiApiKey}`
          },
          responseType: 'json'
        }
      );

      let answer = response.data.choices[0].message.content;
      console.log('Got answer from OpenAI');
      
      // Ensure proper UTF-8 encoding and clean up the response
      if (typeof answer === 'string') {
        // Remove any potential encoding issues
        answer = answer.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
        // Clean up any malformed characters
        answer = answer.replace(/[^\x20-\x7E\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g, '');
      }

      // Get existing chat log
      // Log the followup question and answer to database (optional)
      let chatLog = [];
      try {
        if (pool) {
          const [rows] = await pool.execute(
            'SELECT ai_chat_log FROM search_sessions WHERE session_id = ?',
            [sessionId]
          );

          // Update chat log
          if (rows[0] && rows[0].ai_chat_log) {
            try {
              chatLog = JSON.parse(rows[0].ai_chat_log);
            } catch (e) {
              console.error('Error parsing chat log:', e);
              chatLog = [];
            }
          }
        }
      } catch (error) {
        console.error('Error retrieving chat log:', error);
        // Continue without existing chat log
      }
      
      // Process the answer to ensure HTML tables are properly formatted
      let processedAnswer = answer;
      // Fix any problematic table code that might have code blocks
      processedAnswer = processedAnswer.replace(/```html/g, '');
      processedAnswer = processedAnswer.replace(/```/g, '');
      
      chatLog.push({
        timestamp: new Date().toISOString(),
        question,
        answer: processedAnswer
      });

      // Update the session with new chat log
      try {
        if (pool) {
          await pool.execute(
            'UPDATE search_sessions SET ai_chat_log = ? WHERE session_id = ?',
            [JSON.stringify(chatLog), sessionId]
          );
          console.log('Chat log updated successfully for session:', sessionId);
        }
      } catch (logError) {
        console.error('Error updating chat log:', logError);
        // Continue without logging to database
      }

      res.json({ answer: processedAnswer });
    } catch (apiError) {
      console.error('OpenAI API error:', apiError.message);
      console.error('OpenAI API error details:', apiError.response && apiError.response.data ? apiError.response.data : 'No response data');
      console.error('OpenAI API error status:', apiError.response && apiError.response.status ? apiError.response.status : 'No status');
      throw new Error(`OpenAI API error: ${apiError.message}`);
    }
  } catch (error) {
    console.error('Followup error:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ error: 'Error processing followup question', message: error.message });
  }
});

// AI Mapping Suggestions endpoint
app.post('/api/generate-mapping-suggestions', async (req, res) => {
  try {
    const { sessionId, selectedLoincCodes, originalSearchTerms, provider = 'openai' } = req.body;
    
    if (!sessionId || !selectedLoincCodes || !Array.isArray(selectedLoincCodes)) {
      return res.status(400).json({ error: 'Invalid request: sessionId and selectedLoincCodes array required' });
    }

    console.log('Generate mapping suggestions request received:', {
      sessionId,
      selectedLoincCodesCount: selectedLoincCodes.length,
      originalSearchTerms
    });

    // Get detailed LOINC information for selected codes
    const loincDetails = selectedLoincCodes.map(code => {
      const loincItem = loincData.find(item => item.loincNum === code);
      if (loincItem) {
        return {
          loincNum: loincItem.loincNum,
          component: loincItem.component,
          specimen: loincItem.specimen,
          method: loincItem.method,
          property: loincItem.property,
          scale: loincItem.scale,
          time: loincItem.time,
          relatedNames2: loincItem.relatedNames2,
          commonTestRank: loincItem.commonTestRank,
          commonOrderRank: loincItem.commonOrderRank,
          longCommonName: loincItem.longCommonName
        };
      }
      return null;
    }).filter(Boolean);

    // Prepare data for AI mapping analysis
    const prompt = `
您是一位專精於 LOINC 代碼映射的醫學術語專家。

原始搜尋查詢: "${originalSearchTerms || ''}"

用戶選擇的 LOINC 代碼:
${loincDetails.map(item => `
LOINC: ${item.loincNum}
Component: ${item.component}
Specimen: ${item.specimen}
Method: ${item.method}
Property: ${item.property}
Scale: ${item.scale}
Time: ${item.time}
Long Common Name: ${item.longCommonName}
Related Names: ${item.relatedNames2}
Common Test Rank: ${item.commonTestRank}
Common Order Rank: ${item.commonOrderRank}
`).join('\n')}

請提供詳細的映射分析，包含：

## 映射分析結果

### 1. 選擇的 LOINC 代碼評估
（請評估每個選擇的代碼與原始搜尋查詢的相關性）

### 2. 臨床應用建議
（請說明這些 LOINC 代碼在臨床上的應用場景）

### 3. 映射合理性分析
（請分析這些映射選擇是否合理，並提供改進建議）

### 4. 相關組件詳細說明
（請詳細解釋每個 LOINC 代碼的組件含義）

### 5. 專家建議
（請提供專業的映射建議和注意事項）

### 6. 最佳 LOINC 代碼建議
**請在分析的最後明確推薦一個最佳的 LOINC 代碼，格式如下：**
**推薦的 LOINC 代碼：[LOINC代碼]**

**重要提醒：**
- 每個標題後面都要有兩個換行
- 每個段落之間都要有空行分隔
- 列表項目之間要有空行分隔
- 確保內容有充足的視覺間距
- **必須在最後包含推薦的 LOINC 代碼，格式為「推薦的 LOINC 代碼：[代碼]」**

請用繁體中文回答，專業術語可使用英文。
`;

    console.log(`Using ${provider.toUpperCase()} API for mapping suggestions`);

    try {
      let aiMappingAnalysis;
      
      if (provider === 'grok' && grokApiKey) {
        // Use Grok API
        const response = await axios.post(
          'https://api.x.ai/v1/chat/completions',
          {
            model: 'grok-3',
            messages: [
              {
                role: "system",
                content: "您是一位專精於 LOINC 代碼映射的醫學術語專家，請根據用戶選擇的 LOINC 代碼提供詳細的映射分析，使用繁體中文回答。"
              },
              {
                role: "user",
                content: prompt
              }
            ],
            max_tokens: 2000,
            temperature: 0.7
          },
          {
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Authorization': `Bearer ${grokApiKey}`
            },
            responseType: 'json'
          }
        );
        aiMappingAnalysis = response.data.choices[0].message.content;
        console.log('Got mapping analysis from Grok');
      } else if (provider === 'claude' && anthropicApiKey) {
        // Use Anthropic Claude
        const response = await axios.post(
          'https://api.anthropic.com/v1/messages',
          {
            model: 'claude-3-5-sonnet-20240620',
            max_tokens: 2000,
            temperature: 0.7,
            system: '您是一位專精於 LOINC 代碼映射的醫學術語專家，請根據用戶選擇的 LOINC 代碼提供詳細的映射分析，使用繁體中文回答。',
            messages: [
              { role: 'user', content: prompt }
            ]
          },
          {
            headers: {
              'x-api-key': anthropicApiKey,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json; charset=utf-8'
            }
          }
        );
        aiMappingAnalysis = response.data && response.data.content && response.data.content[0] && response.data.content[0].text || "";
        console.log('Got mapping analysis from Claude');
      } else {
        // Use OpenAI (default)
        const response = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: "您是一位專精於 LOINC 代碼映射的醫學術語專家，請根據用戶選擇的 LOINC 代碼提供詳細的映射分析，使用繁體中文回答。"
              },
              {
                role: "user",
                content: prompt
              }
            ],
            max_tokens: 2000,
            temperature: 0.7
          },
          {
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Authorization': `Bearer ${openaiApiKey}`
            },
            responseType: 'json'
          }
        );
        aiMappingAnalysis = response.data.choices[0].message.content;
        console.log('Got mapping analysis from OpenAI');
      }
      
      // Ensure proper UTF-8 encoding and clean up the response
      if (typeof aiMappingAnalysis === 'string') {
        // Remove any potential encoding issues
        aiMappingAnalysis = aiMappingAnalysis.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
        // Clean up any malformed characters
        aiMappingAnalysis = aiMappingAnalysis.replace(/[^\x20-\x7E\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g, '');
      }

      // Store the mapping suggestion in database
      try {
        await pool.execute(
          'INSERT INTO ai_mapping_suggestions (session_id, original_search_terms, selected_loinc_codes, ai_mapping_analysis, loinc_details) VALUES (?, ?, ?, ?, ?)',
          [
            sessionId,
            originalSearchTerms,
            JSON.stringify(selectedLoincCodes),
            aiMappingAnalysis,
            JSON.stringify(loincDetails)
          ]
        );
        console.log('Mapping suggestion stored successfully for session:', sessionId);
      } catch (logError) {
        console.error('Error storing mapping suggestion:', logError);
      }

      // Extract suggested LOINC code from AI analysis if available
      let suggestedLoincCode = null;
      if (aiMappingAnalysis) {
        // Look for LOINC code patterns in the analysis (various formats)
        const loincPatterns = [
          /推薦的 LOINC 代碼[：:]\s*(\d+-\d+)/gi,  // 專門匹配推薦格式
          /LOINC[:\s]*(\d+-\d+)/gi,
          /(\d+-\d+)/g,  // Simple pattern for XX-XX format
          /LOINC[:\s]*(\d{5}-\d{1})/gi  // More specific LOINC format
        ];
        
        for (const pattern of loincPatterns) {
          const matches = aiMappingAnalysis.match(pattern);
          if (matches && matches.length > 0) {
            // Extract the first LOINC code found
            suggestedLoincCode = matches[0].replace(/推薦的 LOINC 代碼[：:]\s*/gi, '').replace(/LOINC[:\s]*/gi, '');
            break;
          }
        }
      }

      res.json({ 
        mappingAnalysis: aiMappingAnalysis,
        loincDetails: loincDetails,
        suggestedLoincCode: suggestedLoincCode
      });
    } catch (apiError) {
      console.error('OpenAI API error:', apiError.message);
      console.error('OpenAI API error details:', apiError.response && apiError.response.data ? apiError.response.data : 'No response data');
      throw new Error(`OpenAI API error: ${apiError.message}`);
    }
  } catch (error) {
    console.error('Mapping suggestions error:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ error: 'Error generating mapping suggestions', message: error.message });
  }
});

// LOINC Input Translation endpoint
app.post('/api/translate-input', async (req, res) => {
  try {
    const { userInput, labDataContext, provider = 'openai' } = req.body;
    
    if (!userInput || userInput.trim() === '') {
      return res.status(400).json({ error: '請提供輸入內容' });
    }

    console.log(`處理 LOINC 名稱轉換請求: "${userInput}"`);
    if (labDataContext) {
      console.log('包含實驗室數據背景:', labDataContext);
    }
    
    // 構建實驗室背景資訊
    let labContextText = '';
    if (labDataContext && Object.keys(labDataContext).length > 0) {
      labContextText = `

## 實驗室背景資訊 (請參考以下資訊來提供更精確的LOINC建議)：
${labDataContext.labItemName ? `- 檢測項目名稱: ${labDataContext.labItemName}` : ''}
${labDataContext.labUnit ? `- 測量單位: ${labDataContext.labUnit}` : ''}
${labDataContext.labSampleType ? `- 檢體類型: ${labDataContext.labSampleType}` : ''}
${labDataContext.labMeanValue ? `- 平均值: ${labDataContext.labMeanValue}` : ''}
${labDataContext.labMedianValue ? `- 中位數: ${labDataContext.labMedianValue}` : ''}
${labDataContext.labStandardDeviation ? `- 標準差: ${labDataContext.labStandardDeviation}` : ''}
${labDataContext.labTotalRecords ? `- 總記錄數: ${labDataContext.labTotalRecords}` : ''}
${labDataContext.labUniquePatients ? `- 獨特患者數: ${labDataContext.labUniquePatients}` : ''}
${labDataContext.institution ? `- 醫療機構: ${labDataContext.institution}` : ''}
${labDataContext.dataSource ? `- 資料來源: ${labDataContext.dataSource}` : ''}

這些資訊可以幫助您更準確地判斷檢測的性質、範圍和背景。`;
    }
    
    // 準備給 AI 的提示
    const prompt = `
您是一位 LOINC 編碼專家，請幫我分析以下用戶輸入並提供結構化的搜索建議。

用戶輸入: "${userInput}"${labContextText}

此輸入可能是中文描述、醫學縮寫、不完整描述或非標準表達。請分析並提供以下結構化建議：

您的任務：
1. 分析輸入中的關鍵醫學概念
2. 提取檢測的核心成分 (Component) - 參考實驗室背景資訊
3. 識別檢體類型 (System/Specimen) - 參考檢體類型資訊
4. 建議適當的搜索詞 - 結合單位、數值範圍等背景資訊
5. 不要用縮寫，有縮寫一律使用全名

請嚴格按照以下 JSON 格式回應，不要添加其他文字：

{
  "component": "檢測成分英文名稱",
  "system": "檢體類型英文名稱", 
  "searchTerms": "建議搜索詞",
  "explanation": "中文說明"
}

範例輸入: "血液中的紅血球計數"
範例輸出:
{
  "component": "Erythrocytes",
  "system": "Blood",
  "searchTerms": "Erythrocytes count Blood",
  "explanation": "RBC紅血球計數，檢體為血液"
}

重要：只返回JSON，不要有其他文字或符號。
`;

    console.log(`Using ${provider} API`);

    try {
      let response;
      
      if (provider === 'grok' && grokApiKey) {
        // 呼叫 Grok API
        response = await axios.post(
          'https://api.x.ai/v1/chat/completions',
          {
            model: "grok-3",
            messages: [
              { role: "system", content: "您是一位專業的 LOINC 編碼專家，熟悉各種醫學術語、檢查項目和實驗室測試。您特別擅長結合實驗室的統計數據（如平均值、標準差、單位等）來推斷合適的LOINC編碼。當有實驗室背景資訊時，請利用這些資訊來提供更精確的Component和System建議。請嚴格按照要求的 JSON 格式回應，不要添加任何額外文字或解釋。" },
              { role: "user", content: prompt }
            ],
            max_tokens: 1000,
            temperature: 0.3
          },
          {
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Authorization': `Bearer ${grokApiKey}`
            },
            responseType: 'json'
          }
        );
      } else if (provider === 'claude' && anthropicApiKey) {
        // 呼叫 Claude API
        response = await axios.post(
          'https://api.anthropic.com/v1/messages',
          {
            model: 'claude-3-5-sonnet-20240620',
            max_tokens: 1000,
            temperature: 0.3,
            system: "您是一位專業的 LOINC 編碼專家，熟悉各種醫學術語、檢查項目和實驗室測試。您特別擅長結合實驗室的統計數據（如平均值、標準差、單位等）來推斷合適的LOINC編碼。當有實驗室背景資訊時，請利用這些資訊來提供更精確的Component和System建議。請嚴格按照要求的 JSON 格式回應，不要添加任何額外文字或解釋。",
            messages: [
              { role: "user", content: prompt }
            ]
          },
          {
            headers: {
              'x-api-key': anthropicApiKey,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json; charset=utf-8'
            }
          }
        );
        // Convert Claude response format to OpenAI format
        response.data = {
          choices: [{
            message: {
              content: response.data.content[0].text
            }
          }]
        };
      } else {
        // 呼叫 OpenAI API (default)
        response = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: "gpt-4o",
            messages: [
              { role: "system", content: "您是一位專業的 LOINC 編碼專家，熟悉各種醫學術語、檢查項目和實驗室測試。您特別擅長結合實驗室的統計數據（如平均值、標準差、單位等）來推斷合適的LOINC編碼。當有實驗室背景資訊時，請利用這些資訊來提供更精確的Component和System建議。請嚴格按照要求的 JSON 格式回應，不要添加任何額外文字或解釋。" },
              { role: "user", content: prompt }
            ],
            max_tokens: 1000,
            temperature: 0.3
          },
          {
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Authorization': `Bearer ${openaiApiKey}`
            },
            responseType: 'json'
          }
        );
      }

    // 提取 AI 回應
      let aiResponse = response.data.choices[0].message.content;
      console.log(`Got answer from ${provider}`);
      
      // Ensure proper UTF-8 encoding and clean up the response
      if (typeof aiResponse === 'string') {
        // Remove any potential encoding issues
        aiResponse = aiResponse.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
        // Clean up any malformed characters
        aiResponse = aiResponse.replace(/[^\x20-\x7E\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g, '');
      }
      
      try {
        // Clean up AI response for better JSON parsing
        let cleanedResponse = aiResponse.trim();
        
        // Remove markdown code blocks if present
        cleanedResponse = cleanedResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        
        // Remove any text before the first { or after the last }
        const jsonStart = cleanedResponse.indexOf('{');
        const jsonEnd = cleanedResponse.lastIndexOf('}');
        
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          cleanedResponse = cleanedResponse.substring(jsonStart, jsonEnd + 1);
        }
        
        console.log('Cleaned AI response for JSON parsing:', cleanedResponse);
        
        // Try to parse as JSON
        const suggestions = JSON.parse(cleanedResponse);
        
        console.log('輸入轉換完成 (結構化格式)');
        
        // 返回結構化建議
    res.json({ 
      originalInput: userInput,
          suggestions: suggestions
        });
      } catch (jsonError) {
        console.log('JSON 解析失敗，原始回應:', aiResponse);
        console.log('JSON 錯誤:', jsonError.message);
        console.log('回退到舊格式');
        
        // Fallback to old format if JSON parsing fails
        const cleanedResponse = aiResponse.replace(/["""'']/g, '');
        const translatedTerms = cleanedResponse.split(';').map(term => term.trim());
        
        console.log('輸入轉換完成 (舊格式)');
        
        // 返回舊格式結果
        res.json({ 
          originalInput: userInput,
          translatedTerms: translatedTerms
        });
      }
    } catch (apiError) {
      console.error('OpenAI API error:', apiError.message);
      console.error('OpenAI API error details:', apiError.response && apiError.response.data ? apiError.response.data : 'No response data');
      console.error('OpenAI API error status:', apiError.response && apiError.response.status ? apiError.response.status : 'No status');
      throw new Error(`OpenAI API error: ${apiError.message}`);
    }
  } catch (error) {
    console.error('輸入轉換錯誤:', error);
    res.status(500).json({ 
      error: '處理轉換請求時發生錯誤',
      message: error.message 
    });
  }
});

// Add new endpoints for search history
app.get('/api/logs', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM search_logs ORDER BY created_at DESC LIMIT 1000');
        res.json({ logs: rows });
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/logs/stats', async (req, res) => {
    try {
        const [totalSearches] = await pool.execute('SELECT COUNT(*) as count FROM search_logs');
        const [avgTime] = await pool.execute('SELECT AVG(search_time_ms) as avg_time FROM search_logs');
        const [mostCommon] = await pool.execute(`
            SELECT search_terms, COUNT(*) as count 
            FROM search_logs 
            GROUP BY search_terms 
            ORDER BY count DESC 
            LIMIT 1
        `);

        res.json({
            totalSearches: totalSearches[0].count,
            avgSearchTime: Math.round(avgTime[0].avg_time || 0),
            mostCommonSearch: (mostCommon[0] && mostCommon[0].search_terms) || 'No searches yet'
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin API endpoints
app.get('/api/admin/logs', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                session_id, 
                search_terms, 
                created_at, 
                updated_at, 
                ip_address, 
                user_agent, 
                result_count, 
                search_time_ms,
                ai_summary IS NOT NULL as has_ai_summary,
                ai_chat_log IS NOT NULL AND ai_chat_log != '[]' as has_chat_log
            FROM 
                search_sessions 
            ORDER BY 
                created_at DESC
        `);
        
        res.json(rows);
    } catch (error) {
        console.error('Error fetching search logs:', error);
        res.status(500).json({ error: 'Error fetching search logs' });
    }
});

app.get('/api/admin/logs/:sessionId/summary', async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        const [rows] = await pool.query(
            'SELECT session_id, search_terms, ai_summary FROM search_sessions WHERE session_id = ?',
            [sessionId]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        res.json(rows[0]);
    } catch (error) {
        console.error('Error fetching AI summary:', error);
        res.status(500).json({ error: 'Error fetching AI summary' });
    }
});

app.get('/api/admin/logs/:sessionId/chat', async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        const [rows] = await pool.query(
            'SELECT session_id, search_terms, ai_chat_log FROM search_sessions WHERE session_id = ?',
            [sessionId]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        res.json(rows[0]);
    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({ error: 'Error fetching chat history' });
    }
});

// Get mapping suggestions for a session
app.get('/api/mapping-suggestions/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        const [rows] = await pool.query(
            'SELECT * FROM ai_mapping_suggestions WHERE session_id = ? ORDER BY created_at DESC',
            [sessionId]
        );
        
        res.json({ mappingSuggestions: rows });
    } catch (error) {
        console.error('Error fetching mapping suggestions:', error);
        res.status(500).json({ error: 'Error fetching mapping suggestions' });
    }
});

// Get all mapping suggestions (admin)
app.get('/api/admin/mapping-suggestions', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                ams.*,
                ss.search_terms,
                ss.created_at as search_created_at
            FROM ai_mapping_suggestions ams
            LEFT JOIN search_sessions ss ON ams.session_id = ss.session_id
            ORDER BY ams.created_at DESC
            LIMIT 1000
        `);
        
        res.json({ mappingSuggestions: rows });
    } catch (error) {
        console.error('Error fetching all mapping suggestions:', error);
        res.status(500).json({ error: 'Error fetching mapping suggestions' });
    }
});

// Translation endpoint for Ask Stan
app.post('/api/translate-to-english', async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text || text.trim() === '') {
            return res.status(400).json({ error: '請提供要翻譯的內容' });
        }

        console.log(`翻譯請求: "${text.substring(0, 100)}..."`);
        
        // 準備給 AI 的提示
        const prompt = `
請將以下中文內容翻譯成英文，保持專業醫學術語的準確性：

${text}

請確保：
1. 醫學術語使用標準英文表達
2. 保持原文的結構和格式
3. 專業術語保持準確性
4. 輸出純英文，無需額外解釋
`;

        console.log('Using OpenAI API for translation');

        try {
            // 呼叫 OpenAI API
            const response = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: "gpt-4.1-nano",
                    messages: [
                        { role: "system", content: "您是一位專業的醫學翻譯專家，請將中文醫學內容準確翻譯成英文。" },
                        { role: "user", content: prompt }
                    ],
                    max_tokens: 2000,
                    temperature: 0.3
                },
                {
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8',
                        'Authorization': `Bearer ${openaiApiKey}`
                    },
                    responseType: 'json'
                }
            );

            // 提取 AI 回應
            let translatedText = response.data.choices[0].message.content;
            console.log('翻譯完成');
            
            // Ensure proper UTF-8 encoding and clean up the response
            if (typeof translatedText === 'string') {
                translatedText = translatedText.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
                translatedText = translatedText.replace(/[^\x20-\x7E\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g, '');
            }
            
            res.json({ 
                originalText: text,
                translatedText: translatedText
            });
        } catch (apiError) {
            console.error('OpenAI API error:', apiError.message);
            throw new Error(`OpenAI API error: ${apiError.message}`);
        }
    } catch (error) {
        console.error('翻譯錯誤:', error);
        res.status(500).json({ 
            error: '處理翻譯請求時發生錯誤',
            message: error.message 
        });
    }
});

// Function to generate PDF for Ask Stan data
async function generateAskStanPDF(englishContent, targetDir, options = {}) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `ask_stan_${timestamp}.pdf`;
    const filepath = path.join(targetDir, filename);
    const asBuffer = options.asBuffer === true;
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ],
        // Additional options for remote servers
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        timeout: 30000
    });
    
    try {
        const page = await browser.newPage();
        
        // Create HTML content for PDF
        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Ask Stan - LOINC Mapping Report</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    margin: 0;
                    padding: 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                    background: white;
                    border-radius: 10px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                    overflow: hidden;
                }
                .header {
                    background: linear-gradient(135deg, #1a73e8, #4285f4);
                    color: white;
                    padding: 30px;
                    text-align: center;
                }
                .header h1 {
                    margin: 0;
                    font-size: 2.5em;
                    font-weight: 300;
                }
                .header .subtitle {
                    margin: 10px 0 0 0;
                    font-size: 1.2em;
                    opacity: 0.9;
                }
                .content {
                    padding: 5px;
                }
                .section {
                    margin-bottom: 5px;
                    border-left: 4px solid #4285f4;
                    padding-left: 10px;
                }
                .section h2 {
                    color: #1a73e8;
                    margin-top: 0;
                    font-size: 1.5em;
                    border-bottom: 2px solid #e8f0fe;
                    padding-bottom: 2px;
                }
                .section h3 {
                    color: #5f6368;
                    margin-top: 10px;
                    font-size: 1.2em;
                }
                .info-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                    margin: 10px 0;
                }
                .info-item {
                    background: #f8f9fa;
                    padding: 8px;
                    border-radius: 8px;
                    border-left: 4px solid #34a853;
                }
                .info-label {
                    font-weight: bold;
                    color: #5f6368;
                    font-size: 0.9em;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .info-value {
                    color: #202124;
                    margin-top: 5px;
                    font-size: 1.1em;
                }
                .loinc-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 20px 0;
                    background: white;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                .loinc-table th {
                    background: linear-gradient(135deg, #1a73e8, #4285f4);
                    color: white;
                    padding: 15px;
                    text-align: left;
                    font-weight: 600;
                }
                .loinc-table td {
                    padding: 12px 15px;
                    border-bottom: 1px solid #e8f0fe;
                }
                .loinc-table tr:nth-child(even) {
                    background: #f8f9fa;
                }
                .loinc-table tr:hover {
                    background: #e8f0fe;
                }
                .loinc-code {
                    font-family: 'Courier New', monospace;
                    font-weight: bold;
                    color: #1a73e8;
                    background: #e8f0fe;
                    padding: 4px 8px;
                    border-radius: 4px;
                }
                .analysis-box {
                    background: linear-gradient(135deg, #e8f5e8, #f0f8f0);
                    border: 1px solid #34a853;
                    border-radius: 8px;
                    padding: 5px;
                    margin: 2px 0;
                }
                .analysis-box h3 {
                    color: #137333;
                    margin-top: 0;
                }
                .notes-box {
                    background: linear-gradient(135deg, #fff3e0, #fef7e0);
                    border: 1px solid #f9ab00;
                    border-radius: 8px;
                    padding: 5px;
                    margin: 2px 0;
                }
                .notes-box h3 {
                    color: #b06000;
                    margin-top: 0;
                }
                .notes-box p {
                    margin: 0;
                    padding: 0;
                    line-height: 1.2;
                }
                .analysis-box div {
                    margin: 0;
                    padding: 0;
                    line-height: 1.2;
                }
                .timestamp {
                    text-align: center;
                    color: #5f6368;
                    font-size: 0.9em;
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #e8f0fe;
                }
                .highlight {
                    background: linear-gradient(120deg, #a8edea 0%, #fed6e3 100%);
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-weight: 500;
                }
                .lab-context-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                    gap: 8px;
                    margin: 10px 0;
                    font-size: 0.7rem;
                }
                .lab-context-item {
                    border-radius: 4px;
                    padding: 6px;
                    margin: 2px;
                }
                .lab-context-item.highlighted {
                    background: linear-gradient(135deg, #ffebee, #ffcdd2);
                    border: 1px solid #f44336;
                    box-shadow: 0 1px 4px rgba(244, 67, 54, 0.2);
                }
                .lab-context-item.normal {
                    background: #f8f9fa;
                    border: 1px solid #dee2e6;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                }
                .lab-context-label {
                    margin-bottom: 3px;
                    font-size: 0.6rem;
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                    padding-bottom: 2px;
                }
                .lab-context-item.highlighted .lab-context-label {
                    font-weight: normal;
                    color: #212529;
                    border-bottom: 1px solid #dee2e6;
                }
                .lab-context-item.normal .lab-context-label {
                    font-weight: normal;
                    color: #6c757d;
                    border-bottom: 1px solid #dee2e6;
                }
                .lab-context-value {
                    font-size: 0.7rem;
                    word-break: break-word;
                }
                .lab-context-item.highlighted .lab-context-value {
                    color: #b71c1c !important;
                    font-weight: bold !important;
                    font-size: 1.4rem !important;
                }
                .lab-context-item.normal .lab-context-value {
                    color: #212529;
                    font-weight: normal;
                }
                .loinc-table-container {
                    width: 100%;
                    overflow-x: auto;
                    margin: 20px 0;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                }
                .loinc-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.65rem;
                    table-layout: fixed;
                }
                .loinc-table th,
                .loinc-table td {
                    border: 1px solid #ddd;
                    padding: 4px 3px;
                    text-align: left;
                    vertical-align: top;
                    overflow: hidden;
                }
                .loinc-table th {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    font-weight: bold;
                    font-size: 0.65rem;
                    text-align: center;
                    position: sticky;
                    top: 0;
                    z-index: 10;
                }
                .loinc-table td {
                    font-size: 0.65rem;
                    line-height: 1.4;
                }
                .loinc-table tr:nth-child(even) {
                    background-color: #f8f9fa;
                }
                .loinc-table tr:hover {
                    background-color: #e3f2fd;
                }
                .loinc-code {
                    font-weight: bold;
                    color: #1976d2;
                    font-family: 'Courier New', monospace;
                    font-size: 0.7rem;
                }
                .loinc-code-col {
                    width: 12%;
                    white-space: nowrap;
                }
                .component-col {
                    width: 20%;
                    word-break: break-word;
                    white-space: normal;
                    line-height: 1.2;
                }
                .specimen-col {
                    width: 8%;
                    text-align: center;
                    white-space: nowrap;
                }
                .method-col {
                    width: 10%;
                    word-break: break-word;
                    white-space: normal;
                    line-height: 1.2;
                }
                .property-col {
                    width: 8%;
                    text-align: center;
                    white-space: nowrap;
                }
                .scale-col {
                    width: 8%;
                    text-align: center;
                    white-space: nowrap;
                }
                .time-col {
                    width: 8%;
                    text-align: center;
                    white-space: nowrap;
                }
                .long-name-col {
                    width: 26%;
                    word-break: break-word;
                    white-space: normal;
                    line-height: 1.2;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Ask Stan</h1>
                    <div class="subtitle">LOINC Mapping Analysis Report</div>
                </div>
                
                <div class="content">
                    ${englishContent.fileNotes ? `
                    <div class="section">
                        <h2>Mapping Question</h2>
                        <div class="notes-box">
                            <p>${englishContent.fileNotes}</p>
                        </div>
                    </div>
                    ` : ''}
                    ${englishContent.labDataContext ? `
                    <div class="section">
                        <h2>Laboratory Data Context</h2>
                        <div class="lab-context-grid">
                            ${Object.entries(englishContent.labDataContext)
                                .filter(([key, value]) => value && value !== 'null' && value !== null)
                                .sort(([a], [b]) => {
                                    const fieldOrder = ['labItemName', 'labSampleType', 'labUnit', 'itemRank', 'labTotalRecords', 'labUniquePatients', 'labMissingValues', 'labMeanValue', 'labMedianValue', 'institution', 'institutionType', 'institutionLocation', 'itemId', 'dataSource', 'timestamp', 'source'];
                                    return fieldOrder.indexOf(a) - fieldOrder.indexOf(b);
                                })
                                .map(([key, value]) => {
                                const labelMap = {
                                    labItemName: 'Laboratory Item Name',
                                    labUnit: 'Unit',
                                    labSampleType: 'Sample Type',
                                    itemRank: 'Rank',
                                    labTotalRecords: 'Total Records',
                                    labUniquePatients: 'Unique Patients',
                                    labMissingValues: 'Missing Values',
                                    labMeanValue: 'Mean Value',
                                    labMedianValue: 'Median Value',
                                    institution: 'Institution',
                                    institutionType: 'Institution Type',
                                    institutionLocation: 'Institution Location',
                                    itemId: 'Item ID',
                                    dataSource: 'Data Source'
                                };
                                
                                // Define field order - Laboratory Name, Sample Type, Unit, Rank first, then other fields
                                const fieldOrder = ['labItemName', 'labSampleType', 'labUnit', 'itemRank', 'labTotalRecords', 'labUniquePatients', 'labMissingValues', 'labMeanValue', 'labMedianValue', 'institution', 'institutionType', 'institutionLocation', 'itemId', 'dataSource', 'timestamp', 'source'];
                                const label = labelMap[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                                // Define which fields should be highlighted
                                const highlightFields = ['itemRank', 'labItemName', 'labUnit', 'labSampleType'];
                                const isHighlighted = highlightFields.includes(key);
                                
                                return `
                                    <div class="lab-context-item ${isHighlighted ? 'highlighted' : 'normal'}">
                                        <div class="lab-context-label">${label}</div>
                                        <div class="lab-context-value">${value}</div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    ` : ''}
                    
                    <div class="section">
                        <h2>Laboratory Local Code Information</h2>
                        <div class="info-grid">
                            <div class="info-item">
                                <div class="info-label">Search Terms</div>
                                <div class="info-value">${englishContent.laboratoryLocalCode.searchTerms || 'N/A'}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Must Have Terms</div>
                                <div class="info-value">${englishContent.laboratoryLocalCode.mustHaveTerms || 'N/A'}</div>
                            </div>
                        </div>
                        
                    </div>
                    
                    <div class="section">
                        <h2>Selected LOINC Codes</h2>
                        <p><span class="highlight">${englishContent.selectedLoincCodes.length}</span> LOINC code(s) selected for analysis</p>
                        
                        <div class="loinc-table-container">
                            <table class="loinc-table">
                                <thead>
                                    <tr>
                                        <th class="loinc-code-col">LOINC Code</th>
                                        <th class="component-col">Component</th>
                                        <th class="specimen-col">Specimen</th>
                                        <th class="method-col">Method</th>
                                        <th class="property-col">Property</th>
                                        <th class="scale-col">Scale</th>
                                        <th class="time-col">Time</th>
                                        <th class="long-name-col">Long Common Name</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${englishContent.loincDetails.map(detail => `
                                    <tr>
                                        <td class="loinc-code-col"><span class="loinc-code">${detail.loincCode}</span></td>
                                        <td class="component-col">${detail.component}</td>
                                        <td class="specimen-col">${detail.specimen || 'Blood'}</td>
                                        <td class="method-col">${detail.method || 'Automated count'}</td>
                                        <td class="property-col">${detail.property || 'Ratio'}</td>
                                        <td class="scale-col">${detail.scale || 'Quantitative'}</td>
                                        <td class="time-col">${detail.time || 'Point in time'}</td>
                                        <td class="long-name-col">${detail.longCommonName}</td>
                                    </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    ${englishContent.aiAnalysis ? `
                    <div class="section">
                        <h2>AI Analysis</h2>
                        <div class="analysis-box">
                            <h3>Analysis Results</h3>
                            <div>${englishContent.aiAnalysis.replace(/\n/g, '<br>')}</div>
                        </div>
                    </div>
                    ` : ''}
                    
                    
                </div>
                
                <div class="timestamp">
                    Generated on ${new Date(englishContent.timestamp).toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        timeZoneName: 'short'
                    })}
                </div>
            </div>
        </body>
        </html>
        `;
        
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        
        const pdfOptions = {
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20px',
                right: '20px',
                bottom: '20px',
                left: '20px'
            }
        };
        
        if (asBuffer) {
            const buffer = await page.pdf(pdfOptions);
            try {
                await fsPromises.writeFile(filepath, buffer);
                console.log(`PDF generated (buffer + saved): ${filepath}`);
            } catch (diskErr) {
                console.warn('Could not persist buffer PDF to disk:', diskErr.message);
            }
            return { filename, filepath, buffer };
        } else {
            await page.pdf({ ...pdfOptions, path: filepath });
            console.log(`PDF generated: ${filepath}`);
            return { filename, filepath };
        }
        
    } finally {
        await browser.close();
    }
}

// Ask Stan endpoint
app.post('/api/ask-stan', async (req, res) => {
    try {
        const stanData = req.body.mappingData || req.body;
        
        console.log('Ask Stan request received:', {
            timestamp: stanData.timestamp,
            searchTerms: stanData.searchTerms,
            selectedCount: stanData.selectedLoincCodes ? stanData.selectedLoincCodes.length : 0
        });
        
        // Ensure proper content type
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        
        // Translate Chinese content to English using AI
        const translateContent = async (content) => {
            if (!content || content.trim() === '') return '';
            
            try {
                const response = await axios.post(
                    'https://api.openai.com/v1/chat/completions',
                    {
                        model: "gpt-4.1-nano",
                        messages: [
                            { role: "system", content: "You are a professional medical translator. Translate Chinese medical content to English accurately." },
                            { role: "user", content: `Translate to English: ${content}` }
                        ],
                        max_tokens: 1000,
                        temperature: 0.3
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json; charset=utf-8',
                            'Authorization': `Bearer ${openaiApiKey}`
                        },
                        responseType: 'json'
                    }
                );
                
                return response.data.choices[0].message.content;
            } catch (error) {
                console.error('Translation error:', error);
                return content; // Return original if translation fails
            }
        };
        
        // Translate content (except Laboratory Local Code Information which should remain as provided)
        const translatedAnalysis = await translateContent(stanData.aiAnalysis);
        const translatedFileNotes = await translateContent(stanData.fileNotes || '');
        
        // Generate AI analysis for LOINC code suggestion if not provided
        let enhancedAnalysis = translatedAnalysis;
        if (!enhancedAnalysis || enhancedAnalysis.trim() === '') {
            try {
                console.log('Generating AI analysis for LOINC code suggestion...');
                
                // Prepare data for AI analysis
                const loincDetails = (stanData.selectedDetails || []).map(detail => ({
                    loincNum: detail.loincNum,
                    component: detail.component,
                    specimen: detail.specimen || 'Blood',
                    method: detail.method || 'Automated count',
                    property: detail.property || 'Ratio',
                    scale: detail.scale || 'Quantitative',
                    time: detail.time || 'Point in time',
                    longCommonName: detail.longCommonName,
                    commonTestRank: detail.commonTestRank,
                    commonOrderRank: detail.commonOrderRank,
                    similarityScore: detail.similarityScore || 0
                }));

                const prompt = `
您是一位專精於 LOINC 代碼映射的醫學術語專家。

原始搜尋查詢: "${stanData.searchTerms || ''}"

用戶選擇的 LOINC 代碼:
${loincDetails.map(item => `
LOINC: ${item.loincNum}
Component: ${item.component}
Specimen: ${item.specimen}
Method: ${item.method}
Property: ${item.property}
Scale: ${item.scale}
Time: ${item.time}
Long Common Name: ${item.longCommonName}
Common Test Rank: ${item.commonTestRank}
Common Order Rank: ${item.commonOrderRank}
Similarity Score: ${item.similarityScore}
`).join('\n')}

請提供詳細的映射分析，包含：

## 映射分析結果

### 1. 選擇的 LOINC 代碼評估
（請評估每個選擇的代碼與原始搜尋查詢的相關性）

### 2. 臨床應用建議
（請說明這些 LOINC 代碼在臨床上的應用場景）

### 3. 映射合理性分析
（請分析這些映射選擇是否合理，並提供改進建議）

### 4. 相關組件詳細說明
（請詳細解釋每個 LOINC 代碼的組件含義）

### 5. 專家建議
（請提供專業的映射建議和注意事項）

### 6. 最佳 LOINC 代碼建議
**請在分析的最後明確推薦一個最佳的 LOINC 代碼，格式如下：**
**推薦的 LOINC 代碼：[LOINC代碼]**

**重要提醒：**
- 每個標題後面都要有兩個換行
- 每個段落之間都要有空行分隔
- 列表項目之間要有空行分隔
- 確保內容有充足的視覺間距
- **必須在最後包含推薦的 LOINC 代碼，格式為「推薦的 LOINC 代碼：[代碼]」**

請用繁體中文回答，專業術語可使用英文。
`;

                const response = await axios.post(
                    'https://api.openai.com/v1/chat/completions',
                    {
                        model: "gpt-4.1-nano",
                        messages: [
                            {
                                role: "system",
                                content: "您是一位專精於 LOINC 代碼映射的醫學術語專家，請根據用戶選擇的 LOINC 代碼提供詳細的映射分析，使用繁體中文回答。"
                            },
                            {
                                role: "user",
                                content: prompt
                            }
                        ],
                        max_tokens: 2000,
                        temperature: 0.7
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json; charset=utf-8',
                            'Authorization': `Bearer ${openaiApiKey}`
                        },
                        responseType: 'json'
                    }
                );

                enhancedAnalysis = response.data.choices[0].message.content;
                console.log('AI analysis generated for Ask Stan');
            } catch (error) {
                console.error('Error generating AI analysis for Ask Stan:', error);
                enhancedAnalysis = translatedAnalysis || '無法生成 AI 分析';
            }
        }
        
        // Prepare English content for Stan
        const englishContent = {
            timestamp: stanData.timestamp,
            laboratoryLocalCode: {
                // Keep original values (no translation requested for this section)
                searchTerms: stanData.searchTerms,
                mustHaveTerms: stanData.mustHaveTerms,
                notes: stanData.mappingNotes
            },
            selectedLoincCodes: stanData.selectedLoincCodes,
            loincDetails: (stanData.selectedDetails || []).map(detail => ({
                loincCode: detail.loincNum,
                component: detail.component,
                specimen: detail.specimen || 'Blood',
                method: detail.method || 'Automated count',
                property: detail.property || 'Ratio',
                scale: detail.scale || 'Quantitative',
                time: detail.time || 'Point in time',
                longCommonName: detail.longCommonName,
                commonTestRank: detail.commonTestRank,
                commonOrderRank: detail.commonOrderRank,
                similarityScore: detail.similarityScore
            })),
            aiAnalysis: enhancedAnalysis,
            fileNotes: translatedFileNotes,
            conversationHistory: stanData.conversationHistory,
            labDataContext: stanData.labDataContext
        };
        
        // Generate both JSON and PDF files
        // Detect a valid target directory
        const candidateDirs = [
            process.env.LOINC_ED_META_DIR,
            path.join(__dirname, 'saved_mappings')
        ].filter(Boolean);
        let targetDir = candidateDirs.find(d => {
            try {
                fsSync.mkdirSync(d, { recursive: true });
                fsSync.accessSync(d, fsSync.constants.W_OK);
                return true;
            } catch (_) { return false; }
        }) || path.join(__dirname, 'saved_mappings');

        // Ensure target directory exists
        try {
            await fsPromises.mkdir(targetDir, { recursive: true });
        } catch (mkErr) {
            console.warn(`Could not create target directory ${targetDir}:`, mkErr.message);
        }

        // Save JSON file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const jsonFilename = `ask_stan_${timestamp}.json`;
        const jsonFilepath = path.join(targetDir, jsonFilename);
        
        await fsPromises.writeFile(jsonFilepath, JSON.stringify(englishContent, null, 2), 'utf8');
        console.log(`Ask Stan JSON saved to: ${jsonFilepath}`);
        
        // Generate PDF file (optional)
        let pdfPayload = {};
        let pdfResultGenerated = null;
        try {
            const wantsDownload = req.query.download === '1' || (req.body && req.body.download === true);
            pdfResultGenerated = await generateAskStanPDF(englishContent, targetDir, { asBuffer: !!wantsDownload });
            console.log(`Ask Stan PDF generated: ${pdfResultGenerated.filepath}`);
            pdfPayload = {
                pdfFilename: pdfResultGenerated.filename,
                pdfFilepath: pdfResultGenerated.filepath
            };
        } catch (pdfErr) {
            console.warn('PDF generation failed, continuing with JSON only:', pdfErr.message);
        }

        // If client requested immediate download, stream the PDF
        const wantsDownload = req.query.download === '1' || (req.body && req.body.download === true);
        if (wantsDownload) {
            if (pdfResultGenerated && pdfResultGenerated.filepath) {
                // If we have a buffer, send it directly
                if (pdfResultGenerated.buffer) {
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', `attachment; filename="${pdfResultGenerated.filename}"`);
                    return res.end(pdfResultGenerated.buffer);
                }
                // Else stream from disk
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="${pdfResultGenerated.filename}"`);
                return fs.createReadStream(pdfResultGenerated.filepath).pipe(res);
            }
            // If PDF failed, return JSON info with error
            return res.status(500).json({
                success: false,
                message: 'PDF 生成失敗，已儲存 JSON',
                jsonFilename: jsonFilename,
                jsonFilepath: jsonFilepath
            });
        }

        // Extract suggested LOINC code from AI analysis if available
        let suggestedLoincCode = null;
        if (englishContent.aiAnalysis) {
            // Look for LOINC code patterns in the analysis (various formats)
            const loincPatterns = [
                /推薦的 LOINC 代碼[：:]\s*(\d+-\d+)/gi,  // 專門匹配推薦格式
                /LOINC[:\s]*(\d+-\d+)/gi,
                /(\d+-\d+)/g,  // Simple pattern for XX-XX format
                /LOINC[:\s]*(\d{5}-\d{1})/gi  // More specific LOINC format
            ];
            
            for (const pattern of loincPatterns) {
                const matches = englishContent.aiAnalysis.match(pattern);
                if (matches && matches.length > 0) {
                    // Extract the first LOINC code found
                    suggestedLoincCode = matches[0].replace(/推薦的 LOINC 代碼[：:]\s*/gi, '').replace(/LOINC[:\s]*/gi, '');
                    break;
                }
            }
        }

        // Default JSON response (no immediate download)
        res.json({
            success: true,
            message: pdfPayload.pdfFilename ? '已成功發送給 Stan 並生成 PDF 報告' : '已成功發送給 Stan（PDF 生成失敗，已儲存 JSON）',
            jsonFilename: jsonFilename,
            jsonFilepath: jsonFilepath,
            ...pdfPayload,
            englishContent: englishContent,
            suggestedLoincCode: suggestedLoincCode
        });
        
    } catch (error) {
        console.error('Ask Stan error:', error);
        console.error('Error stack:', error.stack);
        console.error('Request body:', JSON.stringify(req.body, null, 2));
        
        // Additional debugging for remote deployment
        console.error('Environment check:');
        console.error('- NODE_ENV:', process.env.NODE_ENV);
        console.error('- OpenAI API Key exists:', !!process.env.OPENAI_API_KEY);
        console.error('- Puppeteer available:', !!require('puppeteer'));
        
        // Check if it's a puppeteer-specific error
        if (error.message.includes('puppeteer') || error.message.includes('browser') || error.message.includes('chrome')) {
            console.error('Puppeteer/Chrome error detected - this is likely a remote server deployment issue');
        }
        
        res.status(500).json({ 
            success: false, 
            error: '發送給 Stan 時發生錯誤',
            message: error.message,
            details: error.stack,
            environment: {
                nodeEnv: process.env.NODE_ENV,
                hasOpenAIKey: !!process.env.OPENAI_API_KEY,
                hasPuppeteer: !!require('puppeteer')
            }
        });
    }
});

// Save mapping results to file system
app.post('/api/save-mapping', async (req, res) => {
    try {
        console.log('=== SAVE MAPPING REQUEST RECEIVED ===');
        console.log('Request URL:', req.url);
        console.log('Request method:', req.method);
        console.log('Request headers:', req.headers);
        console.log('Request body keys:', Object.keys(req.body || {}));
        console.log('mappingNotes received:', req.body.mappingNotes);
        console.log('mappingNotes type:', typeof req.body.mappingNotes);
        console.log('mappingNotes length:', req.body.mappingNotes ? req.body.mappingNotes.length : 'undefined');
        
        // Ensure proper content type
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        
        const mappingData = req.body;
        
        console.log('Saving mapping results:', {
            timestamp: mappingData.timestamp,
            searchTerms: mappingData.searchTerms,
            selectedCount: mappingData.selectedLoincCodes ? mappingData.selectedLoincCodes.length : 0,
            aiAnalysisLength: mappingData.aiAnalysis ? mappingData.aiAnalysis.length : 0,
            aiAnalysisPreview: mappingData.aiAnalysis ? mappingData.aiAnalysis.substring(0, 100) + '...' : 'No AI Analysis',
            conversationHistoryLength: mappingData.conversationHistory ? mappingData.conversationHistory.length : 0,
            mappingNotesLength: mappingData.mappingNotes ? mappingData.mappingNotes.length : 0
        });
        
        // Determine institution folder
        const institution = (mappingData.labDataContext && mappingData.labDataContext.institution) || 'Unknown';
        const institutionFolder = institution.replace(/[^a-zA-Z0-9_-]/g, '_'); // Sanitize folder name
        
        // Choose ONE writable base directory (no duplicate saves)
        const candidateBaseDirs = [
            process.env.LOINC_ED_META_DIR,
            path.join(__dirname, 'saved_mappings')
        ].filter(Boolean);
        let chosenBaseDir = candidateBaseDirs.find(d => {
            try {
                fsSync.mkdirSync(d, { recursive: true });
                fsSync.accessSync(d, fsSync.constants.W_OK);
                return true;
            } catch (_) { return false; }
        }) || path.join(__dirname, 'saved_mappings');

        const targetDir = path.join(chosenBaseDir, institutionFolder);
        try {
            await fsPromises.mkdir(targetDir, { recursive: true });
            console.log(`Using save directory: ${targetDir}`);
        } catch (error) {
            console.warn(`Could not create directory ${targetDir}:`, error.message);
        }
        
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `loinc_mapping_${timestamp}.json`;
        
        // Prepare the data to save
        const saveData = {
            metadata: {
                timestamp: mappingData.timestamp,
                filename: filename,
                version: '1.1',
                source: mappingData.labDataContext ? 'enhanced_with_lab_data' : 'basic_mapping'
            },
            search: {
                searchTerms: mappingData.searchTerms,
                mustHaveTerms: mappingData.mustHaveTerms
            },
            // Include lab data context if available
            ...(mappingData.labDataContext && { labDataContext: mappingData.labDataContext }),
            selectedLoincCodes: mappingData.selectedLoincCodes,
            selectedDetails: mappingData.selectedDetails,
            aiAnalysis: mappingData.aiAnalysis,
            conversationHistory: mappingData.conversationHistory,
            // Save mapping notes directly to fileNotes
            mappingNotes: mappingData.mappingNotes || '',
            fileNotes: mappingData.mappingNotes || '',
            fileNotesTimestamp: mappingData.mappingNotes ? new Date().toISOString() : null
        };
        
        const jsonContent = JSON.stringify(saveData, null, 2);
        let savedPaths = [];
        try {
            const filepath = path.join(targetDir, filename);
            await fsPromises.writeFile(filepath, jsonContent, 'utf8');
            savedPaths.push(filepath);
            console.log(`Mapping results saved to: ${filepath}`);
        } catch (error) {
            console.warn(`Could not save to ${targetDir}:`, error.message);
        }
        
        res.json({ 
            success: true, 
            message: '映射結果已成功儲存',
            filename: filename,
            savedPaths: savedPaths,
            savedCount: savedPaths.length
        });
        
    } catch (error) {
        console.error('Error saving mapping results:', error);
        res.status(500).json({ 
            success: false, 
            error: '儲存映射結果時發生錯誤',
            message: error.message 
        });
    }
});

// Get list of saved mapping files
app.get('/api/get-saved-mappings', async (req, res) => {
    try {
        const institution = req.query.institution;
        
        // Get base directories
        const baseDirs = [
            path.join(__dirname, 'saved_mappings'),
            ...(process.env.LOINC_ED_META_DIR ? [process.env.LOINC_ED_META_DIR] : [])
        ];
        
        let allFiles = [];
        let allInstitutions = new Set();
        
        // Function to scan directory recursively for institution folders
        async function scanDirectory(dir, isInstitutionSpecific = false, institutionName = '') {
            try {
                const entries = await fsPromises.readdir(dir, { withFileTypes: true });
                
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    
                    if (entry.isDirectory() && !isInstitutionSpecific) {
                        // This is an institution folder
                        allInstitutions.add(entry.name);
                        if (!institution || entry.name === institution) {
                            await scanDirectory(fullPath, true, entry.name);
                        }
                    } else if (entry.isFile() && entry.name.startsWith('loinc_mapping_') && entry.name.endsWith('.json')) {
                        // This is a mapping file
                        try {
                            const stats = await fsPromises.stat(fullPath);
                            const fileContent = await fsPromises.readFile(fullPath, 'utf8');
                            const data = JSON.parse(fileContent);
                            
                            // Extract institution from data or folder name
                            const fileInstitution = (data.labDataContext && data.labDataContext.institution) || institutionName || 'Unknown';
                            
                            allFiles.push({
                                filename: entry.name,
                                filepath: fullPath,
                                directory: dir,
                                institution: fileInstitution,
                                institutionFolder: institutionName || 'root',
                                timestamp: (data.metadata && data.metadata.timestamp) || data.timestamp || stats.mtime.toISOString(),
                                searchTerms: (data.search && data.search.searchTerms) || data.searchTerms || '未指定',
                                selectedLoincCodes: data.selectedLoincCodes || [],
                                size: stats.size,
                                lastModified: stats.mtime.toISOString()
                            });
                        } catch (fileError) {
                            console.warn(`Error reading file ${entry.name}:`, fileError.message);
                        }
                    }
                }
            } catch (dirError) {
                console.log(`Directory ${dir} not accessible:`, dirError.message);
            }
        }
        
        // Scan all base directories
        for (const baseDir of baseDirs) {
            await scanDirectory(baseDir);
        }
        
        // Sort by timestamp (newest first)
        allFiles.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        res.json({
            success: true,
            files: allFiles,
            count: allFiles.length,
            institutions: Array.from(allInstitutions).sort(),
            currentInstitution: institution || 'all'
        });
        
    } catch (error) {
        console.error('Error getting saved mappings:', error);
        res.status(500).json({
            success: false,
            error: '載入檔案列表時發生錯誤',
            message: error.message
        });
    }
});

// Get only sorting fields for multiple files (optimized for table view)
app.post('/api/get-sorting-fields', async (req, res) => {
    try {
        const { filenames } = req.body;
        
        if (!filenames || !Array.isArray(filenames)) {
            return res.status(400).json({ success: false, error: 'Invalid filenames array' });
        }
        
        const results = [];
        const directories = [
            path.join(__dirname, 'saved_mappings'),
            ...(process.env.LOINC_ED_META_DIR ? [process.env.LOINC_ED_META_DIR] : [])
        ];
        
        // Function to search for file in directory and its subdirectories
        async function searchFile(dir, filename) {
            try {
                // First check if file exists directly in the directory
                const directPath = path.join(dir, filename);
                try {
                    await fsPromises.access(directPath);
                    const content = await fsPromises.readFile(directPath, 'utf8');
                    return { content, path: directPath };
                } catch (error) {
                    // File not found in root directory, check subdirectories
                }
                
                // Check institution subdirectories
                const entries = await fsPromises.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isDirectory()) {
                        const subPath = path.join(dir, entry.name, filename);
                        try {
                            await fsPromises.access(subPath);
                            const content = await fsPromises.readFile(subPath, 'utf8');
                            return { content, path: subPath };
                        } catch (error) {
                            // File not found in this subdirectory
                        }
                    }
                }
                return null;
            } catch (error) {
                console.error(`Error searching for file ${filename} in ${dir}:`, error);
                return null;
            }
        }
        
        // Process files in parallel
        const filePromises = filenames.map(async (filename) => {
            for (const dir of directories) {
                const result = await searchFile(dir, filename);
                if (result) {
                    try {
                        const data = JSON.parse(result.content);
                        // 檢查是否有有效的資料結構
                        if (data && (data.labDataContext || data.institution)) {
                            const labData = data.labDataContext || {};
                            const selectedDetails = data.selectedDetails || [];
                            
                            // 從檔案路徑中提取 institution（如果檔案在子目錄中）
                            let institution = data.institution || 'Unknown';
                            if (institution === 'Unknown' && result.path) {
                                const pathParts = result.path.split('/');
                                const savedMappingsIndex = pathParts.findIndex(part => part === 'saved_mappings');
                                if (savedMappingsIndex !== -1 && pathParts[savedMappingsIndex + 1]) {
                                    institution = pathParts[savedMappingsIndex + 1];
                                }
                            }
                            
                            return {
                                filename: filename,
                                institution: institution,
                                timestamp: data.timestamp || new Date().toISOString(),
                                rank: labData.itemRank ? parseInt(labData.itemRank) : 999999,
                                localId: labData.itemId || '未指定',
                                localCode: labData.labItemName || '未指定',
                                loincCodes: selectedDetails.map(detail => detail.loincNum).join(', ') || '無',
                                searchTerms: data.search?.searchTerms || '未指定',
                                fileNotes: data.fileNotes || '',
                                fileNotesPreview: (data.fileNotes || '').length > 50 ? 
                                    (data.fileNotes || '').substring(0, 50) + '...' : (data.fileNotes || '')
                            };
                        }
                    } catch (parseError) {
                        console.error(`Error parsing file ${filename}:`, parseError);
                    }
                }
            }
            return null;
        });
        
        const fileResults = await Promise.all(filePromises);
        const validResults = fileResults.filter(result => result !== null);
        
        res.json({
            success: true,
            data: validResults,
            count: validResults.length
        });
        
    } catch (error) {
        console.error('Error getting sorting fields:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Get specific mapping file content
app.get('/api/get-mapping-file/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        
        // Check both directories for the file
        const directories = [
            path.join(__dirname, 'saved_mappings'),
            ...(process.env.LOINC_ED_META_DIR ? [process.env.LOINC_ED_META_DIR] : [])
        ];
        
        let fileContent = null;
        let foundPath = null;
        
        // Function to search for file in directory and its subdirectories
        async function searchFile(dir) {
            try {
                // First check if file exists directly in the directory
                const directPath = path.join(dir, filename);
                try {
                    await fsPromises.access(directPath);
                    const content = await fsPromises.readFile(directPath, 'utf8');
                    return { content, path: directPath };
                } catch (error) {
                    // File not found in root directory, check subdirectories
                }
                
                // Check institution subdirectories
                const entries = await fsPromises.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isDirectory()) {
                        const subDirPath = path.join(dir, entry.name, filename);
                        try {
                            await fsPromises.access(subDirPath);
                            const content = await fsPromises.readFile(subDirPath, 'utf8');
                            return { content, path: subDirPath };
                        } catch (error) {
                            // File not found in this subdirectory, continue
                        }
                    }
                }
            } catch (error) {
                // Directory not accessible
            }
            return null;
        }
        
        // Search in all base directories and their subdirectories
        for (const dir of directories) {
            const result = await searchFile(dir);
            if (result) {
                fileContent = result.content;
                foundPath = result.path;
                break;
            }
        }
        
        if (!fileContent) {
            return res.status(404).json({
                success: false,
                error: '檔案未找到',
                message: `檔案 ${filename} 不存在`
            });
        }
        
        const data = JSON.parse(fileContent);
        
        res.json({
            success: true,
            data: data,
            filepath: foundPath
        });
        
    } catch (error) {
        console.error('Error getting mapping file:', error);
        res.status(500).json({
            success: false,
            error: '載入檔案時發生錯誤',
            message: error.message
        });
    }
});

// Delete mapping file
app.delete('/api/delete-mapping-file/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        
        // 檢查檔案名稱格式，防止路徑遍歷攻擊
        if (!filename.match(/^loinc_mapping_[\d-TZ]+\.json$/)) {
            return res.status(400).json({
                success: false,
                error: '無效的檔案名稱格式'
            });
        }
        
        // Get base directories and scan for institution folders
        const baseDirs = [
            path.join(__dirname, 'saved_mappings'),
            ...(process.env.LOINC_ED_META_DIR ? [process.env.LOINC_ED_META_DIR] : [])
        ];
        
        let deletedPaths = [];
        let errors = [];
        
        // Function to search and delete file in directory and its subdirectories
        async function searchAndDelete(dir) {
            try {
                // First check if file exists directly in the directory
                const directPath = path.join(dir, filename);
                try {
                    await fsPromises.access(directPath);
                    await fsPromises.unlink(directPath);
                    deletedPaths.push(directPath);
                    console.log(`Successfully deleted: ${directPath}`);
                    return;
                } catch (error) {
                    // File not found in root directory, check subdirectories
                }
                
                // Check institution subdirectories
                const entries = await fsPromises.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isDirectory()) {
                        const subDirPath = path.join(dir, entry.name, filename);
                        try {
                            await fsPromises.access(subDirPath);
                            await fsPromises.unlink(subDirPath);
                            deletedPaths.push(subDirPath);
                            console.log(`Successfully deleted: ${subDirPath}`);
                        } catch (error) {
                            // File not found in this subdirectory, continue
                        }
                    }
                }
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    errors.push(`${dir}: ${error.message}`);
                    console.warn(`Could not search in ${dir}:`, error.message);
                }
            }
        }
        
        // Search and delete in all base directories
        for (const baseDir of baseDirs) {
            await searchAndDelete(baseDir);
        }
        
        if (deletedPaths.length === 0 && errors.length === 0) {
            return res.status(404).json({
                success: false,
                error: '檔案未找到',
                message: `檔案 ${filename} 在任何目錄中都不存在`
            });
        }
        
        res.json({
            success: true,
            message: `檔案已成功刪除`,
            deletedPaths: deletedPaths,
            deletedCount: deletedPaths.length,
            errors: errors.length > 0 ? errors : undefined
        });
        
    } catch (error) {
        console.error('Error deleting mapping file:', error);
        res.status(500).json({
            success: false,
            error: '刪除檔案時發生錯誤',
            message: error.message
        });
    }
});

// Save file note endpoint
app.post('/api/save-file-note', async (req, res) => {
    try {
        const { filename, note, timestamp } = req.body;
        
        if (!filename) {
            return res.status(400).json({ 
                success: false, 
                error: '檔案名稱為必要欄位' 
            });
        }

        console.log(`保存檔案備註: ${filename} | 長度: ${note.length}`);

        // 確定檔案路徑，支援機構子目錄
        let filePath = null;
        const savedMappingsDir = path.join(__dirname, 'saved_mappings');
        
        // 首先嘗試在根目錄中找到檔案
        const rootFilePath = path.join(savedMappingsDir, filename);
        if (fsSync.existsSync(rootFilePath)) {
            filePath = rootFilePath;
        } else {
            // 如果在根目錄中找不到，遞歸搜尋所有子目錄
            function findFileRecursively(dir) {
                const items = fsSync.readdirSync(dir);
                for (const item of items) {
                    const itemPath = path.join(dir, item);
                    const stat = fsSync.statSync(itemPath);
                    
                    if (stat.isDirectory()) {
                        const result = findFileRecursively(itemPath);
                        if (result) return result;
                    } else if (item === filename) {
                        return itemPath;
                    }
                }
                return null;
            }
            
            filePath = findFileRecursively(savedMappingsDir);
        }

        if (!filePath || !fsSync.existsSync(filePath)) {
            return res.status(404).json({ 
                success: false, 
                error: '找不到指定的檔案' 
            });
        }

        // 讀取現有的 JSON 檔案
        const fileContent = fsSync.readFileSync(filePath, 'utf8');
        const data = JSON.parse(fileContent);

        // 更新檔案級別的備註
        data.fileNotes = note;
        data.fileNotesTimestamp = timestamp;

        // 寫入更新後的檔案
        await fsPromises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');

        console.log(`檔案備註已保存: ${filename}`);

        res.json({
            success: true,
            message: '檔案備註保存成功'
        });

    } catch (error) {
        console.error('保存檔案備註時發生錯誤:', error);
        res.status(500).json({
            success: false,
            error: '保存檔案備註時發生錯誤',
            message: error.message
        });
    }
});

// Serve the main page
app.get('/', (req, res) => {
    // Force correct content type and disable cache (helps Chrome after prior JSON mis-type)
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Debug endpoint to test URL parameter parsing
app.get('/debug-url-params', (req, res) => {
    const params = {
        labItemName: req.query.labItemName,
        labUnit: req.query.labUnit,
        labSampleType: req.query.labSampleType,
        searchTerms: req.query.searchTerms,
        mustHaveTerms: req.query.mustHaveTerms,
        rankFilter1: req.query.rankFilter1,
        rankFilter2: req.query.rankFilter2
    };
    
    res.json({
        message: 'URL parameters received by server',
        params: params,
        rawQuery: req.query,
        url: req.url
    });
});

// Serve external website under /wfh
app.use('/wfh', express.static(process.env.LOINC_ED_META_DIR || path.join(__dirname, 'saved_mappings'), {
  index: ['index.html', 'index.htm'],
  extensions: ['html', 'htm']
}));

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
