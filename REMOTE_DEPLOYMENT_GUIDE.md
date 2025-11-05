# Remote Server Deployment Guide for LOINC Search Server

## 🚀 Quick Deployment Checklist

### 1. **Upload Files**
```bash
# Upload all project files to remote server
scp -r /Users/arbiter/Dropbox/!Umysql_PVM/LOINC/ user@remote-server:/path/to/project/
```

### 2. **Install Dependencies**
```bash
cd /path/to/project/
npm install
```

### 3. **Install System Dependencies for Puppeteer**
```bash
# For Ubuntu/Debian:
sudo apt-get update
sudo apt-get install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget

# For CentOS/RHEL:
sudo yum install -y alsa-lib atk cups-libs gtk3 libXcomposite libXcursor libXdamage libXext libXi libXrandr libXScrnSaver libXtst pango at-spi2-atk libdrm libxkbcommon
```

### 4. **Set Environment Variables**
```bash
# Create .env file on remote server
nano .env
```

Add your environment variables:
```
OPENAI_API_KEY=your_openai_api_key_here
NODE_ENV=production
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

### 5. **Create Target Directory**
```bash
mkdir -p /path/to/LOINC_ED_Meta
chmod 755 /path/to/LOINC_ED_Meta
```

### 6. **Update Server Configuration**
Update the target directory path in `loinc-search-server.js`:
```javascript
const TARGET_DIR = '/path/to/LOINC_ED_Meta';
```

### 7. **Test the Deployment**
```bash
# Start the server
node loinc-search-server.js

# Test the Ask Stan endpoint
curl -X POST http://localhost:3002/api/ask-stan \
  -H "Content-Type: application/json" \
  -d '{"timestamp":"2025-09-09T12:00:00.000Z","searchTerms":"Test","mustHaveTerms":"","selectedLoincCodes":["12345-6"],"selectedDetails":[{"loincNum":"12345-6","component":"Test","relatedNames2":"Test","commonTestRank":"1","commonOrderRank":"1","longCommonName":"Test","similarityScore":"0.95"}],"aiAnalysis":"Test","conversationHistory":"","mappingNotes":"Test","fileNotes":"Test","labDataContext":{"labItemName":"Test","labUnit":"mg","labSampleType":"Blood","itemRank":"1","institution":"Test","labTotalRecords":"1000","labUniquePatients":"500","labMissingValues":"50"}}'
```

## 🔧 Common Issues and Solutions

### Issue 1: Puppeteer/Chrome Errors
**Error:** `Failed to launch the browser process!`
**Solution:**
```bash
# Install Chrome/Chromium
sudo apt-get install -y chromium-browser
# Or
sudo apt-get install -y google-chrome-stable

# Set executable path in .env
echo "PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser" >> .env
```

### Issue 2: Permission Denied
**Error:** `EACCES: permission denied`
**Solution:**
```bash
# Fix file permissions
sudo chown -R $USER:$USER /path/to/project/
chmod -R 755 /path/to/project/
chmod 755 /path/to/LOINC_ED_Meta
```

### Issue 3: OpenAI API Key Missing
**Error:** `OpenAI API key not found`
**Solution:**
```bash
# Check .env file exists and has correct content
cat .env
# Should show: OPENAI_API_KEY=your_key_here
```

### Issue 4: Memory Issues
**Error:** `JavaScript heap out of memory`
**Solution:**
```bash
# Increase Node.js memory limit
node --max-old-space-size=4096 loinc-search-server.js
```

## 🐳 Docker Deployment (Alternative)

If you prefer Docker deployment:

```dockerfile
FROM node:18-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

EXPOSE 3002
CMD ["node", "loinc-search-server.js"]
```

## 📊 Monitoring

### Check Server Status
```bash
ps aux | grep "loinc-search-server"
```

### Check Logs
```bash
tail -f /var/log/your-app.log
# Or if using PM2:
pm2 logs loinc-search-server
```

### Health Check
```bash
curl http://localhost:3002/api/health
```

## 🔄 Process Management (PM2)

For production deployment, use PM2:

```bash
# Install PM2
npm install -g pm2

# Start the application
pm2 start loinc-search-server.js --name "loinc-search-server"

# Save PM2 configuration
pm2 save
pm2 startup

# Monitor
pm2 monit
pm2 logs loinc-search-server
```

## ✅ Final Verification

After deployment, verify:
1. ✅ Server starts without errors
2. ✅ Ask Stan endpoint responds successfully
3. ✅ PDF files are generated in target directory
4. ✅ JSON files are saved correctly
5. ✅ No memory leaks or crashes

If you encounter any issues, check the server logs for detailed error information with the enhanced debugging we added.

