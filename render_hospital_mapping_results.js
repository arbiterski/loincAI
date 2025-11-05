const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

async function renderHospitalMappingResults() {
  try {
    const baseDir = '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC';

    // Load mapping data for both hospitals
    const aaaData = JSON.parse(fs.readFileSync(path.join(baseDir, 'aaa_hospital_final_200.json'), 'utf8'));
    const triData = JSON.parse(fs.readFileSync(path.join(baseDir, 'tri_service_final_200.json'), 'utf8'));

    console.log(`載入 AAA 醫院資料: ${aaaData.length} 項目`);
    console.log(`載入三軍總醫院資料: ${triData.length} 項目`);

    // Load AI analysis data from saved mappings
    const aiAnalysisMap = {};

    const extractAIAnalysis = (filePath, fileName) => {
      try {
        const aiData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
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
          const cleanAnalysis = analysis
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

          if (!aiAnalysisMap[loincCode] || cleanAnalysis.length > aiAnalysisMap[loincCode].length) {
            aiAnalysisMap[loincCode] = cleanAnalysis || '無法提取 AI 分析內容'; // Remove length limit
          }
          return true;
        }
        return false;
      } catch (e) {
        return false;
      }
    };

    // Load AI analysis from saved_mappings directory
    const savedMappingsDir = path.join(baseDir, 'saved_mappings');
    if (fs.existsSync(savedMappingsDir)) {
      const loadAIFromDirectory = (dirPath) => {
        const items = fs.readdirSync(dirPath, { withFileTypes: true });
        let count = 0;

        for (const item of items) {
          if (item.isFile() && item.name.endsWith('.json')) {
            const filePath = path.join(dirPath, item.name);
            if (extractAIAnalysis(filePath, item.name)) count++;
          } else if (item.isDirectory()) {
            count += loadAIFromDirectory(path.join(dirPath, item.name));
          }
        }
        return count;
      };

      const totalAIAnalysis = loadAIFromDirectory(savedMappingsDir);

      // 載入補充的AI分析
      const supplementFile = path.join(savedMappingsDir, 'ai_analysis_supplement.json');
      if (fs.existsSync(supplementFile)) {
        try {
          const supplementData = JSON.parse(fs.readFileSync(supplementFile, 'utf8'));
          if (supplementData.supplementAnalysis) {
            let supplementCount = 0;
            for (const [loincCode, analysis] of Object.entries(supplementData.supplementAnalysis)) {
              if (!aiAnalysisMap[loincCode] || !aiAnalysisMap[loincCode].trim()) {
                aiAnalysisMap[loincCode] = analysis;
                supplementCount++;
              }
            }
            console.log(`載入了 ${supplementCount} 個補充分析`);
          }
        } catch (e) {
          console.warn('載入補充分析失敗:', e.message);
        }
      }

      console.log(`載入了 ${Object.keys(aiAnalysisMap).length} 個 AI 分析 (從 ${totalAIAnalysis} 個檔案)`);
    }

    // Generate HTML content for both hospitals
    const generateHospitalSection = (hospitalData, hospitalName, hospitalCode) => {
      // Sort by rank order
      const allItems = hospitalData.sort((a, b) => a.itemRank - b.itemRank);

      return `
        <div class="hospital-section">
          <h1 class="hospital-title">${hospitalName} LOINC 對照結果</h1>
          <div class="summary-stats">
            <div class="stat-box">
              <div class="stat-number">${hospitalData.length}</div>
              <div class="stat-label">總對照項目</div>
            </div>
            <div class="stat-box">
              <div class="stat-number">${allItems.filter(item => aiAnalysisMap[item.loincCode]).length}</div>
              <div class="stat-label">具詳細分析</div>
            </div>
            <div class="stat-box">
              <div class="stat-number">${new Set(allItems.map(item => item.loincCode)).size}</div>
              <div class="stat-label">唯一 LOINC 碼</div>
            </div>
          </div>

          <div class="mapping-table">
            <table>
              <thead>
                <tr>
                  <th style="width: 20%">基本資訊</th>
                  <th style="width: 80%">LOINC 對照 & 分析</th>
                </tr>
              </thead>
              <tbody>
                ${allItems.map(item => {
                  const aiAnalysis = aiAnalysisMap[item.loincCode];
                  return `
                    <tr>
                      <td class="basic-info">
                        <div class="rank">#${item.itemRank}</div>
                        <div class="item-details">
                          <strong>${item.labItemName}</strong><br>
                          代碼: ${item.labItemId} | 單位: ${item.labUnit || '-'}<br>
                          檢體: ${item.labSampleType || '-'}
                        </div>
                      </td>
                      <td class="loinc-analysis">
                        <div class="loinc-header">
                          <span class="loinc-code">${item.loincCode}</span>
                          <span class="loinc-name">${item.loincName}</span>
                        </div>
                        ${aiAnalysis ? `
                          <div class="analysis-content">
                            ${aiAnalysis}
                          </div>
                        ` : ''}
                        <div class="mapping-stats">
                          平均值: ${item.meanValue || 'N/A'} | 中位數: ${item.medianValue || 'N/A'}
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    };

    // Create complete HTML document
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>醫院 LOINC 對照結果報告</title>
        <style>
            @page {
                size: A4;
                margin: 1cm;
            }

            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            body {
                font-family: 'Microsoft JhengHei', 'PingFang TC', sans-serif;
                line-height: 1.4;
                color: #333;
                width: 80%; /* 80% width of A4 page */
                margin: 0 auto;
                background: white;
            }

            .hospital-section {
                margin-bottom: 3cm;
                page-break-inside: avoid;
            }

            .hospital-title {
                font-size: 24px;
                font-weight: bold;
                text-align: center;
                margin-bottom: 20px;
                color: #2c5aa0;
                border-bottom: 3px solid #2c5aa0;
                padding-bottom: 10px;
            }

            .summary-stats {
                display: flex;
                justify-content: space-around;
                margin-bottom: 25px;
                background: #f8f9fa;
                padding: 15px;
                border-radius: 8px;
            }

            .stat-box {
                text-align: center;
                padding: 10px;
            }

            .stat-number {
                font-size: 28px;
                font-weight: bold;
                color: #2c5aa0;
                margin-bottom: 5px;
            }

            .stat-label {
                font-size: 12px;
                color: #666;
                font-weight: 500;
            }

            .mapping-table {
                width: 100%;
                overflow: hidden;
            }

            table {
                width: 100%;
                border-collapse: collapse;
                font-size: 9px;
                background: white;
                table-layout: fixed;
            }

            th {
                background: #2c5aa0;
                color: white;
                padding: 8px 4px;
                text-align: center;
                font-weight: bold;
                border: 1px solid #ddd;
                font-size: 10px;
            }

            td {
                padding: 6px 4px;
                border: 1px solid #ddd;
                vertical-align: top;
                word-wrap: break-word;
                overflow-wrap: break-word;
            }

            .basic-info {
                font-size: 9px;
                vertical-align: top;
                padding: 8px;
                background: #f8f9fa;
            }

            .rank {
                font-weight: bold;
                color: #2c5aa0;
                font-size: 11px;
                margin-bottom: 4px;
            }

            .item-details {
                line-height: 1.3;
            }

            .item-details strong {
                color: #333;
                font-size: 10px;
            }

            .loinc-analysis {
                font-size: 9px;
                vertical-align: top;
                padding: 8px;
            }

            .loinc-header {
                margin-bottom: 6px;
                padding-bottom: 4px;
                border-bottom: 1px solid #ddd;
            }

            .loinc-code {
                font-family: 'Courier New', monospace;
                font-weight: bold;
                background: #e3f2fd;
                color: #1976d2;
                padding: 2px 4px;
                border-radius: 3px;
                margin-right: 8px;
                font-size: 9px;
            }

            .loinc-name {
                font-weight: bold;
                color: #1976d2;
                line-height: 1.3;
                font-size: 9px;
            }

            .analysis-content {
                background: #fff3e0;
                border-left: 3px solid #ff9800;
                padding: 8px 10px;
                margin: 8px 0;
                border-radius: 4px;
                color: #e65100;
                line-height: 1.5;
                font-size: 10px;
                word-wrap: break-word;
                white-space: normal;
                min-height: auto;
                max-height: none;
                overflow: visible;
            }

            .mapping-stats {
                color: #666;
                font-size: 7px;
                margin-top: 4px;
                padding-top: 2px;
                border-top: 1px dashed #ddd;
            }

            .page-break {
                page-break-before: always;
            }

            @media print {
                body {
                    width: 80% !important;
                }

                .hospital-section {
                    page-break-inside: avoid;
                }

                .page-break {
                    page-break-before: always;
                }

                table {
                    page-break-inside: auto;
                }

                tr {
                    page-break-inside: avoid;
                    page-break-after: auto;
                }
            }
        </style>
    </head>
    <body>
        ${generateHospitalSection(aaaData, 'AAA 醫院', 'AAA')}
        <div class="page-break"></div>
        ${generateHospitalSection(triData, '三軍總醫院', 'TRI')}

        <div style="margin-top: 40px; text-align: center; font-size: 10px; color: #666;">
            <p>報告產生時間: ${new Date().toLocaleString('zh-TW')}</p>
        </div>
    </body>
    </html>
    `;

    // Save HTML file
    const htmlOutputPath = path.join(baseDir, 'hospital_mapping_results_with_ai.html');
    fs.writeFileSync(htmlOutputPath, htmlContent, 'utf8');
    console.log(`HTML 檔案已儲存: ${htmlOutputPath}`);

    // Generate PDF
    console.log('正在產生 PDF...');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    const pdfOutputPath = path.join(baseDir, 'Hospital_Mapping_Results_with_AI_Analysis.pdf');
    await page.pdf({
      path: pdfOutputPath,
      format: 'A4',
      margin: {
        top: '1cm',
        right: '1cm',
        bottom: '1cm',
        left: '1cm'
      },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-size: 10px; width: 100%; text-align: center; color: #666;">
          醫院 LOINC 對照結果報告
        </div>
      `,
      footerTemplate: `
        <div style="font-size: 9px; width: 100%; text-align: center; color: #666;">
          第 <span class="pageNumber"></span> 頁，共 <span class="totalPages"></span> 頁
        </div>
      `
    });

    await browser.close();
    console.log(`PDF 檔案已儲存: ${pdfOutputPath}`);

    // Generate summary statistics
    const stats = {
      aaaHospital: {
        totalItems: aaaData.length,
        itemsWithAI: aaaData.filter(item => aiAnalysisMap[item.loincCode]).length,
        uniqueLoincCodes: new Set(aaaData.map(item => item.loincCode)).size,
        allItemsWithAI: aaaData.filter(item => aiAnalysisMap[item.loincCode]).length
      },
      triService: {
        totalItems: triData.length,
        itemsWithAI: triData.filter(item => aiAnalysisMap[item.loincCode]).length,
        uniqueLoincCodes: new Set(triData.map(item => item.loincCode)).size,
        allItemsWithAI: triData.filter(item => aiAnalysisMap[item.loincCode]).length
      },
      aiAnalysis: {
        totalAnalysisEntries: Object.keys(aiAnalysisMap).length
      }
    };

    console.log('\n=== 報告統計 ===');
    console.log(`AAA 醫院: ${stats.aaaHospital.totalItems} 項目，${stats.aaaHospital.itemsWithAI} 項有 AI 分析`);
    console.log(`三軍總醫院: ${stats.triService.totalItems} 項目，${stats.triService.itemsWithAI} 項有 AI 分析`);
    console.log(`總 AI 分析條目: ${stats.aiAnalysis.totalAnalysisEntries}`);

    return {
      htmlPath: htmlOutputPath,
      pdfPath: pdfOutputPath,
      statistics: stats
    };

  } catch (error) {
    console.error('產生報告時發生錯誤:', error);
    throw error;
  }
}

// 執行腳本
if (require.main === module) {
  renderHospitalMappingResults()
    .then(result => {
      console.log('\n✅ 報告產生完成!');
      console.log(`HTML: ${result.htmlPath}`);
      console.log(`PDF: ${result.pdfPath}`);
    })
    .catch(error => {
      console.error('❌ 產生報告失敗:', error);
      process.exit(1);
    });
}

module.exports = renderHospitalMappingResults;