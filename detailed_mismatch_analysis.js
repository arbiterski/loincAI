const fs = require('fs');
const path = require('path');

async function detailedMismatchAnalysis() {
  try {
    const baseDir = '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC';
    const savedMappingsDir = path.join(baseDir, 'saved_mappings');

    console.log('🔍 進行詳細的LOINC不一致分析...\n');

    const mismatches = [];
    let totalAnalyzed = 0;

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

        if (!selectedLoinc) {
          return; // 跳過沒有選擇LOINC碼的文件
        }

        const aiAnalysis = data.aiAnalysis || '';
        if (!aiAnalysis || !aiAnalysis.trim()) {
          return;
        }

        // 檢查各種推薦模式
        const checkPatterns = [
          // 明確推薦其他LOINC碼
          {
            pattern: /最符合的代碼是：.*?LOINC\s+(\d{1,5}-\d{1,2})/gi,
            description: '明確推薦代碼'
          },
          {
            pattern: /推薦的.*?LOINC.*?代碼.*?(\d{1,5}-\d{1,2})/gi,
            description: '推薦代碼'
          },
          {
            pattern: /建議.*?LOINC.*?(\d{1,5}-\d{1,2})/gi,
            description: '建議代碼'
          },
          {
            pattern: /因此.*?建議.*?(\d{1,5}-\d{1,2})/gi,
            description: '建議代碼'
          },
          {
            pattern: /最適合.*?(\d{1,5}-\d{1,2})/gi,
            description: '最適合代碼'
          },
          {
            pattern: /color:red.*?(\d{1,5}-\d{1,2})/gi,
            description: '紅色標記代碼'
          },
          {
            pattern: /\*\*(\d{1,5}-\d{1,2})\*\*/gi,
            description: '粗體標記代碼'
          }
        ];

        const recommendedCodes = new Set();

        for (const { pattern, description } of checkPatterns) {
          let match;
          const regex = new RegExp(pattern.source, pattern.flags);
          while ((match = regex.exec(aiAnalysis)) !== null) {
            const code = match[1];
            if (code && code !== selectedLoinc) {
              recommendedCodes.add(code);
            }
          }
        }

        // 特別檢查表格中的推薦（如5567-3案例）
        const tableMatches = aiAnalysis.match(/<td style="color:red;">(\d{1,5}-\d{1,2})<\/td>/gi);
        if (tableMatches) {
          tableMatches.forEach(match => {
            const code = match.match(/(\d{1,5}-\d{1,2})/)[1];
            if (code && code !== selectedLoinc) {
              recommendedCodes.add(code);
            }
          });
        }

        // 檢查分析中是否明確說明當前選擇不適合
        const criticalPhrases = [
          '不符合',
          '不適用',
          '較不適合',
          '不完全符合',
          '較少用於',
          '不建議',
          '錯誤',
          '不匹配'
        ];

        const hasCriticism = criticalPhrases.some(phrase =>
          aiAnalysis.includes(phrase) && aiAnalysis.includes(selectedLoinc)
        );

        if (recommendedCodes.size > 0 || hasCriticism) {
          const labItemName = data.labDataContext?.labItemName || 'Unknown';
          const searchTerms = data.search?.searchTerms || 'Unknown';
          const sampleType = data.labDataContext?.labSampleType || 'Unknown';
          const hospital = data.labDataContext?.institution || 'Unknown';

          // 提取推薦理由
          const extractRecommendationReason = (analysis, recommendedCode) => {
            const codeIndex = analysis.indexOf(recommendedCode);
            if (codeIndex !== -1) {
              const context = analysis.substring(Math.max(0, codeIndex - 200), codeIndex + 300);
              return context.replace(/<[^>]*>/g, '').replace(/\\s+/g, ' ').trim();
            }
            return '';
          };

          mismatches.push({
            file: path.basename(filePath),
            hospital: hospital.includes('AAA') ? 'AAA醫院' :
                     hospital.includes('Tri-Service') ? '三軍總醫院' : hospital,
            labItemName: labItemName,
            searchTerms: searchTerms,
            sampleType: sampleType,
            selectedLoinc: selectedLoinc,
            recommendedCodes: Array.from(recommendedCodes),
            hasCriticism: hasCriticism,
            recommendationReasons: Array.from(recommendedCodes).map(code =>
              extractRecommendationReason(aiAnalysis, code)
            ),
            analysisSnippet: aiAnalysis.substring(0, 800).replace(/<[^>]*>/g, '').replace(/\\s+/g, ' ')
          });
        }

      } catch (e) {
        console.warn(`無法分析文件 ${filePath}:`, e.message);
      }
    };

    scanDirectory(savedMappingsDir);

    console.log(`📊 掃描統計: 總共分析了 ${totalAnalyzed} 個文件`);
    console.log(`🚨 發現 ${mismatches.length} 個LOINC不一致項目\\n`);

    if (mismatches.length > 0) {
      console.log('📋 詳細不一致項目列表:\\n');

      mismatches.forEach((mismatch, index) => {
        console.log(`${index + 1}. 🏥 ${mismatch.hospital}`);
        console.log(`   📝 項目: ${mismatch.labItemName}`);
        console.log(`   🔍 搜尋: ${mismatch.searchTerms}`);
        console.log(`   🧪 檢體: ${mismatch.sampleType}`);
        console.log(`   ❌ 當前選擇: ${mismatch.selectedLoinc}`);
        console.log(`   ✅ AI推薦: ${mismatch.recommendedCodes.join(', ')}`);
        console.log(`   ⚠️  有批評: ${mismatch.hasCriticism ? '是' : '否'}`);
        console.log(`   📄 檔案: ${mismatch.file}`);
        if (mismatch.recommendationReasons[0]) {
          console.log(`   💡 推薦理由: ${mismatch.recommendationReasons[0].substring(0, 150)}...`);
        }
        console.log('   ' + '─'.repeat(80));
      });

      // 統計摘要
      const summary = {
        byHospital: mismatches.reduce((acc, item) => {
          acc[item.hospital] = (acc[item.hospital] || 0) + 1;
          return acc;
        }, {}),
        totalMismatches: mismatches.length,
        withCriticism: mismatches.filter(m => m.hasCriticism).length
      };

      console.log('\\n📈 統計摘要:');
      Object.entries(summary.byHospital).forEach(([hospital, count]) => {
        console.log(`${hospital}: ${count} 項不一致`);
      });
      console.log(`包含批評的項目: ${summary.withCriticism} 項`);
    }

    // 保存詳細報告
    const reportData = {
      scanTimestamp: new Date().toISOString(),
      totalFilesScanned: totalAnalyzed,
      mismatchCount: mismatches.length,
      mismatches: mismatches
    };

    const reportFile = path.join(baseDir, 'detailed_loinc_mismatch_report.json');
    fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2), 'utf8');
    console.log(`\\n📄 詳細報告已保存: ${reportFile}`);

    return reportData;

  } catch (error) {
    console.error('詳細分析過程中發生錯誤:', error);
    throw error;
  }
}

// 執行詳細分析
if (require.main === module) {
  detailedMismatchAnalysis()
    .then(result => {
      console.log('\\n✅ 詳細LOINC不一致分析完成!');
    })
    .catch(error => {
      console.error('❌ 詳細分析失敗:', error);
      process.exit(1);
    });
}

module.exports = detailedMismatchAnalysis;