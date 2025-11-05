const fs = require('fs');

// Read the Tri-Service General Hospital mapping data
const triData = JSON.parse(fs.readFileSync('/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/tri_service_mappings.json', 'utf8'));

// Get all ranks that exist
const existingRanks = triData.map(item => parseInt(item.itemRank)).filter(rank => !isNaN(rank)).sort((a, b) => a - b);

console.log('三軍總醫院現有對應項目數:', triData.length);
console.log('現有排名範圍:', Math.min(...existingRanks), '-', Math.max(...existingRanks));

// Check for missing ranks from 1 to 200
const missingRanks = [];
const duplicatedRanks = [];
const rankCounts = {};

// Count occurrences of each rank
existingRanks.forEach(rank => {
    rankCounts[rank] = (rankCounts[rank] || 0) + 1;
});

// Find missing ranks from 1 to 200
for (let i = 1; i <= 200; i++) {
    if (!existingRanks.includes(i)) {
        missingRanks.push(i);
    }
}

// Find duplicated ranks
Object.keys(rankCounts).forEach(rank => {
    if (rankCounts[rank] > 1) {
        duplicatedRanks.push({rank: parseInt(rank), count: rankCounts[rank]});
    }
});

console.log('\n=== 缺漏的排名 (1-200) ===');
if (missingRanks.length > 0) {
    console.log('缺漏排名數量:', missingRanks.length);
    console.log('缺漏的排名:', missingRanks.join(', '));

    // Group consecutive missing ranks for better readability
    const ranges = [];
    let start = missingRanks[0];
    let end = missingRanks[0];

    for (let i = 1; i < missingRanks.length; i++) {
        if (missingRanks[i] === end + 1) {
            end = missingRanks[i];
        } else {
            if (start === end) {
                ranges.push(start.toString());
            } else {
                ranges.push(`${start}-${end}`);
            }
            start = missingRanks[i];
            end = missingRanks[i];
        }
    }

    if (start === end) {
        ranges.push(start.toString());
    } else {
        ranges.push(`${start}-${end}`);
    }

    console.log('缺漏範圍:', ranges.join(', '));
} else {
    console.log('沒有缺漏的排名');
}

console.log('\n=== 重複的排名 ===');
if (duplicatedRanks.length > 0) {
    console.log('重複排名數量:', duplicatedRanks.length);
    duplicatedRanks.forEach(item => {
        console.log(`排名 ${item.rank}: 出現 ${item.count} 次`);

        // Show the items with duplicate ranks
        const duplicateItems = triData.filter(d => parseInt(d.itemRank) === item.rank);
        duplicateItems.forEach((dupItem, index) => {
            console.log(`  ${index + 1}. ${dupItem.labItemName} (${dupItem.labItemId})`);
        });
    });
} else {
    console.log('沒有重複的排名');
}

console.log('\n=== 統計摘要 ===');
console.log('總項目數:', triData.length);
console.log('1-200排名內的項目數:', triData.filter(d => parseInt(d.itemRank) >= 1 && parseInt(d.itemRank) <= 200).length);
console.log('超過200排名的項目數:', triData.filter(d => parseInt(d.itemRank) > 200).length);
console.log('排名有問題的項目數:', triData.filter(d => isNaN(parseInt(d.itemRank)) || parseInt(d.itemRank) <= 0).length);

// Show items beyond rank 200
const beyondRank200 = triData.filter(d => parseInt(d.itemRank) > 200).sort((a, b) => parseInt(a.itemRank) - parseInt(b.itemRank));
if (beyondRank200.length > 0) {
    console.log('\n=== 超過200排名的項目 ===');
    beyondRank200.forEach(item => {
        console.log(`排名 ${item.itemRank}: ${item.labItemName} (${item.labItemId})`);
    });
}

// Save detailed analysis to file
const analysis = {
    totalItems: triData.length,
    missingRanks: missingRanks,
    duplicatedRanks: duplicatedRanks,
    itemsInRange1to200: triData.filter(d => parseInt(d.itemRank) >= 1 && parseInt(d.itemRank) <= 200).length,
    itemsBeyondRank200: beyondRank200,
    rankStatistics: rankCounts
};

fs.writeFileSync('/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/tri_service_rank_analysis.json', JSON.stringify(analysis, null, 2));
console.log('\n詳細分析已保存至: tri_service_rank_analysis.json');