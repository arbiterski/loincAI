const fs = require('fs');

// Read the corrected AAA Hospital mapping data
const aaaData = JSON.parse(fs.readFileSync('/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/aaa_hospital_mappings_corrected.json', 'utf8'));

console.log('=== 萬芳醫院最終排名檢查 (1-200) ===\n');

// Create rank tracking
const rankMap = {};
const allRanks = [];

aaaData.forEach(item => {
    const rank = parseInt(item.itemRank);
    if (!isNaN(rank)) {
        allRanks.push(rank);
        if (!rankMap[rank]) {
            rankMap[rank] = [];
        }
        rankMap[rank].push(item);
    }
});

console.log(`總項目數: ${aaaData.length}`);
console.log(`有效排名數: ${allRanks.length}`);

// Sort ranks for analysis
const sortedRanks = allRanks.sort((a, b) => a - b);
console.log(`排名範圍: ${Math.min(...sortedRanks)} - ${Math.max(...sortedRanks)}`);

// Check for exact 1-200 coverage
const expectedRanks = [];
for (let i = 1; i <= 200; i++) {
    expectedRanks.push(i);
}

// Find missing ranks in 1-200
const missingRanks = [];
for (let i = 1; i <= 200; i++) {
    if (!rankMap[i]) {
        missingRanks.push(i);
    }
}

// Find extra ranks beyond 200
const extraRanks = sortedRanks.filter(r => r > 200);

// Find duplicate ranks
const duplicateRanks = [];
Object.keys(rankMap).forEach(rank => {
    if (rankMap[rank].length > 1) {
        duplicateRanks.push({
            rank: parseInt(rank),
            count: rankMap[rank].length,
            items: rankMap[rank]
        });
    }
});

console.log('\n=== 1-200 排名完整性檢查 ===');
console.log(`期望排名數: 200 (1-200)`);
console.log(`實際排名數: ${Object.keys(rankMap).filter(r => parseInt(r) >= 1 && parseInt(r) <= 200).length}`);

if (missingRanks.length === 0) {
    console.log('✅ 排名1-200 完全覆蓋，無缺漏');
} else {
    console.log(`❌ 缺漏排名數: ${missingRanks.length}`);
    console.log(`缺漏排名: ${missingRanks.join(', ')}`);
}

if (extraRanks.length === 0) {
    console.log('✅ 無超出200的排名');
} else {
    console.log(`⚠️  超出200的排名: ${extraRanks.length}個`);
    console.log(`超出排名: ${extraRanks.join(', ')}`);
}

if (duplicateRanks.length === 0) {
    console.log('✅ 無重複排名');
} else {
    console.log(`⚠️  重複排名: ${duplicateRanks.length}個`);
    duplicateRanks.forEach(dup => {
        console.log(`  排名 ${dup.rank}: ${dup.count}個項目`);
        dup.items.forEach((item, index) => {
            console.log(`    ${index + 1}. ${item.labItemName} (${item.labItemId})`);
        });
    });
}

// Summary check
console.log('\n=== 最終結論 ===');
const totalIn200 = Object.keys(rankMap).filter(r => parseInt(r) >= 1 && parseInt(r) <= 200).length;

if (totalIn200 === 200 && missingRanks.length === 0 && extraRanks.length === 0) {
    console.log('🎉 完美！萬芳醫院 1-200 排名完全符合預期');
    console.log('   - 200個排名完全覆蓋');
    console.log('   - 無缺漏、無超出範圍');

    if (duplicateRanks.length === 0) {
        console.log('   - 無重複排名');
    } else {
        console.log(`   - 有 ${duplicateRanks.length} 個重複排名需要注意`);
    }
} else {
    console.log('❗ 有以下問題需要處理:');
    if (missingRanks.length > 0) {
        console.log(`   - 缺漏 ${missingRanks.length} 個排名`);
    }
    if (extraRanks.length > 0) {
        console.log(`   - 超出範圍 ${extraRanks.length} 個排名`);
    }
    if (totalIn200 !== 200) {
        console.log(`   - 1-200範圍內實際有 ${totalIn200} 個排名，期望 200 個`);
    }
}

// Count check
console.log('\n=== 數量檢查 ===');
console.log(`項目總數: ${aaaData.length}`);
console.log(`期望數量: 200`);
if (aaaData.length === 200) {
    console.log('✅ 項目數量正確');
} else {
    console.log(`❌ 項目數量不符，差異: ${aaaData.length - 200}`);
}

// Show first and last 10 ranks for verification
console.log('\n=== 排名驗證（首尾10個） ===');
const ranksIn200 = sortedRanks.filter(r => r >= 1 && r <= 200);
console.log(`前10個排名: ${ranksIn200.slice(0, 10).join(', ')}`);
console.log(`後10個排名: ${ranksIn200.slice(-10).join(', ')}`);

// Create final verification file
const verification = {
    summary: {
        totalItems: aaaData.length,
        expectedCount: 200,
        actualRanksIn200: totalIn200,
        missingCount: missingRanks.length,
        extraCount: extraRanks.length,
        duplicateCount: duplicateRanks.length,
        isComplete: totalIn200 === 200 && missingRanks.length === 0 && extraRanks.length === 0,
        isPerfect: totalIn200 === 200 && missingRanks.length === 0 && extraRanks.length === 0 && duplicateRanks.length === 0
    },
    details: {
        missingRanks: missingRanks,
        extraRanks: extraRanks,
        duplicateRanks: duplicateRanks,
        allRanksIn200: ranksIn200
    }
};

fs.writeFileSync('/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/aaa_hospital_final_verification.json', JSON.stringify(verification, null, 2));

console.log('\n✅ 最終驗證結果已保存至: aaa_hospital_final_verification.json');