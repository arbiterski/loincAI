# 快速集成指南：AI Mapping Suggestions 自動選擇功能

## 問題
您的網頁在 AI Mapping Suggestions 回應後沒有自動選中建議的 LOINC 代碼。

## 解決方案

### 1. 確保引入自動選擇腳本
在您的 HTML 頁面中添加：
```html
<script src="auto-select-loinc.js"></script>
```

### 2. 在 AI Mapping Suggestions 回應後調用自動選擇函數

找到您的 AI Mapping Suggestions 請求處理代碼，在收到回應後添加：

```javascript
// 您的 AI Mapping Suggestions 請求代碼
const response = await fetch('/api/generate-mapping-suggestions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        sessionId: 'your-session-id',
        selectedLoincCodes: selectedCodes,
        originalSearchTerms: searchTerms
    })
});

const result = await response.json();

// 添加這幾行代碼：
if (result.suggestedLoincCode) {
    console.log('AI 建議的 LOINC 代碼:', result.suggestedLoincCode);
    autoSelectSuggestedLoinc(result.suggestedLoincCode);
}
```

### 3. 確保 checkbox 的 value 屬性正確

確保您的 LOINC 代碼 checkbox 的 `value` 屬性與 LOINC 代碼完全匹配：

```html
<input type="checkbox" value="785-6" onchange="handleCheckboxChange(this)">
```

### 4. 測試功能

1. 打開瀏覽器開發者工具 (F12)
2. 執行 AI Mapping Suggestions
3. 查看控制台是否有 "AI 建議的 LOINC 代碼: 785-6" 的訊息
4. 檢查是否有 "Successfully selected LOINC code: 785-6" 的訊息

### 5. 完整範例

查看 `complete-integration-example.html` 文件，這是一個完整的集成範例。

## 常見問題

### Q: 為什麼沒有自動選中？
A: 檢查以下幾點：
1. 是否正確引入了 `auto-select-loinc.js` 腳本
2. 是否在 AI Mapping Suggestions 回應後調用了 `autoSelectSuggestedLoinc()` 函數
3. 檢查控制台是否有錯誤訊息
4. 確認 checkbox 的 `value` 屬性與建議的 LOINC 代碼匹配

### Q: 如何調試？
A: 在瀏覽器開發者工具中：
1. 查看 Console 標籤的訊息
2. 檢查 Network 標籤確認 API 請求是否成功
3. 確認 `result.suggestedLoincCode` 是否有值

## 測試頁面

使用以下測試頁面驗證功能：
- `test-auto-select.html` - 基本功能測試
- `complete-integration-example.html` - 完整集成範例
- `ai-mapping-suggestions-example.html` - AI Mapping Suggestions 專用範例

