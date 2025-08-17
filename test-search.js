const axios = require('axios');

const SERVER_URL = 'http://localhost:3002';

async function testSearch(searchTerm, mustHaveTerm = '', orderRankFilter = 'true', testRankFilter = 'true') {
    try {
        const startTime = Date.now();
        
        // Use POST request with JSON body instead of GET with query parameters
        const response = await axios.post(`${SERVER_URL}/api/search`, {
            field1: searchTerm,
            field2: mustHaveTerm || '',
            useOrderRankFilter: orderRankFilter,
            useTestRankFilter: testRankFilter
        });
        
        const endTime = Date.now();
        const executionTime = endTime - startTime;
        
        return {
            success: true,
            query: searchTerm,
            mustHave: mustHaveTerm,
            executionTime: executionTime,
            count: response.data.results ? response.data.results.length : 0,
            results: response.data.results || []
        };
    } catch (error) {
        console.error('Error during search:', error.message);
        return {
            success: false,
            query: searchTerm,
            mustHave: mustHaveTerm,
            error: error.message
        };
    }
}

function displayResult(test) {
    if (!test.success) {
        console.log(`Error: ${test.error}`);
        return;
    }

    console.log(`Found ${test.count} results`);
    if (test.count > 0) {
        const firstResult = test.results[0];
        console.log('First result:');
        console.log('  Component:', firstResult.component);
        console.log('  LOINC:', firstResult.loincNum);
        if (firstResult.longCommonName) {
            console.log('  Long Common Name:', firstResult.longCommonName);
        }
        if (firstResult.commonOrderRank) {
            console.log('  Rank:', firstResult.commonOrderRank);
        }
        console.log('  Similarity:', firstResult.similarityScore.toFixed(1) + '%');
    }
}

async function runTests() {
    console.log('Starting search tests...\n');

    // Test 1: Basic search
    console.log('Test 1: Basic search for "creatine"');
    const test1 = await testSearch('creatine');
    displayResult(test1);
    console.log('----------------------------------------\n');

    // Test 2: Search with must have
    console.log('Test 2: Search for "creatine" with must have "urine"');
    const test2 = await testSearch('creatine', 'urine');
    displayResult(test2);
    console.log('----------------------------------------\n');

    // Test 3: Search with rank filter
    console.log('Test 3: Search for "creatine" with rank filter (≤500)');
    const test3 = await testSearch('creatine', '', 'true', '500');
    displayResult(test3);
    console.log('----------------------------------------\n');

    // Test 4: Complex search
    console.log('Test 4: Search for "Microalbumin/Creatinine ratio panel"');
    const test4 = await testSearch('Microalbumin/Creatinine ratio panel');
    displayResult(test4);
    console.log('----------------------------------------\n');

    // Test 5: Complex search with must have
    console.log('Test 5: Search for "Microalbumin/Creatinine ratio panel" with must have "urine"');
    const test5 = await testSearch('Microalbumin/Creatinine ratio panel', 'urine');
    displayResult(test5);
    console.log('----------------------------------------\n');

    // Test 6: Individual word search
    console.log('Test 6: Search for individual words');
    const words = ['Microalbumin', 'Creatinine', 'ratio', 'panel'];
    for (const word of words) {
        console.log(`\nSearching for "${word}":`);
        const result = await testSearch(word);
        displayResult(result);
    }
    console.log('----------------------------------------\n');
}

// Run the tests
console.log('Make sure the server is running on http://localhost:3002');
console.log('Run "node loinc-search-server.js" if it\'s not running.\n');

runTests().catch(error => {
    console.error('Test execution failed:', error.message);
}); 