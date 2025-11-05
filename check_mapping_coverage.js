const fs = require('fs');
const path = require('path');

function checkMappingCoverage() {
  const baseDir = '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC';

  // Load mapping data
  const aaaData = JSON.parse(fs.readFileSync(path.join(baseDir, 'aaa_hospital_final_200.json'), 'utf8'));
  const triData = JSON.parse(fs.readFileSync(path.join(baseDir, 'tri_service_final_200.json'), 'utf8'));

  // Get all LOINC codes from mapping data
  const aaaLoincCodes = new Set(aaaData.map(item => item.loincCode).filter(Boolean));
  const triLoincCodes = new Set(triData.map(item => item.loincCode).filter(Boolean));
  const allMappingCodes = new Set([...aaaLoincCodes, ...triLoincCodes]);

  console.log('=== Mapping 資料統計 ===');
  console.log(`萬芳醫院 LOINC 代碼數: ${aaaLoincCodes.size}`);
  console.log(`三軍總醫院 LOINC 代碼數: ${triLoincCodes.size}`);
  console.log(`合併後不重複 LOINC 代碼數: ${allMappingCodes.size}`);

  // Load AI analysis
  const aiAnalysisMap = {};
  let totalAIFiles = 0;

  const extractAIAnalysis = (filePath) => {
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
          aiAnalysisMap[loincCode] = cleanAnalysis;
        }
        totalAIFiles++;
        return true;
      }
    } catch (e) {
      // ignore
    }
    return false;
  };

  // Load all AI analysis files
  const rootFiles = fs.readdirSync(path.join(baseDir, 'saved_mappings'))
    .filter(file => file.endsWith('.json'));

  for (const file of rootFiles) {
    extractAIAnalysis(path.join(baseDir, 'saved_mappings', file));
  }

  // Check subdirectories
  const savedMappingsItems = fs.readdirSync(path.join(baseDir, 'saved_mappings'), { withFileTypes: true });
  for (const item of savedMappingsItems) {
    if (item.isDirectory()) {
      const subDir = path.join(baseDir, 'saved_mappings', item.name);
      try {
        const subFiles = fs.readdirSync(subDir)
          .filter(file => file.endsWith('.json'));

        for (const file of subFiles) {
          extractAIAnalysis(path.join(subDir, file));
        }
      } catch (e) {
        // ignore
      }
    }
  }

  const aiLoincCodes = new Set(Object.keys(aiAnalysisMap));

  console.log('\n=== AI 分析統計 ===');
  console.log(`載入的 AI 檔案數: ${totalAIFiles}`);
  console.log(`不重複 AI 分析代碼數: ${aiLoincCodes.size}`);

  // Check coverage
  const coveredInMapping = new Set();
  const notCoveredInMapping = new Set();

  for (const code of allMappingCodes) {
    if (aiLoincCodes.has(code)) {
      coveredInMapping.add(code);
    } else {
      notCoveredInMapping.add(code);
    }
  }

  console.log('\n=== 覆蓋率分析 ===');
  console.log(`Mapping 中有 AI 分析的代碼: ${coveredInMapping.size}/${allMappingCodes.size} (${(coveredInMapping.size/allMappingCodes.size*100).toFixed(1)}%)`);
  console.log(`Mapping 中沒有 AI 分析的代碼: ${notCoveredInMapping.size}`);

  if (notCoveredInMapping.size > 0) {
    console.log('\n=== 缺少 AI 分析的 LOINC 代碼 ===');
    const missing = Array.from(notCoveredInMapping).slice(0, 20);
    missing.forEach(code => console.log(code));
    if (notCoveredInMapping.size > 20) {
      console.log(`... 還有 ${notCoveredInMapping.size - 20} 個`);
    }
  }

  // Check extra AI analysis
  const extraAI = new Set();
  for (const code of aiLoincCodes) {
    if (!allMappingCodes.has(code)) {
      extraAI.add(code);
    }
  }

  if (extraAI.size > 0) {
    console.log(`\n=== 額外的 AI 分析 (不在 mapping 中): ${extraAI.size} ===`);
    const extra = Array.from(extraAI).slice(0, 10);
    console.log(extra.join(', '));
    if (extraAI.size > 10) {
      console.log(`... 還有 ${extraAI.size - 10} 個`);
    }
  }
}

checkMappingCoverage();