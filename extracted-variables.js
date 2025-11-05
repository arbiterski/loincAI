// Extracted variables from LOINC LLM interface URL
// Source: https://loinc-llm.ngrok.io/?labItemName=CREA&labUnit=mg%2FdL&labSampleType=Blood&labTotalRecords=5018&labUniquePatients=4562&labMissingValues=0.0%25&labMeanValue=1.13&labMedianValue=0.86&itemRank=1&institution=AAA+Hospital&institutionType=Medical+Center&institutionLocation=Taiwan&itemId=CREB&dataSource=Analytics+Dashboard&timestamp=2025-09-06T12%3A43%3A41.554Z&rankFilter1=true&rankFilter2=true&searchTermItemName=CREA&searchTermUnit=mg%2FdL&searchTermSampleType=Blood&searchTermTotalRecords=5018&searchTermUniquePatients=4562&searchTermMissingValues=0.0%25&searchTermMeanValue=1.13&searchTermMedianValue=0.86&searchTerms=CREA+mg%2FdL+Blood+5018+4562+0.0%25+1.13+0.86

const urlVariables = {
  // Lab Item Information
  labItemName: "CREA",
  labUnit: "mg/dL",  // URL encoded as mg%2FdL
  labSampleType: "Blood",
  
  // Statistical Data
  labTotalRecords: 5018,
  labUniquePatients: 4562,
  labMissingValues: "0.0%",  // URL encoded as 0.0%25
  labMeanValue: 1.13,
  labMedianValue: 0.86,
  
  // Ranking and Institution
  itemRank: 1,
  institution: "AAA Hospital",  // URL encoded as AAA+Hospital
  institutionType: "Medical Center",  // URL encoded as Medical+Center
  institutionLocation: "Taiwan",
  itemId: "CREB",
  
  // Metadata
  dataSource: "Analytics Dashboard",  // URL encoded as Analytics+Dashboard
  timestamp: "2025-09-06T12:43:41.554Z",  // URL encoded with %3A
  
  // Filter Settings
  rankFilter1: true,
  rankFilter2: true,
  
  // Search Terms (duplicated for search)
  searchTermItemName: "CREA",
  searchTermUnit: "mg/dL",
  searchTermSampleType: "Blood",
  searchTermTotalRecords: 5018,
  searchTermUniquePatients: 4562,
  searchTermMissingValues: "0.0%",
  searchTermMeanValue: 1.13,
  searchTermMedianValue: 0.86,
  searchTerms: "CREA mg/dL Blood 5018 4562 0.0% 1.13 0.86"  // Space-separated search terms
};

// Function to construct search query from lab data
function constructSearchQuery(variables) {
  const searchComponents = [
    variables.labItemName,
    variables.labUnit,
    variables.labSampleType
  ].filter(Boolean);
  
  return searchComponents.join(' ');
}

// Function to construct detailed search context
function constructDetailedContext(variables) {
  return {
    primarySearch: constructSearchQuery(variables),
    statisticalContext: {
      totalRecords: variables.labTotalRecords,
      uniquePatients: variables.labUniquePatients,
      missingValues: variables.labMissingValues,
      meanValue: variables.labMeanValue,
      medianValue: variables.labMedianValue
    },
    institutionalContext: {
      institution: variables.institution,
      type: variables.institutionType,
      location: variables.institutionLocation,
      itemId: variables.itemId
    },
    filters: {
      useOrderRankFilter: variables.rankFilter1,
      useTestRankFilter: variables.rankFilter2
    },
    metadata: {
      dataSource: variables.dataSource,
      timestamp: variables.timestamp,
      itemRank: variables.itemRank
    }
  };
}

// Export for use in server
module.exports = {
  urlVariables,
  constructSearchQuery,
  constructDetailedContext
};

// Example usage:
console.log('Extracted Variables:');
console.log(JSON.stringify(urlVariables, null, 2));
console.log('\nConstructed Search Query:', constructSearchQuery(urlVariables));
console.log('\nDetailed Context:', JSON.stringify(constructDetailedContext(urlVariables), null, 2));


