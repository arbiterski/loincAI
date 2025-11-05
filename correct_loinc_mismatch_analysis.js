const fs = require('fs');
const path = require('path');

async function correctLOINCMismatchAnalysis() {
  try {
    const baseDir = '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC';
    const savedMappingsDir = path.join(baseDir, 'saved_mappings');

    console.log('🔍 進行正確的LOINC不一致分析...\n');

    const mismatches = [];
    let totalAnalyzed = 0;
    let hasValidData = 0;

    const scanDirectory = (dirPath) => {
      const items = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const item of items) {
        if (item.isDirectory()) {
          scanDirectory(path.join(dirPath, item.name));
        } else if (item.isFile() && item.name.endsWith('.json') &&
                   item.name.startsWith('loinc_mapping_')) {
          const filePath = path.join(dirPath, item.name);
          analyzeFile(filePath);
        }
      }
    };

    const analyzeFile = (filePath) => {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        totalAnalyzed++;

        // 提取選擇的LOINC碼
        let selectedLoinc = null;
        if (data.selectedLoincCodes && data.selectedLoincCodes.length > 0) {
          selectedLoinc = data.selectedLoincCodes[0];
        }

        if (!selectedLoinc) {
          return; // 跳過沒有選擇LOINC碼的文件
        }

        const aiAnalysis = data.aiAnalysis || '';
        if (!aiAnalysis || !aiAnalysis.trim()) {
          return;
        }

        hasValidData++;

        // 提取AI推薦的LOINC碼（紅色標記的）
        const recommendedCodes = extractRecommendedCodes(aiAnalysis);

        // 檢查是否有不一致
        const hasRecommendationMismatch = recommendedCodes.length > 0 &&
          !recommendedCodes.includes(selectedLoinc);

        // 檢查批評性詞語
        const criticalPhrases = [
          '不符合', '不適用', '較不適合', '不完全符合',
          '較少用於', '不建議', '錯誤', '不匹配'
        ];

        const hasCriticism = criticalPhrases.some(phrase =>
          aiAnalysis.includes(phrase)
        );

        if (hasRecommendationMismatch || hasCriticism) {
          const labItemName = data.labDataContext?.labItemName || 'Unknown';
          const searchTerms = data.search?.searchTerms || 'Unknown';
          const sampleType = data.labDataContext?.labSampleType || 'Unknown';
          const hospital = extractHospitalName(data.labDataContext?.institution || 'Unknown');

          mismatches.push({
            file: path.basename(filePath),
            hospital: hospital,
            labItemName: labItemName,
            searchTerms: searchTerms,
            sampleType: sampleType,
            selectedLoinc: selectedLoinc,
            recommendedCodes: recommendedCodes,
            hasCriticism: hasCriticism,
            hasRecommendationMismatch: hasRecommendationMismatch,
            analysisSnippet: aiAnalysis.substring(0, 800).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')
          });
        }

      } catch (e) {
        console.warn(`無法分析文件 ${filePath}:`, e.message);
      }
    };

    // 提取AI推薦的LOINC碼（重點關注紅色標記的）
    const extractRecommendedCodes = (analysis) => {
      const codes = new Set();

      // 1. 提取表格中紅色標記的代碼
      const redCodePatterns = [
        /<td style="color:\s*red;?"[^>]*>(\d{1,5}-\d{1,2})</gi,
        /<td style="color:red;?"[^>]*>(\d{1,5}-\d{1,2})</gi,
        /style="color:\s*red;?"[^>]*>(\d{1,5}-\d{1,2})</gi
      ];

      for (const pattern of redCodePatterns) {
        let match;
        while ((match = pattern.exec(analysis)) !== null) {
          codes.add(match[1]);
        }
      }

      // 2. 提取明確推薦表述
      const recommendationPatterns = [
        /最符合.*?代碼.*?(\d{1,5}-\d{1,2})/gi,
        /最符合搜尋詞語.*?(\d{1,5}-\d{1,2})/gi,
        /推薦.*?(\d{1,5}-\d{1,2})/gi,
        /建議.*?(\d{1,5}-\d{1,2})/gi,
        /最適合.*?(\d{1,5}-\d{1,2})/gi,
        /\*\*(\d{1,5}-\d{1,2})\*\*/gi
      ];

      for (const pattern of recommendationPatterns) {
        let match;
        while ((match = pattern.exec(analysis)) !== null) {
          codes.add(match[1]);
        }
      }

      return Array.from(codes);
    };

    const extractHospitalName = (institution) => {
      if (institution.includes('AAA')) return 'AAA醫院';
      if (institution.includes('Tri-Service')) return '三軍總醫院';
      return institution;
    };

    // 開始掃描
    scanDirectory(savedMappingsDir);

    console.log(`📊 掃描統計: 總共分析了 ${totalAnalyzed} 個mapping文件`);
    console.log(`📝 有效數據: ${hasValidData} 個文件`);
    console.log(`🚨 發現 ${mismatches.length} 個LOINC不一致項目\n`);

    if (mismatches.length > 0) {
      console.log('📋 詳細不一致項目列表:\n');

      mismatches.forEach((mismatch, index) => {
        console.log(`${index + 1}. 🏥 ${mismatch.hospital}`);
        console.log(`   📝 項目: ${mismatch.labItemName}`);
        console.log(`   🔍 搜尋: ${mismatch.searchTerms.substring(0, 50)}...`);
        console.log(`   🧪 檢體: ${mismatch.sampleType}`);
        console.log(`   ❌ 當前選擇: ${mismatch.selectedLoinc}`);
        console.log(`   ✅ AI推薦: ${mismatch.recommendedCodes.join(', ') || '無明確推薦'}`);
        console.log(`   ⚠️  有批評: ${mismatch.hasCriticism ? '是' : '否'}`);
        console.log(`   🔄 推薦不符: ${mismatch.hasRecommendationMismatch ? '是' : '否'}`);
        console.log(`   📄 檔案: ${mismatch.file}`);
        console.log('   ' + '─'.repeat(80));
      });

      // 統計摘要
      const summary = {
        byHospital: mismatches.reduce((acc, item) => {
          acc[item.hospital] = (acc[item.hospital] || 0) + 1;
          return acc;
        }, {}),
        totalMismatches: mismatches.length,
        withCriticism: mismatches.filter(m => m.hasCriticism).length,
        withRecommendationMismatch: mismatches.filter(m => m.hasRecommendationMismatch).length
      };

      console.log('\n📈 統計摘要:');
      Object.entries(summary.byHospital).forEach(([hospital, count]) => {
        console.log(`${hospital}: ${count} 項不一致`);
      });
      console.log(`包含批評的項目: ${summary.withCriticism} 項`);
      console.log(`AI推薦不符的項目: ${summary.withRecommendationMismatch} 項`);
    }

    // 保存詳細報告
    const reportData = {
      scanTimestamp: new Date().toISOString(),
      totalFilesScanned: totalAnalyzed,
      validDataFiles: hasValidData,
      mismatchCount: mismatches.length,
      mismatches: mismatches
    };

    const reportFile = path.join(baseDir, 'correct_loinc_mismatch_report.json');
    fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2), 'utf8');
    console.log(`\n📄 正確的詳細報告已保存: ${reportFile}`);

    return reportData;

  } catch (error) {
    console.error('分析過程中發生錯誤:', error);
    throw error;
  }
}

// 執行分析
if (require.main === module) {
  correctLOINCMismatchAnalysis()
    .then(result => {
      console.log('\n✅ 正確的LOINC不一致分析完成!');
    })
    .catch(error => {
      console.error('❌ 分析失敗:', error);
      process.exit(1);
    });
}

module.exports = correctLOINCMismatchAnalysis;