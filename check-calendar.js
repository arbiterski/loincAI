#!/usr/bin/env node

/**
 * Simple Google Calendar Checker
 * Uses existing credentials to check calendar events
 */

const https = require('https');
const querystring = require('querystring');
const fs = require('fs');
const path = require('path');

// Load tokens
const tokensPath = '/Users/arbiter/.config/google-calendar-mcp/tokens.json';
const credentialsPath = '/Users/arbiter/Dropbox/ai-assistant/credentials/google-calendar-oauth.json';

async function refreshAccessToken() {
  const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

  const refreshToken = tokens.normal?.refresh_token;
  const clientId = credentials.installed.client_id;
  const clientSecret = credentials.installed.client_secret;

  if (!refreshToken) {
    throw new Error('No refresh token found');
  }

  const postData = querystring.stringify({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
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

async function getCalendarEvents(accessToken, timeMin = null, timeMax = null, maxResults = 10) {
  const params = new URLSearchParams({
    maxResults: maxResults.toString(),
    orderBy: 'startTime',
    singleEvents: 'true'
  });

  if (timeMin) params.append('timeMin', timeMin);
  if (timeMax) params.append('timeMax', timeMax);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.googleapis.com',
      port: 443,
      path: `/calendar/v3/calendars/primary/events?${params.toString()}`,
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

function formatDateTime(dateTime) {
  if (!dateTime) return 'No time specified';

  const date = new Date(dateTime);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  let dateStr = '';
  if (eventDate.getTime() === today.getTime()) {
    dateStr = 'Today';
  } else if (eventDate.getTime() === today.getTime() + 24 * 60 * 60 * 1000) {
    dateStr = 'Tomorrow';
  } else {
    dateStr = date.toLocaleDateString();
  }

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${dateStr} ${timeStr}`;
}

async function main() {
  try {
    console.log('📅 Checking Google Calendar...\n');

    // Get fresh access token
    const accessToken = await refreshAccessToken();

    // Get today's date and next week
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Get upcoming events
    const events = await getCalendarEvents(
      accessToken,
      today.toISOString(),
      nextWeek.toISOString(),
      20
    );

    if (!events.items || events.items.length === 0) {
      console.log('📭 No upcoming events found');
      return;
    }

    console.log(`📋 Found ${events.items.length} upcoming events (next 7 days):\n`);

    events.items.forEach((event, index) => {
      const start = event.start?.dateTime || event.start?.date;
      const end = event.end?.dateTime || event.end?.date;
      const title = event.summary || 'No title';
      const location = event.location ? ` @ ${event.location}` : '';
      const description = event.description ? ` - ${event.description.substring(0, 100)}...` : '';

      console.log(`${index + 1}. ${title}${location}`);
      console.log(`   📅 ${formatDateTime(start)}`);
      if (event.start?.dateTime && event.end?.dateTime) {
        const endTime = new Date(end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        console.log(`   ⏰ Until ${endTime}`);
      }
      if (description) {
        console.log(`   📝${description}`);
      }
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error checking calendar:', error.message);
  }
}

main();