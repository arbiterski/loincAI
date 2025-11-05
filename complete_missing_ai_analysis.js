const fs = require('fs');
const path = require('path');

// 為所有缺少AI分析的項目創建專業分析內容
const comprehensiveAnalysis = {
  // AAA醫院缺少的8個項目
  "706-2": `嗜鹼性白血球 (Basophil) 是血液中數量最少的白血球類型，正常值約占白血球總數的0.5-1%。主要功能包括參與過敏反應和發炎反應，釋放組織胺和肝素等介質。臨床意義：嗜鹼性白血球增多常見於過敏性疾病（如氣喘、過敏性鼻炎）、血液疾病（如慢性粒細胞白血病、真性紅血球增多症）、感染（特別是寄生蟲感染）、內分泌疾病（如甲狀腺功能低下）等。檢測方法通常使用自動血球計數器進行全血細胞計數。需注意某些藥物如抗甲狀腺藥物可能影響數值。`,

  "1920-8": `天門冬胺酸轉胺酶 (AST/GOT) 是重要的肝功能指標，廣泛存在於肝臟、心肌、骨骼肌等組織中。正常值一般為10-40 U/L（可因實驗室而異）。臨床意義：AST升高主要見於急慢性肝炎、肝硬化、肝癌、心肌梗塞、肌肉損傷等。當肝細胞受損時，AST會釋放入血，導致血清濃度升高。通常與ALT一併檢測，AST/ALT比值有助於鑑別診斷：比值>2提示酒精性肝病或肝硬化，比值<1多見於病毒性肝炎。檢測採用酶法，需空腹採血。`,

  "1977-8": `膽紅素 (Bilirubin) 是血紅蛋白代謝的產物，包括直接膽紅素和間接膽紅素。總膽紅素正常值約0.3-1.2 mg/dL (5-21 μmol/L)。臨床意義：膽紅素升高導致黃疸，可分為溶血性黃疸（間接膽紅素↑）、肝細胞性黃疸（兩者皆↑）、阻塞性黃疸（直接膽紅素↑）。常見原因包括溶血性貧血、肝炎、膽道阻塞、新生兒生理性黃疸等。檢測方法使用重氮法或酶法。需注意飲食、藥物、光照等因素可能影響結果。膽紅素檢測對肝膽疾病診斷具重要價值。`,

  "19258-3": `靜脈血氧分壓 (pO2 venous) 反映組織對氧氣的利用程度，正常值約35-40 mmHg。與動脈血氧分壓不同，靜脈血氧分壓較低，反映組織代謝後的血氧狀態。臨床意義：靜脈血氧分壓降低可見於心功能不全、休克、嚴重貧血、組織代謝亢進等情況。升高則可能表示組織氧利用障礙或動靜脈分流。檢測通常使用血氣分析儀，需嚴格厭氧採集和及時檢測。常與血氧飽和度、血紅蛋白等指標一併評估，對重症監護、心肺功能評估具重要價值。`,

  "2039-6": `癌胚抗原 (CEA) 是重要的腫瘤標記物，正常人血清濃度極低，通常<2.5 ng/mL（非吸菸者）或<5.0 ng/mL（吸菸者）。CEA主要用於結直腸癌的診斷、分期、療效監測和復發監測。臨床意義：CEA升高常見於消化道腫瘤（特別是結直腸癌）、肺癌、乳腺癌、卵巢癌等。但也可見於良性疾病如肝硬化、胰腺炎、炎症性腸病等。檢測方法通常使用化學發光免疫分析法(CLIA)。需注意吸菸、年齡等因素可能影響基準值。CEA不適合作為篩檢工具，主要用於已確診癌症患者的監測。`,

  "2532-0": `乳酸脫氫酶 (LDH) 是重要的細胞酶，廣泛存在於心肌、肝臟、骨骼肌、腎臟等組織中。正常值約140-280 U/L（可因實驗室而異）。LDH有五種同工酶，不同組織來源的LDH同工酶比例不同。臨床意義：LDH升高見於心肌梗塞、肝病、溶血、肌肉損傷、惡性腫瘤等。由於LDH廣泛存在，其升高缺乏器官特異性，需結合其他指標判讀。在腫瘤學中，LDH常作為預後指標。檢測採用酶法，室溫下不穩定，需及時檢測或冷藏保存。`,

  "35741-8": `前列腺特異性抗原 (Total PSA) 是前列腺特異性的糖蛋白，主要由前列腺上皮細胞產生。正常值一般<4.0 ng/mL，但需考慮年齡因素。臨床意義：PSA主要用於前列腺癌的篩檢、診斷、分期和療效監測。PSA升高可見於前列腺癌、良性前列腺增生、前列腺炎等。需注意前列腺按摩、導尿、射精等可能暫時性升高PSA。檢測包括總PSA和游離PSA，游離PSA/總PSA比值有助於鑑別良惡性病變。採用化學發光免疫分析法，是目前前列腺癌最重要的血清標記物。`,

  "54348-8": `甲型胎兒蛋白 (Alpha-Fetoprotein, AFP) 是重要的腫瘤標記物，主要用於肝癌、生殖細胞腫瘤的診斷和監測。正常成人血清AFP濃度極低（<10 ng/mL），但在肝細胞癌患者中可顯著升高。AFP也可用於產前篩檢，檢測神經管缺陷等胎兒異常。此LOINC碼特指臍帶血中的AFP檢測，常用於新生兒相關檢查。檢測方法通常使用化學發光免疫分析法(CLIA)或酶聯免疫吸附法(ELISA)。臨床意義包括：肝癌診斷與監測、生殖細胞腫瘤篩檢、產前診斷輔助指標。需注意某些良性肝病如肝炎、肝硬化也可能導致AFP輕度升高。`,

  // 三軍總醫院缺少的4個項目
  "1742-6": `丙胺酸轉胺酶 (ALT/GPT) 是最重要的肝功能指標之一，主要存在於肝細胞中，正常值一般為7-40 U/L（可因實驗室而異）。ALT對肝細胞損傷具有高度敏感性和相對特異性。臨床意義：ALT升高主要見於急慢性肝炎、脂肪肝、肝硬化、藥物性肝損傷、肝癌等。與AST相比，ALT對肝細胞損傷更敏感，常作為肝炎診斷的首選指標。檢測採用酶法，建議空腹採血。ALT升高超過正常值上限2倍通常提示肝細胞損傷，需進一步檢查確定病因。`,

  "789-8": `紅血球計數 (RBC) 是基本的血液檢查項目，反映血液中紅血球的數量。正常值男性約4.5-5.5 × 10¹²/L，女性約4.0-5.0 × 10¹²/L。紅血球主要功能是攜帶氧氣和二氧化碳。臨床意義：RBC減少見於各種貧血（缺鐵性、巨球性、再生不良性貧血等）、慢性失血、慢性疾病等。RBC增加見於真性紅血球增多症、慢性肺病、高原居住等。檢測使用自動血球計數器，需與血紅蛋白、血球容積比等指標一併評估。是貧血診斷和分類的重要依據。`,

  "21418-9": `中性白血球 (Neutrophil) 是血液中數量最多的白血球類型，約占白血球總數的50-70%。主要功能是吞噬細菌和真菌，是機體重要的防禦細胞。正常絕對計數約2.0-7.5 × 10⁹/L。臨床意義：中性白血球增多常見於細菌感染、急性發炎、組織壞死、惡性腫瘤、藥物反應等。減少則見於病毒感染、藥物副作用、放化療、自體免疫疾病等。檢測使用自動血球計數器，可提供絕對計數和百分比。中性白血球計數對感染診斷和免疫功能評估具重要價值。`,

  "57803-9": `尿潛血 (Urine Occult Blood) 檢測尿液中是否含有肉眼不可見的紅血球或血紅蛋白。正常尿液應為陰性或僅有少量紅血球（<3個/高倍視野）。臨床意義：尿潛血陽性可見於泌尿系統疾病如腎炎、腎結石、泌尿道感染、膀胱癌、前列腺疾病等，也可能由劇烈運動、月經污染等非病理因素引起。檢測方法包括試紙法和顯微鏡檢查。試紙法快速但可能有偽陽性，顯微鏡檢查更準確。需注意採集中段尿，避免外生殖器污染。持續尿潛血陽性需進一步檢查明確病因。`
};

async function createComprehensiveSupplementFile() {
  try {
    const baseDir = '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC';

    // 創建完整的補充分析文件
    const comprehensiveSupplementData = {
      metadata: {
        timestamp: new Date().toISOString(),
        description: "完整補充缺失的專業分析",
        totalSupplementedCodes: Object.keys(comprehensiveAnalysis).length,
        aaaHospitalCodes: ["706-2", "1920-8", "1977-8", "19258-3", "2039-6", "2532-0", "35741-8", "54348-8"],
        triServiceCodes: ["1742-6", "789-8", "21418-9", "57803-9"]
      },
      supplementAnalysis: comprehensiveAnalysis,
      codeDetails: {
        "706-2": { labItemName: "Basophil", hospital: "AAA", category: "血液學檢查" },
        "1920-8": { labItemName: "GOT(AST)", hospital: "AAA", category: "肝功能檢查" },
        "1977-8": { labItemName: "Bilirubin", hospital: "AAA", category: "肝功能檢查" },
        "19258-3": { labItemName: "pO2(vein)", hospital: "AAA", category: "血氣分析" },
        "2039-6": { labItemName: "CEA", hospital: "AAA", category: "腫瘤標記物" },
        "2532-0": { labItemName: "LDH", hospital: "AAA", category: "酶學檢查" },
        "35741-8": { labItemName: "Total PSA", hospital: "AAA", category: "腫瘤標記物" },
        "54348-8": { labItemName: "Alpha-Fetoprotein", hospital: "AAA", category: "腫瘤標記物" },
        "1742-6": { labItemName: "ALT", hospital: "Tri-Service", category: "肝功能檢查" },
        "789-8": { labItemName: "RBC", hospital: "Tri-Service", category: "血液學檢查" },
        "21418-9": { labItemName: "Neutrophil", hospital: "Tri-Service", category: "血液學檢查" },
        "57803-9": { labItemName: "Urine Occult Blood", hospital: "Tri-Service", category: "尿液檢查" }
      }
    };

    // 保存完整補充文件
    const supplementFile = path.join(baseDir, 'saved_mappings', 'comprehensive_ai_analysis_supplement.json');
    fs.writeFileSync(supplementFile, JSON.stringify(comprehensiveSupplementData, null, 2), 'utf8');
    console.log(`完整補充分析文件已保存: ${supplementFile}`);

    // 更新原有的補充文件
    const originalSupplementFile = path.join(baseDir, 'saved_mappings', 'ai_analysis_supplement.json');
    fs.writeFileSync(originalSupplementFile, JSON.stringify(comprehensiveSupplementData, null, 2), 'utf8');
    console.log(`原補充分析文件已更新: ${originalSupplementFile}`);

    // 創建詳細報告
    const reportData = {
      title: "缺失分析項目補充報告",
      generatedAt: new Date().toISOString(),
      summary: {
        totalEmptyFiles: 12,
        aaaHospitalEmpty: 8,
        triServiceEmpty: 4,
        supplementedCodes: Object.keys(comprehensiveAnalysis).length
      },
      detailedAnalysis: Object.keys(comprehensiveAnalysis).map(code => ({
        loincCode: code,
        labItemName: comprehensiveSupplementData.codeDetails[code].labItemName,
        hospital: comprehensiveSupplementData.codeDetails[code].hospital,
        category: comprehensiveSupplementData.codeDetails[code].category,
        analysisPreview: comprehensiveAnalysis[code].substring(0, 100) + "..."
      })),
      categoryBreakdown: {
        "血液學檢查": ["706-2", "789-8", "21418-9"],
        "肝功能檢查": ["1920-8", "1977-8", "1742-6"],
        "腫瘤標記物": ["2039-6", "35741-8", "54348-8"],
        "其他檢查": ["19258-3", "2532-0", "57803-9"]
      }
    };

    const reportFile = path.join(baseDir, 'missing_analysis_supplement_report.json');
    fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2), 'utf8');
    console.log(`補充報告已保存: ${reportFile}`);

    return {
      supplementFile: supplementFile,
      reportFile: reportFile,
      totalSupplemented: Object.keys(comprehensiveAnalysis).length
    };

  } catch (error) {
    console.error('創建補充文件時發生錯誤:', error);
    throw error;
  }
}

// 執行腳本
if (require.main === module) {
  createComprehensiveSupplementFile()
    .then(result => {
      console.log('\n✅ 補充文件創建完成!');
      console.log(`補充了 ${result.totalSupplemented} 個LOINC碼的專業分析`);
      console.log(`檔案位置: ${result.supplementFile}`);
    })
    .catch(error => {
      console.error('❌ 創建補充文件失敗:', error);
      process.exit(1);
    });
}

module.exports = createComprehensiveSupplementFile;