const fs = require('fs');
const path = require('path');

async function analyzeEmptyAIFiles() {
  try {
    const baseDir = '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC';
    const savedMappingsDir = path.join(baseDir, 'saved_mappings');

    const results = {
      aaaHospital: {
        totalFiles: 0,
        withAI: 0,
        emptyAI: 0,
        emptyAIFiles: [],
        emptyLoincCodes: []
      },
      triService: {
        totalFiles: 0,
        withAI: 0,
        emptyAI: 0,
        emptyAIFiles: [],
        emptyLoincCodes: []
      },
      other: {
        totalFiles: 0,
        withAI: 0,
        emptyAI: 0
      }
    };

    const analyzeFile = (filePath, hospitalKey) => {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        results[hospitalKey].totalFiles++;

        let loincCode = null;
        let analysis = null;
        let labItemName = '';

        // 提取LOINC碼
        if (data.selectedLoincCodes && data.selectedLoincCodes.length > 0) {
          loincCode = data.selectedLoincCodes[0];
        } else if (data.selectedLoinc) {
          loincCode = data.selectedLoinc;
        }

        // 提取分析內容
        analysis = data.aiAnalysis || '';

        // 提取項目名稱
        if (data.labDataContext && data.labDataContext.labItemName) {
          labItemName = data.labDataContext.labItemName;
        }

        if (analysis && analysis.trim()) {
          results[hospitalKey].withAI++;
        } else {
          results[hospitalKey].emptyAI++;
          if (loincCode) {
            results[hospitalKey].emptyAIFiles.push({
              file: path.basename(filePath),
              loincCode: loincCode,
              labItemName: labItemName
            });
            results[hospitalKey].emptyLoincCodes.push(loincCode);
          }
        }

        return true;
      } catch (e) {
        console.warn(`無法分析文件 ${filePath}:`, e.message);
        return false;
      }
    };

    // 分析AAA醫院
    const aaaHospitalDir = path.join(savedMappingsDir, 'AAA_Hospital');
    if (fs.existsSync(aaaHospitalDir)) {
      const aaaFiles = fs.readdirSync(aaaHospitalDir)
        .filter(file => file.endsWith('.json'));

      console.log(`AAA醫院: 找到 ${aaaFiles.length} 個JSON文件`);

      for (const file of aaaFiles) {
        const filePath = path.join(aaaHospitalDir, file);
        analyzeFile(filePath, 'aaaHospital');
      }
    }

    // 分析三軍總醫院
    const triServiceDir = path.join(savedMappingsDir, 'Tri-Service_General_Hospital');
    if (fs.existsSync(triServiceDir)) {
      const triFiles = fs.readdirSync(triServiceDir)
        .filter(file => file.endsWith('.json'));

      console.log(`三軍總醫院: 找到 ${triFiles.length} 個JSON文件`);

      for (const file of triFiles) {
        const filePath = path.join(triServiceDir, file);
        analyzeFile(filePath, 'triService');
      }
    }

    // 分析其他文件
    const rootFiles = fs.readdirSync(savedMappingsDir)
      .filter(file => file.endsWith('.json'));

    for (const file of rootFiles) {
      const filePath = path.join(savedMappingsDir, file);
      analyzeFile(filePath, 'other');
    }

    // 輸出統計結果
    console.log('\n=== AI分析統計結果 ===');

    console.log(`\nAAA醫院:`);
    console.log(`  總文件數: ${results.aaaHospital.totalFiles}`);
    console.log(`  有AI分析: ${results.aaaHospital.withAI}`);
    console.log(`  空AI分析: ${results.aaaHospital.emptyAI}`);
    console.log(`  空AI比例: ${(results.aaaHospital.emptyAI / results.aaaHospital.totalFiles * 100).toFixed(1)}%`);

    console.log(`\n三軍總醫院:`);
    console.log(`  總文件數: ${results.triService.totalFiles}`);
    console.log(`  有AI分析: ${results.triService.withAI}`);
    console.log(`  空AI分析: ${results.triService.emptyAI}`);
    console.log(`  空AI比例: ${(results.triService.emptyAI / results.triService.totalFiles * 100).toFixed(1)}%`);

    console.log(`\n其他文件:`);
    console.log(`  總文件數: ${results.other.totalFiles}`);
    console.log(`  有AI分析: ${results.other.withAI}`);
    console.log(`  空AI分析: ${results.other.emptyAI}`);

    // 顯示一些空分析的例子
    if (results.aaaHospital.emptyAIFiles.length > 0) {
      console.log(`\nAAA醫院空分析文件範例 (前10個):`);
      results.aaaHospital.emptyAIFiles.slice(0, 10).forEach(item => {
        console.log(`  ${item.loincCode} - ${item.labItemName} (${item.file})`);
      });
    }

    if (results.triService.emptyAIFiles.length > 0) {
      console.log(`\n三軍總醫院空分析文件範例 (前10個):`);
      results.triService.emptyAIFiles.slice(0, 10).forEach(item => {
        console.log(`  ${item.loincCode} - ${item.labItemName} (${item.file})`);
      });
    }

    // 保存詳細結果
    const resultFile = path.join(baseDir, 'empty_ai_analysis_report.json');
    fs.writeFileSync(resultFile, JSON.stringify(results, null, 2), 'utf8');
    console.log(`\n詳細報告已保存到: ${resultFile}`);

    return results;

  } catch (error) {
    console.error('分析過程中發生錯誤:', error);
    throw error;
  }
}

// 執行分析
if (require.main === module) {
  analyzeEmptyAIFiles()
    .then(results => {
      console.log('\n✅ 分析完成!');
    })
    .catch(error => {
      console.error('❌ 分析失敗:', error);
      process.exit(1);
    });
}

module.exports = analyzeEmptyAIFiles;