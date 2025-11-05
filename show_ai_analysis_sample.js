const fs = require('fs');
const path = require('path');

function showAIAnalysisSample() {
  const baseDir = '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC';

  // Load a few sample AI analysis files
  const sampleFiles = [
    'saved_mappings/ask_stan_2025-09-14T01-07-35-209Z.json',
    'saved_mappings/AAA_Hospital/loinc_mapping_2025-09-07T15-12-32-300Z.json',
    'saved_mappings/AAA_Hospital/loinc_mapping_2025-09-07T15-26-25-612Z.json'
  ];

  console.log('=== AI 分析內容範例 ===\n');

  sampleFiles.forEach((filePath, index) => {
    try {
      const fullPath = path.join(baseDir, filePath);
      const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));

      console.log(`📋 範例 ${index + 1}: ${path.basename(filePath)}`);
      console.log('─'.repeat(60));

      if (data.labDataContext) {
        console.log(`🏥 醫院: ${data.labDataContext.institution || '未知'}`);
        console.log(`🧪 檢驗項目: ${data.labDataContext.labItemName || '未知'}`);
        console.log(`🔢 項目代碼: ${data.labDataContext.itemId || '未知'}`);
        console.log(`📊 單位: ${data.labDataContext.labUnit || '未知'}`);
        console.log(`🩸 檢體: ${data.labDataContext.labSampleType || '未知'}`);
        console.log(`📈 平均值: ${data.labDataContext.labMeanValue || '未知'}`);
      }

      if (data.selectedLoincCodes && data.selectedLoincCodes.length > 0) {
        console.log(`🎯 選中的 LOINC: ${data.selectedLoincCodes[0]}`);
      }

      if (data.aiAnalysis) {
        console.log('\n🤖 AI 分析摘要:');
        const cleanAnalysis = data.aiAnalysis
          .replace(/<[^>]*>/g, ' ')  // Remove HTML
          .replace(/\s+/g, ' ')       // Multiple spaces to one
          .substring(0, 300)          // First 300 chars
          .trim();
        console.log(`"${cleanAnalysis}..."`);
      }

      console.log('\n' + '='.repeat(60) + '\n');
    } catch (e) {
      console.error(`❌ 無法讀取 ${filePath}:`, e.message);
    }
  });

  // Show AI analysis coverage by hospital
  console.log('=== 各醫院 AI 分析覆蓋情況 ===\n');

  const hospitalCoverage = {
    'AAA_Hospital': 0,
    'Tri-Service_General_Hospital': 0,
    'Unknown': 0,
    'root': 0
  };

  const aiAnalysisMap = {};

  // Function to collect coverage data
  const collectCoverage = (dirPath, hospitalName) => {
    try {
      const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));

      files.forEach(file => {
        try {
          const filePath = path.join(dirPath, file);
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

          if (data.aiAnalysis && data.selectedLoincCodes && data.selectedLoincCodes.length > 0) {
            hospitalCoverage[hospitalName]++;
            const loincCode = data.selectedLoincCodes[0];

            if (!aiAnalysisMap[loincCode]) {
              aiAnalysisMap[loincCode] = [];
            }
            aiAnalysisMap[loincCode].push({
              hospital: hospitalName,
              file: file,
              analysis: data.aiAnalysis.substring(0, 100) + '...'
            });
          }
        } catch (e) {
          // Skip invalid files
        }
      });
    } catch (e) {
      console.warn(`無法讀取目錄 ${dirPath}`);
    }
  };

  // Collect data
  collectCoverage(path.join(baseDir, 'saved_mappings'), 'root');
  collectCoverage(path.join(baseDir, 'saved_mappings', 'AAA_Hospital'), 'AAA_Hospital');
  collectCoverage(path.join(baseDir, 'saved_mappings', 'Tri-Service_General_Hospital'), 'Tri-Service_General_Hospital');
  collectCoverage(path.join(baseDir, 'saved_mappings', 'Unknown'), 'Unknown');

  // Display coverage
  Object.entries(hospitalCoverage).forEach(([hospital, count]) => {
    if (count > 0) {
      console.log(`🏥 ${hospital}: ${count} 個 AI 分析`);
    }
  });

  console.log(`\n📊 總計: ${Object.keys(aiAnalysisMap).length} 個不重複的 LOINC 代碼有 AI 分析`);

  // Show some LOINC codes with multiple analyses
  console.log('\n=== 重複分析的 LOINC 代碼範例 ===');
  let duplicateCount = 0;
  Object.entries(aiAnalysisMap).forEach(([loincCode, analyses]) => {
    if (analyses.length > 1 && duplicateCount < 5) {
      console.log(`\n🔬 LOINC ${loincCode}: ${analyses.length} 個分析`);
      analyses.forEach(analysis => {
        console.log(`   - ${analysis.hospital}: ${analysis.analysis}`);
      });
      duplicateCount++;
    }
  });

  console.log(`\n📈 重複分析統計: ${Object.values(aiAnalysisMap).filter(arr => arr.length > 1).length} 個 LOINC 代碼有多個分析`);
}

showAIAnalysisSample();