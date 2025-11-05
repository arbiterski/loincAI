const fs = require('fs');

function crossAnalysis() {
    // Read data from both hospitals
    const aaaData = JSON.parse(fs.readFileSync('/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/aaa_hospital_final_200.json', 'utf8'));
    const triData = JSON.parse(fs.readFileSync('/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/tri_service_final_200.json', 'utf8'));

    console.log('=== 兩家醫院交叉分析 ===\n');
    console.log(`萬芳醫院項目數: ${aaaData.length}`);
    console.log(`三軍總醫院項目數: ${triData.length}`);

    // Analyze by LOINC codes
    const aaaLoincCodes = new Set(aaaData.map(item => item.loincCode));
    const triLoincCodes = new Set(triData.map(item => item.loincCode));

    const commonLoincCodes = [...aaaLoincCodes].filter(code => triLoincCodes.has(code));
    const aaaUniqueLoincCodes = [...aaaLoincCodes].filter(code => !triLoincCodes.has(code));
    const triUniqueLoincCodes = [...triLoincCodes].filter(code => !aaaLoincCodes.has(code));

    console.log('\n=== LOINC 代碼重複分析 ===');
    console.log(`共同 LOINC 代碼數: ${commonLoincCodes.length}`);
    console.log(`萬芳醫院獨有 LOINC 代碼: ${aaaUniqueLoincCodes.length}`);
    console.log(`三軍總醫院獨有 LOINC 代碼: ${triUniqueLoincCodes.length}`);
    console.log(`總唯一 LOINC 代碼數: ${new Set([...aaaLoincCodes, ...triLoincCodes]).size}`);

    // Analyze by lab item names (fuzzy matching)
    console.log('\n=== 檢驗項目名稱重複分析 ===');

    const aaaItemNames = aaaData.map(item => item.labItemName.toLowerCase().trim());
    const triItemNames = triData.map(item => item.labItemName.toLowerCase().trim());

    const commonItemNames = aaaItemNames.filter(name => triItemNames.includes(name));
    const uniqueCommonNames = [...new Set(commonItemNames)];

    console.log(`相同檢驗項目名稱數: ${uniqueCommonNames.length}`);

    // Detailed analysis of common LOINC codes
    console.log('\n=== 共同 LOINC 代碼詳細分析 ===');
    const commonMappings = [];

    commonLoincCodes.forEach(loincCode => {
        const aaaItem = aaaData.find(item => item.loincCode === loincCode);
        const triItem = triData.find(item => item.loincCode === loincCode);

        if (aaaItem && triItem) {
            commonMappings.push({
                loincCode: loincCode,
                loincName: aaaItem.loincName,
                aaaItemName: aaaItem.labItemName,
                aaaRank: aaaItem.itemRank,
                aaaUnit: aaaItem.labUnit,
                aaaSampleType: aaaItem.labSampleType,
                triItemName: triItem.labItemName,
                triRank: triItem.itemRank,
                triUnit: triItem.labUnit,
                triSampleType: triItem.labSampleType,
                nameMatch: aaaItem.labItemName.toLowerCase() === triItem.labItemName.toLowerCase(),
                unitMatch: aaaItem.labUnit === triItem.labUnit,
                sampleMatch: aaaItem.labSampleType === triItem.labSampleType
            });
        }
    });

    // Sort by LOINC code for easier reading
    commonMappings.sort((a, b) => a.loincCode.localeCompare(b.loincCode));

    console.log(`\n前20個共同 LOINC 代碼:`);
    console.log('排名格式: 萬芳排名 | 三總排名');
    commonMappings.slice(0, 20).forEach((mapping, index) => {
        const nameStatus = mapping.nameMatch ? '✓' : '✗';
        const unitStatus = mapping.unitMatch ? '✓' : '✗';
        const sampleStatus = mapping.sampleMatch ? '✓' : '✗';

        console.log(`${index + 1}. ${mapping.loincCode}`);
        console.log(`   萬芳: ${mapping.aaaItemName} (排名${mapping.aaaRank}) | 三總: ${mapping.triItemName} (排名${mapping.triRank})`);
        console.log(`   單位: ${mapping.aaaUnit} | ${mapping.triUnit} ${unitStatus} | 檢體: ${mapping.aaaSampleType} | ${mapping.triSampleType} ${sampleStatus} | 名稱: ${nameStatus}`);
        console.log('');
    });

    // Analysis by sample types
    console.log('\n=== 檢體類型分布比較 ===');
    const aaaSampleTypes = {};
    const triSampleTypes = {};

    aaaData.forEach(item => {
        aaaSampleTypes[item.labSampleType] = (aaaSampleTypes[item.labSampleType] || 0) + 1;
    });

    triData.forEach(item => {
        triSampleTypes[item.labSampleType] = (triSampleTypes[item.labSampleType] || 0) + 1;
    });

    const allSampleTypes = new Set([...Object.keys(aaaSampleTypes), ...Object.keys(triSampleTypes)]);

    console.log('檢體類型 | 萬芳數量 | 三總數量');
    console.log('---------|----------|----------');
    [...allSampleTypes].sort().forEach(sampleType => {
        const aaaCount = aaaSampleTypes[sampleType] || 0;
        const triCount = triSampleTypes[sampleType] || 0;
        console.log(`${sampleType.padEnd(8)} | ${aaaCount.toString().padStart(8)} | ${triCount.toString().padStart(8)}`);
    });

    // Analysis by units
    console.log('\n=== 單位分布比較 (前15個) ===');
    const aaaUnits = {};
    const triUnits = {};

    aaaData.forEach(item => {
        aaaUnits[item.labUnit] = (aaaUnits[item.labUnit] || 0) + 1;
    });

    triData.forEach(item => {
        triUnits[item.labUnit] = (triUnits[item.labUnit] || 0) + 1;
    });

    const allUnits = new Set([...Object.keys(aaaUnits), ...Object.keys(triUnits)]);
    const sortedUnits = [...allUnits].sort((a, b) => {
        const aaaCount = aaaUnits[a] || 0;
        const triCount = triUnits[a] || 0;
        const bAaaCount = aaaUnits[b] || 0;
        const bTriCount = triUnits[b] || 0;
        return (bAaaCount + bTriCount) - (aaaCount + triCount);
    });

    console.log('單位     | 萬芳數量 | 三總數量');
    console.log('---------|----------|----------');
    sortedUnits.slice(0, 15).forEach(unit => {
        const aaaCount = aaaUnits[unit] || 0;
        const triCount = triUnits[unit] || 0;
        console.log(`${unit.padEnd(8)} | ${aaaCount.toString().padStart(8)} | ${triCount.toString().padStart(8)}`);
    });

    // Generate summary statistics
    const summary = {
        totalItems: {
            aaa: aaaData.length,
            tri: triData.length,
            combined: aaaData.length + triData.length
        },
        loincCodes: {
            common: commonLoincCodes.length,
            aaaUnique: aaaUniqueLoincCodes.length,
            triUnique: triUniqueLoincCodes.length,
            totalUnique: new Set([...aaaLoincCodes, ...triLoincCodes]).size,
            overlapPercentage: ((commonLoincCodes.length / Math.min(aaaLoincCodes.size, triLoincCodes.size)) * 100).toFixed(1)
        },
        itemNames: {
            commonExact: uniqueCommonNames.length,
            exactMatchPercentage: ((uniqueCommonNames.length / Math.min(aaaData.length, triData.length)) * 100).toFixed(1)
        },
        compatibility: {
            nameMatch: commonMappings.filter(m => m.nameMatch).length,
            unitMatch: commonMappings.filter(m => m.unitMatch).length,
            sampleMatch: commonMappings.filter(m => m.sampleMatch).length,
            perfectMatch: commonMappings.filter(m => m.nameMatch && m.unitMatch && m.sampleMatch).length
        }
    };

    console.log('\n=== 總結統計 ===');
    console.log(`LOINC 代碼重複率: ${summary.loincCodes.overlapPercentage}%`);
    console.log(`檢驗項目名稱重複率: ${summary.itemNames.exactMatchPercentage}%`);
    console.log(`共同 LOINC 中完全匹配項目: ${summary.compatibility.perfectMatch}/${commonLoincCodes.length}`);

    // Save detailed analysis
    const detailedAnalysis = {
        summary: summary,
        commonLoincCodes: commonLoincCodes,
        commonMappings: commonMappings,
        aaaUniqueLoincCodes: aaaUniqueLoincCodes,
        triUniqueLoincCodes: triUniqueLoincCodes,
        sampleTypeDistribution: {
            aaa: aaaSampleTypes,
            tri: triSampleTypes
        },
        unitDistribution: {
            aaa: aaaUnits,
            tri: triUnits
        }
    };

    fs.writeFileSync('/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/cross_analysis_results.json', JSON.stringify(detailedAnalysis, null, 2));

    console.log('\n✅ 詳細交叉分析結果已保存至: cross_analysis_results.json');
}

// Run the analysis
crossAnalysis();