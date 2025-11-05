const fs = require('fs');
const path = require('path');

function debugAIAnalysis() {
  const baseDir = '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC';

  let totalFiles = 0;
  let filesWithAI = 0;
  let filesWithoutAI = 0;
  const missingAIFiles = [];
  const loadedAICodes = new Set();

  // Function to check AI analysis in file
  const checkAIAnalysis = (filePath, fileName) => {
    try {
      totalFiles++;
      const aiData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      // Check different possible structures
      let hasAI = false;
      let loincCode = null;
      let analysis = null;

      console.log(`\n檢查檔案: ${fileName}`);
      console.log('檔案結構:', Object.keys(aiData).join(', '));

      if (aiData.aiAnalysis) {
        hasAI = true;
        analysis = aiData.aiAnalysis;
        console.log('✓ 找到 aiAnalysis 欄位');

        // Check for LOINC codes
        if (aiData.selectedLoincCodes && aiData.selectedLoincCodes.length > 0) {
          loincCode = aiData.selectedLoincCodes[0];
          console.log('✓ 找到 selectedLoincCodes:', aiData.selectedLoincCodes);
        } else if (aiData.selectedLoinc) {
          loincCode = aiData.selectedLoinc;
          console.log('✓ 找到 selectedLoinc:', aiData.selectedLoinc);
        } else {
          console.log('⚠ 找不到 LOINC 代碼');
        }
      } else {
        console.log('✗ 沒有 aiAnalysis 欄位');
      }

      if (hasAI && loincCode) {
        filesWithAI++;
        loadedAICodes.add(loincCode);
        console.log(`✓ 成功載入 ${loincCode} 的 AI 分析`);
      } else {
        filesWithoutAI++;
        missingAIFiles.push({
          file: fileName,
          reason: !hasAI ? 'no aiAnalysis field' : 'no LOINC code'
        });
        console.log(`✗ 無法載入 AI 分析: ${!hasAI ? '無aiAnalysis欄位' : '無LOINC代碼'}`);
      }

    } catch (e) {
      console.error(`❌ 讀取錯誤 ${fileName}:`, e.message);
      totalFiles++;
      filesWithoutAI++;
      missingAIFiles.push({
        file: fileName,
        reason: `parse error: ${e.message}`
      });
    }
  };

  console.log('=== 開始檢查 saved_mappings 根目錄 ===');
  // Check root directory
  const rootFiles = fs.readdirSync(path.join(baseDir, 'saved_mappings'))
    .filter(file => file.endsWith('.json'));

  for (const file of rootFiles) {
    const filePath = path.join(baseDir, 'saved_mappings', file);
    checkAIAnalysis(filePath, file);
  }

  console.log('\n=== 開始檢查 AAA_Hospital 目錄 ===');
  // Check AAA_Hospital subdirectory
  const aaaHospitalDir = path.join(baseDir, 'saved_mappings', 'AAA_Hospital');
  if (fs.existsSync(aaaHospitalDir)) {
    const aaaFiles = fs.readdirSync(aaaHospitalDir)
      .filter(file => file.endsWith('.json'));

    for (const file of aaaFiles) {
      const filePath = path.join(aaaHospitalDir, file);
      checkAIAnalysis(filePath, `AAA_Hospital/${file}`);
    }
  }

  console.log('\n=== 開始檢查其他子目錄 ===');
  // Check other subdirectories
  const savedMappingsItems = fs.readdirSync(path.join(baseDir, 'saved_mappings'), { withFileTypes: true });
  for (const item of savedMappingsItems) {
    if (item.isDirectory() && item.name !== 'AAA_Hospital') {
      console.log(`檢查目錄: ${item.name}`);
      const subDir = path.join(baseDir, 'saved_mappings', item.name);
      try {
        const subFiles = fs.readdirSync(subDir)
          .filter(file => file.endsWith('.json'));

        for (const file of subFiles) {
          const filePath = path.join(subDir, file);
          checkAIAnalysis(filePath, `${item.name}/${file}`);
        }
      } catch (e) {
        console.warn(`無法讀取目錄 ${item.name}:`, e.message);
      }
    }
  }

  console.log('\n=== 統計結果 ===');
  console.log(`總檔案數: ${totalFiles}`);
  console.log(`有 AI 分析的檔案: ${filesWithAI}`);
  console.log(`沒有 AI 分析的檔案: ${filesWithoutAI}`);
  console.log(`載入的 LOINC 代碼數: ${loadedAICodes.size}`);

  if (missingAIFiles.length > 0) {
    console.log('\n=== 沒有 AI 分析的檔案 ===');
    missingAIFiles.slice(0, 10).forEach(item => {
      console.log(`${item.file}: ${item.reason}`);
    });
    if (missingAIFiles.length > 10) {
      console.log(`... 還有 ${missingAIFiles.length - 10} 個檔案`);
    }
  }

  console.log('\n=== 載入的 LOINC 代碼範例 ===');
  const codesArray = Array.from(loadedAICodes);
  console.log('前10個代碼:', codesArray.slice(0, 10).join(', '));
}

debugAIAnalysis();