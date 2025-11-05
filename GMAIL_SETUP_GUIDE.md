# Gmail MCP Setup Guide

## 🚀 Quick Setup Steps

### 1. Google Cloud Console Setup

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Create or Select Project**: Create a new project or select existing one
3. **Enable Gmail API**:
   - Go to: https://console.cloud.google.com/apis/library/gmail.googleapis.com
   - Click "Enable"

### 2. Create OAuth2 Credentials

1. **Go to Credentials**: https://console.cloud.google.com/apis/credentials
2. **Create Credentials** → "OAuth client ID"
3. **Application type**: "Desktop application"
4. **Name**: "Gmail MCP Client"
5. **Download JSON** credentials file

### 3. Setup Environment Variables

Create or update `.env` file with your credentials:

```env
# Gmail MCP Configuration
GMAIL_CLIENT_ID=your_client_id_here
GMAIL_CLIENT_SECRET=your_client_secret_here
GMAIL_REDIRECT_URI=http://localhost:3000/oauth/callback
```

### 4. Install Dependencies

```bash
# If npm cache issues, try:
npm install --force googleapis google-auth-library dotenv

# Or use yarn:
yarn add googleapis google-auth-library dotenv
```

### 5. Generate Refresh Token

Run the setup scripts:

```bash
# Interactive setup
node setup-gmail-mcp.js

# Generate OAuth token
node generate-gmail-token.js
```

### 6. Configure MCP Server

```bash
# Remove existing server
claude mcp remove gmail

# Add with environment variables
claude mcp add-json gmail '{
  "type": "stdio",
  "command": "npx",
  "args": ["mcp-gmail"],
  "env": {
    "GMAIL_CLIENT_ID": "your_client_id",
    "GMAIL_CLIENT_SECRET": "your_client_secret",
    "GMAIL_REFRESH_TOKEN": "your_refresh_token"
  }
}'
```

### 7. Test Connection

```bash
claude mcp list
```

## 🔧 Manual Setup (Alternative)

If automatic setup fails:

1. **Install dependencies manually**:
   ```bash
   npm install --force googleapis google-auth-library dotenv
   ```

2. **Get OAuth URL manually**:
   ```bash
   node -e "
   const {google} = require('googleapis');
   const oauth2Client = new google.auth.OAuth2(
     'YOUR_CLIENT_ID',
     'YOUR_CLIENT_SECRET',
     'http://localhost:3000/oauth/callback'
   );
   console.log(oauth2Client.generateAuthUrl({
     access_type: 'offline',
     scope: ['https://www.googleapis.com/auth/gmail.readonly'],
     prompt: 'consent'
   }));
   "
   ```

3. **Exchange code for token**:
   ```bash
   node -e "
   const {google} = require('googleapis');
   const oauth2Client = new google.auth.OAuth2(
     'YOUR_CLIENT_ID',
     'YOUR_CLIENT_SECRET',
     'http://localhost:3000/oauth/callback'
   );
   oauth2Client.getAccessToken('YOUR_AUTH_CODE').then(({tokens}) => {
     console.log('Refresh Token:', tokens.refresh_token);
   });
   "
   ```

## 📝 Troubleshooting

- **npm cache issues**: Run `npm cache clean --force` or use `--force` flag
- **Permission errors**: Check file permissions and npm ownership
- **MCP connection fails**: Verify environment variables are set correctly
- **OAuth errors**: Ensure redirect URI matches exactly in Google Console

## 🎯 Gmail MCP Features

Once configured, you can:
- Read emails
- Send emails
- Search messages
- Manage labels
- Get email metadata