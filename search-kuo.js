#!/usr/bin/env node
const https = require('https');
const querystring = require('querystring');
require('dotenv').config();

async function refreshAccessToken() {
  const postData = querystring.stringify({
    client_id: process.env.GMAIL_CLIENT_ID,
    client_secret: process.env.GMAIL_CLIENT_SECRET,
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
    grant_type: 'refresh_token'
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'oauth2.googleapis.com',
      port: 443,
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.error) {
            reject(new Error(result.error_description || result.error));
          } else {
            resolve(result.access_token);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function getGmailMessages(accessToken, query) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'gmail.googleapis.com',
      port: 443,
      path: `/gmail/v1/users/me/messages?maxResults=20&q=${encodeURIComponent(query)}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function getMessageDetails(accessToken, messageId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'gmail.googleapis.com',
      port: 443,
      path: `/gmail/v1/users/me/messages/${messageId}?format=full`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function getHeaderValue(headers, name) {
  const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return header ? header.value : '';
}

function formatDate(timestamp) {
  const date = new Date(parseInt(timestamp));
  return date.toLocaleDateString('zh-TW') + ' ' + date.toLocaleTimeString('zh-TW');
}

function decodeBody(body) {
  if (!body || !body.data) return '';
  return Buffer.from(body.data, 'base64').toString('utf-8');
}

function extractTextFromPayload(payload) {
  if (payload.mimeType === 'text/plain' && payload.body && payload.body.data) {
    return decodeBody(payload.body);
  }
  
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        return decodeBody(part.body);
      }
    }
  }
  
  return '';
}

async function main() {
  try {
    console.log('📧 搜尋郭家英的郵件...\n');

    const accessToken = await refreshAccessToken();
    const messages = await getGmailMessages(accessToken, '郭家英');

    if (!messages.messages || messages.messages.length === 0) {
      console.log('📭 找不到來自郭家英的郵件');
      return;
    }

    console.log(`📬 找到 ${messages.messages.length} 封郵件:\n`);

    for (let i = 0; i < Math.min(messages.messages.length, 5); i++) {
      const messageId = messages.messages[i].id;
      const details = await getMessageDetails(accessToken, messageId);
      const headers = details.payload.headers;
      
      console.log(`${i + 1}. 寄件人: ${getHeaderValue(headers, 'From')}`);
      console.log(`   主旨: ${getHeaderValue(headers, 'Subject')}`);
      console.log(`   日期: ${formatDate(details.internalDate)}`);
      console.log(`   ID: ${messageId}`);
      
      const body = extractTextFromPayload(details.payload);
      if (body) {
        const preview = body.substring(0, 200).replace(/\n/g, ' ');
        console.log(`   預覽: ${preview}...`);
      }
      console.log('');
    }

  } catch (error) {
    console.error('❌ 錯誤:', error.message);
  }
}

main();
