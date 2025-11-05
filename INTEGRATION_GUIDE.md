# AI Mapping Suggestions 自動選擇 LOINC 代碼集成指南

## 功能說明

當用戶使用 AI Mapping Suggestions 或 Ask Stan 功能後，如果 AI 在回應中建議了特定的 LOINC 代碼，系統會自動選中該代碼的 checkbox。

## 後端修改

### 1. AI Mapping Suggestions 端點修改

在 `/api/generate-mapping-suggestions` 端點的回應中添加了 `suggestedLoincCode` 字段：

```javascript
// 在回應中包含建議的 LOINC 代碼
res.json({
    mappingAnalysis: aiMappingAnalysis,
    loincDetails: loincDetails,
    suggestedLoincCode: suggestedLoincCode  // 新增字段
});
```

### 2. Ask Stan 端點修改

在 `/api/ask-stan` 端點的回應中也添加了 `suggestedLoincCode` 字段：

```javascript
// 在回應中包含建議的 LOINC 代碼
res.json({
    success: true,
    message: '...',
    // ... 其他字段
    suggestedLoincCode: suggestedLoincCode  // 新增字段
});
```

### 3. LOINC 代碼提取邏輯

系統會從 AI 分析中自動提取 LOINC 代碼：

```javascript
// 支援多種 LOINC 代碼格式
const loincPatterns = [
    /LOINC[:\s]*(\d+-\d+)/gi,
    /(\d+-\d+)/g,  // 簡單的 XX-XX 格式
    /LOINC[:\s]*(\d{5}-\d{1})/gi  // 更特定的 LOINC 格式
];
```

## 前端集成

### 1. 引入自動選擇腳本

```html
<script src="auto-select-loinc.js"></script>
```

### 2. 在 AI Mapping Suggestions 請求後調用

```javascript
// 發送 AI Mapping Suggestions 請求
const response = await fetch('/api/generate-mapping-suggestions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        sessionId: 'your-session-id',
        selectedLoincCodes: selectedCodes,
        originalSearchTerms: 'your search terms'
    })
});

const result = await response.json();

if (result.suggestedLoincCode) {
    // 自動選中建議的 LOINC 代碼
    autoSelectSuggestedLoinc(result.suggestedLoincCode);
}
```

### 3. 在 Ask Stan 請求後調用

```javascript
// 發送 Ask Stan 請求
const response = await fetch('/api/ask-stan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mappingData)
});

const result = await response.json();

if (result.success && result.suggestedLoincCode) {
    // 自動選中建議的 LOINC 代碼
    autoSelectSuggestedLoinc(result.suggestedLoincCode);
}
```

### 4. 核心函數

```javascript
// 自動選中建議的 LOINC 代碼
function autoSelectSuggestedLoinc(suggestedLoincCode) {
    const checkbox = document.querySelector(`input[type="checkbox"][value="${suggestedLoincCode}"]`);
    
    if (checkbox) {
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        
        // 視覺反饋
        checkbox.closest('tr')?.classList.add('suggested-loinc');
        
        // 顯示通知
        showNotification(`已自動選中建議的 LOINC 代碼: ${suggestedLoincCode}`, 'success');
    }
}
```

## 使用範例

### 完整的集成範例

```html
<!DOCTYPE html>
<html>
<head>
    <title>LOINC 搜索</title>
</head>
<body>
    <!-- LOINC 代碼表格 -->
    <table>
        <tr>
            <td><input type="checkbox" value="2888-6" onchange="handleChange(this)"></td>
            <td>2888-6 - Protein in Urine</td>
        </tr>
        <!-- 更多行... -->
    </table>
    
    <button onclick="askStan()">請萬達人解釋搜尋結果</button>
    
    <script src="auto-select-loinc.js"></script>
    <script>
        async function askStan() {
            const response = await fetch('/api/ask-stan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mappingData: {
                        searchTerms: "protein urine",
                        selectedLoincCodes: getSelectedCodes(),
                        aiAnalysis: "用戶的 AI 分析內容..."
                    }
                })
            });
            
            const result = await response.json();
            
            if (result.success && result.suggestedLoincCode) {
                autoSelectSuggestedLoinc(result.suggestedLoincCode);
            }
        }
        
        function getSelectedCodes() {
            return Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
                        .map(cb => cb.value);
        }
        
        function handleChange(checkbox) {
            // 處理 checkbox 變更
            console.log('Selected:', checkbox.value, checkbox.checked);
        }
    </script>
</body>
</html>
```

## 測試

### 1. 測試 AI Mapping Suggestions 端點

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"sessionId":"test123","selectedLoincCodes":["2888-6"],"originalSearchTerms":"protein urine"}' \
  http://localhost:3002/api/generate-mapping-suggestions
```

### 2. 測試 Ask Stan 端點

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"mappingData":{"searchTerms":"protein urine","aiAnalysis":"建議使用 LOINC 代碼 2888-6"}}' \
  http://localhost:3002/api/ask-stan
```

### 3. 預期回應

**AI Mapping Suggestions 回應：**
```json
{
  "mappingAnalysis": "## 映射分析結果...",
  "loincDetails": [...],
  "suggestedLoincCode": "2888-6"
}
```

**Ask Stan 回應：**
```json
{
  "success": true,
  "message": "已成功發送給 Stan",
  "suggestedLoincCode": "2888-6",
  "englishContent": { ... }
}
```

## 注意事項

1. **Checkbox 格式**：確保 checkbox 的 `value` 屬性與 LOINC 代碼完全匹配
2. **事件觸發**：自動選中後會觸發 `change` 事件，確保相關邏輯被執行
3. **視覺反饋**：選中的行會添加 `suggested-loinc` 類別，可自定義樣式
4. **錯誤處理**：如果找不到對應的 checkbox，會顯示警告訊息

## 自定義樣式

```css
.suggested-loinc {
    background-color: #e8f5e8 !important;
    border-left: 4px solid #4CAF50 !important;
}
```

## 文件位置

- 後端修改：`loinc-search-server.js` 
  - AI Mapping Suggestions: 第 1745-1769 行
  - Ask Stan: 第 2797-2817 行
- 前端腳本：`auto-select-loinc.js`
- 完整範例：
  - `ai-mapping-suggestions-example.html` (AI Mapping Suggestions)
  - `ask-stan-integration-example.html` (Ask Stan)
- 集成指南：`INTEGRATION_GUIDE.md`
