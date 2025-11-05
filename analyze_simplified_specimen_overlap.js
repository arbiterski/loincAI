const fs = require('fs');

function analyzeSimplifiedSpecimenOverlap() {
    try {
        // Read hospital data
        const aaaData = JSON.parse(fs.readFileSync('/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/aaa_hospital_final_200.json', 'utf8'));
        const triData = JSON.parse(fs.readFileSync('/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/tri_service_final_200.json', 'utf8'));

        console.log('=== LOINC 重複分析 (簡化檢體分類) ===');
        console.log('規則: Urine 獨立, Biochemist/Haematolog/Blood 視為相同');
        console.log(`萬芳醫院項目數: ${aaaData.length}`);
        console.log(`三軍總醫院項目數: ${triData.length}\n`);

        // Function to extract analyte (component) from LOINC name
        function extractAnalyte(loincName) {
            if (!loincName) return '';
            const beforeIn = loincName.split(' in ')[0];
            const analyte = beforeIn.replace(/\s*\[.*?\]\s*/g, '').trim();
            return analyte;
        }

        // Function to normalize specimen type
        function normalizeSpecimen(specimen) {
            if (!specimen) return 'Unknown';

            const spec = specimen.toLowerCase();

            // Check for urine-related specimens
            if (spec.includes('urine') || spec.includes('尿')) {
                return 'Urine';
            }

            // Check for stool
            if (spec.includes('stool') || spec.includes('糞便')) {
                return 'Stool';
            }

            // Check for CSF
            if (spec.includes('csf') || spec.includes('腦脊髓')) {
                return 'CSF';
            }

            // Check for other body fluids
            if (spec.includes('fluid') || spec.includes('液')) {
                if (!spec.includes('血')) { // Not blood
                    return 'Body Fluid';
                }
            }

            // Check for sputum
            if (spec.includes('sputum') || spec.includes('痰')) {
                return 'Sputum';
            }

            // Check for nasopharyngeal
            if (spec.includes('nasopharyn') || spec.includes('鼻咽')) {
                return 'Nasopharyngeal';
            }

            // Everything else (including Blood, Biochemist, Haematolog, CBC, etc.) is "Blood/Serum"
            return 'Blood/Serum';
        }

        // Create combined analyte+specimen keys
        const aaaAnalyteSpecimen = new Map();
        const triAnalyteSpecimen = new Map();

        // Process AAA Hospital data
        aaaData.forEach(item => {
            const analyte = extractAnalyte(item.loincName);
            const specimen = normalizeSpecimen(item.labSampleType);
            const key = `${analyte}|||${specimen}`;

            if (!aaaAnalyteSpecimen.has(key)) {
                aaaAnalyteSpecimen.set(key, []);
            }
            aaaAnalyteSpecimen.get(key).push({
                rank: item.itemRank,
                labName: item.labItemName,
                loincCode: item.loincCode,
                loincName: item.loincName,
                originalSpecimen: item.labSampleType
            });
        });

        // Process Tri-Service Hospital data
        triData.forEach(item => {
            const analyte = extractAnalyte(item.loincName);
            const specimen = normalizeSpecimen(item.labSampleType);
            const key = `${analyte}|||${specimen}`;

            if (!triAnalyteSpecimen.has(key)) {
                triAnalyteSpecimen.set(key, []);
            }
            triAnalyteSpecimen.get(key).push({
                rank: item.itemRank,
                labName: item.labItemName,
                loincCode: item.loincCode,
                loincName: item.loincName,
                originalSpecimen: item.labSampleType
            });
        });

        // Find common analyte+specimen combinations
        const aaaKeys = new Set(aaaAnalyteSpecimen.keys());
        const triKeys = new Set(triAnalyteSpecimen.keys());
        const commonKeys = [...aaaKeys].filter(key => triKeys.has(key));

        // Calculate statistics
        const totalUniqueKeys = new Set([...aaaKeys, ...triKeys]).size;
        const aaaOnlyKeys = [...aaaKeys].filter(key => !triKeys.has(key));
        const triOnlyKeys = [...triKeys].filter(key => !aaaKeys.has(key));
        const overlapPercentage = ((commonKeys.length * 2) / (aaaKeys.size + triKeys.size) * 100).toFixed(1);

        console.log('=== 統計結果 (簡化檢體分類) ===');
        console.log(`萬芳醫院獨特組合: ${aaaKeys.size}`);
        console.log(`三軍總醫院獨特組合: ${triKeys.size}`);
        console.log(`共同組合 (analyte + 簡化檢體): ${commonKeys.length}`);
        console.log(`總唯一組合: ${totalUniqueKeys}`);
        console.log(`萬芳獨有組合: ${aaaOnlyKeys.length}`);
        console.log(`三總獨有組合: ${triOnlyKeys.length}`);
        console.log(`重複率: ${overlapPercentage}%`);

        // Show specimen distribution
        const specimenStats = {
            aaa: {},
            tri: {}
        };

        aaaData.forEach(item => {
            const specimen = normalizeSpecimen(item.labSampleType);
            specimenStats.aaa[specimen] = (specimenStats.aaa[specimen] || 0) + 1;
        });

        triData.forEach(item => {
            const specimen = normalizeSpecimen(item.labSampleType);
            specimenStats.tri[specimen] = (specimenStats.tri[specimen] || 0) + 1;
        });

        console.log('\n=== 簡化後檢體類型分布 ===');
        console.log('萬芳醫院:');
        Object.entries(specimenStats.aaa).sort((a, b) => b[1] - a[1]).forEach(([spec, count]) => {
            console.log(`  ${spec}: ${count} 項`);
        });

        console.log('\n三軍總醫院:');
        Object.entries(specimenStats.tri).sort((a, b) => b[1] - a[1]).forEach(([spec, count]) => {
            console.log(`  ${spec}: ${count} 項`);
        });

        // Show common combinations
        console.log('\n=== 共同 Analyte+Specimen 組合 Top 30 ===');
        commonKeys.slice(0, 30).forEach((key, index) => {
            const [analyte, specimen] = key.split('|||');
            const aaaItems = aaaAnalyteSpecimen.get(key);
            const triItems = triAnalyteSpecimen.get(key);

            console.log(`\n${index + 1}. ${analyte} [${specimen}]`);
            console.log(`   萬芳: ${aaaItems.map(item => `排名${item.rank} (${item.labName})`).join(', ')}`);
            console.log(`   三總: ${triItems.map(item => `排名${item.rank} (${item.labName})`).join(', ')}`);

            // Show original specimen names if different
            const aaaOriginal = [...new Set(aaaItems.map(item => item.originalSpecimen))];
            const triOriginal = [...new Set(triItems.map(item => item.originalSpecimen))];
            console.log(`   原始檢體: 萬芳[${aaaOriginal.join(',')}] vs 三總[${triOriginal.join(',')}]`);
        });

        // Analyze by specimen type
        console.log('\n=== 各檢體類型的重複情況 ===');
        const specimenOverlap = {};

        commonKeys.forEach(key => {
            const [analyte, specimen] = key.split('|||');
            if (!specimenOverlap[specimen]) {
                specimenOverlap[specimen] = 0;
            }
            specimenOverlap[specimen]++;
        });

        Object.entries(specimenOverlap).sort((a, b) => b[1] - a[1]).forEach(([spec, count]) => {
            console.log(`${spec}: ${count} 個共同檢驗項目`);
        });

        // Save results
        const results = {
            timestamp: new Date().toISOString(),
            rules: "Urine獨立, Biochemist/Haematolog/Blood視為相同",
            summary: {
                aaaUniqueKeys: aaaKeys.size,
                triUniqueKeys: triKeys.size,
                commonKeys: commonKeys.length,
                totalUniqueKeys: totalUniqueKeys,
                aaaOnlyKeys: aaaOnlyKeys.length,
                triOnlyKeys: triOnlyKeys.length,
                overlapPercentage: parseFloat(overlapPercentage)
            },
            specimenDistribution: specimenStats,
            specimenOverlap: specimenOverlap,
            commonCombinations: commonKeys.slice(0, 50).map(key => {
                const [analyte, specimen] = key.split('|||');
                return {
                    analyte: analyte,
                    specimen: specimen,
                    aaaItems: aaaAnalyteSpecimen.get(key),
                    triItems: triAnalyteSpecimen.get(key)
                };
            })
        };

        fs.writeFileSync('/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/simplified_specimen_overlap_analysis.json', JSON.stringify(results, null, 2));
        console.log('\n分析結果已保存至 simplified_specimen_overlap_analysis.json');

    } catch (error) {
        console.error('Error analyzing simplified specimen overlap:', error);
    }
}

analyzeSimplifiedSpecimenOverlap();