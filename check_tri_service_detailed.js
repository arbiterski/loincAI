const fs = require('fs');

// Read the Tri-Service General Hospital mapping data
const triData = JSON.parse(fs.readFileSync('/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/tri_service_mappings.json', 'utf8'));

console.log('=== 三軍總醫院排名詳細檢查 ===\n');

// Create a map to track all items by rank
const rankMap = {};
const duplicates = {};
const allRanks = [];

triData.forEach(item => {
    const rank = parseInt(item.itemRank);
    if (!isNaN(rank)) {
        allRanks.push(rank);

        if (!rankMap[rank]) {
            rankMap[rank] = [];
        }
        rankMap[rank].push(item);

        // Track duplicates
        if (rankMap[rank].length > 1) {
            duplicates[rank] = rankMap[rank];
        }
    }
});

// Check for duplicates
console.log('=== 重複排名檢查 ===');
if (Object.keys(duplicates).length > 0) {
    console.log('發現重複排名:');
    Object.keys(duplicates).sort((a, b) => parseInt(a) - parseInt(b)).forEach(rank => {
        console.log(`\n排名 ${rank} 有 ${duplicates[rank].length} 個項目:`);
        duplicates[rank].forEach((item, index) => {
            console.log(`  ${index + 1}. ${item.labItemName} (${item.labItemId}) - 時間: ${item.timestamp}`);
        });
    });
} else {
    console.log('沒有發現重複排名');
}

// Find missing ranks from 1 to 200
const missingRanks = [];
const existingRanks = Object.keys(rankMap).map(r => parseInt(r)).sort((a, b) => a - b);

for (let i = 1; i <= 200; i++) {
    if (!rankMap[i]) {
        missingRanks.push(i);
    }
}

console.log('\n=== 缺漏排名檢查 ===');
console.log(`缺漏排名數量: ${missingRanks.length}`);
if (missingRanks.length > 0) {
    console.log('缺漏的排名:');

    // Group consecutive missing ranks
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

    console.log(`缺漏範圍: ${ranges.join(', ')}`);

    // Show detailed missing ranks
    console.log('\n詳細缺漏排名:');
    missingRanks.forEach((rank, index) => {
        if (index % 10 === 0) console.log(); // New line every 10 items
        process.stdout.write(`${rank.toString().padStart(3)} `);
    });
    console.log(); // End with newline
}

// Check if we have exactly 200 unique ranks
console.log('\n=== 統計摘要 ===');
console.log(`總項目數: ${triData.length}`);
console.log(`唯一排名數: ${existingRanks.length}`);
console.log(`期望排名數 (1-200): 200`);
console.log(`缺漏數量: ${200 - existingRanks.length}`);
console.log(`重複排名數: ${Object.keys(duplicates).length}`);

// Show all existing ranks in 1-200 range
const ranksIn200 = existingRanks.filter(r => r >= 1 && r <= 200);
console.log(`\n1-200範圍內現有排名數: ${ranksIn200.length}`);

// Check for ranks beyond 200
const ranksBeyond200 = existingRanks.filter(r => r > 200);
if (ranksBeyond200.length > 0) {
    console.log(`\n超過200的排名: ${ranksBeyond200.join(', ')}`);
}

// Show the first 20 and last 20 existing ranks for reference
console.log('\n=== 現有排名範圍示例 ===');
console.log(`最小20個排名: ${ranksIn200.slice(0, 20).join(', ')}`);
console.log(`最大20個排名: ${ranksIn200.slice(-20).join(', ')}`);

// Create detailed output for missing ranks
const detailedAnalysis = {
    summary: {
        totalItems: triData.length,
        uniqueRanks: existingRanks.length,
        expectedRanks: 200,
        missingCount: missingRanks.length,
        duplicateCount: Object.keys(duplicates).length
    },
    missingRanks: missingRanks,
    duplicateRanks: duplicates,
    existingRanks: ranksIn200,
    ranksBeyond200: ranksBeyond200
};

fs.writeFileSync('/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/tri_service_detailed_analysis.json', JSON.stringify(detailedAnalysis, null, 2));

console.log('\n詳細分析已保存至: tri_service_detailed_analysis.json');

// Create a simple list of missing ranks for easy reference
const missingRanksList = missingRanks.join('\n');
fs.writeFileSync('/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/tri_service_missing_ranks.txt',
    `三軍總醫院缺漏排名清單 (${missingRanks.length} 個)\n` +
    `生成時間: ${new Date().toLocaleString()}\n\n` +
    missingRanksList
);

console.log('缺漏排名清單已保存至: tri_service_missing_ranks.txt');