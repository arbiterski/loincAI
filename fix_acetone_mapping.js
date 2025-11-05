const fs = require('fs');
const path = require('path');

async function fixAcetoneMapping() {
  try {
    const baseDir = '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC';

    // 檢查三軍總醫院的final_200數據
    const triDataPath = path.join(baseDir, 'tri_service_final_200.json');
    const triData = JSON.parse(fs.readFileSync(triDataPath, 'utf8'));

    // 找到5567-3的項目
    const acetoneItem = triData.find(item => item.loincCode === '5567-3');

    if (acetoneItem) {
      console.log('找到問題項目:');
      console.log(`項目名稱: ${acetoneItem.labItemName}`);
      console.log(`檢體類型: ${acetoneItem.labSampleType}`);
      console.log(`當前LOINC: ${acetoneItem.loincCode} - ${acetoneItem.loincName}`);
      console.log(`排序: ${acetoneItem.itemRank}`);

      // 更新補充分析文件，為5567-3提供正確的分析
      const correctAnalysis = {
        "5567-3": `尿液丙酮 (Acetone in Urine) 檢測存在LOINC對照問題。本項目原始數據顯示檢體類型為"Urines"，項目名稱為"Acetone Urine"，但錯誤選擇了血清/血漿的LOINC碼5567-3。正確的LOINC碼應該是33903-6 "Ketones [Presence] in Urine"，因為：1) 檢體類型匹配（尿液 vs 血清/血漿）；2) 臨床意義正確（尿液酮體檢測是糖尿病監測的標準項目）；3) 檢測方法適合（尿液試紙法）。雖然當前使用5567-3，但臨床解釋應基於尿液酮體：正常尿液酮體應為陰性，陽性提示脂肪代謝異常、糖尿病酮症、飢餓狀態等。檢測方法通常使用尿液試紙，快速簡便。建議未來修正為正確的尿液酮體LOINC碼。`
      };

      // 載入現有補充文件
      const supplementFile = path.join(baseDir, 'saved_mappings', 'comprehensive_ai_analysis_supplement.json');
      const supplementData = JSON.parse(fs.readFileSync(supplementFile, 'utf8'));

      // 添加修正分析
      supplementData.supplementAnalysis["5567-3"] = correctAnalysis["5567-3"];
      supplementData.codeDetails["5567-3"] = {
        labItemName: "Acetone Urine",
        hospital: "Tri-Service",
        category: "尿液檢查 (LOINC對照錯誤)",
        note: "應使用33903-6 Ketones [Presence] in Urine"
      };
      supplementData.metadata.totalSupplementedCodes = Object.keys(supplementData.supplementAnalysis).length;
      supplementData.metadata.correctedMappings = supplementData.metadata.correctedMappings || [];
      supplementData.metadata.correctedMappings.push({
        loincCode: "5567-3",
        issue: "檢體類型不匹配",
        currentMapping: "Acetone [Presence] in Serum or Plasma",
        suggestedMapping: "33903-6 - Ketones [Presence] in Urine",
        reason: "原始數據檢體類型為Urines，但選擇了血清/血漿的LOINC碼"
      });

      // 保存更新的補充文件
      fs.writeFileSync(supplementFile, JSON.stringify(supplementData, null, 2), 'utf8');

      // 同時更新原有的補充文件
      const originalSupplementFile = path.join(baseDir, 'saved_mappings', 'ai_analysis_supplement.json');
      fs.writeFileSync(originalSupplementFile, JSON.stringify(supplementData, null, 2), 'utf8');

      console.log('\n✅ 已修正5567-3的分析問題');
      console.log('📝 添加了正確的臨床解釋');
      console.log('⚠️  標記了LOINC對照錯誤問題');
      console.log('💡 建議修正為33903-6');

      return {
        issue: "LOINC對照錯誤",
        currentCode: "5567-3",
        correctCode: "33903-6",
        problem: "檢體類型不匹配 (血清/血漿 vs 尿液)",
        fixed: true
      };

    } else {
      console.log('❌ 未找到5567-3項目');
      return { fixed: false };
    }

  } catch (error) {
    console.error('修正過程中發生錯誤:', error);
    throw error;
  }
}

// 執行修正
if (require.main === module) {
  fixAcetoneMapping()
    .then(result => {
      if (result.fixed) {
        console.log('\n📋 修正結果摘要:');
        console.log(`問題: ${result.issue}`);
        console.log(`當前碼: ${result.currentCode}`);
        console.log(`建議碼: ${result.correctCode}`);
        console.log(`原因: ${result.problem}`);
      }
    })
    .catch(error => {
      console.error('❌ 修正失敗:', error);
      process.exit(1);
    });
}

module.exports = fixAcetoneMapping;