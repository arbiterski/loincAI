const fs = require('fs');

function analyzeMethodStrategies() {
    try {
        // Read hospital data
        const aaaData = JSON.parse(fs.readFileSync('/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/aaa_hospital_final_200.json', 'utf8'));
        const triData = JSON.parse(fs.readFileSync('/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/tri_service_final_200.json', 'utf8'));

        console.log('=== LOINC Method Mapping Strategy 分析 ===');
        console.log(`萬芳醫院項目數: ${aaaData.length}`);
        console.log(`三軍總醫院項目數: ${triData.length}\n`);

        // Function to extract analyte from LOINC name
        function extractAnalyte(loincName) {
            if (!loincName) return '';
            const beforeIn = loincName.split(' in ')[0];
            const analyte = beforeIn.replace(/\s*\[.*?\]\s*/g, '').trim();
            return analyte;
        }

        // Function to extract method from LOINC name
        function extractMethod(loincName) {
            if (!loincName) return 'No method specified';

            // Look for method patterns after "by"
            const byMatch = loincName.match(/by\s+(.+?)(?:\s|$)/i);
            if (byMatch) {
                return byMatch[1].trim();
            }

            // Look for common method patterns
            const methodPatterns = [
                /immunoassay/i,
                /chromatography/i,
                /electrophoresis/i,
                /enzymatic/i,
                /spectrophotometry/i,
                /turbidimetry/i,
                /nephelometry/i,
                /coagulation/i,
                /automated count/i,
                /calculation/i,
                /microscopy/i,
                /flow cytometry/i
            ];

            for (const pattern of methodPatterns) {
                const match = loincName.match(pattern);
                if (match) {
                    return match[0];
                }
            }

            return 'No method specified';
        }

        // Function to determine if LOINC uses method-specific coding
        function isMethodSpecific(loincName) {
            const methodIndicators = [
                'by ',
                'Immunoassay',
                'Chromatography',
                'Electrophoresis',
                'Enzymatic',
                'Spectrophotometry',
                'Turbidimetry',
                'Nephelometry',
                'Coagulation',
                'Automated count',
                'Calculation',
                'Microscopy',
                'Flow cytometry'
            ];

            return methodIndicators.some(indicator =>
                loincName.toLowerCase().includes(indicator.toLowerCase())
            );
        }

        // Group data by analyte
        const aaaAnalytes = new Map();
        const triAnalytes = new Map();

        aaaData.forEach(item => {
            const analyte = extractAnalyte(item.loincName);
            if (!aaaAnalytes.has(analyte)) {
                aaaAnalytes.set(analyte, []);
            }
            aaaAnalytes.get(analyte).push({
                ...item,
                method: extractMethod(item.loincName),
                isMethodSpecific: isMethodSpecific(item.loincName)
            });
        });

        triData.forEach(item => {
            const analyte = extractAnalyte(item.loincName);
            if (!triAnalytes.has(analyte)) {
                triAnalytes.set(analyte, []);
            }
            triAnalytes.get(analyte).push({
                ...item,
                method: extractMethod(item.loincName),
                isMethodSpecific: isMethodSpecific(item.loincName)
            });
        });

        // Find common analytes
        const commonAnalytes = [...aaaAnalytes.keys()].filter(analyte => triAnalytes.has(analyte));

        console.log(`共同 analytes 數量: ${commonAnalytes.length}\n`);

        // Analyze method strategies for common analytes
        const methodAnalysis = {
            bothMethodSpecific: [],
            bothMethodless: [],
            aaaMethodSpecific: [],
            triMethodSpecific: [],
            differentMethods: [],
            sameMethods: []
        };

        const methodStats = {
            aaa: { methodSpecific: 0, methodless: 0 },
            tri: { methodSpecific: 0, methodless: 0 }
        };

        commonAnalytes.forEach(analyte => {
            const aaaItems = aaaAnalytes.get(analyte);
            const triItems = triAnalytes.get(analyte);

            const aaaMethods = [...new Set(aaaItems.map(item => item.method))];
            const triMethods = [...new Set(triItems.map(item => item.method))];

            const aaaMethodSpecific = aaaItems.some(item => item.isMethodSpecific);
            const triMethodSpecific = triItems.some(item => item.isMethodSpecific);

            const analysisItem = {
                analyte,
                aaa: {
                    items: aaaItems.map(item => ({
                        rank: item.itemRank,
                        labName: item.labItemName,
                        loincCode: item.loincCode,
                        loincName: item.loincName,
                        method: item.method,
                        isMethodSpecific: item.isMethodSpecific
                    })),
                    methods: aaaMethods,
                    hasMethodSpecific: aaaMethodSpecific
                },
                tri: {
                    items: triItems.map(item => ({
                        rank: item.itemRank,
                        labName: item.labItemName,
                        loincCode: item.loincCode,
                        loincName: item.loincName,
                        method: item.method,
                        isMethodSpecific: item.isMethodSpecific
                    })),
                    methods: triMethods,
                    hasMethodSpecific: triMethodSpecific
                }
            };

            // Categorize by method strategy
            if (aaaMethodSpecific && triMethodSpecific) {
                methodAnalysis.bothMethodSpecific.push(analysisItem);
            } else if (!aaaMethodSpecific && !triMethodSpecific) {
                methodAnalysis.bothMethodless.push(analysisItem);
            } else if (aaaMethodSpecific && !triMethodSpecific) {
                methodAnalysis.aaaMethodSpecific.push(analysisItem);
            } else if (!aaaMethodSpecific && triMethodSpecific) {
                methodAnalysis.triMethodSpecific.push(analysisItem);
            }

            // Check if methods are the same
            const commonMethods = aaaMethods.filter(method => triMethods.includes(method));
            if (commonMethods.length > 0) {
                methodAnalysis.sameMethods.push({...analysisItem, commonMethods});
            } else {
                methodAnalysis.differentMethods.push(analysisItem);
            }
        });

        // Calculate overall method usage statistics
        aaaData.forEach(item => {
            if (isMethodSpecific(item.loincName)) {
                methodStats.aaa.methodSpecific++;
            } else {
                methodStats.aaa.methodless++;
            }
        });

        triData.forEach(item => {
            if (isMethodSpecific(item.loincName)) {
                methodStats.tri.methodSpecific++;
            } else {
                methodStats.tri.methodless++;
            }
        });

        // Display results
        console.log('=== 整體 Method Strategy 統計 ===');
        console.log(`萬芳醫院:`);
        console.log(`  有方法碼: ${methodStats.aaa.methodSpecific} 項 (${(methodStats.aaa.methodSpecific/aaaData.length*100).toFixed(1)}%)`);
        console.log(`  無方法碼: ${methodStats.aaa.methodless} 項 (${(methodStats.aaa.methodless/aaaData.length*100).toFixed(1)}%)`);

        console.log(`\n三軍總醫院:`);
        console.log(`  有方法碼: ${methodStats.tri.methodSpecific} 項 (${(methodStats.tri.methodSpecific/triData.length*100).toFixed(1)}%)`);
        console.log(`  無方法碼: ${methodStats.tri.methodless} 項 (${(methodStats.tri.methodless/triData.length*100).toFixed(1)}%)`);

        console.log('\n=== 共同 Analytes 的 Method Strategy 比較 ===');
        console.log(`兩院都用有方法碼: ${methodAnalysis.bothMethodSpecific.length} 項`);
        console.log(`兩院都用無方法碼: ${methodAnalysis.bothMethodless.length} 項`);
        console.log(`僅萬芳用有方法碼: ${methodAnalysis.aaaMethodSpecific.length} 項`);
        console.log(`僅三總用有方法碼: ${methodAnalysis.triMethodSpecific.length} 項`);

        console.log('\n=== 兩院都用有方法碼的項目 ===');
        methodAnalysis.bothMethodSpecific.forEach((item, index) => {
            console.log(`\n${index + 1}. ${item.analyte}`);
            console.log(`   萬芳方法: ${item.aaa.methods.join(', ')}`);
            console.log(`   三總方法: ${item.tri.methods.join(', ')}`);
            if (item.aaa.methods.join(',') === item.tri.methods.join(',')) {
                console.log(`   ✓ 方法一致`);
            } else {
                console.log(`   ✗ 方法不同`);
            }
        });

        console.log('\n=== 僅萬芳用有方法碼的項目 ===');
        methodAnalysis.aaaMethodSpecific.slice(0, 10).forEach((item, index) => {
            console.log(`\n${index + 1}. ${item.analyte}`);
            console.log(`   萬芳: ${item.aaa.items[0].loincName}`);
            console.log(`   三總: ${item.tri.items[0].loincName}`);
            console.log(`   萬芳方法: ${item.aaa.methods.join(', ')}`);
            console.log(`   三總策略: 使用無方法碼`);
        });

        console.log('\n=== 僅三總用有方法碼的項目 ===');
        methodAnalysis.triMethodSpecific.slice(0, 10).forEach((item, index) => {
            console.log(`\n${index + 1}. ${item.analyte}`);
            console.log(`   萬芳: ${item.aaa.items[0].loincName}`);
            console.log(`   三總: ${item.tri.items[0].loincName}`);
            console.log(`   萬芳策略: 使用無方法碼`);
            console.log(`   三總方法: ${item.tri.methods.join(', ')}`);
        });

        console.log('\n=== 兩院都用無方法碼的項目 Top 10 ===');
        methodAnalysis.bothMethodless.slice(0, 10).forEach((item, index) => {
            console.log(`${index + 1}. ${item.analyte} - 兩院都選擇簡化無方法碼策略`);
        });

        // Method preference analysis
        console.log('\n=== Method 偏好分析 ===');
        const aaaMethodPreference = {};
        const triMethodPreference = {};

        aaaData.forEach(item => {
            const method = extractMethod(item.loincName);
            aaaMethodPreference[method] = (aaaMethodPreference[method] || 0) + 1;
        });

        triData.forEach(item => {
            const method = extractMethod(item.loincName);
            triMethodPreference[method] = (triMethodPreference[method] || 0) + 1;
        });

        console.log('\n萬芳醫院 Method 使用分布:');
        Object.entries(aaaMethodPreference)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .forEach(([method, count]) => {
                console.log(`  ${method}: ${count} 項`);
            });

        console.log('\n三軍總醫院 Method 使用分布:');
        Object.entries(triMethodPreference)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .forEach(([method, count]) => {
                console.log(`  ${method}: ${count} 項`);
            });

        // Save detailed analysis
        const results = {
            timestamp: new Date().toISOString(),
            summary: {
                commonAnalytes: commonAnalytes.length,
                methodStats: methodStats,
                strategyComparison: {
                    bothMethodSpecific: methodAnalysis.bothMethodSpecific.length,
                    bothMethodless: methodAnalysis.bothMethodless.length,
                    aaaMethodSpecific: methodAnalysis.aaaMethodSpecific.length,
                    triMethodSpecific: methodAnalysis.triMethodSpecific.length
                }
            },
            methodAnalysis: methodAnalysis,
            methodPreference: {
                aaa: aaaMethodPreference,
                tri: triMethodPreference
            }
        };

        fs.writeFileSync('/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/method_strategy_analysis.json', JSON.stringify(results, null, 2));
        console.log('\n詳細分析結果已保存至 method_strategy_analysis.json');

    } catch (error) {
        console.error('Error analyzing method strategies:', error);
    }
}

analyzeMethodStrategies();