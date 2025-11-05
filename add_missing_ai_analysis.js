const fs = require('fs');
const path = require('path');

// 為缺失AI分析的重要項目添加分析內容
const missingAnalysis = {
  "54348-8": `Alpha-1-Fetoprotein (AFP) 是一種重要的腫瘤標記物，主要用於肝癌、生殖細胞腫瘤的診斷和監測。正常成人血清AFP濃度極低（<10 ng/mL），但在肝細胞癌患者中可顯著升高。AFP也可用於產前篩檢，檢測神經管缺陷等胎兒異常。此LOINC碼特指臍帶血中的AFP檢測，常用於新生兒相關檢查。檢測方法通常使用化學發光免疫分析法(CLIA)或酶聯免疫吸附法(ELISA)。臨床意義包括：肝癌診斷與監測、生殖細胞腫瘤篩檢、產前診斷輔助指標。需注意某些良性肝病如肝炎、肝硬化也可能導致AFP輕度升高。`,

  // 可以添加更多缺失的分析
  "1988-5": `總膽固醇是評估心血管疾病風險的重要指標。正常範圍一般為 < 200 mg/dL (<5.2 mmol/L)。高膽固醇血症是動脈粥樣硬化和冠心病的主要危險因子。檢測採用酶法，通常要求空腹12小時。臨床意義包括心血管風險評估、動脈硬化篩檢、脂質代謝異常診斷。需結合HDL、LDL、三酸甘油酯等指標綜合評估。`,

  "2085-9": `高密度脂蛋白膽固醇(HDL-C)俗稱"好膽固醇"，具有保護心血管的作用。正常值男性 > 40 mg/dL，女性 > 50 mg/dL。HDL-C能將周邊組織的膽固醇運送回肝臟代謝，具有抗動脈硬化作用。低HDL-C是心血管疾病的獨立危險因子。檢測方法包括直接法和間接法，現多採用直接免疫法。臨床應用於心血管風險分層、脂質代謝評估、治療效果監測。`
};

async function addMissingAIAnalysis() {
  try {
    const baseDir = '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC';

    // 讀取現有的AI分析映射
    const aiAnalysisMap = {};

    // 載入現有分析
    const extractAIAnalysis = (filePath, fileName) => {
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

        if (loincCode) {
          if (analysis && analysis.trim()) {
            // 有現有分析
            const cleanAnalysis = analysis
              .replace(/<[^>]*>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            aiAnalysisMap[loincCode] = cleanAnalysis;
          } else {
            // 沒有分析，標記為空
            aiAnalysisMap[loincCode] = '';
          }
          return true;
        }
        return false;
      } catch (e) {
        return false;
      }
    };

    // 載入所有現有的AI分析
    const savedMappingsDir = path.join(baseDir, 'saved_mappings');
    if (fs.existsSync(savedMappingsDir)) {
      const loadAIFromDirectory = (dirPath) => {
        const items = fs.readdirSync(dirPath, { withFileTypes: true });
        let count = 0;

        for (const item of items) {
          if (item.isFile() && item.name.endsWith('.json')) {
            const filePath = path.join(dirPath, item.name);
            if (extractAIAnalysis(filePath, item.name)) count++;
          } else if (item.isDirectory()) {
            count += loadAIFromDirectory(path.join(dirPath, item.name));
          }
        }
        return count;
      };

      const totalFiles = loadAIFromDirectory(savedMappingsDir);
      console.log(`載入了 ${totalFiles} 個分析文件`);
    }

    // 檢查並添加缺失的分析
    let addedCount = 0;
    for (const [loincCode, analysis] of Object.entries(missingAnalysis)) {
      if (!aiAnalysisMap[loincCode] || !aiAnalysisMap[loincCode].trim()) {
        console.log(`為 LOINC ${loincCode} 添加缺失的分析`);
        aiAnalysisMap[loincCode] = analysis;
        addedCount++;
      } else {
        console.log(`LOINC ${loincCode} 已有分析，跳過`);
      }
    }

    // 創建一個包含補充分析的文件
    const supplementFile = path.join(baseDir, 'saved_mappings', 'ai_analysis_supplement.json');
    const supplementData = {
      metadata: {
        timestamp: new Date().toISOString(),
        description: "補充缺失的AI分析",
        addedAnalysisCount: addedCount
      },
      supplementAnalysis: {}
    };

    // 只保存新添加的分析
    for (const [loincCode, analysis] of Object.entries(missingAnalysis)) {
      supplementData.supplementAnalysis[loincCode] = analysis;
    }

    fs.writeFileSync(supplementFile, JSON.stringify(supplementData, null, 2), 'utf8');
    console.log(`補充分析文件已保存: ${supplementFile}`);

    // 更新渲染腳本的AI分析載入邏輯
    console.log(`\n已為 ${addedCount} 個 LOINC 碼添加分析：`);
    Object.keys(missingAnalysis).forEach(code => {
      console.log(`- ${code}: ${missingAnalysis[code].substring(0, 50)}...`);
    });

    return {
      totalAnalysis: Object.keys(aiAnalysisMap).length,
      addedCount: addedCount,
      supplementFile: supplementFile
    };

  } catch (error) {
    console.error('添加分析時發生錯誤:', error);
    throw error;
  }
}

// 執行腳本
if (require.main === module) {
  addMissingAIAnalysis()
    .then(result => {
      console.log('\n✅ 分析補充完成!');
      console.log(`總分析數: ${result.totalAnalysis}`);
      console.log(`新增分析: ${result.addedCount}`);
    })
    .catch(error => {
      console.error('❌ 補充分析失敗:', error);
      process.exit(1);
    });
}

module.exports = addMissingAIAnalysis;