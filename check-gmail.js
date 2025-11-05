#!/usr/bin/env node

/**
 * Simple Gmail Checker
 * Uses existing credentials to check Gmail inbox
 */

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

async function getGmailMessages(accessToken, maxResults = 10, query = '') {
  const searchQuery = query ? `&q=${encodeURIComponent(query)}` : '';
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'gmail.googleapis.com',
      port: 443,
      path: `/gmail/v1/users/me/messages?maxResults=${maxResults}${searchQuery}`,
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
          const result = JSON.parse(data);
          resolve(result);
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
      path: `/gmail/v1/users/me/messages/${messageId}`,
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
          const result = JSON.parse(data);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function formatDate(timestamp) {
  const date = new Date(parseInt(timestamp));
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function getHeaderValue(headers, name) {
  const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return header ? header.value : '';
}

async function main() {
  try {
    console.log('📧 Checking Gmail for today\'s new messages...\n');

    // Get fresh access token
    const accessToken = await refreshAccessToken();

    // Get today's messages (after midnight)
    const todayQuery = 'after:2025/10/13';
    const messages = await getGmailMessages(accessToken, 20, todayQuery);

    if (!messages.messages || messages.messages.length === 0) {
      console.log('📭 No messages found in inbox');
      return;
    }

    console.log(`📬 Found ${messages.messages.length} new messages today (2025-10-13):\n`);

    // Get details for each message
    for (let i = 0; i < Math.min(messages.messages.length, 5); i++) {
      const messageId = messages.messages[i].id;
      const details = await getMessageDetails(accessToken, messageId);

      const headers = details.payload.headers;
      const from = getHeaderValue(headers, 'From');
      const subject = getHeaderValue(headers, 'Subject');
      const date = formatDate(details.internalDate);

      console.log(`${i + 1}. From: ${from}`);
      console.log(`   Subject: ${subject}`);
      console.log(`   Date: ${date}`);
      console.log(`   ID: ${messageId}`);
      console.log('');
    }

    console.log(`📊 Total messages in result: ${messages.resultSizeEstimate || 'Unknown'}`);

  } catch (error) {
    console.error('❌ Error checking Gmail:', error.message);
  }
}

main();