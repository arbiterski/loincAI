const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

async function generateJSONDataReport() {
  try {
    const baseDir = '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC';
    const savedMappingsDir = path.join(baseDir, 'saved_mappings');

    console.log('📂 掃描JSON檔案並生成PDF報告...\n');

    const allData = [];

    const scanDirectory = (dirPath) => {
      const items = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const item of items) {
        if (item.isDirectory()) {
          scanDirectory(path.join(dirPath, item.name));
        } else if (item.isFile() && item.name.endsWith('.json') &&
                   item.name.startsWith('loinc_mapping_')) {
          const filePath = path.join(dirPath, item.name);
          parseJsonFile(filePath);
        }
      }
    };

    const parseJsonFile = (filePath) => {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        // 提取基本資訊
        const selectedLoinc = data.selectedLoincCodes?.[0] || 'N/A';
        const labItemName = data.labDataContext?.labItemName || 'N/A';
        const searchTerms = data.search?.searchTerms || 'N/A';
        const sampleType = data.labDataContext?.labSampleType || 'N/A';
        const hospital = data.labDataContext?.institution || 'N/A';
        const aiAnalysis = data.aiAnalysis || 'N/A';
        const itemRank = data.labDataContext?.itemRank || 'N/A';
        const labUnit = data.labDataContext?.labUnit || 'N/A';
        const labMeanValue = data.labDataContext?.labMeanValue || 'N/A';
        const labMedianValue = data.labDataContext?.labMedianValue || 'N/A';
        const labTotalRecords = data.labDataContext?.labTotalRecords || 'N/A';

        allData.push({
          file: path.basename(filePath),
          hospital: hospital,
          labItemName: labItemName,
          searchTerms: searchTerms,
          sampleType: sampleType,
          selectedLoinc: selectedLoinc,
          aiAnalysis: aiAnalysis,
          itemRank: parseInt(itemRank) || 999,
          labUnit: labUnit,
          labMeanValue: labMeanValue,
          labMedianValue: labMedianValue,
          labTotalRecords: labTotalRecords
        });

      } catch (e) {
        console.warn(`無法解析文件 ${filePath}:`, e.message);
      }
    };

    // 掃描所有文件
    scanDirectory(savedMappingsDir);

    // 按醫院和rank排序
    allData.sort((a, b) => {
      if (a.hospital !== b.hospital) {
        return a.hospital.localeCompare(b.hospital);
      }
      return a.itemRank - b.itemRank;
    });

    console.log(`📊 共解析 ${allData.length} 個JSON檔案`);

    // 生成HTML報告
    const htmlContent = generateHTMLReport(allData);

    // 生成PDF
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfPath = path.join(baseDir, `LOINC_JSON_Data_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' }
    });

    await browser.close();

    console.log(`📄 PDF報告已生成: ${pdfPath}`);

    return {
      totalFiles: allData.length,
      pdfPath: pdfPath,
      data: allData
    };

  } catch (error) {
    console.error('生成報告過程中發生錯誤:', error);
    throw error;
  }
}

function generateHTMLReport(data) {
  const groupedByHospital = data.reduce((acc, item) => {
    const hospitalKey = item.hospital.includes('AAA') ? '萬芳醫院' :
                      item.hospital.includes('Tri-Service') ? '三軍總醫院' :
                      item.hospital;

    if (!acc[hospitalKey]) acc[hospitalKey] = [];
    acc[hospitalKey].push(item);
    return acc;
  }, {});

  let htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>LOINC JSON 數據報告</title>
    <style>
        body { font-family: 'Microsoft JhengHei', Arial, sans-serif; margin: 20px; font-size: 11px; }
        h1 { color: #2c3e50; text-align: center; margin-bottom: 30px; }
        h2 { color: #34495e; border-bottom: 2px solid #3498db; padding-bottom: 5px; }
        .summary { background: #ecf0f1; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th, td { border: 1px solid #bdc3c7; padding: 8px; text-align: left; vertical-align: top; }
        th { background-color: #3498db; color: white; font-weight: bold; }
        tr:nth-child(even) { background-color: #f8f9fa; }
        .rank { text-align: center; font-weight: bold; }
        .loinc-code { font-family: monospace; font-weight: bold; color: #e74c3c; }
        .ai-analysis { width: 85%; font-size: 10px; }
        .hospital-section { page-break-before: auto; margin-bottom: 40px; }
        .search-terms { max-width: 150px; }
    </style>
</head>
<body>
    <h1>LOINC JSON 數據完整報告</h1>

    <div class="summary">
        <h3>📊 數據統計</h3>
        <p><strong>總檔案數:</strong> ${data.length}</p>
        <p><strong>掃描時間:</strong> ${new Date().toLocaleString('zh-TW')}</p>
        <p><strong>醫院分布:</strong></p>
        <ul>
        ${Object.entries(groupedByHospital).map(([hospital, items]) =>
          `<li>${hospital}: ${items.length} 項目</li>`
        ).join('')}
        </ul>
    </div>`;

  // 為每個醫院生成表格
  Object.entries(groupedByHospital).forEach(([hospital, items]) => {
    htmlContent += `
    <div class="hospital-section">
        <h2>🏥 ${hospital} (${items.length} 項目)</h2>
        <table>
            <thead>
                <tr>
                    <th style="width: 15%;">項目資訊</th>
                    <th style="width: 85%;">AI分析</th>
                </tr>
            </thead>
            <tbody>`;

    items.forEach((item, index) => {
      // 清理AI分析內容
      const cleanedAnalysis = item.aiAnalysis.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

      htmlContent += `
                <tr>
                    <td style="vertical-align: top; font-size: 9px;">
                        <strong>排序:</strong> ${item.itemRank}<br>
                        <strong>項目:</strong> ${item.labItemName}<br>
                        <strong>檢體:</strong> ${item.sampleType}<br>
                        <strong>單位:</strong> ${item.labUnit}<br>
                        <strong>平均值:</strong> ${item.labMeanValue}<br>
                        <strong>中位數:</strong> ${item.labMedianValue}<br>
                        <strong>LOINC:</strong> <span class="loinc-code">${item.selectedLoinc}</span>
                    </td>
                    <td class="ai-analysis">${cleanedAnalysis}</td>
                </tr>`;
    });

    htmlContent += `
            </tbody>
        </table>
    </div>`;
  });

  htmlContent += `
    <div style="margin-top: 30px; text-align: center; color: #7f8c8d; font-size: 10px;">
        <p>報告生成時間: ${new Date().toLocaleString('zh-TW')}</p>
        <p>數據來源: LOINC Mapping JSON 檔案</p>
    </div>
</body>
</html>`;

  return htmlContent;
}

// 執行報告生成
if (require.main === module) {
  generateJSONDataReport()
    .then(result => {
      console.log(`\n✅ 報告生成完成!`);
      console.log(`📊 總共處理了 ${result.totalFiles} 個檔案`);
      console.log(`📄 PDF報告: ${result.pdfPath}`);
    })
    .catch(error => {
      console.error('❌ 報告生成失敗:', error);
      process.exit(1);
    });
}

module.exports = generateJSONDataReport;