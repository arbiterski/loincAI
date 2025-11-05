const fs = require('fs');
const path = require('path');

async function analyzeLOINCMismatches() {
  try {
    const baseDir = '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC';
    const savedMappingsDir = path.join(baseDir, 'saved_mappings');

    console.log('🔍 掃描所有AI分析文件，尋找建議與實際LOINC不一致的項目...\n');

    const mismatches = [];
    let totalAnalyzed = 0;
    let hasAnalysisCount = 0;

    // 遞歸掃描所有JSON文件
    const scanDirectory = (dirPath) => {
      const items = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const item of items) {
        if (item.isDirectory()) {
          scanDirectory(path.join(dirPath, item.name));
        } else if (item.isFile() && item.name.endsWith('.json')) {
          const filePath = path.join(dirPath, item.name);
          analyzeFile(filePath);
        }
      }
    };

    const analyzeFile = (filePath) => {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        totalAnalyzed++;

        // 提取當前選擇的LOINC碼
        let selectedLoinc = null;
        if (data.selectedLoincCodes && data.selectedLoincCodes.length > 0) {
          selectedLoinc = data.selectedLoincCodes[0];
        } else if (data.selectedLoinc) {
          selectedLoinc = data.selectedLoinc;
        }

        // 檢查是否有AI分析
        const aiAnalysis = data.aiAnalysis || '';
        if (!aiAnalysis || !aiAnalysis.trim()) {
          return; // 跳過沒有AI分析的文件
        }

        hasAnalysisCount++;

        // 尋找AI分析中推薦的LOINC碼
        const recommendedCodes = extractRecommendedLOINC(aiAnalysis);

        if (selectedLoinc && recommendedCodes.length > 0) {
          // 檢查選擇的碼是否在推薦中
          const isMatched = recommendedCodes.some(rec =>
            rec.code === selectedLoinc ||
            aiAnalysis.includes(`${selectedLoinc}`) && aiAnalysis.includes('推薦') ||
            aiAnalysis.includes(`${selectedLoinc}`) && aiAnalysis.includes('建議') ||
            aiAnalysis.includes(`${selectedLoinc}`) && aiAnalysis.includes('最佳') ||
            aiAnalysis.includes(`${selectedLoinc}`) && aiAnalysis.includes('適合')
          );

          if (!isMatched) {
            // 找到不一致的情況
            const labItemName = data.labDataContext?.labItemName || 'Unknown';
            const searchTerms = data.search?.searchTerms || 'Unknown';
            const sampleType = data.labDataContext?.labSampleType || 'Unknown';
            const hospital = data.labDataContext?.institution || 'Unknown';

            mismatches.push({
              file: path.basename(filePath),
              hospital: hospital,
              labItemName: labItemName,
              searchTerms: searchTerms,
              sampleType: sampleType,
              selectedLoinc: selectedLoinc,
              recommendedCodes: recommendedCodes,
              analysisSnippet: aiAnalysis.substring(0, 500) + '...',
              fullAnalysis: aiAnalysis
            });
          }
        }

      } catch (e) {
        console.warn(`無法分析文件 ${filePath}:`, e.message);
      }
    };

    // 提取AI分析中推薦的LOINC碼
    const extractRecommendedLOINC = (analysis) => {
      const codes = [];

      // 各種推薦模式的正則表達式
      const patterns = [
        /推薦.*?LOINC.*?代碼[：:]\\s*([\\d-]+)/gi,
        /建議.*?LOINC.*?代碼[：:]\\s*([\\d-]+)/gi,
        /最適合.*?代碼.*?([\\d-]+)/gi,
        /最佳.*?LOINC.*?代碼[：:]\\s*([\\d-]+)/gi,
        /Recommended.*?LOINC.*?Code[：:]\\s*([\\d-]+)/gi,
        /推薦的\\s*LOINC\\s*代碼[：:]\\s*([\\d-]+)/gi,
        /建議以.*?([\\d-]+).*?作為/gi,
        /選擇.*?([\\d-]+).*?較為適合/gi,
        /LOINC[：:]\\s*([\\d-]+).*?是.*?選擇/gi,
        /因此.*?建議.*?([\\d-]+)/gi,
        /最符合.*?代碼.*?([\\d-]+)/gi,
        /color:red.*?>([\\d-]+)</gi,
        /\\*\\*([\\d-]+)\\*\\*/gi
      ];

      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(analysis)) !== null) {
          const code = match[1];
          if (code && /^\\d{1,5}-\\d{1,2}$/.test(code)) {
            codes.push({
              code: code,
              context: match[0]
            });
          }
        }
      }

      // 移除重複項目
      const uniqueCodes = codes.filter((item, index, self) =>
        index === self.findIndex(t => t.code === item.code)
      );

      return uniqueCodes;
    };

    // 開始掃描
    scanDirectory(savedMappingsDir);

    console.log(`📊 掃描統計:`);
    console.log(`總文件數: ${totalAnalyzed}`);
    console.log(`有AI分析: ${hasAnalysisCount}`);
    console.log(`發現不一致: ${mismatches.length}\\n`);

    if (mismatches.length > 0) {
      console.log('🚨 發現以下LOINC對照不一致的項目:\\n');

      mismatches.forEach((mismatch, index) => {
        console.log(`${index + 1}. ${mismatch.labItemName} (${mismatch.selectedLoinc})`);
        console.log(`   醫院: ${mismatch.hospital}`);
        console.log(`   搜尋詞: ${mismatch.searchTerms}`);
        console.log(`   檢體: ${mismatch.sampleType}`);
        console.log(`   當前選擇: ${mismatch.selectedLoinc}`);
        console.log(`   AI推薦: ${mismatch.recommendedCodes.map(r => r.code).join(', ')}`);
        console.log(`   檔案: ${mismatch.file}`);
        console.log('   ---');
      });

      // 按醫院分組統計
      const byHospital = mismatches.reduce((acc, item) => {
        const hospital = item.hospital.includes('AAA') ? 'AAA' :
                        item.hospital.includes('Tri-Service') ? 'Tri-Service' : 'Other';
        acc[hospital] = (acc[hospital] || 0) + 1;
        return acc;
      }, {});

      console.log('\\n📈 按醫院統計不一致項目:');
      Object.entries(byHospital).forEach(([hospital, count]) => {
        console.log(`${hospital}: ${count} 項`);
      });
    }

    // 保存詳細報告
    const reportData = {
      scanTimestamp: new Date().toISOString(),
      summary: {
        totalFiles: totalAnalyzed,
        filesWithAnalysis: hasAnalysisCount,
        mismatchCount: mismatches.length,
        mismatchRate: ((mismatches.length / hasAnalysisCount) * 100).toFixed(2) + '%'
      },
      mismatches: mismatches,
      byHospital: mismatches.reduce((acc, item) => {
        const hospital = item.hospital.includes('AAA') ? 'AAA' :
                        item.hospital.includes('Tri-Service') ? 'Tri-Service' : 'Other';
        if (!acc[hospital]) acc[hospital] = [];
        acc[hospital].push({
          labItemName: item.labItemName,
          selectedLoinc: item.selectedLoinc,
          recommendedCodes: item.recommendedCodes.map(r => r.code),
          sampleType: item.sampleType
        });
        return acc;
      }, {})
    };

    const reportFile = path.join(baseDir, 'loinc_mismatch_analysis_report.json');
    fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2), 'utf8');
    console.log(`\\n📄 詳細報告已保存: ${reportFile}`);

    return reportData;

  } catch (error) {
    console.error('分析過程中發生錯誤:', error);
    throw error;
  }
}

// 執行分析
if (require.main === module) {
  analyzeLOINCMismatches()
    .then(result => {
      console.log('\\n✅ LOINC不一致分析完成!');
      if (result.mismatches.length === 0) {
        console.log('🎉 未發現其他不一致項目');
      }
    })
    .catch(error => {
      console.error('❌ 分析失敗:', error);
      process.exit(1);
    });
}

module.exports = analyzeLOINCMismatches;