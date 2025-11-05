const fs = require('fs');
const path = require('path');

async function finalLOINCMismatchAnalysis() {
  try {
    const baseDir = '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC';
    const savedMappingsDir = path.join(baseDir, 'saved_mappings');

    console.log('🔍 使用JSON中的aiAnalysis進行LOINC不一致分析...\n');

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

        // 直接使用JSON中的aiAnalysis
        const aiAnalysis = data.aiAnalysis || '';
        if (!aiAnalysis || !aiAnalysis.trim()) {
          return;
        }

        hasValidData++;

        // 從aiAnalysis中提取推薦的LOINC碼
        const recommendedCodes = extractRecommendedFromAiAnalysis(aiAnalysis);

        // 檢查是否有推薦與實際選擇不符的情況
        const hasRecommendationMismatch = recommendedCodes.length > 0 &&
          !recommendedCodes.some(rec => rec.code === selectedLoinc);

        // 檢查AI分析中是否有批評性詞語
        const criticalPhrases = [
          '不符合', '不適用', '較不適合', '不完全符合',
          '較少用於', '不建議', '錯誤', '不匹配', '不正確',
          '不合適', '較差', '問題'
        ];

        const hasCriticism = criticalPhrases.some(phrase =>
          aiAnalysis.includes(phrase)
        );

        if (hasRecommendationMismatch || hasCriticism) {
          const labItemName = data.labDataContext?.labItemName || 'Unknown';
          const searchTerms = data.search?.searchTerms || 'Unknown';
          const sampleType = data.labDataContext?.labSampleType || 'Unknown';
          const hospital = extractHospitalName(data.labDataContext?.institution || 'Unknown');

          // 提取推薦理由
          const recommendationReasons = recommendedCodes.map(rec => rec.reason).filter(r => r);

          mismatches.push({
            file: path.basename(filePath),
            hospital: hospital,
            labItemName: labItemName,
            searchTerms: searchTerms,
            sampleType: sampleType,
            selectedLoinc: selectedLoinc,
            recommendedCodes: recommendedCodes.map(r => r.code),
            recommendationReasons: recommendationReasons,
            hasCriticism: hasCriticism,
            hasRecommendationMismatch: hasRecommendationMismatch,
            fullAiAnalysis: aiAnalysis,
            analysisSnippet: aiAnalysis.substring(0, 1000).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')
          });
        }

      } catch (e) {
        console.warn(`無法分析文件 ${filePath}:`, e.message);
      }
    };

    // 從AI分析中提取推薦的LOINC碼
    const extractRecommendedFromAiAnalysis = (analysis) => {
      const codes = [];

      // 1. 提取表格中紅色標記的代碼和原因
      const redTablePattern = /<tr[^>]*>[\s\S]*?<td[^>]*style="color:\s*red[^"]*"[^>]*>(\d{1,5}-\d{1,2})<\/td>[\s\S]*?<td[^>]*style="color:\s*red[^"]*"[^>]*>([^<]+)<\/td>[\s\S]*?<\/tr>/gi;
      let match;
      while ((match = redTablePattern.exec(analysis)) !== null) {
        codes.push({
          code: match[1],
          reason: match[2].replace(/<[^>]*>/g, '').trim()
        });
      }

      // 2. 提取明確推薦語句
      const recommendationPatterns = [
        {
          pattern: /最符合搜尋詞語.*?LOINC.*?代碼.*?(\d{1,5}-\d{1,2})[^。]*?。([^。]*)/gi,
          type: '最符合推薦'
        },
        {
          pattern: /最符合.*?代碼.*?(\d{1,5}-\d{1,2})[^。]*?。([^。]*)/gi,
          type: '最符合代碼'
        },
        {
          pattern: /推薦.*?LOINC.*?代碼.*?(\d{1,5}-\d{1,2})[^。]*?。([^。]*)/gi,
          type: '推薦代碼'
        },
        {
          pattern: /建議.*?LOINC.*?代碼.*?(\d{1,5}-\d{1,2})[^。]*?。([^。]*)/gi,
          type: '建議代碼'
        },
        {
          pattern: /因此.*?建議.*?(\d{1,5}-\d{1,2})[^。]*?。([^。]*)/gi,
          type: '建議使用'
        }
      ];

      for (const patternObj of recommendationPatterns) {
        let match;
        while ((match = patternObj.pattern.exec(analysis)) !== null) {
          const existingCode = codes.find(c => c.code === match[1]);
          if (!existingCode) {
            codes.push({
              code: match[1],
              reason: `${patternObj.type}: ${match[2] || ''}`.trim()
            });
          }
        }
      }

      // 3. 提取表格中的推薦代碼（非紅色但有推薦意見）
      const tableRecommendationPattern = /<td[^>]*>(\d{1,5}-\d{1,2})<\/td>[\s\S]*?<td[^>]*>([^<]*推薦[^<]*|[^<]*建議[^<]*|[^<]*最適合[^<]*|[^<]*符合[^<]*)<\/td>/gi;
      while ((match = tableRecommendationPattern.exec(analysis)) !== null) {
        const existingCode = codes.find(c => c.code === match[1]);
        if (!existingCode) {
          codes.push({
            code: match[1],
            reason: match[2].replace(/<[^>]*>/g, '').trim()
          });
        }
      }

      return codes;
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

      mismatches.slice(0, 20).forEach((mismatch, index) => {
        console.log(`${index + 1}. 🏥 ${mismatch.hospital}`);
        console.log(`   📝 項目: ${mismatch.labItemName}`);
        console.log(`   🔍 搜尋: ${mismatch.searchTerms.substring(0, 50)}...`);
        console.log(`   🧪 檢體: ${mismatch.sampleType}`);
        console.log(`   ❌ 當前選擇: ${mismatch.selectedLoinc}`);
        console.log(`   ✅ AI推薦: ${mismatch.recommendedCodes.join(', ') || '無明確推薦'}`);
        if (mismatch.recommendationReasons.length > 0) {
          console.log(`   💡 推薦理由: ${mismatch.recommendationReasons[0].substring(0, 100)}...`);
        }
        console.log(`   ⚠️  有批評: ${mismatch.hasCriticism ? '是' : '否'}`);
        console.log(`   🔄 推薦不符: ${mismatch.hasRecommendationMismatch ? '是' : '否'}`);
        console.log(`   📄 檔案: ${mismatch.file}`);
        console.log('   ' + '─'.repeat(80));
      });

      if (mismatches.length > 20) {
        console.log(`   ... 還有 ${mismatches.length - 20} 個項目，詳見JSON報告`);
      }

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
      methodology: "直接使用JSON檔案中的aiAnalysis欄位進行分析",
      mismatches: mismatches
    };

    const reportFile = path.join(baseDir, 'final_loinc_mismatch_report.json');
    fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2), 'utf8');
    console.log(`\n📄 最終報告已保存: ${reportFile}`);

    return reportData;

  } catch (error) {
    console.error('分析過程中發生錯誤:', error);
    throw error;
  }
}

// 執行分析
if (require.main === module) {
  finalLOINCMismatchAnalysis()
    .then(result => {
      console.log('\n✅ 基於JSON aiAnalysis的LOINC不一致分析完成!');
    })
    .catch(error => {
      console.error('❌ 分析失敗:', error);
      process.exit(1);
    });
}

module.exports = finalLOINCMismatchAnalysis;