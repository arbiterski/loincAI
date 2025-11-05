const puppeteer = require('puppeteer');
const fs = require('fs');

async function captureScreenshots() {
    try {
        console.log('啟動瀏覽器進行截圖...');

        const browser = await puppeteer.launch({
            headless: false, // 設為 false 可以看到瀏覽器操作
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        // 等待伺服器啟動
        console.log('等待伺服器啟動...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 截圖1: 主頁面
        console.log('截圖1: 主頁面');
        await page.goto('http://localhost:3002');
        await page.waitForTimeout(2000);
        await page.screenshot({
            path: '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/screenshots/01_main_page.png',
            fullPage: true
        });

        // 截圖2: 搜尋示例 - 輸入GLU
        console.log('截圖2: 搜尋示例');
        await page.type('#searchTerms', 'Glucose mg/dL Blood');
        await page.type('#mustHaveTerms', 'Glucose');
        await page.screenshot({
            path: '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/screenshots/02_search_input.png',
            fullPage: true
        });

        // 截圖3: 搜尋結果
        console.log('截圖3: 搜尋結果');
        await page.click('#searchButton');
        await page.waitForTimeout(3000);
        await page.screenshot({
            path: '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/screenshots/03_search_results.png',
            fullPage: true
        });

        // 截圖4: 選擇LOINC代碼
        console.log('截圖4: 選擇LOINC代碼');
        // 嘗試選擇第一個結果
        const firstCheckbox = await page.$('input[type="checkbox"]:not([checked])');
        if (firstCheckbox) {
            await firstCheckbox.click();
            await page.waitForTimeout(1000);
        }
        await page.screenshot({
            path: '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/screenshots/04_loinc_selection.png',
            fullPage: true
        });

        // 截圖5: AI分析功能
        console.log('截圖5: AI分析功能');
        await page.click('#askStanButton');
        await page.waitForTimeout(5000); // AI分析需要較長時間
        await page.screenshot({
            path: '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/screenshots/05_ai_analysis.png',
            fullPage: true
        });

        // 截圖6: 保存功能
        console.log('截圖6: 保存功能');
        await page.click('#saveMapping');
        await page.waitForTimeout(2000);
        await page.screenshot({
            path: '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/screenshots/06_save_mapping.png',
            fullPage: true
        });

        await browser.close();
        console.log('✅ 所有截圖完成');

        // 創建功能說明文件
        const featureDescription = `# LOINC 半自動 Mapping 網頁程式功能說明

## 系統概述
loinc-search-server.js 是一個先進的半自動 LOINC 對應網頁應用程式，提供智能化的檢驗項目與 LOINC 代碼對應功能。

## 主要功能特色

### 1. 智能搜尋功能
- **關鍵字搜尋**: 支援檢驗項目名稱、單位、檢體類型等多維度搜尋
- **必要條件**: 可設定必須包含的關鍵字，提升搜尋精確度
- **模糊匹配**: 支援部分關鍵字匹配，增加搜尋靈活性

### 2. LOINC 代碼推薦
- **相似度評分**: 自動計算每個 LOINC 代碼與搜尋條件的相似度
- **排序顯示**: 按相似度高低排序顯示候選 LOINC 代碼
- **詳細資訊**: 顯示 LOINC 代碼的完整資訊（組件、檢體、方法等）

### 3. AI 分析輔助
- **專家級分析**: 整合 AI 技術提供專業的對應建議
- **決策支援**: 分析各候選代碼的適用性與注意事項
- **品質保證**: 提供對應理由與專業建議

### 4. 對應結果管理
- **即時保存**: 一鍵保存對應結果為 JSON 格式
- **歷程追蹤**: 記錄完整的對應歷程與時間戳記
- **版本控制**: 支援對應結果的修改與版本管理

### 5. 使用者介面
- **直觀操作**: 簡潔明瞭的網頁介面，易於上手
- **響應式設計**: 支援不同螢幕尺寸的設備
- **即時回饋**: 提供即時的操作回饋與狀態顯示

## 技術特點

### 後端架構
- **Node.js + Express**: 高效能的伺服器架構
- **CSV 資料庫**: 77MB 完整 LOINC 資料庫，快速查詢
- **智能演算法**: 先進的文字匹配與相似度計算

### 前端技術
- **現代 Web 技術**: HTML5、CSS3、JavaScript ES6+
- **Ajax 非同步**: 流暢的使用者體驗
- **動態載入**: 高效的資料載入與顯示

### 整合功能
- **AI 服務整合**: 智能分析與建議功能
- **檔案管理**: 自動化的結果儲存與管理
- **日誌記錄**: 完整的操作記錄與稽核功能

## 操作流程

1. **輸入搜尋條件**: 在搜尋框輸入檢驗項目相關資訊
2. **執行搜尋**: 系統自動搜尋相關 LOINC 代碼
3. **檢視結果**: 瀏覽按相似度排序的候選代碼
4. **選擇對應**: 勾選最適合的 LOINC 代碼
5. **AI 分析**: 可選擇使用 AI 進行深度分析
6. **保存結果**: 一鍵保存對應結果

## 系統效益

### 提升效率
- **半自動化**: 大幅減少人工對應時間
- **智能推薦**: 快速找到最適合的 LOINC 代碼
- **批量處理**: 支援大量檢驗項目的快速對應

### 確保品質
- **標準化流程**: 統一的對應標準與流程
- **AI 輔助**: 專業級的分析與建議
- **追蹤機制**: 完整的對應歷程記錄

### 易於推廣
- **Web 介面**: 無需安裝，瀏覽器即可使用
- **直觀操作**: 簡單易學，降低學習成本
- **擴展性強**: 易於客製化與功能擴展
`;

        fs.writeFileSync('/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/loinc_system_features.md', featureDescription);

        console.log('✅ 功能說明文件已生成: loinc_system_features.md');

    } catch (error) {
        console.error('截圖過程中發生錯誤:', error);
    }
}

// 創建截圖目錄
const screenshotDir = '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/screenshots';
if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
}

// 執行截圖
captureScreenshots();