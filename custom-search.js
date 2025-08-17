const axios = require('axios');

const SERVER_URL = 'http://localhost:3002';

async function customSearch(searchTerm, mustHaveTerm = '', useOrderRankFilter = true, useTestRankFilter = true) {
    try {
        console.log(`\nSearching for "${searchTerm}"${mustHaveTerm ? ` with must have "${mustHaveTerm}"` : ''}...`);
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
            console.log(`\n⚠️  ${response.data.message}`);
            console.log(`Found ${response.data.recordCount} records. Please refine your search.`);
            console.log(`Try adding more specific terms or enabling rank filters.`);
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

// Run tests with different search variations
async function runTests() {
    console.log('CREATINE/CREATININE PLASMA SEARCH TEST');
    console.log('=====================================');
    
    // Tests with creatinine
    await customSearch('creatinine serum');
    await customSearch('creatinine plasma');
    await customSearch('creatinine', 'plasma');
    
    // Tests with creatine
    await customSearch('creatine serum');
    await customSearch('creatine plasma');
    await customSearch('creatine', 'plasma');
    
    // Tests with specific terms
    await customSearch('creatinine mass volume plasma');
    await customSearch('creatinine moles volume plasma');
    
    console.log('\nTests completed.');
}

console.log('Make sure the server is running on http://localhost:3002');
console.log('Run "node loinc-search-server.js" if it\'s not running.\n');

runTests().catch(error => {
    console.error('Test execution failed:', error.message);
}); 