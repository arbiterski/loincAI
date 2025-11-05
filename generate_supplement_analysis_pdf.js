const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

async function generateSupplementAnalysisPDF() {
  try {
    const baseDir = '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC';

    // 載入補充分析資料
    const supplementFile = path.join(baseDir, 'saved_mappings', 'comprehensive_ai_analysis_supplement.json');
    const supplementData = JSON.parse(fs.readFileSync(supplementFile, 'utf8'));

    // 載入空分析報告
    const emptyReportFile = path.join(baseDir, 'empty_ai_analysis_report.json');
    const emptyReport = JSON.parse(fs.readFileSync(emptyReportFile, 'utf8'));

    // 創建HTML內容
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>缺失分析補充報告</title>
        <style>
            @page {
                size: A4;
                margin: 1.5cm;
            }

            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            body {
                font-family: 'Microsoft JhengHei', 'PingFang TC', sans-serif;
                line-height: 1.6;
                color: #333;
                width: 80%;
                margin: 0 auto;
                background: white;
            }

            .header {
                text-align: center;
                margin-bottom: 30px;
                border-bottom: 3px solid #2c5aa0;
                padding-bottom: 20px;
            }

            .title {
                font-size: 28px;
                font-weight: bold;
                color: #2c5aa0;
                margin-bottom: 10px;
            }

            .subtitle {
                font-size: 16px;
                color: #666;
                margin-bottom: 5px;
            }

            .summary-section {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 30px;
            }

            .summary-title {
                font-size: 20px;
                font-weight: bold;
                color: #2c5aa0;
                margin-bottom: 15px;
            }

            .stats-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 20px;
                margin-bottom: 20px;
            }

            .stat-card {
                background: white;
                padding: 15px;
                border-radius: 6px;
                border-left: 4px solid #2c5aa0;
            }

            .stat-number {
                font-size: 24px;
                font-weight: bold;
                color: #2c5aa0;
                margin-bottom: 5px;
            }

            .stat-label {
                color: #666;
                font-size: 14px;
            }

            .category-section {
                margin-bottom: 30px;
            }

            .category-title {
                font-size: 18px;
                font-weight: bold;
                color: #2c5aa0;
                margin-bottom: 15px;
                border-bottom: 2px solid #e3f2fd;
                padding-bottom: 5px;
            }

            .code-item {
                background: white;
                border: 1px solid #ddd;
                border-radius: 6px;
                padding: 15px;
                margin-bottom: 15px;
                page-break-inside: avoid;
            }

            .code-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
            }

            .loinc-code {
                font-family: 'Courier New', monospace;
                font-weight: bold;
                background: #e3f2fd;
                color: #1976d2;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 14px;
            }

            .lab-name {
                font-weight: bold;
                font-size: 16px;
                color: #333;
            }

            .hospital-tag {
                background: #ff9800;
                color: white;
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: bold;
            }

            .analysis-content {
                background: #fff3e0;
                border-left: 4px solid #ff9800;
                padding: 12px;
                margin-top: 10px;
                border-radius: 4px;
                line-height: 1.7;
                font-size: 14px;
                color: #e65100;
            }

            .page-break {
                page-break-before: always;
            }

            .footer {
                margin-top: 40px;
                text-align: center;
                font-size: 12px;
                color: #666;
                border-top: 1px solid #ddd;
                padding-top: 20px;
            }

            @media print {
                body {
                    width: 80% !important;
                }

                .code-item {
                    page-break-inside: avoid;
                }

                .page-break {
                    page-break-before: always;
                }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="title">LOINC 分析補充報告</div>
            <div class="subtitle">缺失分析項目專業內容補充</div>
            <div class="subtitle">生成時間: ${new Date().toLocaleString('zh-TW')}</div>
        </div>

        <div class="summary-section">
            <div class="summary-title">📊 補充統計摘要</div>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${supplementData.metadata.totalSupplementedCodes}</div>
                    <div class="stat-label">總補充項目</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${supplementData.metadata.aaaHospitalCodes.length}</div>
                    <div class="stat-label">AAA醫院補充項目</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${supplementData.metadata.triServiceCodes.length}</div>
                    <div class="stat-label">三軍總醫院補充項目</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${((supplementData.metadata.totalSupplementedCodes / 403) * 100).toFixed(1)}%</div>
                    <div class="stat-label">補充比例</div>
                </div>
            </div>

            <div style="background: white; padding: 15px; border-radius: 6px; margin-top: 15px;">
                <strong>補充說明：</strong>本報告針對兩家醫院LOINC對照系統中缺少分析內容的12個重要檢驗項目，
                提供專業的臨床解釋和分析內容，確保每個LOINC碼都有完整的醫學專業說明。
            </div>
        </div>

        ${Object.entries({
          "血液學檢查": ["706-2", "789-8", "21418-9"],
          "肝功能檢查": ["1920-8", "1977-8", "1742-6"],
          "腫瘤標記物": ["2039-6", "35741-8", "54348-8"],
          "其他專科檢查": ["19258-3", "2532-0", "57803-9"]
        }).map(([category, codes]) => `
          <div class="category-section">
            <div class="category-title">${category}</div>
            ${codes.map(code => {
              const details = supplementData.codeDetails[code];
              const analysis = supplementData.supplementAnalysis[code];
              return `
                <div class="code-item">
                  <div class="code-header">
                    <div>
                      <span class="loinc-code">${code}</span>
                      <span class="lab-name">${details.labItemName}</span>
                    </div>
                    <span class="hospital-tag">${details.hospital}</span>
                  </div>
                  <div class="analysis-content">
                    ${analysis}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `).join('')}

        <div class="footer">
            <p><strong>補充完成統計：</strong></p>
            <p>已為 ${supplementData.metadata.totalSupplementedCodes} 個LOINC碼補充專業分析內容</p>
            <p>AAA醫院：${supplementData.metadata.aaaHospitalCodes.join(', ')}</p>
            <p>三軍總醫院：${supplementData.metadata.triServiceCodes.join(', ')}</p>
            <br>
            <p>所有補充內容已整合至主要LOINC對照系統中</p>
        </div>
    </body>
    </html>
    `;

    // 保存HTML文件
    const htmlOutputPath = path.join(baseDir, 'supplement_analysis_report.html');
    fs.writeFileSync(htmlOutputPath, htmlContent, 'utf8');
    console.log(`補充分析HTML報告已保存: ${htmlOutputPath}`);

    // 生成PDF
    console.log('正在生成補充分析PDF報告...');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    const pdfOutputPath = path.join(baseDir, 'LOINC_Supplement_Analysis_Report.pdf');
    await page.pdf({
      path: pdfOutputPath,
      format: 'A4',
      margin: {
        top: '1.5cm',
        right: '1.5cm',
        bottom: '1.5cm',
        left: '1.5cm'
      },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-size: 10px; width: 100%; text-align: center; color: #666;">
          LOINC 分析補充報告
        </div>
      `,
      footerTemplate: `
        <div style="font-size: 9px; width: 100%; text-align: center; color: #666;">
          第 <span class="pageNumber"></span> 頁，共 <span class="totalPages"></span> 頁
        </div>
      `
    });

    await browser.close();
    console.log(`補充分析PDF報告已保存: ${pdfOutputPath}`);

    return {
      htmlPath: htmlOutputPath,
      pdfPath: pdfOutputPath,
      totalSupplemented: supplementData.metadata.totalSupplementedCodes
    };

  } catch (error) {
    console.error('生成補充分析報告時發生錯誤:', error);
    throw error;
  }
}

// 執行腳本
if (require.main === module) {
  generateSupplementAnalysisPDF()
    .then(result => {
      console.log('\n✅ 補充分析報告生成完成!');
      console.log(`HTML: ${result.htmlPath}`);
      console.log(`PDF: ${result.pdfPath}`);
      console.log(`補充了 ${result.totalSupplemented} 個LOINC碼的專業分析`);
    })
    .catch(error => {
      console.error('❌ 生成報告失敗:', error);
      process.exit(1);
    });
}

module.exports = generateSupplementAnalysisPDF;