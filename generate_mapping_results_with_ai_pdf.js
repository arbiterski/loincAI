const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

async function generateMappingResultsWithAI() {
  try {
    const baseDir = '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC';

    // Load mapping data
    const aaaData = JSON.parse(fs.readFileSync(path.join(baseDir, 'aaa_hospital_final_200.json'), 'utf8'));
    const triData = JSON.parse(fs.readFileSync(path.join(baseDir, 'tri_service_final_200.json'), 'utf8'));

    // Load AI analysis data from multiple sources
    const aiAnalysisMap = {};

    // Function to extract AI analysis from file
    const extractAIAnalysis = (filePath, fileName) => {
      try {
        const aiData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        // Handle different file structures
        let loincCode = null;
        let analysis = null;

        if (aiData.selectedLoincCodes && aiData.selectedLoincCodes.length > 0) {
          loincCode = aiData.selectedLoincCodes[0];
          analysis = aiData.aiAnalysis;
        } else if (aiData.selectedLoinc) {
          loincCode = aiData.selectedLoinc;
          analysis = aiData.aiAnalysis;
        }

        if (loincCode && analysis) {
          // Clean up HTML and extract meaningful text
          const cleanAnalysis = analysis
            .replace(/<[^>]*>/g, ' ')  // Remove HTML tags
            .replace(/\s+/g, ' ')       // Replace multiple spaces
            .trim();

          // If this LOINC code already exists, keep the longer analysis
          if (!aiAnalysisMap[loincCode] || cleanAnalysis.length > aiAnalysisMap[loincCode].length) {
            aiAnalysisMap[loincCode] = cleanAnalysis.substring(0, 1500) || '無法提取 AI 分析內容';
          }
          return true;
        }
        return false;
      } catch (e) {
        console.warn(`無法讀取 ${fileName}:`, e.message);
        return false;
      }
    };

    // Load from saved_mappings root directory
    const rootFiles = fs.readdirSync(path.join(baseDir, 'saved_mappings'))
      .filter(file => file.endsWith('.json'));

    let analysisCount = 0;
    for (const file of rootFiles) {
      const filePath = path.join(baseDir, 'saved_mappings', file);
      if (extractAIAnalysis(filePath, file)) {
        analysisCount++;
      }
    }

    // Load from AAA_Hospital subdirectory
    const aaaHospitalDir = path.join(baseDir, 'saved_mappings', 'AAA_Hospital');
    if (fs.existsSync(aaaHospitalDir)) {
      const aaaFiles = fs.readdirSync(aaaHospitalDir)
        .filter(file => file.endsWith('.json'));

      for (const file of aaaFiles) {
        const filePath = path.join(aaaHospitalDir, file);
        if (extractAIAnalysis(filePath, `AAA_Hospital/${file}`)) {
          analysisCount++;
        }
      }
    }

    // Check for other potential subdirectories
    const savedMappingsItems = fs.readdirSync(path.join(baseDir, 'saved_mappings'), { withFileTypes: true });
    for (const item of savedMappingsItems) {
      if (item.isDirectory() && item.name !== 'AAA_Hospital') {
        const subDir = path.join(baseDir, 'saved_mappings', item.name);
        try {
          const subFiles = fs.readdirSync(subDir)
            .filter(file => file.endsWith('.json'));

          for (const file of subFiles) {
            const filePath = path.join(subDir, file);
            if (extractAIAnalysis(filePath, `${item.name}/${file}`)) {
              analysisCount++;
            }
          }
        } catch (e) {
          console.warn(`無法讀取目錄 ${item.name}:`, e.message);
        }
      }
    }

    console.log(`從 ${analysisCount} 個檔案載入了 ${Object.keys(aiAnalysisMap).length} 個 AI 分析`);

    // Generate HTML content
    const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LOINC Mapping Results with AI Analysis</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700&display=swap');

        body {
            font-family: 'Noto Sans TC', 'Microsoft JhengHei', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 3px solid #0066cc;
            padding-bottom: 20px;
        }

        .title {
            font-size: 28px;
            font-weight: 700;
            color: #0066cc;
            margin-bottom: 10px;
        }

        .subtitle {
            font-size: 18px;
            color: #666;
            margin-bottom: 5px;
        }

        .date {
            font-size: 14px;
            color: #888;
        }

        .summary-box {
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            padding: 20px;
            border-radius: 10px;
            margin: 30px 0;
            border-left: 5px solid #0066cc;
        }

        .summary-title {
            font-size: 20px;
            font-weight: 600;
            color: #0066cc;
            margin-bottom: 15px;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }

        .stat-item {
            background: white;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .stat-number {
            font-size: 24px;
            font-weight: 700;
            color: #0066cc;
        }

        .stat-label {
            font-size: 14px;
            color: #666;
            margin-top: 5px;
        }

        .hospital-section {
            margin: 40px 0;
            page-break-before: always;
        }

        .hospital-title {
            font-size: 24px;
            font-weight: 600;
            color: #0066cc;
            margin-bottom: 20px;
            border-bottom: 2px solid #0066cc;
            padding-bottom: 10px;
        }

        .mapping-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            font-size: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }

        .mapping-table th {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 8px;
            text-align: center;
            font-weight: 600;
            border: 1px solid #ddd;
        }

        .mapping-table td {
            padding: 10px 8px;
            border: 1px solid #ddd;
            vertical-align: top;
        }

        .mapping-table tr:nth-child(even) {
            background-color: #f9f9f9;
        }

        .mapping-table tr:hover {
            background-color: #f0f8ff;
        }

        .rank-cell {
            text-align: center;
            font-weight: 600;
            color: #0066cc;
        }

        .loinc-code {
            font-family: monospace;
            background: #f0f0f0;
            padding: 2px 4px;
            border-radius: 3px;
            font-weight: 600;
        }

        .ai-analysis {
            background: #fff8dc;
            border: 1px solid #ddd;
            border-radius: 5px;
            padding: 10px;
            margin-top: 5px;
            font-size: 12px;
            line-height: 1.5;
            border-left: 4px solid #ff6b35;
            max-width: 500px;
            word-wrap: break-word;
            white-space: pre-wrap;
        }

        .ai-label {
            font-weight: 600;
            color: #ff6b35;
            margin-bottom: 3px;
        }

        .no-ai {
            color: #999;
            font-style: italic;
        }

        .page-break {
            page-break-before: always;
        }

        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 12px;
            color: #666;
        }

        @media print {
            body {
                max-width: none;
                margin: 0;
                padding: 15px;
            }

            .hospital-section {
                page-break-before: always;
            }

            .mapping-table {
                font-size: 10px;
            }

            .ai-analysis {
                font-size: 9px;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">LOINC Mapping Results Report</div>
        <div class="title">LOINC 代碼對應結果報告（包含 AI 分析）</div>
        <div class="subtitle">Complete Implementation Report with AI Analysis</div>
        <div class="date">報告生成日期：${new Date().toLocaleDateString('zh-TW')} | 參與機構：萬芳醫院、三軍總醫院</div>
    </div>

    <div class="summary-box">
        <div class="summary-title">📊 執行摘要 Executive Summary</div>
        <div class="stats-grid">
            <div class="stat-item">
                <div class="stat-number">${aaaData.length + triData.length}</div>
                <div class="stat-label">總對應項目</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${aaaData.length}</div>
                <div class="stat-label">萬芳醫院項目</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${triData.length}</div>
                <div class="stat-label">三軍總醫院項目</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">100%</div>
                <div class="stat-label">完成率</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${Object.keys(aiAnalysisMap).length}</div>
                <div class="stat-label">AI 分析項目</div>
            </div>
        </div>
    </div>

    <div class="hospital-section">
        <div class="hospital-title">🏥 萬芳醫院 LOINC 對應結果 (AAA Hospital)</div>
        <p><strong>共 ${aaaData.length} 項檢驗項目完成對應</strong></p>

        <table class="mapping-table">
            <thead>
                <tr>
                    <th style="width: 40px;">排序</th>
                    <th style="width: 100px;">檢驗項目</th>
                    <th style="width: 70px;">項目代碼</th>
                    <th style="width: 80px;">LOINC 代碼</th>
                    <th style="width: 150px;">LOINC 名稱</th>
                    <th style="width: 60px;">單位</th>
                    <th style="width: 60px;">檢體</th>
                    <th style="width: 500px;">AI 分析說明</th>
                </tr>
            </thead>
            <tbody>
                ${aaaData.map((item, index) => `
                <tr>
                    <td class="rank-cell">${item.itemRank || (index + 1)}</td>
                    <td><strong>${item.labItemName || ''}</strong></td>
                    <td>${item.labItemId || ''}</td>
                    <td><span class="loinc-code">${item.loincCode || ''}</span></td>
                    <td>${item.loincName || ''}</td>
                    <td>${item.labUnit || ''}</td>
                    <td>${item.labSampleType || ''}</td>
                    <td>
                        ${aiAnalysisMap[item.loincCode] ?
                          `<div class="ai-analysis">
                             <div class="ai-label">🤖 AI 分析：</div>
                             ${aiAnalysisMap[item.loincCode]}
                           </div>` :
                          '<div class="no-ai">暫無 AI 分析</div>'
                        }
                    </td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="hospital-section page-break">
        <div class="hospital-title">🏥 三軍總醫院 LOINC 對應結果 (Tri-Service General Hospital)</div>
        <p><strong>共 ${triData.length} 項檢驗項目完成對應</strong></p>

        <table class="mapping-table">
            <thead>
                <tr>
                    <th style="width: 40px;">排序</th>
                    <th style="width: 100px;">檢驗項目</th>
                    <th style="width: 70px;">項目代碼</th>
                    <th style="width: 80px;">LOINC 代碼</th>
                    <th style="width: 150px;">LOINC 名稱</th>
                    <th style="width: 60px;">單位</th>
                    <th style="width: 60px;">檢體</th>
                    <th style="width: 500px;">AI 分析說明</th>
                </tr>
            </thead>
            <tbody>
                ${triData.map((item, index) => `
                <tr>
                    <td class="rank-cell">${item.itemRank || (index + 1)}</td>
                    <td><strong>${item.labItemName || ''}</strong></td>
                    <td>${item.labItemId || ''}</td>
                    <td><span class="loinc-code">${item.loincCode || ''}</span></td>
                    <td>${item.loincName || ''}</td>
                    <td>${item.labUnit || ''}</td>
                    <td>${item.labSampleType || ''}</td>
                    <td>
                        ${aiAnalysisMap[item.loincCode] ?
                          `<div class="ai-analysis">
                             <div class="ai-label">🤖 AI 分析：</div>
                             ${aiAnalysisMap[item.loincCode]}
                           </div>` :
                          '<div class="no-ai">暫無 AI 分析</div>'
                        }
                    </td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="page-break">
        <div class="summary-box">
            <div class="summary-title">🔍 AI 分析摘要</div>
            <p><strong>共有 ${Object.keys(aiAnalysisMap).length} 個項目包含 AI 分析說明</strong></p>
            <div style="margin-top: 20px;">
                <h4>AI 分析涵蓋的 LOINC 代碼：</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-top: 10px;">
                    ${Object.keys(aiAnalysisMap).map(code =>
                      `<div style="background: #f0f8ff; padding: 8px; border-radius: 4px; text-align: center;">
                         <span class="loinc-code">${code}</span>
                       </div>`
                    ).join('')}
                </div>
            </div>
        </div>
    </div>

    <div class="footer">
        <p><strong>報告由 TAMI AI LOINC Taiwan top 100 推動小組生成</strong></p>
        <p>生成時間：${new Date().toLocaleString('zh-TW')} | 包含 AI 輔助分析與專家驗證</p>
        <p>技術支援：Claude Code AI Assistant</p>
    </div>
</body>
</html>`;

    // Save HTML file
    const htmlPath = path.join(baseDir, 'mapping_results_with_ai.html');
    fs.writeFileSync(htmlPath, htmlContent);
    console.log(`✅ HTML 檔案已生成：${htmlPath}`);

    // Convert to PDF using Puppeteer
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      timeout: 120000
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(120000);
    await page.goto(`file://${htmlPath}`, {
      waitUntil: 'networkidle0',
      timeout: 120000
    });

    const pdfPath = path.join(baseDir, 'LOINC_Mapping_Results_with_AI_Analysis.pdf');
    await page.pdf({
      path: pdfPath,
      format: 'A3',  // Use A3 for wider AI analysis columns
      printBackground: true,
      margin: {
        top: '15mm',
        right: '10mm',
        bottom: '15mm',
        left: '10mm'
      },
      timeout: 120000
    });

    await browser.close();

    console.log(`✅ PDF 檔案已生成：${pdfPath}`);
    console.log(`📋 包含 ${Object.keys(aiAnalysisMap).length} 個 AI 分析說明`);

    return { htmlPath, pdfPath };

  } catch (error) {
    console.error('❌ 生成報告失敗：', error);
    throw error;
  }
}

if (require.main === module) {
  generateMappingResultsWithAI();
}

module.exports = generateMappingResultsWithAI;