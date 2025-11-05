const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

async function generateUpdatedReport() {
  const baseDir = '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC';
  try {
    // Load data
    const aaaData = JSON.parse(fs.readFileSync(path.join(baseDir, 'aaa_hospital_final_200.json'), 'utf8'));
    const triData = JSON.parse(fs.readFileSync(path.join(baseDir, 'tri_service_final_200.json'), 'utf8'));
    let crossAnalysis = null;
    try {
      crossAnalysis = JSON.parse(fs.readFileSync(path.join(baseDir, 'cross_analysis_results.json'), 'utf8'));
    } catch {}
    const aaaIssuesText = fs.existsSync(path.join(baseDir, 'aaa_hospital_missing_ranks.txt'))
      ? fs.readFileSync(path.join(baseDir, 'aaa_hospital_missing_ranks.txt'), 'utf8')
      : '';
    const triIssuesText = fs.existsSync(path.join(baseDir, 'tri_service_missing_ranks.txt'))
      ? fs.readFileSync(path.join(baseDir, 'tri_service_missing_ranks.txt'), 'utf8')
      : '';

    console.log('=== 生成模板對齊的完整報告（含圖片） ===');
    console.log(`萬芳醫院項目數: ${aaaData.length}`);
    console.log(`三軍總醫院項目數: ${triData.length}`);

    // Images to base64
    const imageFiles = ['report1.png', 'report2.png', 'report3.png', 'report4.png', 'report5.png', 'report6.png'];
    const base64Images = {};
    for (const f of imageFiles) {
      const p = path.join(baseDir, f);
      if (fs.existsSync(p)) {
        base64Images[f] = `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
        console.log('已轉換圖片:', f);
      }
    }

    // Stats
    const totalItems = aaaData.length + triData.length;
    const aaaFileCount = 202; // from analysis
    const triFileCount = 201; // from analysis
    const totalFiles = aaaFileCount + triFileCount;
    const today = new Date();
    const zhDate = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;

    // Helpers
    const listFromText = (text) => {
      if (!text) return '<p>無</p>';
      const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      if (lines.length === 0) return '<p>無</p>';
      return '<ul>' + lines.map((l) => `<li>${l.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</li>`).join('') + '</ul>';
    };

    // Sections in template order + your new sections
    const coverHeader = `
      <div class="header">
        <h1>健保署 LOINC Mapping 計畫</h1>
        <div class="subtitle">完整實施報告</div>
        <div class="subtitle">Taiwan LOINC Implementation Project — Complete Implementation Report</div>
        <div class="subtitle">TAMI AI LOINC Taiwan top 100 推動小組</div>
        <div class="subtitle">報告日期：${zhDate}</div>
      </div>`;

    const versionNote = `
      <div class="version-note">
        <strong>📋 版本說明：</strong> 本報告依「健保署 LOINC Mapping 計畫_Template.docx」章節對齊，並基於校正後資料生成。
      </div>`;

    const sectionExecSummary = `
      <h2>一、執行摘要</h2>
      <div class="executive-summary">
        <p>兩家醫學中心完成 Top 200 檢驗項目的完整對應，達成 100% 完成率，建立高品質 LOINC 對應關係。</p>
        <div class="statistics">
          <div class="stat-box"><div class="stat-number">2</div><div class="stat-label">參與醫院</div></div>
          <div class="stat-box"><div class="stat-number">${totalItems}</div><div class="stat-label">總對應項目</div></div>
          <div class="stat-box"><div class="stat-number">${totalFiles}</div><div class="stat-label">對應檔案數</div></div>
          <div class="stat-box"><div class="stat-number">100%</div><div class="stat-label">完成率</div></div>
          <div class="stat-box"><div class="stat-number">0</div><div class="stat-label">缺漏項目</div></div>
        </div>
      </div>`;

    const sectionBackground = `
      <h2>二、計畫背景與目標</h2>
      <div class="methodology">
        <h3>計畫背景</h3>
        <p>LOINC 為國際通用之檢驗與臨床觀察標準代碼系統，推動本計畫以提升資料互通與再利用。</p>
        <h3>計畫目標</h3>
        <ul>
          <li>兩家醫學中心 Top 200 檢驗項目完成標準對應</li>
          <li>標準化流程、品質保證與審計軌跡</li>
          <li>形成可全國推廣之治理與技術作法</li>
        </ul>
      </div>`;

    const sectionStanHuff = `
      <h2>三、LOINC 主席 Stan Huff 專家建議</h2>
      <div class="methodology">
        <ul>
          <li>Ser/Plas 可於方法與參考值一致情境共用；Bld 僅限全血檢測。</li>
          <li>機構層級鼓勵對應至最具體 LOINC；研究層級以群組對應表彈性聚合。</li>
        </ul>
      </div>`;

    const sectionNational = `
      <h2>四、國家級推動建議</h2>
      <div class="methodology">
        <ul>
          <li>建立國家級 LOINC 治理框架與最佳實務指引</li>
          <li>分階段推廣：示範院 → 主要醫院 → 全國</li>
        </ul>
      </div>`;

    const sectionDataPrep = `
      <h2>五、資料準備與對應策略</h2>
      <div class="methodology">
        <h3>資料準備</h3>
        <ul>
          <li>建立標準 CSV 欄位（排名、名稱、代碼、單位、檢體、備註）</li>
          <li>清理重複項、補齊缺漏、校正欄位一致性</li>
        </ul>
        <h3>對應策略</h3>
        <ul>
          <li>以名稱/檢體/單位為核心，方法碼依院所策略彈性採用</li>
          <li>AI 智能搜尋輔助；專家逐筆確認；跨院交叉驗證</li>
        </ul>
      </div>`;

    const sectionMethod = `
      <h2>六、實施方法與流程</h2>
      <div class="methodology">
        <ol>
          <li>輸入搜尋條件 → 執行智能搜尋 → 瀏覽候選結果</li>
          <li>選擇最佳對應 → AI 深度分析（選用） → 專家確認</li>
          <li>保存結果 → 產生審計軌跡與報告</li>
        </ol>
      </div>`;

    const sectionArch = `
      <h2>七、系統架構與技術特色</h2>
      <div class="methodology">
        <table style="width: 100%; margin: 10px 0;">
          <tr><th style="width:20%;">層級</th><th style="width:30%;">組件</th><th style="width:50%;">功能</th></tr>
          <tr><td><strong>前端</strong></td><td>Web 介面</td><td>條件設定、搜尋與結果檢視</td></tr>
          <tr><td><strong>後端</strong></td><td>搜尋與比對服務</td><td>多欄位相似度排序與規則比對</td></tr>
          <tr><td><strong>資料</strong></td><td>索引與結果庫</td><td>候選 LOINC 與對應紀錄保存</td></tr>
          <tr><td><strong>AI</strong></td><td>分析 API</td><td>對應建議與決策支援</td></tr>
        </table>
      </div>`;

    const sectionUI = `
      <h2>八、系統操作畫面展示</h2>
      <div style="margin: 10px 0;">
        <h4>1. 主要搜尋介面</h4>
        <div style="text-align:center; margin:10px 0; page-break-inside: avoid;">
          <img src="${base64Images['report1.png'] || ''}" style="max-width: 90%; border: 1px solid #ddd; border-radius: 8px;" alt="搜尋介面">
        </div>
        <h4>2. 搜尋結果顯示</h4>
        <div style="text-align:center; margin:10px 0; page-break-inside: avoid;">
          <img src="${base64Images['report2.png'] || ''}" style="max-width: 90%; border: 1px solid #ddd; border-radius: 8px;" alt="搜尋結果">
        </div>
        <h4>3. 實驗室資料輸入</h4>
        <div style="text-align:center; margin:10px 0; page-break-inside: avoid;">
          <img src="${base64Images['report3.png'] || ''}" style="max-width: 90%; border: 1px solid #ddd; border-radius: 8px;" alt="資料輸入">
        </div>
      </div>`;

    const sectionStats = `
      <h2>九、專案統計與成果</h2>
      <div class="methodology">
        <table style="width: 100%; margin: 10px 0;">
          <tr><th style="width:25%;">醫院</th><th style="width:15%;">檔案數</th><th style="width:15%;">有效項目</th><th style="width:15%;">排名覆蓋</th><th style="width:10%;">缺漏</th><th style="width:10%;">完成率</th><th style="width:10%;">狀態</th></tr>
          <tr><td><strong>萬芳醫院</strong></td><td>${aaaFileCount}</td><td>${aaaData.length}</td><td>1-200</td><td>0</td><td>100%</td><td style="color:#27ae60;"><strong>完成</strong></td></tr>
          <tr><td><strong>三軍總醫院</strong></td><td>${triFileCount}</td><td>${triData.length}</td><td>1-200</td><td>0</td><td>100%</td><td style="color:#27ae60;"><strong>完成</strong></td></tr>
          <tr style="background:#f8f9fa; font-weight:bold;"><td>總計</td><td>${totalFiles}</td><td>${totalItems}</td><td>1-200 × 2</td><td>0</td><td>100%</td><td style="color:#27ae60;">完成</td></tr>
        </table>
      </div>`;

    const sectionAAA = `
      <h2>十、萬芳醫院對應結果</h2>
      <div class="statistics">
        <div class="stat-box"><div class="stat-number">${aaaData.length}</div><div class="stat-label">對應項目數</div></div>
        <div class="stat-box"><div class="stat-number">${aaaFileCount}</div><div class="stat-label">對應檔案數</div></div>
        <div class="stat-box"><div class="stat-number">100%</div><div class="stat-label">完成率</div></div>
      </div>
      <h3>檢驗項目 LOINC 對應表</h3>
      <table>
        <thead>
          <tr>
            <th style="width:4%;">排名</th>
            <th style="width:18%;">檢驗項目名稱</th>
            <th style="width:8%;">項目代碼</th>
            <th style="width:8%;">LOINC Code</th>
            <th style="width:22%;">LOINC 名稱</th>
            <th style="width:8%;">單位</th>
            <th style="width:10%;">檢體類型</th>
            <th style="width:7%;">Mean</th>
            <th style="width:7%;">Median</th>
          </tr>
        </thead>
        <tbody>
          ${aaaData.map((item) => `
            <tr>
              <td style=\"text-align:center;\">${item.itemRank}</td>
              <td><strong>${item.labItemName}</strong></td>
              <td>${item.labItemId}</td>
              <td style=\"color:#e74c3c; font-weight:bold;\">${item.loincCode}</td>
              <td>${item.loincName}</td>
              <td>${item.labUnit}</td>
              <td>${item.labSampleType}</td>
              <td style=\"text-align:right;\">${item.meanValue || '-'}</td>
              <td style=\"text-align:right;\">${item.medianValue || '-'}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    const sectionTRI = `
      <h2>十一、三軍總醫院對應結果</h2>
      <div class="statistics">
        <div class="stat-box"><div class="stat-number">${triData.length}</div><div class="stat-label">對應項目數</div></div>
        <div class="stat-box"><div class="stat-number">${triFileCount}</div><div class="stat-label">對應檔案數</div></div>
        <div class="stat-box"><div class="stat-number">100%</div><div class="stat-label">完成率</div></div>
      </div>
      <h3>檢驗項目 LOINC 對應表</h3>
      <table>
        <thead>
          <tr>
            <th style="width:4%;">排名</th>
            <th style="width:18%;">檢驗項目名稱</th>
            <th style="width:8%;">項目代碼</th>
            <th style="width:8%;">LOINC Code</th>
            <th style="width:22%;">LOINC 名稱</th>
            <th style="width:8%;">單位</th>
            <th style="width:10%;">檢體類型</th>
            <th style="width:7%;">Mean</th>
            <th style="width:7%;">Median</th>
          </tr>
        </thead>
        <tbody>
          ${triData.map((item) => `
            <tr>
              <td style=\"text-align:center;\">${item.itemRank}</td>
              <td><strong>${item.labItemName}</strong></td>
              <td>${item.labItemId}</td>
              <td style=\"color:#e74c3c; font-weight:bold;\">${item.loincCode}</td>
              <td>${item.loincName}</td>
              <td>${item.labUnit}</td>
              <td>${item.labSampleType}</td>
              <td style=\"text-align:right;\">${item.meanValue || '-'}</td>
              <td style=\"text-align:right;\">${item.medianValue || '-'}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    const sectionQA = `
      <h2>十二、品質保證與驗證</h2>
      <div class="methodology">
        <ul>
          <li>AI 智能初篩 → 專家人工驗證 → 交叉驗證 → 最終審查</li>
          <li>完成率 ≥95%（實際 100%）、準確性 ≥90%、一致性 ≥85%</li>
        </ul>
      </div>`;

    // New sections from user
    const sectionAgencyConcerns = `
      <h2>參與特約醫事服務機構疑義</h2>
      <div class="methodology">
        <h3>檢體標示差異</h3>
        <ul>
          <li>部分醫院慣用「Blood」作為檢體來源，但實際上多數檢驗為 Serum/Plasma，造成對應時出現落差。</li>
          <li>是否嚴格區分血液/血清/血漿，各機構意見不一，擔心導入成本與修正難度。</li>
        </ul>
        <h3>方法學差異</h3>
        <ul>
          <li>同一檢測項目因方法不同可能產生多組代碼，如 manual count 與 automated count。</li>
          <li>醫院端希望避免過度細分導致 mapping 失敗或跨院不可交換。</li>
        </ul>
        <h3>資訊需求與流程疑慮</h3>
        <ul>
          <li>關心匯出 CSV 與轉換 ED 的流程是否標準化，以及是否需要 LIS/HIS 改版。</li>
          <li>資訊科需考量網路頻寬與資料安全，避免額外成本或資安風險。</li>
        </ul>
      </div>`;

    const sectionExpertCombined = `
      <h2>專家諮詢結果（或建議）</h2>
      <div class="methodology">
        <h3>兼顧速度與品質的 Mapping 策略</h3>
        <ul>
          <li>採用半自動化工具，確保 analyte、system、method 三軸向準確對應。</li>
          <li>以 Na、K、Glucose、Cholesterol 等常見項目先行推動，形成「正向表列」。</li>
        </ul>
        <h3>逐步導入可交換性檢核</h3>
        <ul>
          <li>初期以「全國互換性」為核心，建立可比對的 mean、std、單位參考基準。</li>
          <li>中期針對 manual vs. automated、serum vs. plasma 進行跨院分析，決定合併或分流。</li>
        </ul>
        <h3>分層標準</h3>
        <ul>
          <li><strong>第一層：</strong>必須一致的檢驗項目（如 Na, K）。</li>
          <li><strong>第二層：</strong>允許方法或檢體差異，但需備註。</li>
          <li><strong>第三層：</strong>高差異檢測，待數據驗證後再決定可交換性。</li>
        </ul>
        <h3>補充原則（依 Stan Huff）</h3>
        <ul>
          <li>Ser/Plas 可於方法/參考值一致時共用；Bld 僅限全血檢測。</li>
          <li>機構層級採最具體 LOINC；研究層級以群組表彈性聚合。</li>
        </ul>
      </div>`;

    const sectionCosts = `
      <h2>整體導入之成本</h2>
      <div class="methodology">
        <table style="width:100%; margin:10px 0;">
          <tr><th style="width:20%;">項目</th><th style="width:60%;">說明</th><th style="width:20%;">預估成本</th></tr>
          <tr><td><strong>資訊成本</strong></td><td>轉換工具由醫學資訊學會提供，無額外軟體費用</td><td>低</td></tr>
          <tr><td><strong>人力成本</strong></td><td>1. 匯出一個月檢驗數據成 CSV (4 小時)<br>2. 半自動化 mapping (2 小時)</td><td>每院約 6 小時</td></tr>
          <tr><td><strong>時間成本</strong></td><td>初期準備與 mapping 約 1 週內可完成</td><td>中</td></tr>
          <tr><td><strong>設備成本</strong></td><td>使用現有 HIS/LIS 匯出功能，僅需伺服器/網路穩定</td><td>低</td></tr>
          <tr><td><strong>其他成本</strong></td><td>LLM API 約 20 美金 / 每 200 筆 query</td><td>中</td></tr>
        </table>
      </div>`;

    const sectionQualityNext = `
      <h2>後續品質確保及資訊需求</h2>
      <div class="methodology">
        <h3>完整性</h3>
        <p>確保每一家醫院的 Top 100 lab code 均能對應到 LOINC。</p>
        <h3>正確性</h3>
        <p>比對上傳代碼與數值一致性，透過 mean、std、單位檢驗，對照中央標準值。</p>
        <ul>
          <li>示例：2093-3 Cholesterol（兩院單位皆 mg/dL）。</li>
          <li>示例：14957-5 Urine microalbumin（Urine 檢體、mg/dL 單位一致）。</li>
        </ul>
        <h3>一致性</h3>
        <p>蒐集跨院大規模數據，針對相同 component 不同 method/specimen 進行統計檢視，提供交換性建議。</p>
        <ul>
          <li>示例：2947-0 Sodium（Blood vs Ser/Plas 樣本標示差異）。</li>
          <li>示例：4544-3 Hematocrit by Automated count（方法一致、可比性佳）。</li>
        </ul>
        <h3>第一年目標</h3>
        <p>完成 Na, K, Glucose, Cholesterol 等常用項目的「一致性 mapping」。</p>
        <h3>終極目標</h3>
        <p>建立跨院間「正確的可交換性」標準，並針對 reference value 進行徹底討論與共識化。</p>
      </div>`;

    const sectionIssues = `
      <h2>十四、院別疑義清單（依上傳資料與對應結果）</h2>
      <div class="methodology">
        <h3>萬芳醫院</h3>
        ${listFromText(aaaIssuesText)}
        <h3>三軍總醫院</h3>
        ${listFromText(triIssuesText)}
      </div>`;

    const sectionConclusion = `
      <h2>十五、結論與未來展望</h2>
      <div class="methodology">
        <h3>結論</h3>
        <ul>
          <li>完成兩院共 ${totalItems} 項之對應，建立可推廣之方法論</li>
          <li>治理、流程與品質三軸並行，成果穩健</li>
        </ul>
        <h3>未來展望</h3>
        <ul>
          <li>六個月：完善平台、訓練示範醫院</li>
          <li>一年：推廣至 50 家主要機構，建立國家級清單與監測</li>
          <li>持續：整合品質指標、支援研究與國際接軌</li>
        </ul>
      </div>`;

    // HTML shell
    const htmlContent = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>健保署 LOINC Mapping 計畫完整報告（模板版）</title>
  <style>
    @page { size: A4; margin: 2cm; }
    body { font-family: 'Microsoft JhengHei','Arial',sans-serif; line-height: 1.5; color:#333; margin:0; padding:20px; background:white; font-size: 11px; }
    .header { text-align:center; border-bottom:3px solid #2c3e50; padding-bottom:20px; margin-bottom:30px; page-break-after: avoid; }
    h1 { color:#2c3e50; margin:10px 0; font-size:24px; }
    h2 { color:#34495e; border-bottom:2px solid #ecf0f1; padding-bottom:8px; margin-top:25px; font-size:18px; page-break-after: avoid; }
    h3 { color:#7f8c8d; margin-top:15px; font-size:14px; page-break-after: avoid; }
    .subtitle { color:#7f8c8d; font-size: 14px; margin:5px 0; }
    .executive-summary { background:#f8f9fa; border-left:4px solid #3498db; padding:15px; margin:20px 0; border-radius:5px; page-break-inside: avoid; }
    .statistics { display:flex; justify-content: space-around; margin: 20px 0; flex-wrap: wrap; }
    .stat-box { background:#ecf0f1; padding:15px; border-radius:8px; text-align:center; min-width:150px; margin:8px; box-shadow:0 2px 4px rgba(0,0,0,0.1); }
    .stat-number { font-size:28px; font-weight:bold; color:#2c3e50; }
    .stat-label { color:#7f8c8d; margin-top:5px; font-size:12px; }
    .success-box { background:#d4edda; border:1px solid #c3e6cb; border-radius:8px; padding:15px; margin:20px 0; }
    .success-icon { color:#155724; font-size:20px; margin-right:10px; }
    table { width:100%; border-collapse: collapse; margin: 15px 0; font-size:10px; page-break-inside:auto; }
    thead { display: table-header-group; }
    th { background:#34495e; color:white; padding:6px; text-align:left; font-size:10px; font-weight: normal; }
    td { padding:4px 6px; border-bottom:1px solid #ecf0f1; font-size:10px; }
    tr { page-break-inside: avoid; }
    tr:nth-child(even) { background:#f8f9fa; }
    .page-break { page-break-before: always; }
    .methodology { background:#fff; border:1px solid #ddd; padding:15px; margin:20px 0; border-radius:8px; page-break-inside: avoid; }
    .methodology ul { list-style-type: none; padding-left:0; margin:10px 0; }
    .methodology li { padding:5px 0; padding-left:25px; position: relative; }
    .methodology li:before { content: '✓'; position: absolute; left:0; color:#27ae60; font-weight: bold; }
    .footer { text-align:center; margin-top:40px; padding-top:15px; border-top:2px solid #ecf0f1; color:#7f8c8d; page-break-before: avoid; }
    .version-note { background:#fff3cd; border:1px solid #ffeaa7; border-radius:5px; padding:10px; margin:20px 0; font-style: italic; }
  </style>
</head>
<body>
  ${coverHeader}
  ${versionNote}
  ${sectionExecSummary}
  ${sectionBackground}
  ${sectionStanHuff}
  ${sectionNational}
  ${sectionDataPrep}
  ${sectionMethod}
  ${sectionArch}
  ${sectionUI}
  ${sectionStats}
  ${sectionAAA}
  ${sectionTRI}
  ${sectionQA}
  ${sectionAgencyConcerns}
  ${sectionExpertCombined}
  ${sectionCosts}
  ${sectionQualityNext}
  ${sectionIssues}
  ${sectionConclusion}
  <div class="footer">
    <p><strong>健保署 LOINC Mapping 計畫</strong></p>
    <p>報告生成日期：${zhDate}</p>
  </div>
</body>
</html>`;

    // Write HTML
    const htmlOut = path.join(baseDir, 'loinc_mapping_complete_report_with_images.html');
    fs.writeFileSync(htmlOut, htmlContent);
    console.log('已輸出 HTML：', path.basename(htmlOut));

    // Try PDF
    try {
      const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
      const page = await browser.newPage();
      await page.setViewport({ width: 1240, height: 1754 });
      await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 60000 });
      await page.evaluate(() => new Promise((r) => setTimeout(r, 1500)));
      const pdfOut = path.join(baseDir, 'LOINC_Mapping_Report_Complete_With_Images_2025.pdf');
      await page.pdf({
        path: pdfOut,
        format: 'A4',
        landscape: false,
        printBackground: true,
        margin: { top: '2cm', right: '2cm', bottom: '2cm', left: '2cm' },
        displayHeaderFooter: true,
        headerTemplate: '<div style="font-size: 9px; text-align: center; width: 100%; padding-top: 5mm;">健保署 LOINC Mapping 計畫</div>',
        footerTemplate: '<div style="font-size: 9px; text-align: center; width: 100%; padding-bottom: 5mm;">第 <span class="pageNumber"></span> 頁，共 <span class="totalPages"></span> 頁</div>'
      });
      await browser.close();
      console.log('已輸出 PDF：', path.basename(pdfOut));
    } catch (e) {
      console.warn('PDF 產生失敗（已保留 HTML）：', e.message);
    }

    // Stats snapshot
    const updatedStats = {
      reportDate: new Date().toISOString(),
      version: 'Template-aligned',
      hospitals: {
        wanFang: { name: '萬芳醫院', mappedItems: aaaData.length, totalFiles: aaaFileCount, completionRate: '100%', status: 'Perfect' },
        triService: { name: '三軍總醫院', mappedItems: triData.length, totalFiles: triFileCount, completionRate: '100%', status: 'Perfect' }
      },
      total: {
        mappedItems: totalItems,
        totalFiles,
        completionRate: '100%',
        missingItems: 0,
        uniqueLoincCodes: new Set([...aaaData.map(d => d.loincCode), ...triData.map(d => d.loincCode)]).size,
        projectStatus: 'Successfully Completed'
      }
    };
    fs.writeFileSync(path.join(baseDir, 'mapping_statistics_updated.json'), JSON.stringify(updatedStats, null, 2));

    console.log('=== 生成完成 ===');
  } catch (error) {
    console.error('Error generating report:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  generateUpdatedReport();
}

module.exports = generateUpdatedReport;

