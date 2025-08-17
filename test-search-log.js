const axios = require('axios');

async function testSearchLog() {
  try {
    console.log('Sending search request...');
    const response = await axios.post('http://localhost:3002/api/search', {
      field1: 'creatine',
      field2: '',
      useOrderRankFilter: false,
      useTestRankFilter: false
    });
    console.log('Search response:', response.data);
    console.log('Number of results:', response.data.results.length);
  } catch (error) {
    console.error('Error details:', {
      message: error.message,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : 'No response data',
      stack: error.stack
    });
  }
}

testSearchLog(); 