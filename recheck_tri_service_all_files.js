const fs = require('fs');
const path = require('path');

function recheckTriServiceFiles() {
    const triServiceDir = '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/saved_mappings/Tri-Service_General_Hospital';

    // Get all JSON files
    const allFiles = fs.readdirSync(triServiceDir)
        .filter(file => file.endsWith('.json'))
        .sort();

    console.log(`=== 三軍總醫院完整檔案檢查 ===`);
    console.log(`總檔案數: ${allFiles.length}`);

    const allMappings = [];
    const problemFiles = [];
    const rankMap = {};

    allFiles.forEach((file, index) => {
        try {
            const filePath = path.join(triServiceDir, file);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

            // 檢查檔案是否有必要的資料結構
            if (data.labDataContext) {
                const mapping = {
                    filename: file,
                    labItemName: data.labDataContext.labItemName || 'Unknown',
                    labItemId: data.labDataContext.itemId || 'Unknown',
                    labUnit: data.labDataContext.labUnit || '',
                    labSampleType: data.labDataContext.labSampleType || '',
                    itemRank: data.labDataContext.itemRank ? parseInt(data.labDataContext.itemRank) : null,
                    loincCode: (data.selectedLoincCodes && data.selectedLoincCodes.length > 0) ? data.selectedLoincCodes[0] : 'No LOINC',
                    loincName: (data.selectedDetails && data.selectedDetails[0])
                        ? data.selectedDetails[0].longCommonName || 'No name'
                        : 'No details',
                    totalRecords: data.labDataContext.labTotalRecords || '',
                    uniquePatients: data.labDataContext.labUniquePatients || '',
                    meanValue: data.labDataContext.labMeanValue || '',
                    timestamp: data.metadata ? data.metadata.timestamp : '',
                    hasLabContext: true,
                    hasSelectedLoinc: data.selectedLoincCodes && data.selectedLoincCodes.length > 0
                };

                allMappings.push(mapping);

                // Track by rank
                if (mapping.itemRank !== null && !isNaN(mapping.itemRank)) {
                    if (!rankMap[mapping.itemRank]) {
                        rankMap[mapping.itemRank] = [];
                    }
                    rankMap[mapping.itemRank].push(mapping);
                }
            } else {
                problemFiles.push({
                    filename: file,
                    issue: 'Missing labDataContext',
                    hasMetadata: !!data.metadata,
                    hasSearch: !!data.search,
                    hasSelectedCodes: !!(data.selectedLoincCodes && data.selectedLoincCodes.length > 0)
                });
            }

        } catch (error) {
            problemFiles.push({
                filename: file,
                issue: `Parse error: ${error.message}`
            });
        }
    });

    console.log(`\n=== 處理結果 ===`);
    console.log(`成功處理的檔案: ${allMappings.length}`);
    console.log(`有問題的檔案: ${problemFiles.length}`);

    if (problemFiles.length > 0) {
        console.log(`\n=== 有問題的檔案 ===`);
        problemFiles.forEach((pf, index) => {
            console.log(`${index + 1}. ${pf.filename}: ${pf.issue}`);
        });
    }

    // 檢查排名
    const validRanks = Object.keys(rankMap).map(r => parseInt(r)).sort((a, b) => a - b);
    console.log(`\n=== 排名分析 ===`);
    console.log(`有效排名數: ${validRanks.length}`);
    console.log(`排名範圍: ${Math.min(...validRanks)} - ${Math.max(...validRanks)}`);

    // 檢查重複排名
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

    if (duplicateRanks.length > 0) {
        console.log(`\n=== 重複排名 ===`);
        duplicateRanks.forEach(dup => {
            console.log(`\n排名 ${dup.rank} 有 ${dup.count} 個項目:`);
            dup.items.forEach((item, index) => {
                console.log(`  ${index + 1}. ${item.labItemName} (${item.labItemId}) - ${item.filename}`);
            });
        });
    }

    // 檢查1-200範圍內的缺漏
    const missingRanks = [];
    for (let i = 1; i <= 200; i++) {
        if (!rankMap[i]) {
            missingRanks.push(i);
        }
    }

    console.log(`\n=== 1-200排名缺漏 ===`);
    console.log(`缺漏數量: ${missingRanks.length}`);
    if (missingRanks.length > 0) {
        console.log(`缺漏排名: ${missingRanks.slice(0, 20).join(', ')}${missingRanks.length > 20 ? '...' : ''}`);
    }

    // 檢查超過200的排名
    const ranksOver200 = validRanks.filter(r => r > 200);
    if (ranksOver200.length > 0) {
        console.log(`\n=== 超過200的排名 ===`);
        console.log(`數量: ${ranksOver200.length}`);
        console.log(`排名: ${ranksOver200.join(', ')}`);
    }

    // 檢查沒有排名或排名無效的項目
    const noRankItems = allMappings.filter(m => m.itemRank === null || isNaN(m.itemRank) || m.itemRank <= 0);
    if (noRankItems.length > 0) {
        console.log(`\n=== 沒有有效排名的項目 ===`);
        console.log(`數量: ${noRankItems.length}`);
        noRankItems.forEach((item, index) => {
            console.log(`  ${index + 1}. ${item.labItemName} (${item.labItemId}) - 排名: ${item.itemRank}`);
        });
    }

    // 保存完整分析結果
    const completeAnalysis = {
        summary: {
            totalFiles: allFiles.length,
            processedFiles: allMappings.length,
            problemFiles: problemFiles.length,
            validRanks: validRanks.length,
            duplicateRanks: duplicateRanks.length,
            missingRanks1to200: missingRanks.length,
            ranksOver200: ranksOver200.length,
            noRankItems: noRankItems.length
        },
        allMappings: allMappings,
        problemFiles: problemFiles,
        duplicateRanks: duplicateRanks,
        missingRanks: missingRanks,
        ranksOver200: ranksOver200,
        noRankItems: noRankItems
    };

    fs.writeFileSync('/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/tri_service_complete_analysis.json', JSON.stringify(completeAnalysis, null, 2));

    // 重新生成正確的mapping檔案，包含所有有效的mappings
    const validMappingsForExport = allMappings.filter(m => m.itemRank !== null && !isNaN(m.itemRank) && m.itemRank > 0);

    // 去重複，保留最新的
    const uniqueMappings = {};
    validMappingsForExport.forEach(m => {
        const key = `${m.labItemName}_${m.itemRank}`;
        if (!uniqueMappings[key] || new Date(m.timestamp) > new Date(uniqueMappings[key].timestamp)) {
            uniqueMappings[key] = m;
        }
    });

    const finalMappings = Object.values(uniqueMappings).sort((a, b) => a.itemRank - b.itemRank);

    fs.writeFileSync('/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/tri_service_mappings_corrected.json', JSON.stringify(finalMappings, null, 2));

    console.log(`\n=== 最終結果 ===`);
    console.log(`校正後的mapping數量: ${finalMappings.length}`);
    console.log(`檔案已保存: tri_service_mappings_corrected.json`);
    console.log(`完整分析已保存: tri_service_complete_analysis.json`);

    return finalMappings;
}

// 執行檢查
recheckTriServiceFiles();