const fs = require('fs');

function analyzeAnalyteOverlap() {
    try {
        // Read hospital data
        const aaaData = JSON.parse(fs.readFileSync('/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/aaa_hospital_final_200.json', 'utf8'));
        const triData = JSON.parse(fs.readFileSync('/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/tri_service_final_200.json', 'utf8'));

        console.log('=== LOINC Analyte 重複分析 (忽略 System) ===');
        console.log(`萬芳醫院項目數: ${aaaData.length}`);
        console.log(`三軍總醫院項目數: ${triData.length}`);

        // Function to extract analyte (component) from LOINC name
        function extractAnalyte(loincName) {
            if (!loincName) return '';

            // Remove everything after " in " to get the analyte
            const beforeIn = loincName.split(' in ')[0];

            // Remove brackets and property info like [Mass/volume], [Presence], etc.
            const analyte = beforeIn.replace(/\s*\[.*?\]\s*/g, '').trim();

            return analyte;
        }

        // Extract analytes for each hospital
        const aaaAnalytes = new Set();
        const triAnalytes = new Set();

        const aaaAnalyteMap = new Map();
        const triAnalyteMap = new Map();

        // Process AAA Hospital data
        aaaData.forEach(item => {
            const analyte = extractAnalyte(item.loincName);
            if (analyte) {
                aaaAnalytes.add(analyte);
                if (!aaaAnalyteMap.has(analyte)) {
                    aaaAnalyteMap.set(analyte, []);
                }
                aaaAnalyteMap.get(analyte).push({
                    rank: item.itemRank,
                    labName: item.labItemName,
                    loincCode: item.loincCode,
                    loincName: item.loincName,
                    system: item.labSampleType
                });
            }
        });

        // Process Tri-Service Hospital data
        triData.forEach(item => {
            const analyte = extractAnalyte(item.loincName);
            if (analyte) {
                triAnalytes.add(analyte);
                if (!triAnalyteMap.has(analyte)) {
                    triAnalyteMap.set(analyte, []);
                }
                triAnalyteMap.get(analyte).push({
                    rank: item.itemRank,
                    labName: item.labItemName,
                    loincCode: item.loincCode,
                    loincName: item.loincName,
                    system: item.labSampleType
                });
            }
        });

        // Find common analytes
        const commonAnalytes = [...aaaAnalytes].filter(analyte => triAnalytes.has(analyte));

        // Calculate statistics
        const totalUniqueAnalytes = new Set([...aaaAnalytes, ...triAnalytes]).size;
        const aaaUniqueAnalytes = aaaAnalytes.size - commonAnalytes.length;
        const triUniqueAnalytes = triAnalytes.size - commonAnalytes.length;
        const overlapPercentage = ((commonAnalytes.length * 2) / (aaaAnalytes.size + triAnalytes.size) * 100).toFixed(1);

        console.log('\n=== 統計結果 ===');
        console.log(`萬芳醫院獨特 analytes: ${aaaAnalytes.size}`);
        console.log(`三軍總醫院獨特 analytes: ${triAnalytes.size}`);
        console.log(`共同 analytes: ${commonAnalytes.length}`);
        console.log(`總唯一 analytes: ${totalUniqueAnalytes}`);
        console.log(`萬芳獨有 analytes: ${aaaUniqueAnalytes}`);
        console.log(`三總獨有 analytes: ${triUniqueAnalytes}`);
        console.log(`Analyte 重複率: ${overlapPercentage}%`);

        // Show common analytes with details
        console.log('\n=== 共同 Analytes Top 20 ===');
        commonAnalytes.slice(0, 20).forEach((analyte, index) => {
            const aaaItems = aaaAnalyteMap.get(analyte);
            const triItems = triAnalyteMap.get(analyte);

            console.log(`\n${index + 1}. ${analyte}`);
            console.log(`   萬芳: ${aaaItems.map(item => `排名${item.rank} (${item.labName})`).join(', ')}`);
            console.log(`   三總: ${triItems.map(item => `排名${item.rank} (${item.labName})`).join(', ')}`);

            // Check if systems are different
            const aaaSystems = [...new Set(aaaItems.map(item => item.system))];
            const triSystems = [...new Set(triItems.map(item => item.system))];
            if (aaaSystems.join(',') !== triSystems.join(',')) {
                console.log(`   檢體差異: 萬芳[${aaaSystems.join(',')}] vs 三總[${triSystems.join(',')}]`);
            }
        });

        // Show some examples of different systems for same analyte
        console.log('\n=== 相同 Analyte 不同 System 的例子 ===');
        let systemDiffCount = 0;
        commonAnalytes.forEach(analyte => {
            const aaaItems = aaaAnalyteMap.get(analyte);
            const triItems = triAnalyteMap.get(analyte);

            const aaaSystems = [...new Set(aaaItems.map(item => item.system))];
            const triSystems = [...new Set(triItems.map(item => item.system))];

            if (aaaSystems.join(',') !== triSystems.join(',') && systemDiffCount < 10) {
                console.log(`${systemDiffCount + 1}. ${analyte}`);
                console.log(`   萬芳檢體: ${aaaSystems.join(', ')}`);
                console.log(`   三總檢體: ${triSystems.join(', ')}`);
                systemDiffCount++;
            }
        });

        // Save results
        const results = {
            timestamp: new Date().toISOString(),
            summary: {
                aaaUniqueAnalytes: aaaAnalytes.size,
                triUniqueAnalytes: triAnalytes.size,
                commonAnalytes: commonAnalytes.length,
                totalUniqueAnalytes: totalUniqueAnalytes,
                aaaOnlyAnalytes: aaaUniqueAnalytes,
                triOnlyAnalytes: triUniqueAnalytes,
                overlapPercentage: parseFloat(overlapPercentage)
            },
            commonAnalytesList: commonAnalytes.map(analyte => ({
                analyte: analyte,
                aaaItems: aaaAnalyteMap.get(analyte),
                triItems: triAnalyteMap.get(analyte)
            }))
        };

        fs.writeFileSync('/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/analyte_overlap_analysis.json', JSON.stringify(results, null, 2));
        console.log('\n分析結果已保存至 analyte_overlap_analysis.json');

    } catch (error) {
        console.error('Error analyzing analyte overlap:', error);
    }
}

analyzeAnalyteOverlap();