// URL Parameter Parser for LOINC Server Integration
// Handles parameters from LOINC LLM interface and other external sources

/**
 * Parse URL query parameters into structured lab data
 * @param {Object} query - Express req.query object or URL search params
 * @returns {Object} Structured lab data object
 */
function parseLabDataFromQuery(query) {
  // Safe decode function that handles malformed URIs
  function safeDecodeURIComponent(str) {
    try {
      return decodeURIComponent(str || '');
    } catch (e) {
      console.warn('Failed to decode URI component:', str, e.message);
      return str || '';
    }
  }

  return {
    // Primary Lab Information
    labItemName: query.labItemName || '',
    labUnit: safeDecodeURIComponent(query.labUnit),
    labSampleType: query.labSampleType || '',
    
    // Statistical Data
    labTotalRecords: parseInt(query.labTotalRecords) || 0,
    labUniquePatients: parseInt(query.labUniquePatients) || 0,
    labMissingValues: safeDecodeURIComponent(query.labMissingValues),
    labMeanValue: parseFloat(query.labMeanValue) || 0,
    labMedianValue: parseFloat(query.labMedianValue) || 0,
    
    // Ranking and Institution
    itemRank: parseInt(query.itemRank) || 0,
    institution: safeDecodeURIComponent(query.institution).replace(/\+/g, ' '),
    institutionType: safeDecodeURIComponent(query.institutionType).replace(/\+/g, ' '),
    institutionLocation: query.institutionLocation || '',
    itemId: query.itemId || '',
    
    // Metadata
    dataSource: safeDecodeURIComponent(query.dataSource).replace(/\+/g, ' '),
    timestamp: query.timestamp || new Date().toISOString(),
    
    // Filter Settings
    rankFilter1: query.rankFilter1 === 'true',
    rankFilter2: query.rankFilter2 === 'true',
    
    // Search Terms
    searchTerms: safeDecodeURIComponent(query.searchTerms).replace(/\+/g, ' ')
  };
}

/**
 * Convert lab data to search parameters for LOINC search
 * @param {Object} labData - Parsed lab data object
 * @returns {Object} Search parameters object
 */
function convertToSearchParams(labData) {
  // Construct primary search terms
  const primaryTerms = [
    labData.labItemName,
    labData.labUnit,
    labData.labSampleType
  ].filter(Boolean).join(' ');
  
  // Use custom search terms if provided, otherwise use constructed terms
  const searchTerms = labData.searchTerms || primaryTerms;
  
  return {
    field1: searchTerms,
    field2: '', // Can be populated with must-have terms if needed
    useOrderRankFilter: labData.rankFilter1,
    useTestRankFilter: labData.rankFilter2,
    
    // Additional context for enhanced analysis
    context: {
      institution: labData.institution,
      institutionType: labData.institutionType,
      location: labData.institutionLocation,
      dataSource: labData.dataSource,
      statisticalData: {
        totalRecords: labData.labTotalRecords,
        uniquePatients: labData.labUniquePatients,
        missingValues: labData.labMissingValues,
        meanValue: labData.labMeanValue,
        medianValue: labData.labMedianValue
      }
    }
  };
}

/**
 * Generate enhanced AI prompt with institutional context
 * @param {Object} labData - Parsed lab data object
 * @param {Array} results - Search results
 * @returns {String} Enhanced AI prompt
 */
function generateEnhancedPrompt(labData, results) {
  const institutionalContext = labData.institution ? 
    `\n機構資訊: ${labData.institution} (${labData.institutionType}) - ${labData.institutionLocation}` : '';
  
  const statisticalContext = labData.labTotalRecords > 0 ? 
    `\n統計資料: 總記錄數 ${labData.labTotalRecords}, 獨特患者 ${labData.labUniquePatients}, 平均值 ${labData.labMeanValue}, 中位數 ${labData.labMedianValue}` : '';
  
  return `
您是一位專精於 LOINC 代碼的醫學術語專家。

搜尋查詢: "${labData.labItemName} ${labData.labUnit} ${labData.labSampleType}"
${institutionalContext}
${statisticalContext}

請基於以下資訊提供詳細的 LOINC 代碼分析，並考慮機構背景和統計數據的臨床意義。
`;
}

module.exports = {
  parseLabDataFromQuery,
  convertToSearchParams,
  generateEnhancedPrompt
};
