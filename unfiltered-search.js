const axios = require('axios');

const SERVER_URL = 'http://localhost:3002';

async function unfilteredSearch(searchTerm, mustHaveTerm = '') {
    console.log(`\nPerforming unfiltered search for "${searchTerm}"${mustHaveTerm ? ` with must have "${mustHaveTerm}"` : ''}...`);
    
    try {
        const startTime = Date.now();
        
        const response = await axios.post(`${SERVER_URL}/api/search`, {
            field1: searchTerm,
            field2: mustHaveTerm || '',
            useOrderRankFilter: false,
            useTestRankFilter: false
        });
        
        const endTime = Date.now();
        const executionTime = endTime - startTime;
        
        if (response.data.tooManyResults) {
            // Show message indicating too many results
            console.log("\nToo many results. Please add more search conditions.");
            return;
        }

        const results = response.data.results || [];
        console.log(`\nFound ${results.length} results in ${executionTime}ms`);
        
        if (results.length > 0) {
            console.log('\nResults breakdown:');
            
            // Count items with no rank
            const noRank = results.filter(item => !item.commonTestRank && !item.commonOrderRank).length;
            
            // Count items outside normal filter range
            const outsideOrderRank = results.filter(item => 
                item.commonOrderRank && (parseInt(item.commonOrderRank) > 300)).length;
                
            const outsideTestRank = results.filter(item => 
                item.commonTestRank && (parseInt(item.commonTestRank) > 3000)).length;
            
            console.log(`- Items with no rank: ${noRank}`);
            console.log(`- Items with Order Rank > 300: ${outsideOrderRank}`);
            console.log(`- Items with Test Rank > 3000: ${outsideTestRank}`);
            
            if (results.length > 5) {
                console.log('\nShowing top 5 results:');
            } else {
                console.log('\nAll results:');
            }
            
            results.slice(0, 5).forEach((result, index) => {
                console.log(`\n${index + 1}. ${result.component || 'N/A'}`);
                console.log(`   LOINC: ${result.loincNum}`);
                console.log(`   Name: ${result.longCommonName || 'N/A'}`);
                console.log(`   Score: ${result.similarityScore.toFixed(1)}%`);
                console.log(`   Test Rank: ${result.commonTestRank || 'None'}`);
                console.log(`   Order Rank: ${result.commonOrderRank || 'None'}`);
            });
        } else {
            console.log('No results found.');
        }
    } catch (error) {
        console.error('Error during search:', error.message);
    }
}

async function runSearches() {
    console.log('UNFILTERED SEARCH TEST');
    console.log('=====================');
    
    // Test with must-have term to avoid too many results
    await unfilteredSearch('creatine', 'plasma');
    await unfilteredSearch('creatinine', 'plasma');
    
    // Attempt with unfiltered search - will likely hit warning
    await unfilteredSearch('creatine plasma');
    await unfilteredSearch('creatinine plasma');
    
    console.log('\nTests completed.');
}

console.log('Make sure the server is running on http://localhost:3002');
console.log('Run "node loinc-search-server.js" if it\'s not running.\n');

runSearches().catch(error => {
    console.error('Test execution failed:', error.message);
}); 