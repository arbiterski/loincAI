const fs = require('fs');
const path = require('path');

function extractComplete200Rankings(hospitalDir, hospitalName) {
    const mappings = [];
    const files = fs.readdirSync(hospitalDir)
        .filter(file => file.endsWith('.json'))
        .sort();

    files.forEach(file => {
        try {
            const filePath = path.join(hospitalDir, file);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

            if (data.labDataContext && data.selectedLoincCodes && data.selectedLoincCodes.length > 0) {
                mappings.push({
                    labItemName: data.labDataContext.labItemName || '',
                    labItemId: data.labDataContext.itemId || '',
                    labUnit: data.labDataContext.labUnit || '',
                    labSampleType: data.labDataContext.labSampleType || '',
                    itemRank: parseInt(data.labDataContext.itemRank) || 999,
                    loincCode: data.selectedLoincCodes[0] || '',
                    loincName: data.selectedDetails && data.selectedDetails[0]
                        ? data.selectedDetails[0].longCommonName || ''
                        : '',
                    meanValue: data.labDataContext.labMeanValue || '',
                    medianValue: data.labDataContext.labMedianValue || '',
                    timestamp: data.metadata.timestamp || '',
                    filename: file
                });
            }
        } catch (e) {
            console.error(`Error processing ${file}: ${e.message}`);
        }
    });

    // Group by rank
    const rankMap = {};
    mappings.forEach(m => {
        if (m.itemRank >= 1 && m.itemRank <= 200) {
            if (!rankMap[m.itemRank]) {
                rankMap[m.itemRank] = [];
            }
            rankMap[m.itemRank].push(m);
        }
    });

    // For each rank, keep the latest version
    const finalMappings = [];
    for (let rank = 1; rank <= 200; rank++) {
        if (rankMap[rank]) {
            // Sort by timestamp and keep the latest
            const latest = rankMap[rank].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
            finalMappings.push(latest);
        }
    }

    return finalMappings.sort((a, b) => a.itemRank - b.itemRank);
}

// Extract mappings for both hospitals
const aaa_hospital_dir = '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/saved_mappings/AAA_Hospital';
const tri_service_dir = '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/saved_mappings/Tri-Service_General_Hospital';

console.log('=== 重新提取完整 1-200 項目 ===');

const aaa_mappings = extractComplete200Rankings(aaa_hospital_dir, '萬芳醫院');
const tri_mappings = extractComplete200Rankings(tri_service_dir, '三軍總醫院');

console.log(`萬芳醫院 1-200 項目數: ${aaa_mappings.length}`);
console.log(`三軍總醫院 1-200 項目數: ${tri_mappings.length}`);

// Check missing ranks
const aaaMissingRanks = [];
const triMissingRanks = [];

for (let i = 1; i <= 200; i++) {
    if (!aaa_mappings.find(m => m.itemRank === i)) {
        aaaMissingRanks.push(i);
    }
    if (!tri_mappings.find(m => m.itemRank === i)) {
        triMissingRanks.push(i);
    }
}

console.log(`萬芳醫院缺漏排名: ${aaaMissingRanks.length} 個`);
if (aaaMissingRanks.length > 0) {
    console.log(`缺漏排名: ${aaaMissingRanks.slice(0, 10).join(', ')}${aaaMissingRanks.length > 10 ? '...' : ''}`);
}

console.log(`三軍總醫院缺漏排名: ${triMissingRanks.length} 個`);
if (triMissingRanks.length > 0) {
    console.log(`缺漏排名: ${triMissingRanks.slice(0, 10).join(', ')}${triMissingRanks.length > 10 ? '...' : ''}`);
}

// Save the corrected files
fs.writeFileSync(
    '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/aaa_hospital_final_200.json',
    JSON.stringify(aaa_mappings, null, 2)
);

fs.writeFileSync(
    '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/tri_service_final_200.json',
    JSON.stringify(tri_mappings, null, 2)
);

console.log('✅ 最終 200 項目檔案已生成');