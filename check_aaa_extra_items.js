const fs = require('fs');

// Read the complete analysis file
const completeAnalysis = JSON.parse(fs.readFileSync('/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/aaa_hospital_complete_analysis.json', 'utf8'));

console.log('=== 萬芳醫院超出200排名檢查 ===\n');

console.log(`總檔案數: ${completeAnalysis.summary.totalFiles}`);
console.log(`處理成功檔案數: ${completeAnalysis.summary.processedFiles}`);

// Check for items beyond rank 200
const allMappings = completeAnalysis.allMappings;
const itemsBeyond200 = allMappings.filter(item => {
    const rank = parseInt(item.itemRank);
    return !isNaN(rank) && rank > 200;
});

const itemsIn200 = allMappings.filter(item => {
    const rank = parseInt(item.itemRank);
    return !isNaN(rank) && rank >= 1 && rank <= 200;
});

const noRankItems = allMappings.filter(item => {
    const rank = parseInt(item.itemRank);
    return isNaN(rank) || rank <= 0;
});

console.log(`\n=== 排名分布統計 ===`);
console.log(`1-200排名項目: ${itemsIn200.length}`);
console.log(`超過200排名項目: ${itemsBeyond200.length}`);
console.log(`無有效排名項目: ${noRankItems.length}`);
console.log(`總計: ${itemsIn200.length + itemsBeyond200.length + noRankItems.length}`);

if (itemsBeyond200.length > 0) {
    console.log(`\n=== 超過200排名的項目詳細清單 ===`);
    itemsBeyond200.sort((a, b) => parseInt(a.itemRank) - parseInt(b.itemRank));

    itemsBeyond200.forEach((item, index) => {
        console.log(`${index + 1}. 排名 ${item.itemRank}: ${item.labItemName} (${item.labItemId})`);
        console.log(`   檔案: ${item.filename}`);
        console.log(`   單位: ${item.labUnit} | 檢體: ${item.labSampleType}`);
        console.log(`   LOINC: ${item.loincCode} - ${item.loincName}`);
        console.log(`   檢驗次數: ${item.totalRecords} | 病患數: ${item.uniquePatients}`);
        console.log('');
    });

    // Find the range of extra ranks
    const extraRanks = itemsBeyond200.map(item => parseInt(item.itemRank)).sort((a, b) => a - b);
    console.log(`超出排名範圍: ${Math.min(...extraRanks)} - ${Math.max(...extraRanks)}`);
    console.log(`超出排名清單: ${extraRanks.join(', ')}`);
} else {
    console.log(`\n✅ 沒有超過200排名的項目`);
}

if (noRankItems.length > 0) {
    console.log(`\n=== 無有效排名的項目 ===`);
    noRankItems.forEach((item, index) => {
        console.log(`${index + 1}. ${item.labItemName} (${item.labItemId}) - 排名: ${item.itemRank}`);
        console.log(`   檔案: ${item.filename}`);
    });
}

// Check for duplicates in the original data
const rankCounts = {};
allMappings.forEach(item => {
    const rank = parseInt(item.itemRank);
    if (!isNaN(rank) && rank > 0) {
        if (!rankCounts[rank]) {
            rankCounts[rank] = [];
        }
        rankCounts[rank].push(item);
    }
});

const duplicates = Object.keys(rankCounts).filter(rank => rankCounts[rank].length > 1);
if (duplicates.length > 0) {
    console.log(`\n=== 原始資料中的重複排名 ===`);
    duplicates.forEach(rank => {
        console.log(`\n排名 ${rank} 有 ${rankCounts[rank].length} 個項目:`);
        rankCounts[rank].forEach((item, index) => {
            console.log(`  ${index + 1}. ${item.labItemName} (${item.labItemId}) - ${item.filename}`);
        });
    });
}

// Summary of why we have extra files
console.log(`\n=== 檔案數量分析 ===`);
console.log(`總檔案數 (202) 的組成:`);
console.log(`- 1-200排名項目: ${itemsIn200.length} 個`);
if (itemsBeyond200.length > 0) {
    console.log(`- 超過200排名項目: ${itemsBeyond200.length} 個`);
}
if (noRankItems.length > 0) {
    console.log(`- 無有效排名項目: ${noRankItems.length} 個`);
}
if (duplicates.length > 0) {
    const totalDuplicateFiles = duplicates.reduce((sum, rank) => sum + rankCounts[rank].length - 1, 0);
    console.log(`- 重複排名產生的額外檔案: ${totalDuplicateFiles} 個`);
}

const expectedTotal = 200 + itemsBeyond200.length + noRankItems.length;
console.log(`預期檔案數 (不含重複): ${expectedTotal}`);
console.log(`實際檔案數: ${completeAnalysis.summary.totalFiles}`);
console.log(`差異 (重複檔案): ${completeAnalysis.summary.totalFiles - expectedTotal}`);

// Create a detailed breakdown file
const breakdown = {
    summary: {
        totalFiles: completeAnalysis.summary.totalFiles,
        itemsIn200: itemsIn200.length,
        itemsBeyond200: itemsBeyond200.length,
        noRankItems: noRankItems.length,
        duplicateRanks: duplicates.length,
        correctedTotal: 200 // After removing duplicates and keeping only 1-200
    },
    itemsBeyond200: itemsBeyond200,
    noRankItems: noRankItems,
    duplicateRanks: duplicates.map(rank => ({
        rank: parseInt(rank),
        count: rankCounts[rank].length,
        items: rankCounts[rank]
    }))
};

fs.writeFileSync('/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/aaa_hospital_extra_items_analysis.json', JSON.stringify(breakdown, null, 2));

console.log(`\n✅ 詳細分析已保存至: aaa_hospital_extra_items_analysis.json`);