# loincAI 🔬

**AI-Powered LOINC Code Search and Analysis Tool**

A sophisticated web application that leverages artificial intelligence to search, analyze, and interpret LOINC (Logical Observation Identifiers Names and Codes) data for medical laboratory testing.

## ✨ Features

- **🔍 AI-Powered Search**: Advanced search algorithms for LOINC codes
- **📊 Smart Ranking**: Intelligent result ranking and filtering
- **🌐 Web Interface**: Modern, responsive web application
- **📱 Mobile Friendly**: Optimized for all device sizes
- **🔗 URL Parameters**: Shareable search results via URL
- **📈 Search Analytics**: Track and analyze search patterns
- **👥 User Management**: Admin panel for user oversight

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/loincAI.git
   cd loincAI
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   node loinc-search-server.js
   ```

4. **Open your browser**
   Navigate to `http://localhost:3002`

## 🏗️ Architecture

### Frontend
- **HTML5**: Semantic markup with modern web standards
- **CSS3**: Responsive design with CSS Grid and Flexbox
- **JavaScript**: Vanilla JS with ES6+ features
- **AI Integration**: OpenAI API for intelligent search

### Backend
- **Node.js**: Server-side JavaScript runtime
- **Express.js**: Web application framework
- **CSV Processing**: Efficient LOINC data handling
- **Search Algorithms**: Advanced text search and ranking

### Data
- **LOINC Database**: Comprehensive medical coding data
- **CSV Format**: Optimized for fast data access
- **Search Index**: Pre-processed search optimization

## 📁 Project Structure

```
loincAI/
├── public/                 # Frontend assets
│   ├── index.html         # Main application
│   ├── admin.html         # Admin panel
│   └── search-history.html # Search analytics
├── loinc-search-server.js # Main server file
├── package.json           # Dependencies
├── Loinc.csv             # LOINC database
├── custom-search.js      # Search algorithms
└── README.md             # This file
```

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the root directory:

```env
PORT=3002
OPENAI_API_KEY=your_openai_api_key_here
NODE_ENV=development
```

### Server Configuration
The server runs on port 3002 by default. You can change this in `loinc-search-server.js` or via environment variables.

### Gmail MCP Integration
For email integration capabilities, you can set up Gmail MCP (Model Context Protocol):

1. **Add Gmail MCP Server**
   ```bash
   claude mcp add gmail "npx mcp-gmail"
   ```

2. **Verify Installation**
   ```bash
   claude mcp list
   ```

3. **Available Gmail MCP Servers**
   - `mcp-gmail` - Minimal Gmail client with refresh-token support
   - `@sowonai/mcp-gmail` - Full-featured Gmail MCP server
   - `@gongrzhe/server-gmail-autoauth-mcp` - Auto-authentication Gmail server
   - `gmail-mcp-server` - Multi-user Gmail MCP with OAuth2

4. **Gmail API Setup Required**
   - Google Cloud Console project with Gmail API enabled
   - OAuth2 credentials (client ID, client secret)
   - Refresh token for authentication

### Trello MCP Integration
For project management and task tracking integration:

1. **Add Trello MCP Server**
   ```bash
   claude mcp add trello "npx @delorenj/mcp-server-trello"
   ```

2. **Verify Installation**
   ```bash
   claude mcp list
   ```

3. **Available Trello MCP Servers**
   - `@delorenj/mcp-server-trello` - Full-featured Trello server with Bun performance
   - `mcp-trello` - Basic Trello MCP server
   - `@welt-studio/trello-mcp-server` - Alternative Trello API integration

4. **Trello API Setup Required**
   - Trello API key from [Trello Developer Portal](https://trello.com/app-key)
   - User token for authentication
   - Board and list IDs for specific operations

### Google Calendar MCP Integration
For calendar management and scheduling:

1. **Add Google Calendar MCP Server**
   ```bash
   claude mcp add gcal /path/to/gcal-mcp-wrapper.sh
   ```

2. **Initial Authentication**
   - First run will open browser for OAuth2 authentication
   - Tokens saved to `~/.config/google-calendar-mcp/tokens.json`
   - Grant necessary calendar permissions

3. **Verify Installation**
   ```bash
   claude mcp list
   # Should show: gcal - ✓ Connected
   ```

### MCP Troubleshooting - Decision Journey

#### Issue: Authentication Tokens Expired

**症狀**：
```
MCP error -32600: Authentication tokens are no longer valid.
Please restart the server to re-authenticate.
```

**決策過程與解決方案**：

**Step 1: 診斷問題**
```bash
claude mcp list
# 檢查 MCP 服務器狀態
# gcal: ✓ Connected（但實際操作時仍報錯）
```

**觀察**：
- MCP 列表顯示已連接
- 但實際呼叫 Google Calendar API 時認證失敗
- 原因：Token 已過期，但 MCP 服務器未自動重新認證

**Step 2: 嘗試的解決方案**

❌ **方案 1：嘗試重啟 MCP（失敗）**
```bash
claude mcp restart gcal
# Error: unknown command 'restart'
```
決策：MCP CLI 不支援 restart 命令

❌ **方案 2：手動執行 wrapper script（被拒絕）**
```bash
bash /path/to/gcal-mcp-wrapper.sh
# 被 hook 攔截，不允許執行
```
決策：需要用戶手動觸發重新認證

✅ **方案 3：重新認證（成功）**
1. 用戶在瀏覽器中完成 OAuth2 認證流程
2. 新的 tokens 儲存至 `~/.config/google-calendar-mcp/tokens.json`
3. 重新啟動 Claude Code 載入新 tokens

**Step 3: 最終解決方案**

當遇到 MCP 認證過期問題時：

1. **檢查錯誤訊息**
   ```
   MCP error -32600: Authentication tokens are no longer valid
   ```

2. **重新認證流程**
   - 觸發 OAuth2 認證流程
   - 在瀏覽器中完成授權
   - 確認 tokens 已儲存

3. **重啟服務**
   - 重新啟動 Claude Code
   - 或重新載入 MCP 服務器

4. **驗證連接**
   ```bash
   claude mcp list
   # 確認服務狀態為 ✓ Connected
   ```

**預防措施**：

1. **Token 管理**
   - Google OAuth tokens 有效期限（通常 1 小時 access token + refresh token）
   - Refresh tokens 可能因長時間未使用而失效
   - 定期使用可保持 refresh token 有效

2. **錯誤處理**
   - 當遇到認證錯誤時，先嘗試重新認證
   - 如果重新認證失敗，檢查 Google Cloud Console 的 API 設定
   - 確認 OAuth consent screen 和 credentials 設定正確

3. **最佳實踐**
   - 將 tokens 目錄加入 `.gitignore`
   - 不要分享或提交 tokens 到版本控制
   - 定期備份重要的 MCP 設定

**相關檔案位置**：
- Tokens: `~/.config/google-calendar-mcp/tokens.json`
- MCP Wrapper: `/Users/arbiter/Dropbox/ai-assistant/workflows/ceo-training/gcal-mcp-wrapper.sh`
- Gmail Wrapper: `/Users/arbiter/Dropbox/ai-assistant/workflows/ceo-training/gmail-mcp-wrapper.sh`

## 🎯 Usage

### Basic Search
1. Enter search terms in the main search box
2. Use filters to narrow results
3. Click search to get AI-powered results

### Advanced Features
- **URL Parameters**: Share searches via URL
- **Ranking Filters**: Customize result ordering
- **Admin Panel**: Monitor system usage
- **Search History**: Track user interactions

### Example Search URLs
```
http://localhost:3002/?searchTerms=CREA+mg%2FdL+Blood&rankFilter1=true
http://localhost:3002/?searchTerms=glucose+fasting&rankFilter2=true
```

## 🤖 AI Features

- **Semantic Search**: Understands medical terminology context
- **Smart Ranking**: Prioritizes most relevant results
- **Query Expansion**: Automatically suggests related terms
- **Context Awareness**: Considers medical domain knowledge

## 🔍 AI Assistant - Government Procurement Search

### 查詢健保署標案 (NHIA Tender Search)

使用 Claude AI Assistant 可以查詢政府採購網的健保署標案資訊。

#### 政府採購網查詢方法

**基本查詢 URL 結構:**
```
https://web.pcc.gov.tw/prkms/tender/common/basic/readTenderBasic?
  pageSize=
  &firstSearch=true
  &searchType=basic
  &isBinding=N
  &isLogIn=N
  &level_1=on
  &orgName=%E8%A1%9B%E7%94%9F%E7%A6%8F%E5%88%A9%E9%83%A8%E4%B8%AD%E5%A4%AE%E5%81%A5%E5%BA%B7%E4%BF%9D%E9%9A%AA%E7%BD%B2
  &orgId=A.21.3
  &tenderName=
  &tenderId=
  &tenderType=TENDER_DECLARATION
  &tenderWay=TENDER_WAY_ALL_DECLARATION
  &dateType=isDate
  &tenderStartDate=2025%2F09%2F01
  &tenderEndDate=2025%2F10%2F15
  &radProctrgCate=
  &policyAdvocacy=
```

#### 重要參數說明

| 參數 | 說明 | 範例值 |
|------|------|--------|
| `orgName` | 機關名稱（URL encoded）| 衛生福利部中央健康保險署 |
| `orgId` | 機關代碼 | A.21.3（健保署）|
| `tenderStartDate` | 招標開始日期 | 2025/09/01 |
| `tenderEndDate` | 招標結束日期 | 2025/10/15 |
| `tenderType` | 標案類型 | TENDER_DECLARATION（公告）|
| `tenderWay` | 招標方式 | TENDER_WAY_ALL_DECLARATION |
| `tenderName` | 標案名稱關鍵字 | 留空或指定關鍵字（如：FHIR）|

#### 使用 AI Assistant 查詢範例

```
可否幫我查詢 https://web.pcc.gov.tw/prkms/tender/...
```

AI Assistant 將會：
1. 自動提取所有標案資訊
2. 整理標案的：案號、名稱、類型、預算、日期
3. 識別特定關鍵字相關的標案（如：FHIR、LOINC）
4. 提供完整的結構化資料

#### 查詢結果範例

最近查詢到的 FHIR 相關標案：

**健保相關治療資訊以電子病歷（FHIR）申請及上傳實作成果觀摩會**
- 案號: U1140700862
- 機關: 衛生福利部中央健康保險署
- 招標方式: 公開取得報價單或企劃書
- 類型: 勞務類
- 預算: 600,000元
- 公告日期: 2025/09/10
- 截止日期: 2025/09/23

#### 其他機關代碼參考

- **A.21.3**: 衛生福利部中央健康保險署
- 可依需求查詢其他政府機關的標案資訊

#### 進階搜尋技巧

1. **搜尋特定關鍵字**
   - 在 `tenderName` 參數加入關鍵字（需 URL encode）
   - 範例：FHIR、LOINC、電子病歷、醫療資訊

2. **日期範圍調整**
   - 修改 `tenderStartDate` 和 `tenderEndDate`
   - 格式：YYYY/MM/DD

3. **標案狀態篩選**
   - 調整 `tenderType` 參數
   - 可查詢：公告中、決標、流標等狀態

## 📊 Data Sources

- **LOINC Database**: Official LOINC codes and descriptions
- **Medical Terminology**: Standardized medical vocabulary
- **Search Patterns**: User behavior analytics

## 🔒 Security

- **Input Validation**: Sanitized user inputs
- **Rate Limiting**: API usage controls
- **Secure Headers**: HTTP security best practices
- **Admin Authentication**: Protected admin functions

## 🧪 Testing

Run the test suite:

```bash
# Test search functionality
node test-search.js

# Test API endpoints
node test-api.js

# Test search logging
node test-search-log.js
```

## 📈 Performance

- **Fast Search**: Optimized CSV processing
- **Efficient Indexing**: Pre-processed search data
- **Caching**: Intelligent result caching
- **Compression**: Gzip compression for responses

## 🌍 Browser Support

- **Chrome**: 80+
- **Firefox**: 75+
- **Safari**: 13+
- **Edge**: 80+

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Maintainers

- **林明錦 (Mark Lin)** - *Initial work* - [TAMI](https://www.tami.org.tw/)

## 🙏 Acknowledgments

- **台灣醫學資訊學會 (TAMI)** - Medical informatics expertise
- **LOINC Committee** - Data standards and codes
- **OpenAI** - AI capabilities and API

## 📝 AI Assistant - Conversation History & Best Practices

### 2025-10-20 CEO Executive Assistant Workflow

#### 任務概述
今日完成的主要任務包括郵件管理、行程安排、截止日期追蹤等 CEO 日常管理工作。

#### 完成任務清單

**1. 天下雜誌採訪安排** ✅
- **任務**：從 Gmail 中找到天下雜誌記者簡嘉佑的回覆，確認採訪時間
- **結果**：
  - 確認時間：2025年10月29日（三）09:00-11:00
  - 採訪主題：台灣健康數據怎麼走
  - 記者：簡嘉佑（天下編輯部 醫療教育組）
  - 已添加到 Google Calendar，設置提醒
- **工具使用**：
  ```bash
  # Gmail 搜尋指令
  mcp__gmail__gmail_list_emails --query "from:天下 OR CommonWealth"
  mcp__gmail__gmail_read_email --messageId [email_id]

  # Google Calendar 添加事件
  mcp__gcal__create-event --calendarId primary --summary "天下雜誌採訪"
  ```

**2. 秘書雅君聯絡與任務委派** ✅
- **任務**：找到秘書雅君的郵箱地址，請她協助安排會議地點
- **解決過程**：
  - 先在 README 中搜尋（未找到）
  - 使用 Grep 工具搜尋項目文件
  - 通過 Gmail 搜尋找到雅君的往來郵件
  - 郵箱：sj917927love@gmail.com
- **學習重點**：聯絡人資訊不應只依賴文檔，Gmail 往來記錄是重要資料來源
- **已發送郵件**：請雅君協助安排 10/29 採訪的會議地點

**3. MIE 2026 截止日期管理** ✅
- **任務**：從 Gmail 中查找 MIE 相關的截止日期，添加到 Trello 和 Google Calendar
- **MIE 2026 會議資訊**：
  - **論文提交截止日**：2025年11月3日（已延長）
  - **會議日期**：2026年5月25-28日
  - **地點**：意大利 Genoa（熱那亞）
  - **主席**：Mauro Giacomini
  - **提交網站**：https://access.online-registry.net/mie2026/
- **Calendar 設置**：
  - 提前一週提醒（10/27）
  - 提前兩天郵件提醒（11/1）
  - 提前一天提醒（11/2）

**4. Trello MCP 安裝與配置** ✅
- **任務**：設置 Trello MCP 以便管理任務
- **完成步驟**：
  ```bash
  # 安裝 Trello MCP
  claude mcp add trello "npx @delorenj/mcp-server-trello"

  # 檢查配置
  cat ~/.claude.json | grep -A 10 trello
  ```
- **發現的配置**：
  - Trello API Key: a609c74aab4ffdaf9726563e492048d9
  - Trello Token: ATTA30eb7fdb1f741ad1dac9234d1fb52fa9419c63c...
- **下一步**：需要重啟 Claude Code 讓 Trello MCP 生效

#### 技術工具使用經驗

**Gmail MCP 最佳實踐**：
```javascript
// 1. 搜尋特定寄件人
mcp__gmail__gmail_list_emails({query: "from:email@domain.com"})

// 2. 搜尋關鍵字（中文）
mcp__gmail__gmail_list_emails({query: "天下 OR 採訪"})

// 3. 高級過濾搜尋
mcp__gmail__gmail_list_emails_with_advanced_filters({
  hasWords: "關鍵字",
  isRead: false,
  maxResults: 10
})

// 4. 讀取郵件內容
mcp__gmail__gmail_read_email({messageId: "xxx"})

// 5. 發送郵件
mcp__gmail__gmail_send_email({
  to: ["recipient@email.com"],
  subject: "主旨",
  body: "內容"
})
```

**Google Calendar MCP 最佳實踐**：
```javascript
// 創建事件時的重要設置
mcp__gcal__create-event({
  calendarId: "primary",
  summary: "事件標題",
  start: "2025-10-29T09:00:00",  // 使用本地時間
  end: "2025-10-29T11:00:00",
  timeZone: "Asia/Taipei",        // 明確指定時區
  reminders: {
    useDefault: false,
    overrides: [
      {method: "popup", minutes: 1440},  // 一天前
      {method: "email", minutes: 2880}   // 兩天前郵件
    ]
  },
  description: "詳細資訊，包含聯絡方式、地點等"
})
```

#### 工作流程優化建議

**CEO 每日郵件管理流程**：
1. 使用 `mcp__gmail__gmail_list_emails_with_advanced_filters` 篩選未讀重要郵件
2. 識別需要回覆、委派、或添加行程的郵件
3. 立即處理截止日期相關郵件
4. 將行程添加到 Google Calendar，設置適當提醒
5. 委派任務給秘書或團隊成員

**截止日期管理最佳實踐**：
- 在 Gmail 中搜尋特定會議或活動名稱（如 "MIE 2026"）
- 提取關鍵資訊：截止日期、會議日期、地點、聯絡人
- 同時添加到 Google Calendar 和 Trello
- 設置多層次提醒（一週、兩天、一天前）

**聯絡人管理**：
- 重要聯絡人（如秘書雅君）的資訊應記錄在項目文檔中
- Gmail 往來記錄是查找聯絡方式的可靠來源
- 可以建立聯絡人資料庫文件（JSON 或 CSV 格式）

#### 下次對話建議

**待完成任務**：
1. 重啟 Claude Code 以啟用 Trello MCP
2. 將 MIE 2026 截止日期添加到 Trello 看板
3. 確認天下雜誌採訪的會議地點（等待雅君回覆）
4. 建立聯絡人資料庫文件

**可以詢問的指令範例**：
- "幫我檢查今天的行程"
- "查看未讀的重要郵件"
- "將這個任務添加到 Trello"
- "提醒我明天要做什麼"

#### 關鍵聯絡人

| 姓名 | 職位 | 郵箱 | 備註 |
|------|------|------|------|
| 盧雅君 | 秘書/助理 | sj917927love@gmail.com | 負責會議安排、行程管理 |
| 簡嘉佑 | 天下雜誌記者 | joshjian@cw.com.tw | 醫療教育組，電話：+886-909-203-918 |

#### Trello 看板資訊

- **Mark 個人助理**: https://trello.com/b/dQW5re2h
- **Team Mark**: https://trello.com/b/iYz31GXX

---

### 2025-10-23 NHIA XML LOINC Mapping Verification Project

#### 任務概述
協助健保署（NHIA）釐清三軍總醫院（Tri-Service General Hospital）XML檔案與LOINC報告之間的對應問題，進行完整的技術分析與驗證。

#### 問題背景
健保署來信（林俊逸 A111505@nhi.gov.tw）指出三總XML檔案對應LOINC報告有以下三類問題：

**1. 🟢 綠底標記（14項）**
- **問題描述**：檢驗項目LOINC碼無法對應報告（如：序號5 WBC Stool）
- **實際發現**：這些項目在XML中都存在且大量使用
- **真相**：
  - INR (6301-6): 161次記錄
  - Pro-BNP (83107-3): 85次記錄
  - Direct Bilirubin (15152-2): 79次記錄
  - 共14項，出現頻率9-161次
- **原因**：不在Top 200報告範圍內，但都是實際使用的檢驗項目
- **建議**：應補充到最終報告中

**2. 🟡 黃底標記（16項）**
- **問題描述**：檢驗項目LOINC碼對應報告中萬芳醫院的LOINC碼（如：序號1 RH TYPE）
- **現象**：三總XML使用了萬芳醫院（Wanfang Hospital）的LOINC mapping結果
- **建議**：確認三總是否應建立自己的對應碼，或說明為何參考萬芳結果

**3. 🌸 粉底標記（30項）**
- **問題描述**：檢驗項目LOINC碼與報告LOINC碼不同（如：序號4 APTT Control）
- **分析結果**：每個項目情況不同，需逐一分析

#### 關鍵技術發現

**案例1: APTT Control - XML更精確**
```
XML碼: 13488-2 (APTT Control - quality control sample) - 160次
      14979-9 (Aptt patient - patient sample) - 160次
報告碼: 16629-8 (APTT - general)

結論: XML精確區分QC vs Patient樣本，報告較籠統
建議: 保留XML的區分，或更新報告
```

**案例2: pH - 報告有誤**
```
XML碼: 50560-2 (pH of Urine by Test strip) - 376次記錄
報告碼: 2888-6 (Protein [Mass/volume] in Serum or Plasma)

結論: 報告將2888-6錯誤用於三個不同項目（Total Protein、pH、Urine Protein）
建議: XML正確，報告需更正
```

**案例3: Color - XML有誤（重大發現）⚠️**
```
XML碼: 9397-1 (Color of STOOL - 糞便顏色)
報告碼: 5778-6 (Color of URINE - 尿液顏色)

ED檔案驗證:
- 萬芳ED檔案: 5778-6 (Color of Urine), 檢體: Foly urine
- 三總ED檔案: 5778-6 (Color of Urine), 檢體: Urines (2151筆)

結論: XML誤用糞便顏色碼於尿液檢驗，Body System錯誤
建議: 以報告和ED檔案為準，XML需修正為5778-6
```

#### 技術方法與工具

**1. XML分析**
```python
# 使用Big5編碼讀取XML
import xml.etree.ElementTree as ET

with open('1007住院下午.xml', 'r', encoding='big5') as f:
    xml_content = f.read()
root = ET.fromstring(xml_content)

# 分析LOINC碼使用頻率
for rdata in root.findall('.//rdata'):
    r2 = rdata.find('r2')   # 檢驗項目名稱
    r11 = rdata.find('r11')  # LOINC代碼
    r4 = rdata.find('r4')    # 檢驗值
```

**2. Excel分析與回覆生成**
```python
import pandas as pd
import openpyxl

# 讀取問題清單
df = pd.read_excel('附件1-三總(配對) (1).xlsx')

# 根據顏色類型生成回覆
def generate_answer(row_data, color_type):
    if color_type == 'green':
        return f"此項目在三總實際XML資料中存在且有使用（出現{count}次），建議補充到最終報告中。"
    elif color_type == 'yellow':
        return f"此項目三總報告中無對應，XML使用了萬芳醫院的LOINC mapping結果。建議確認三總是否應建立自己的對應碼。"
    elif color_type == 'pink':
        return f"XML使用碼{loinc}與報告編號{report_num}的碼{report_loinc}不一致。建議查詢LOINC官方資料庫確認正確碼。"
```

**3. ED Mapping檔案比對**
```bash
# ED檔案位置
/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/saved_mappings/
├── AAA_Hospital/                      # 萬芳醫院
│   └── loinc_mapping_*.json
└── Tri-Service_General_Hospital/     # 三軍總醫院
    └── loinc_mapping_*.json

# ED檔案結構
{
  "metadata": {...},
  "labDataContext": {
    "labItemName": "Color",
    "itemId": "COLOR",
    "labSampleType": "Urines"
  },
  "selectedLoincCodes": ["5778-6"]
}
```

#### 重要資料檔案

**XML檔案**
- `1007住院下午.xml` (10.1 MB, 15,270筆記錄)
- `1007住院上午.xml` (3.5 MB, 5,478筆記錄)
- 其他4個XML檔案

**Excel檔案**
- 輸入: `附件1-三總(配對) (1).xlsx` (60項問題清單)
- 輸出: `附件1-三總(配對)_final_with_ED_analysis.xlsx` (含完整回覆)

**ED Mapping檔案**
- 萬芳醫院: `saved_mappings/AAA_Hospital/loinc_mapping_2025-09-14T21-50-21-313Z.json`
- 三軍總醫院: `saved_mappings/Tri-Service_General_Hospital/loinc_mapping_2025-09-14T19-13-13-961Z.json`

#### 交付成果

**1. 完整回覆Excel檔案**
- 檔名: `附件1-三總(配對)_final_with_ED_analysis.xlsx`
- 內容: 新增「健保署回覆」欄位，包含60筆詳細回覆說明
- 特色: 每項問題都有具體分析、證據來源、建議方案

**2. Color項目ED檔案比對表**
```
                    萬芳醫院              三軍總醫院
醫院名稱            AAA Hospital         Tri-Service Hospital
Item ID             FCOL                 COLOR
項目排名            179                  106
總記錄數            40                   2151
檢體類型            Foly urine           Urines
ED檔案選擇的LOINC碼 5778-6               5778-6
LOINC全名           Color of Urine       Color of Urine

結論: XML的9397-1(Stool)是錯誤的，應為5778-6(Urine)
```

**3. Trello任務追蹤**
- 卡片: 🏥 健保署三總XML檔案LOINC對應問題釐清
- 連結: https://trello.com/c/PfPuZKHM
- 狀態: 已完成完整分析 ✅
- 期限: 2025-10-30

#### 統計數據

**XML檔案分析統計**
- 總XML檔案數: 6個
- 總記錄數: 約2萬筆
- 唯一LOINC碼數: 103+
- 問題項目數: 60項（14綠+16黃+30粉）

**問題分布**
- 🟢 XML有但報告無: 14項 (23.3%)
- 🟡 使用萬芳碼: 16項 (26.7%)
- 🌸 碼不一致: 30項 (50.0%)

**重大發現**
- XML更精確的項目: 2項 (APTT Control, Pro-BNP)
- 報告有誤的項目: 1項 (pH)
- XML有誤的項目: 1項 (Color - Body System錯誤)

#### 關鍵學習與最佳實踐

**1. XML編碼處理**
```python
# ❌ 錯誤: 直接使用ET.parse()
tree = ET.parse('file.xml')  # 會遇到Big5編碼問題

# ✅ 正確: 先讀取內容再解析
with open('file.xml', 'r', encoding='big5') as f:
    content = f.read()
root = ET.fromstring(content)
```

**2. ED檔案是驗證的金標準**
- ED (Enhanced Data) mapping檔案記錄了AI輔助mapping的完整過程
- 包含: 檢體類型、記錄數、相似度評分
- 當XML與報告不一致時，ED檔案可作為驗證依據

**3. LOINC碼的六個維度**
LOINC碼由六個維度組成（Component, Property, Timing, System, Scale, Method）：
- **Component**: 被檢測的物質（如Color, pH, Protein）
- **Property**: 屬性類型（如濃度、質量、pH值）
- **Timing**: 時間點（如空腹、餐後）
- **System**: 體系統（如Urine vs Stool - 本次發現的關鍵錯誤！）
- **Scale**: 量表（如定量、定性）
- **Method**: 檢測方法（如試紙、儀器）

錯用Body System（如Color項目用Stool碼於Urine檢體）是嚴重錯誤。

**4. 多來源證據驗證法**
```
問題: XML碼 vs 報告碼不一致
    ↓
證據來源1: XML實際使用頻率分析
證據來源2: ED mapping檔案（AI建議）
證據來源3: LOINC官方定義
證據來源4: 檢體類型（Specimen Type）
    ↓
交叉驗證 → 確定正確碼
```

#### 聯絡資訊

**健保署聯絡人**
- 姓名: 林俊逸
- Email: A111505@nhi.gov.tw
- 機關: 衛生福利部中央健康保險署
- 用途: 辦理核銷、LOINC mapping驗證

**截止日期**
- 回覆期限: 2025-10-30
- 任務類型: LOINC mapping驗證與報告更正

#### Python依賴套件

```bash
# 本分析需要的Python套件
pip3 install pandas openpyxl --quiet
```

#### 下次類似任務建議

**工作流程**
1. 先分析Excel問題清單，理解問題類型
2. 解析XML檔案（注意Big5編碼），統計LOINC碼使用頻率
3. 比對ED mapping檔案（AI建議的金標準）
4. 查詢LOINC官方定義確認語義
5. 生成結構化回覆（包含證據、分析、建議）
6. 更新Trello追蹤進度

**技術工具**
- XML解析: xml.etree.ElementTree (Python)
- Excel處理: pandas + openpyxl (Python)
- JSON分析: Python json module
- 版本控制: Git (記錄所有分析檔案)

**文檔記錄**
- 保留所有原始檔案（XML, Excel, JSON）
- 記錄分析過程和決策理由
- 產出可追溯的證據鏈
- 更新README記錄關鍵發現

---

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Contact the maintainers
- Check the documentation

---

**Made with ❤️ for the medical community**

*This tool helps healthcare professionals quickly and accurately identify LOINC codes for laboratory tests, improving patient care and data standardization.*
