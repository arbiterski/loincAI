// server.js
const express = require('express');
const csv = require('csv-parse');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const axios = require('axios');
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Load OpenAI API key from environment variable
const openaiApiKey = process.env.OPENAI_API_KEY || '';

// Azure OpenAI configuration (commented out for later use)
// const azureEndpoint = "https://emrgenie.openai.azure.com/";
// const azureKey = "7970ff0f9ba34d4ba6c2022f2da8bb7e";
// const azureDeployment = "gpt-4o";
// const azureApiVersion = "2023-05-15";

// OpenAI API configuration is already set above

// Search index for fast lookup
let searchIndex = null;

// Load LOINC data
let loincData = [];
fs.createReadStream('Loinc.csv')
  .pipe(csv.parse({ columns: true }))
  .on('data', (row) => {
    loincData.push({
      loincNum: row.LOINC_NUM,
      component: row.COMPONENT,
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
    host: 'localhost',
    user: 'arbiter',
    password: 'gimi',
    database: 'loinc_search'
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
    ).map(item => ({
      loincNum: item.loincNum,
      component: item.component,
      relatedNames2: item.relatedNames2,
      commonTestRank: item.commonTestRank,
      commonOrderRank: item.commonOrderRank,
      longCommonName: item.longCommonName,
      similarityScore: 100 // Exact match gets 100% similarity
    }));
    
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
    const { field1, field2, useOrderRankFilter, useTestRankFilter } = req.body;
    
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
      // Extract the original field1 value for specific longCommonName matching
      const field1Value = field1 || '';
      
      // Calculate specific comparison between field1 and longCommonName using distanceArray (Python port)
      const longNameMatchScore = distanceArray(field1Value, item.longCommonName || '');
      
      // Direct term match gets highest score
      const directMatchScore = field1Value.toLowerCase() === (item.longCommonName || '').toLowerCase() ? 100 : 0;
      
      // For other fields, use the existing original distance function
      const componentMatchScore = distance(field1Value, item.component || '');
      const relatedNamesMatchScore = distance(field1Value, item.relatedNames2 || '');
      
      // Compute the weighted score with emphasis on component match
      let similarityScore = 0;
      
      if (directMatchScore > 0) {
        similarityScore = 100;
      } else {
        // Weight distribution: 
        // - 70% for component match
        // - 20% for longCommonName match (using distanceArray from Python port)
        // - 10% for relatedNames match
        similarityScore = (componentMatchScore * 0.7) + 
                          (longNameMatchScore * 0.2) + 
                          (relatedNamesMatchScore * 0.1);
      }
      
      // Ensure similarity score is within 0-100 range
      similarityScore = Math.min(100, Math.max(0, similarityScore));
      
      // Add debug info for testing
      const debugInfo = {
        longNameMatchScore,
        directMatchScore,
        componentMatchScore,
        relatedNamesMatchScore,
        finalScore: similarityScore
      };
      
      return {
        loincNum: item.loincNum,
        component: item.component,
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
      results: filteredResults.slice(0, 100) 
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Analyze endpoint
app.post('/api/analyze', async (req, res) => {
  try {
    const { sessionId, results, searchTerms, mustHaveTerms } = req.body;
    
    console.log('Analyze request received:', {
      sessionId,
      resultsCount: results ? results.length : 0,
      searchTerms,
      mustHaveTerms
    });
    
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
    const prompt = `
您是一位專精於 LOINC 代碼的醫學術語專家。


搜尋查詢: "${searchTerms || ''}"
${mustHaveTerms ? `必須包含詞語: "${mustHaveTerms}"` : ''}


請用繁體中文回答，專業部分用英文，Based on these search terms, analyze the following LOINC code results to identify the most relevant matches:


${safeResults.slice(0, 10).map(item => `
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


1. 哪些 LOINC 代碼最符合搜尋詞語，以及為什麼
2. 在多個相似結果之間選擇時應該考慮什麼因素
3. 簡短解釋此搜尋最相關的組件
4. 分析意見請你針對輸入，然後 LOINC 專家分析，此代碼的合理性

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

    console.log('Using OpenAI API');

    try {
      // Call OpenAI API
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: "gpt-4o",
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
          temperature: 1.2
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`
          }
        }
      );

      let aiSummary = response.data.choices[0].message.content;
      console.log('Got answer from OpenAI');
      
      // Process the summary to ensure HTML tables are properly formatted
      aiSummary = aiSummary.replace(/```html/g, '');
      aiSummary = aiSummary.replace(/```/g, '');

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

      res.json({ summary: aiSummary });
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
    const [analysisRows] = await pool.execute(
      'SELECT ai_summary FROM search_sessions WHERE session_id = ?',
      [sessionId]
    );
    
    const previousAnalysis = (analysisRows[0] && analysisRows[0].ai_summary) 
      ? analysisRows[0].ai_summary 
      : '無先前分析';

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


${safeResults.slice(0, 10).map(item => `
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


請用繁體中文回答用戶的後續問題，保持專業性和簡潔性。專業術語可使用英文。因為要讓使用者比較好比較，所有提過的 LOINC 代碼
請用表格格式，然後最推薦的擺在第一行，然後表格中最推薦的 LOINC code 的 cell 用紅色表示，然後所有 LOINC code 都要在同一個表格中 然後一樣加上分析意見欄位。


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
          model: "gpt-4o",
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
          temperature: 1.2
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`
          }
        }
      );

      const answer = response.data.choices[0].message.content;
      console.log('Got answer from OpenAI');

      // Get existing chat log
      const [rows] = await pool.execute(
        'SELECT ai_chat_log FROM search_sessions WHERE session_id = ?',
        [sessionId]
      );

      // Update chat log
      let chatLog = [];
      if (rows[0] && rows[0].ai_chat_log) {
        try {
          chatLog = JSON.parse(rows[0].ai_chat_log);
        } catch (e) {
          console.error('Error parsing chat log:', e);
          chatLog = [];
        }
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
        await pool.execute(
          'UPDATE search_sessions SET ai_chat_log = ? WHERE session_id = ?',
          [JSON.stringify(chatLog), sessionId]
        );
        console.log('Chat log updated successfully for session:', sessionId);
      } catch (logError) {
        console.error('Error updating chat log:', logError);
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

// LOINC Input Translation endpoint
app.post('/api/translate-input', async (req, res) => {
  try {
    const { userInput } = req.body;
    
    if (!userInput || userInput.trim() === '') {
      return res.status(400).json({ error: '請提供輸入內容' });
    }

    console.log(`處理 LOINC 名稱轉換請求: "${userInput}"`);
    
    // 準備給 AI 的提示
    const prompt = `
您是一位 LOINC 編碼專家，請幫我將以下用戶輸入轉換為最適合的 LOINC 檢查項目名稱（英文）。

用戶輸入: "${userInput}"

此輸入可能是中文描述、醫學縮寫、不完整描述或非標準表達。請將其轉換為標準的 LOINC 檢查項目名稱，以便在 LOINC 數據庫中搜索。

您的任務：
1. 識別用戶輸入中的關鍵醫學概念
2. 將其轉換為標準英文 LOINC 檢查項目名稱
3. 如果有多個可能的解釋，請提供最常見或最相關的 1-5 個選項
4. 格式應為: 檢查項目名稱 (例如: Glucose [Mass/volume] in Serum or Plasma)

請直接返回標準化的 LOINC 檢查項目名稱，無需解釋。如果有多個可能選項，請用分號分隔。
請勿在回應中使用引號，直接提供純文本的檢查項目名稱。
`;

    console.log('Using OpenAI API');

    try {
      // 呼叫 OpenAI API
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: "gpt-4o",
          messages: [
            { role: "system", content: "您是一位專業的 LOINC 編碼專家，熟悉各種醫學術語、檢查項目和實驗室測試。請僅提供標準 LOINC 檢查名稱，無需使用引號。" },
            { role: "user", content: prompt }
          ],
          max_tokens: 1500,
          temperature: 1.2
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`
          }
        }
      );

      // 提取 AI 回應
      const aiResponse = response.data.choices[0].message.content;
      console.log('Got answer from OpenAI');
      
      // 清理回應：移除引號並分割
      const cleanedResponse = aiResponse.replace(/["""'']/g, '');
      const translatedTerms = cleanedResponse.split(';').map(term => term.trim());
      
      console.log('輸入轉換完成');
      
      // 返回轉換結果
      res.json({ 
        originalInput: userInput,
        translatedTerms: translatedTerms
      });
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

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});