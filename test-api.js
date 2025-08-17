const axios = require('axios');

// Azure OpenAI configuration
const azureEndpoint = "https://emrgenie.openai.azure.com/";
const azureKey = "9a272ece3d044f9da3c9baf18cd1b78b";
const azureDeployment = "gpt-4o";
const azureApiVersion = "2023-05-15";

async function testAzureOpenAI() {
  try {
    console.log('Testing Azure OpenAI API connection...');
    console.log('Endpoint:', azureEndpoint);
    console.log('API Key (first 4 chars):', azureKey.substring(0, 4) + '...');
    console.log('Deployment:', azureDeployment);
    console.log('API Version:', azureApiVersion);

    const response = await axios.post(
      `${azureEndpoint}openai/deployments/${azureDeployment}/chat/completions?api-version=${azureApiVersion}`,
      {
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant."
          },
          {
            role: "user",
            content: "Say hello!"
          }
        ],
        max_tokens: 100
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'api-key': azureKey
        }
      }
    );

    console.log('Response status:', response.status);
    console.log('Response data:', response.data);
    console.log('Message content:', response.data.choices[0].message.content);
    console.log('API connection successful!');
  } catch (error) {
    console.error('Azure OpenAI API error:');
    console.error('Error message:', error.message);
    
    if (error.response) {
      console.error('Status code:', error.response.status);
      console.error('Response data:', error.response.data);
      console.error('Response headers:', error.response.headers);
    } else if (error.request) {
      console.error('No response received. Request:', error.request);
    }
  }
}

testAzureOpenAI(); 