# 請萬達人解釋搜尋結果 - 自動選中整合指南

## 概述

本指南說明如何整合"請萬達人解釋搜尋結果"功能的自動選中 LOINC 代碼功能。當用戶點擊此按鈕時，系統會分析搜尋結果並建議最佳的 LOINC 代碼，然後自動選中該代碼的核取方塊。

## 功能特點

- ✅ 利用豐富的搜尋結果資料進行 AI 分析
- ✅ 包含實驗室背景資訊（如果提供）
- ✅ 提供詳細的專業分析報告
- ✅ 自動建議最佳的 LOINC 代碼
- ✅ 自動選中建議的代碼核取方塊
- ✅ 視覺化高亮顯示選中的代碼

## 後端修改

### 1. `/api/analyze` 端點增強

已修改 `/api/analyze` 端點，新增以下功能：

```javascript
// 在 AI 分析提示詞中添加明確的建議要求
### 5. 最佳 LOINC 代碼建議<br>

**請在分析的最後明確推薦一個最佳的 LOINC 代碼，格式如下：**<br>
**推薦的 LOINC 代碼：[LOINC代碼]**<br>

**重要提醒：**
- **必須在最後包含推薦的 LOINC 代碼，格式為「推薦的 LOINC 代碼：[代碼]」**
```

### 2. 回應格式更新

端點現在回傳包含 `suggestedLoincCode` 的 JSON 回應：

```json
{
  "summary": "AI 分析結果...",
  "suggestedLoincCode": "2888-6"
}
```

### 3. LOINC 代碼提取邏輯

使用多種正則表達式模式來提取建議的代碼：

```javascript
const loincPatterns = [
  /推薦的 LOINC 代碼[：:]\s*(\d+-\d+)/gi,  // 專門匹配推薦格式
  /LOINC[:\s]*(\d+-\d+)/gi,
  /(\d+-\d+)/g,  // Simple pattern for XX-XX format
  /LOINC[:\s]*(\d{5}-\d{1})/gi  // More specific LOINC format
];
```

## 前端整合

### 1. 引入自動選中腳本

```html
<script src="/auto-select-loinc.js"></script>
```

### 2. 修改 analyze() 函數

在現有的 `analyze()` 函數中添加自動選中邏輯：

```javascript
async function analyze() {
    // ... 現有的搜尋和分析邏輯 ...
    
    const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            sessionId: sessionId,
            results: currentSearchResults,
            searchTerms: currentSearchTerms,
            mustHaveTerms: currentMustHaveTerms,
            labDataContext: labDataContext
        })
    });

    const data = await response.json();
    
    // 顯示分析結果
    currentAnalysis = data.summary;
    // ... 現有的顯示邏輯 ...
    
    // 新增：如果有建議的 LOINC 代碼，自動選中
    if (data.suggestedLoincCode) {
        console.log('AI 建議選中 LOINC 代碼:', data.suggestedLoincCode);
        
        // 延遲一點時間讓 UI 更新完成
        setTimeout(() => {
            autoSelectSuggestedLoinc(data.suggestedLoincCode);
        }, 500);
    }
}
```

### 3. 確保核取方塊有正確的 value 屬性

確保每個 LOINC 代碼的核取方塊都有對應的 `value` 屬性：

```html
<input type="checkbox" 
       class="loinc-checkbox" 
       value="2888-6" 
       onchange="toggleSelection('2888-6')">
```

## 使用範例

### 1. 基本使用

```javascript
// 點擊"請萬達人解釋搜尋結果"按鈕
document.getElementById('analyzeBtn').click();

// 系統會自動：
// 1. 分析搜尋結果
// 2. 生成 AI 建議
// 3. 提取建議的 LOINC 代碼
// 4. 自動選中對應的核取方塊
// 5. 顯示視覺化高亮
```

### 2. 手動觸發自動選中

```javascript
// 如果已經有建議的 LOINC 代碼
const suggestedCode = "2888-6";
autoSelectSuggestedLoinc(suggestedCode);
```

## 測試

### 1. 測試 API 端點

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test123",
    "results": [
      {
        "loincNum": "2888-6",
        "component": "Protein",
        "longCommonName": "Protein [Mass/volume] in Urine",
        "similarityScore": 0.95
      }
    ],
    "searchTerms": "protein urine"
  }' \
  http://localhost:3002/api/analyze
```

### 2. 預期回應

```json
{
  "summary": "## 分析結果\n\n### 5. 最佳 LOINC 代碼建議\n\n**推薦的 LOINC 代碼：2888-6**\n\n...",
  "suggestedLoincCode": "2888-6"
}
```

## 範例頁面

查看 `analyze-integration-example.html` 以了解完整的整合範例。

## 注意事項

1. **依賴性**: 需要 `auto-select-loinc.js` 腳本
2. **時機**: 建議在 UI 更新完成後再觸發自動選中
3. **錯誤處理**: 如果找不到對應的核取方塊，會顯示警告訊息
4. **視覺回饋**: 選中的代碼會有高亮效果和通知訊息

## 故障排除

### 1. 核取方塊沒有被選中

- 檢查核取方塊是否有正確的 `value` 屬性
- 確認 `autoSelectSuggestedLoinc` 函數已正確載入
- 檢查控制台是否有錯誤訊息

### 2. 沒有收到建議的代碼

- 檢查 AI 分析是否包含"推薦的 LOINC 代碼："格式
- 確認正則表達式模式是否正確匹配
- 檢查 API 回應是否包含 `suggestedLoincCode` 欄位

### 3. 視覺效果沒有顯示

- 確認 CSS 樣式已正確載入
- 檢查 `highlight` 類別是否正確定義
- 確認通知訊息函數是否正常工作

