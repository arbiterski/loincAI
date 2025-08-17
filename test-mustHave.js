const axios = require('axios');

const SERVER_URL = 'http://localhost:3002';

async function testSearch(searchTerm, mustHaveTerm = '', useOrderRankFilter = false, useTestRankFilter = false) {
    try {
        console.log(`\nSearching for "${searchTerm}" with must have "${mustHaveTerm || 'none'}"...`);
        console.log(`Order Rank Filter: ${useOrderRankFilter}, Test Rank Filter: ${useTestRankFilter}`);
        
        const startTime = Date.now();
        
        const response = await axios.post(`${SERVER_URL}/api/search`, {
            field1: searchTerm,
            field2: mustHaveTerm || '',
            useOrderRankFilter: useOrderRankFilter,
            useTestRankFilter: useTestRankFilter
        });
        
        const endTime = Date.now();
        const executionTime = endTime - startTime;
        
        if (response.data.tooManyResults) {
            console.log(`\nToo many results. Please add more search conditions.`);
            console.log(`Found ${response.data.recordCount} total records.`);
            return;
        }

        const results = response.data.results || [];
        console.log(`\nFound ${results.length} results in ${executionTime}ms`);
        
        if (results.length > 0) {
            console.log('\nTop 5 results:');
            results.slice(0, 5).forEach((result, index) => {
                console.log(`\n${index + 1}. ${result.component || 'N/A'}`);
                console.log(`   LOINC: ${result.loincNum}`);
                console.log(`   Name: ${result.longCommonName || 'N/A'}`);
                console.log(`   Score: ${result.similarityScore.toFixed(1)}%`);
                if (result.commonTestRank) console.log(`   Test Rank: ${result.commonTestRank}`);
                if (result.commonOrderRank) console.log(`   Order Rank: ${result.commonOrderRank}`);
            });
        } else {
            console.log('No results found.');
        }
    } catch (error) {
        console.error('Error during search:', error.message);
    }
}

async function runTests() {
    console.log('TESTING CREATINE URINE SEARCHES');
    console.log('==============================');
    
    // Test 1: creatine urine with creatine as must have
    await testSearch('creatine urine', 'creatine');
    
    // Test 2: Compare with just creatine urine
    await testSearch('creatine urine');
    
    // Test 3: Compare with creatine and urine as separate terms
    await testSearch('creatine', 'urine');
    
    // Test 4: With rank filters
    await testSearch('creatine urine', 'creatine', true, true);
    
    console.log('\nTests completed.');
}

console.log('Make sure the server is running on http://localhost:3002');
console.log('Run "node loinc-search-server.js" if it\'s not running.\n');

runTests().catch(error => {
    console.error('Test execution failed:', error.message);
}); 