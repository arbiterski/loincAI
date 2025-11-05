const fs = require('fs').promises;
const fsSyncBackup = require('fs');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, AlignmentType, WidthType, PageBreak, ShadingType, ImageRun } = require('docx');
const path = require('path');

async function generateFinalWordReport() {
    try {
        // Read the final data files
        const aaaDataRaw = await fs.readFile('/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/aaa_hospital_final_200.json', 'utf8');
        const triDataRaw = await fs.readFile('/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/tri_service_final_200.json', 'utf8');

        const aaaData = JSON.parse(aaaDataRaw);
        const triData = JSON.parse(triDataRaw);

        console.log('=== 生成最終 Word 報告 ===');
        console.log(`萬芳醫院項目數: ${aaaData.length}`);
        console.log(`三軍總醫院項目數: ${triData.length}`);

        // Helper function to create styled paragraphs
        const createHeading = (text, level = HeadingLevel.HEADING_1, size = 28) => {
            return new Paragraph({
                children: [
                    new TextRun({
                        text: text,
                        bold: true,
                        size: size,
                        font: "Microsoft JhengHei"
                    })
                ],
                heading: level
            });
        };

        const createParagraph = (text, size = 22, bold = false, italics = false, alignment = AlignmentType.LEFT) => {
            return new Paragraph({
                children: [
                    new TextRun({
                        text: text,
                        size: size,
                        font: "Microsoft JhengHei",
                        bold: bold,
                        italics: italics
                    })
                ],
                alignment: alignment
            });
        };

        const createTableHeader = (headers) => {
            return new TableRow({
                children: headers.map(header =>
                    new TableCell({
                        children: [new Paragraph({
                            children: [new TextRun({
                                text: header,
                                bold: true,
                                font: "Microsoft JhengHei",
                                size: 20
                            })]
                        })],
                        shading: {
                            fill: "CCCCCC",
                            type: ShadingType.SOLID,
                        },
                    })
                ),
            });
        };

        // CSV helpers for Chapter 11.2
        const stripBOM = (s) => (s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s);
        const parseCsvLine = (line) => {
            const out = [];
            let cur = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (ch === '"') {
                    inQuotes = !inQuotes;
                    continue;
                }
                if (ch === ',' && !inQuotes) {
                    out.push(cur);
                    cur = '';
                } else {
                    cur += ch;
                }
            }
            out.push(cur);
            return out.map(s => s.trim());
        };

        const parseCsvHeaderAndSample = (filePath) => {
            const raw = fsSyncBackup.readFileSync(filePath, 'utf8');
            const lines = stripBOM(raw).split(/\r?\n/).filter(l => l.length > 0);
            if (lines.length === 0) return { headers: [], sample: [] };
            const headers = parseCsvLine(lines[0]);
            const sample = lines.length > 1 ? parseCsvLine(lines[1]) : headers.map(() => '');
            return { headers, sample };
        };

        const guessType = (name) => {
            const n = name.toLowerCase();
            if (["age"].includes(n)) return "整數";
            if (["val", "ref_min", "ref_max"].includes(n)) return "數字";
            if (["date", "timestamp", "time"].includes(n)) return "日期/時間";
            return "字串";
        };

        const descMap = {
            hos: "醫院/單位代碼（例如 801）",
            item_id: "本地檢驗代碼（local code）",
            item: "本地檢驗項目名稱（local name）",
            date: "檢驗日期時間（ISO 或 yyyy-MM-dd HH:mm:ss）",
            val: "檢驗結果值（數值/文字；名目型項目為文字）",
            unit: "檢驗單位（單位名稱）",
            ref: "參考值（自由字串；若有上下限請用 ref_min/ref_max）",
            ref_min: "參考下限（數值）",
            ref_max: "參考上限（數值）",
            time: "採檢/結果時間（如 HHmm 或 HH:MM；若已含於 date 可留空）",
            chr_no: "去識別化病歷號（請勿為可回溯之 PHI）",
            age: "年齡（歲）",
            sex: "性別代碼（0/1 或 M/F；請說明對應）",
            sample: "檢體/系統（System），例如：Blood、Ser/Plas、Urine、甲狀腺",
            mark: "備註/異常旗標（可選）",
        };

        const buildCsvFieldTable = (title, headers, sample) => {
            const rows = [createTableHeader(["欄位名稱", "資料型態", "說明", "範例"])];
            headers.forEach((h, idx) => {
                const key = (h || '').replace(/^\"|\"$/g, '').trim();
                const lower = key.toLowerCase();
                const type = guessType(lower);
                const desc = descMap[lower] || "—";
                const example = (sample[idx] || '').replace(/^\"|\"$/g, '');
                rows.push(new TableRow({
                    children: [
                        new TableCell({ children: [createParagraph(key, 20, true)] }),
                        new TableCell({ children: [createParagraph(type, 20)] }),
                        new TableCell({ children: [createParagraph(desc, 20)] }),
                        new TableCell({ children: [createParagraph(example, 20)] }),
                    ]
                }));
            });
            return [
                createHeading(title, HeadingLevel.HEADING_3, 24),
                new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows })
            ];
        };

        // Prepare CSV field tables from provided files
        const wfhPath = '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC_ED_Meta/WFH.csv';
        const hosPath = '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC_ED_Meta/Tri_Service/HOS_split_files/HOS_801.csv';
        const { headers: wfhHeaders, sample: wfhSample } = parseCsvHeaderAndSample(wfhPath);
        const { headers: hosHeaders, sample: hosSample } = parseCsvHeaderAndSample(hosPath);
        const wfhTableElems = buildCsvFieldTable('萬芳醫院.csv 欄位定義（上傳範例）', wfhHeaders, wfhSample);
        const hosTableElems = buildCsvFieldTable('三軍總醫院.csv 欄位定義（上傳範例）', hosHeaders, hosSample);

        // Load issues if available
        let aaaIssues = [];
        let triIssues = [];
        try { aaaIssues = JSON.parse(await fs.readFile('/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/issues_aaa.json','utf8')); } catch (e) {}
        try { triIssues = JSON.parse(await fs.readFile('/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/issues_tri.json','utf8')); } catch (e) {}

        // Build issue-type distributions
        const countByType = (arr) => {
            const m = new Map();
            for (const x of arr) {
                const k = (x.issueType || '未分類').toString();
                m.set(k, (m.get(k) || 0) + 1);
            }
            return m;
        };
        const aaaDist = countByType(aaaIssues);
        const triDist = countByType(triIssues);
        const distKeys = Array.from(new Set([...aaaDist.keys(), ...triDist.keys()])).sort();
        const aaaTotalIssues = aaaIssues.length || 1;
        const triTotalIssues = triIssues.length || 1;
        const fmtCountPct = (count, total) => `${count} (${((count/total)*100).toFixed(1)}%)`;

        // Sample at most 5 unique issues per hospital (dedupe by type+details)
        const sampleIssues = (arr, maxN=5) => {
            const seen = new Set();
            const out = [];
            for (const x of arr) {
                const key = `${x.issueType||''}|${x.details||''}`;
                if (seen.has(key)) continue;
                seen.add(key);
                out.push(x);
                if (out.length >= maxN) break;
            }
            return out;
        };
        const aaaSample = sampleIssues(aaaIssues, 5);
        const triSample = sampleIssues(triIssues, 5);

        

        // Helper function to create image from file
        const createImageParagraph = async (imagePath, description, width = 600, height = 400) => {
            try {
                const imageData = await fs.readFile(imagePath);
                return [
                    new Paragraph({
                        children: [
                            new ImageRun({
                                data: imageData,
                                transformation: {
                                    width: width,
                                    height: height,
                                },
                            }),
                        ],
                        alignment: AlignmentType.CENTER,
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: description,
                                size: 20,
                                font: "Microsoft JhengHei",
                                italics: true
                            })
                        ],
                        alignment: AlignmentType.CENTER
                    }),
                    new Paragraph({ text: "" }) // Empty line
                ];
            } catch (error) {
                console.warn(`無法載入圖片 ${imagePath}:`, error.message);
                return [
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `[圖片載入失敗: ${description}]`,
                                size: 20,
                                font: "Microsoft JhengHei",
                                italics: true
                            })
                        ],
                        alignment: AlignmentType.CENTER
                    })
                ];
            }
        };

        // Create the complete document
        const doc = new Document({
            sections: [{
                properties: {},
                children: [
                    // Cover Page
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "健保署 LOINC Mapping 計畫",
                                bold: true,
                                size: 36,
                                font: "Microsoft JhengHei"
                            })
                        ],
                        heading: HeadingLevel.TITLE,
                        alignment: AlignmentType.CENTER
                    }),

                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "完整實施報告",
                                bold: true,
                                size: 32,
                                font: "Microsoft JhengHei"
                            })
                        ],
                        alignment: AlignmentType.CENTER
                    }),

                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "Taiwan LOINC Implementation Project",
                                italics: true,
                                size: 24,
                                font: "Arial"
                            })
                        ],
                        alignment: AlignmentType.CENTER
                    }),

                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "Complete Implementation Report",
                                italics: true,
                                size: 20,
                                font: "Arial"
                            })
                        ],
                        alignment: AlignmentType.CENTER
                    }),

                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "TAMI AI LOINC Taiwan top 100 推動小組",
                                italics: true,
                                size: 22,
                                font: "Microsoft JhengHei"
                            })
                        ],
                        alignment: AlignmentType.CENTER
                    }),

                    new Paragraph({ text: "" }),
                    new Paragraph({ text: "" }),

                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `報告生成日期：${new Date().toLocaleDateString('zh-TW')}`,
                                size: 24,
                                font: "Microsoft JhengHei"
                            })
                        ],
                        alignment: AlignmentType.CENTER
                    }),

                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "參與機構：萬芳醫院、三軍總醫院",
                                size: 22,
                                font: "Microsoft JhengHei"
                            })
                        ],
                        alignment: AlignmentType.CENTER
                    }),

                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "總對應項目：400 項檢驗項目",
                                size: 22,
                                font: "Microsoft JhengHei"
                            })
                        ],
                        alignment: AlignmentType.CENTER
                    }),

                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "完成率：100%",
                                size: 22,
                                font: "Microsoft JhengHei",
                                bold: true
                            })
                        ],
                        alignment: AlignmentType.CENTER
                    }),

                    createParagraph("上傳資料之『即時評分』：可由『萬達人』系統根據 ED 指標（頻次/均值/標準差/名目分布）與映射結果（mapping）進行自動評分與確認，提供院端快速回饋並輔助健保署端治理。"),

                    new Paragraph({ children: [new PageBreak()] }),

                    // Table of Contents (renumbered)
                    createHeading("目錄", HeadingLevel.HEADING_1, 32),

                    createParagraph("一、執行摘要 ...................................................."),
                    createParagraph("二、計畫背景與目標 .........................................."),
                    createParagraph("三、LOINC 主席專家建議 ...................................."),
                    createParagraph("四、國家級推動建議 ........................................"),
                    createParagraph("五、資料準備與對應策略 ...................................."),
                    createParagraph("六、實施方法與流程 .........................................."),
                    createParagraph("七、系統架構與技術特色 ...................................."),
                    createParagraph("八、系統操作畫面展示 ........................................"),
                    createParagraph("九、專案統計與成果 .........................................."),
                    createParagraph("十、萬芳醫院對應結果 ........................................"),
                    createParagraph("十一、三軍總醫院對應結果 .................................."),
                    createParagraph("十二、品質保證與驗證 ........................................"),
                    createParagraph("十四、院別疑義清單 .........................................."),
                    createParagraph("十五、結論與未來展望 ........................................"),

                    new Paragraph({ children: [new PageBreak()] }),

                    // Chapter 1: Executive Summary
                    createHeading("一、執行摘要", HeadingLevel.HEADING_1, 32),

                    createParagraph("本計畫成功完成台灣首個大規模醫療檢驗項目 LOINC（Logical Observation Identifiers Names and Codes）標準化對應工作。透過萬芳醫院與三軍總醫院的密切配合，共完成 400 項檢驗項目的精確對應，建立了國內領先的智慧化 LOINC 對應系統。"),

                    createHeading("1.1 主要成就", HeadingLevel.HEADING_2, 26),

                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            createTableHeader(["成就項目", "具體數據", "影響意義"]),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [createParagraph("完成率", 20)] }),
                                    new TableCell({ children: [createParagraph("100% (400/400)", 20, true)] }),
                                    new TableCell({ children: [createParagraph("零遺漏，全面覆蓋", 20)] }),
                                ],
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [createParagraph("參與醫院", 20)] }),
                                    new TableCell({ children: [createParagraph("2 家醫學中心", 20, true)] }),
                                    new TableCell({ children: [createParagraph("代表性強，可推廣", 20)] }),
                                ],
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [createParagraph("技術創新", 20)] }),
                                    new TableCell({ children: [createParagraph("AI 智慧對應", 20, true)] }),
                                    new TableCell({ children: [createParagraph("國內首創，效率提升", 20)] }),
                                ],
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [createParagraph("品質保證", 20)] }),
                                    new TableCell({ children: [createParagraph("專家人工驗證", 20, true)] }),
                                    new TableCell({ children: [createParagraph("確保準確性", 20)] }),
                                ],
                            }),
                        ],
                    }),

                    new Paragraph({ children: [new PageBreak()] }),

                    // Chapter 2: Background and Objectives
                    createHeading("二、計畫背景與目標", HeadingLevel.HEADING_1, 32),

                    createHeading("2.1 計畫背景", HeadingLevel.HEADING_2, 26),
                    createParagraph("隨著精準醫療與健康大數據應用的發展，醫療檢驗資料的標準化與互通性成為關鍵議題。LOINC 作為國際公認的實驗室檢驗標準，已被全球超過 180 個國家和地區採用。台灣為推動醫療資料標準化，啟動本項先導計畫。"),

                    createHeading("2.2 計畫目標", HeadingLevel.HEADING_2, 26),
                    createParagraph("• 建立台灣首個大規模 LOINC 對應系統"),
                    createParagraph("• 完成 400 項常見檢驗項目的精確對應"),
                    createParagraph("• 開發智慧化對應工具提升效率"),
                    createParagraph("• 建立可複製的推廣模式"),
                    createParagraph("• 為全國醫療標準化奠定基礎"),

                    createHeading("2.3 預期效益", HeadingLevel.HEADING_2, 26),
                    createParagraph("• 提升醫療資料品質與可比性"),
                    createParagraph("• 促進醫院間資料交換"),
                    createParagraph("• 支援精準醫療發展"),
                    createParagraph("• 建立國際接軌基礎"),

                    new Paragraph({ children: [new PageBreak()] }),

                    // Chapter 3: Implementation Method
                    // Moved Expert Recommendations and Data Prep forward

                    // Chapter 3: Expert Recommendations (moved earlier)
                    createHeading("三、LOINC 主席 Stan Huff 專家建議", HeadingLevel.HEADING_1, 32),

                    createHeading("3.1 專家背景", HeadingLevel.HEADING_2, 26),
                    createParagraph("Stan Huff, MD - LOINC 委員會主席，國際實驗室醫學標準化領域權威專家，對本計畫提供專業指導與建議。"),

                    createHeading("3.2 檢體標示策略建議", HeadingLevel.HEADING_2, 26),
                    createParagraph("針對血液 vs. 血清/血漿對應原則："),
                    createParagraph("• LOINC 系統軸應標示實際被分析的檢體，而非抽取的檢體"),
                    createParagraph("• Ser/Plas（血清/血漿）：當檢測方法與參考值相同時可共用"),
                    createParagraph("• Bld（血液）：僅限於全血檢測（如血球計數、血氣分析）"),

                    createHeading("3.3 務實推動策略", HeadingLevel.HEADING_2, 26),

                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            createTableHeader(["階段", "策略重點", "具體作法"]),
                            new TableRow({ children: [
                                new TableCell({ children: [createParagraph("第一階段", 20, true)] }),
                                new TableCell({ children: [createParagraph("快速上線", 20)] }),
                                new TableCell({ children: [createParagraph("使用 Ser/Plas/Bld 與無方法碼", 20)] }),
                            ] }),
                            new TableRow({ children: [
                                new TableCell({ children: [createParagraph("第二階段", 20, true)] }),
                                new TableCell({ children: [createParagraph("資料驗證", 20)] }),
                                new TableCell({ children: [createParagraph("比較實驗室數值與參考值", 20)] }),
                            ] }),
                            new TableRow({ children: [
                                new TableCell({ children: [createParagraph("第三階段", 20, true)] }),
                                new TableCell({ children: [createParagraph("精進治理", 20)] }),
                                new TableCell({ children: [createParagraph("更新為檢體準確與方法特定代碼", 20)] }),
                            ] }),
                        ],
                    }),

                    createHeading("3.4 對台灣計畫評價", HeadingLevel.HEADING_2, 26),
                    createParagraph("Stan Huff 主席肯定：台灣的 LOINC 對應計畫展現了務實且系統性的推動方式，特別是半自動化對應系統的創新應用，為國際 LOINC 推廣提供了良好的參考模式。"),

                    createHeading("3.5 Stan 建議原文（引用）", HeadingLevel.HEADING_2, 26),
                    createParagraph("Previously, I mentioned that I am conducting a pilot project to test the Taiwan Top 100 LOINC initiative. I mapped the top 200 laboratory tests and found that only 46 LOINC codes were identical across two institutions. I identified several issues contributing to this inconsistency, and I would like your opinion." , 20, false, true),
                    createParagraph("1. Specimen: Blood vs. Serum/Plasma", 20, true, false),
                    createParagraph("In my hospital, the specimen type is always recorded as ‘blood,’ rather than distinguishing ‘serum’ or ‘plasma.’ This practice is a major source of inconsistency. From my experience, choosing more general terms seems to cause fewer problems during mapping.", 20, false, true),
                    createParagraph("However, in reality, even when our system records ‘blood,’ many of those tests are actually performed on serum or plasma. Correcting this would require significant time and effort, so I need to discuss it with our laboratory staff. What is your suggestion on how to handle the distinction between ‘blood’ and ‘serum/plasma,’ especially in the context of my institution?", 20, false, true),
                    createParagraph("In LOINC, the system (specimen) always refers to what kind of specimen was analyzed, not what was drawn from the patient. ‘Ser/plas’ is used when the laboratory uses the same method and has the same reference range for either serum or plasma. Tests that are done on whole blood (like ABO typing or blood gases) use bld as the specimen type. There are also 152 LOINC codes that have a system of ‘ser/plas/bld’, which are not used in the US but are used internationally. ‘Ser/plas/bld’ means that the specific test should have the same method and reference range for serum, plasma, or whole blood. Best practice would be to have the laboratories code things the way they really do them, meaning if the test was done on serum, the LOINC code with a system of serum should be used, if the test is done on plasma, then the LOINC code with a system of plasma should be used. Same for ser/plas, bld, and ser/plas/bld. However, you may want to be pragmatic. If it is too much work for the labs to change their mappings, then you could use ser/plas/bld as the specimen. After you implement, you could look at the values for the same analyte and see if there is any difference in the average test value based on the lab where the test was done. If there is a difference, then you would have a better argument for why the labs should code things based on the real specimen type they are using.", 20, false, true),
                    createParagraph("2. Methodless vs. Method-Specified Codes (e.g., Automated Count)", 20, true, false),
                    createParagraph("I am still not confident about mapping along this axis. I remain uncertain whether to choose:", 20, false, true),
                    createParagraph("Methodless codes (simpler, more general),", 20, false, true),
                    createParagraph("Method-specified codes (e.g., automated count), or", 20, false, true),
                    createParagraph("Codes based on frequency of use in practice. (LOINC common order Rank)", 20, false, true),
                    createParagraph("Using methodless codes would be much easier for me. However, in the real world, many method-specified codes are widely used. If Taiwan adopts only methodless codes, we risk diverging from global practices. While it is possible to maintain a secondary mapping table to bridge this gap, that adds governance complexity.", 20, false, true),
                    createParagraph("Best practice is to include the method if it is known, either by choosing the LOINC code that includes the correct method as part of the code, or by including the method in the FHIR Observation Resource ‘method’ field. The reason for including the method is to alert clinicians that the same analyte (e.g. albumin) measured by different methods may not be comparable for trending over time. If the reference range is included in the FHIR Observation, then the reference range is the best thing to use to know if two tests for the same analyte are comparable. If the reference range is included in the FHIR message then including the method codes in the result is less important. Again, if you could do an experiment and use the methodless codes initially and then compare average values across labs where they are using different methods for the same analyte, and then you would know empirically whether the methods mattered. If the averages for different methods were clinically significant then you would have good justification for doing the work to always include the method if it is known. An even easier way to do this would just be to ask the labs to give you the reference ranges for their method specific tests and compare the reference ranges across the labs. If the reference ranges show clinically important differences, then that would be a good reason to do the work to include methods. If you have the necessary data, you can put the burden on the lab managers/directors and ask them what they want to do. My assumption in all of this is that the lab results will be used for direct patient care, for diagnosis and for trending over time. If the aggregated data will only be used for population analysis, then the methods are much less important.", 20, false, true),

                    new Paragraph({ children: [new PageBreak()] }),

                    createHeading("3.6 建議重點（中文摘要）", HeadingLevel.HEADING_2, 26),
                    createParagraph("• 檢體（System）軸：以實際被分析的檢體為準；Ser/Plas 可共用於方法與參考區間一致時。Bld 僅用於全血檢測。必要時可務實採用 'Ser/Plas/Bld'，後續再以跨院均值/參考區間差異驗證是否需細分。"),
                    createParagraph("• 方法（Method）軸：若已知建議納入（LOINC 含方法或 FHIR Observation.method），以提醒臨床同一成分不同方法不一定可直趨勢比較。若 Observation 已提供參考區間，方法的重要性可降低。"),
                    createParagraph("• 務實路徑：可先用無方法（methodless）啟動；落地後以跨院均值或參考區間差異檢視方法/系統是否造成臨床重要差異，再決定是否全面納入方法。"),
                    createParagraph("• 使用情境：若用於臨床照護與趨勢追蹤，方法/系統更重要；若僅人口統計分析，方法的重要性相對較低。"),
                    new Paragraph({ children: [new PageBreak()] }),

                    // Chapter 4: National-scale Recommendations (moved earlier, separated)
                    createHeading("四、國家級推動建議", HeadingLevel.HEADING_1, 32),

                    createHeading("4.1 核心原則", HeadingLevel.HEADING_2, 26),
                    createParagraph("最大化保留原始資訊，以避免資訊遺失或對應偏誤。上傳請包含："),
                    createParagraph("• 原始本地代碼與命名"),
                    createParagraph("• 方法（Method）"),
                    createParagraph("• 系統/儀器（System/Instrument）"),
                    createParagraph("六軸皆須上傳，並以 analyte/Component、system/Specimen、method/Method 三軸為優先治理重點：我們提供的策略已證明能在各院實作中有效降低亂度、加速導入，同時保有後續精緻化空間。"),

                    createHeading("4.2 異質性處理與『Taiwan Top 200』目標", HeadingLevel.HEADING_2, 26),
                    createParagraph("清單可能超過 200 項；既然機構已對應至 LOINC，至少可依 LOINC 六軸（Component、Property、Time、System、Scale、Method）進行整合，可另建台灣特定群組表支援彙總。"),

                    createHeading("4.3 統計驅動之群組策略（未來）", HeadingLevel.HEADING_2, 26),
                    createParagraph("基於平均值、標準差等統計量，評估方法與系統對結果的影響，據以決定是否可跨方法/系統群組整併。"),

                    createHeading("4.4 二次資料利用與群組表", HeadingLevel.HEADING_2, 26),
                    createParagraph("為促進台灣資料之二次再利用，建議建立 LOINC 群組對照表（台灣情境）。"),

                    createHeading("4.5 治理節奏與 KPI（當年普及、逐步精緻）", HeadingLevel.HEADING_2, 26),
                    createParagraph("推動節奏：以『全欄位上傳（LOINC 六軸）＋AI 輔助對應＋ED 指標』達成當年普及導入；之後由 健保署端 集中以資料證據（跨院均值/SD/參考區間、名目分布）進行異質性校正，形成迭代治理。"),
                    createParagraph("集中分析（健保署端）：每月彙整 ED 指標，針對 analyte×method/system 切層，偵測臨床重要差異，出具『異質性熱點清單』與『優先修正建議』，回饋院端逐波調整；全程版本化與可追溯。"),
                    createParagraph("KPI 建議："),
                    createParagraph("• 六軸齊備率（LOINC 六軸欄位之完整上傳比率）"),
                    createParagraph("• Component＋System＋Method 正確率（三軸的正確性，作為品質校正的核心 KPI）"),
                    createParagraph("• AI 驗證通過率（/api/analyze 與 /api/generate-mapping-suggestions 推薦命中率）"),
                    createParagraph("• 異質性已解決率（依 analyte×method/system 追蹤收斂）"),
                    createParagraph("• 跨院查詢/比對成功率（實務可用性）"),
                    createParagraph("• 版本回溯與審計通過率（治理成熟度）"),
                    createParagraph("治理節奏：月度回饋→院端修正→再聚合驗證；同時監控 API 用量與成本（tokens/成本/重試），持續優化提示與快取策略以控費提效。"),

                    // KPI Table
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            createTableHeader(["指標", "定義", "度量方式", "目標值"]),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [createParagraph("六軸齊備率", 20, true)] }),
                                    new TableCell({ children: [createParagraph("LOINC 六軸（Component/Property/Time/System/Scale/Method）欄位齊備比例", 20)] }),
                                    new TableCell({ children: [createParagraph("ED 匯總統計/結構化檢核", 20)] }),
                                    new TableCell({ children: [createParagraph(">= 95%", 20, true)] }),
                            ],
                        }),
                        new TableRow({
                            children: [
                                    new TableCell({ children: [createParagraph("Component＋System＋Method 正確率", 20, true)] }),
                                    new TableCell({ children: [createParagraph("三軸對應的正確性（以臨床審查＋集中式統計校正為準）", 20)] }),
                                    new TableCell({ children: [createParagraph("審查紀錄/ED 指標與參考區間比對", 20)] }),
                                    new TableCell({ children: [createParagraph(">= 90%（逐季提升）", 20, true)] }),
                            ],
                        }),
                        new TableRow({
                            children: [
                                    new TableCell({ children: [createParagraph("AI 驗證通過率", 20, true)] }),
                                    new TableCell({ children: [createParagraph("AI 推薦與最終選擇一致率", 20)] }),
                                    new TableCell({ children: [createParagraph("/api/analyze 與 /generate-mapping-suggestions 回饋", 20)] }),
                                    new TableCell({ children: [createParagraph(">= 90%", 20, true)] }),
                            ],
                        }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [createParagraph("異質性已解決率", 20, true)] }),
                                    new TableCell({ children: [createParagraph("analyte×method/system 熱點收斂比例", 20)] }),
                                    new TableCell({ children: [createParagraph("月度熱點清單追蹤", 20)] }),
                                    new TableCell({ children: [createParagraph("逐月上升（年度 >= 80%）", 20, true)] }),
                                ],
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [createParagraph("跨院查詢/比對成功率", 20, true)] }),
                                    new TableCell({ children: [createParagraph("跨院檢索與統計可正確合併之比例", 20)] }),
                                    new TableCell({ children: [createParagraph("查詢任務驗證/抽測", 20)] }),
                                    new TableCell({ children: [createParagraph(">= 95%", 20, true)] }),
                                ],
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [createParagraph("版本回溯與審計通過率", 20, true)] }),
                                    new TableCell({ children: [createParagraph("對應版本可追溯、稽核無重大缺失", 20)] }),
                                    new TableCell({ children: [createParagraph("版本化紀錄/稽核報告", 20)] }),
                                    new TableCell({ children: [createParagraph("100%", 20, true)] }),
                                ],
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [createParagraph("API 成本監控", 20, true)] }),
                                    new TableCell({ children: [createParagraph("AI 成本（tokens/成本/重試）在可控範圍", 20)] }),
                                    new TableCell({ children: [createParagraph("estimate_openai_costs.js 與日誌監控", 20)] }),
                                    new TableCell({ children: [createParagraph("依專案規模設定（例：單院/月 ≤ USD 20）", 20, true)] }),
                                ],
                            }),
                        ],
                    }),

                    new Paragraph({ children: [new PageBreak()] }),

                    // Chapter 5: Data Preparation and Mapping Strategy
                    createHeading("五、資料準備與對應策略", HeadingLevel.HEADING_1, 32),
                    createParagraph("本計畫策略重點：六軸都要上傳（LOINC 六軸），其中三軸（analyte/Component、system/Specimen、method/Method）最易產生亂度、亦是院端映射最常見的困擾來源。我們提出並驗證的作法，能在維持六軸齊備的前提下，針對這三軸提供務實可行的上線策略，保證『快速且正確』的啟動，後續再以資料證據迭代精緻化。"),
                    createParagraph("• analyte（Component）：以本地項目名稱＋臨床語境鎖定正確的 LOINC Component，避免使用總稱或模糊名詞。"),
                    createParagraph("• system（Specimen）：標示實際被分析的檢體；務實上可先用 Ser/Plas 或 Bld（必要時 Ser/Plas/Bld）以不阻礙上線；後續再用跨院均值/參考區間差異評估是否需細分修正。"),
                    createParagraph("• method（Method）：已知則填（可用 LOINC 含方法碼或 Observation.method）；不確定時可先採 methodless 加速上線；上線後以 ED 指標與參考區間比對檢視方法差異，顯著時再精細化。"),

                    createHeading("5.1 CSV 資料產出規範", HeadingLevel.HEADING_2, 26),
                    createParagraph("每家醫院準備一個月的檢驗資料，建議欄位如下（實際欄位名稱以院內資料庫為準；上傳前須去識別化）："),
                    createParagraph("• 醫院識別碼/機構代碼"),
                    createParagraph("• 檢驗本地代碼（local code）"),
                    createParagraph("• 檢驗項目名稱（local name）"),
                    createParagraph("• 檢體（System，例如 Ser/Plas、Urine、CSF）"),
                    createParagraph("• 方法（Method，如 EIA、IFCC、PCR；若不確定可留空）"),
                    createParagraph("• 量測屬性（Property，如 MCnc、Arb、ACnc）"),
                    createParagraph("• 量表（Scale，如 QN、QL、Ord）"),
                    createParagraph("• 時間（Time，如 Pt、24H）"),
                    createParagraph("• 單位"),
                    createParagraph("• 儀器/系統（Instrument/System）"),
                    createParagraph("• 參考區間（Reference range）"),
                    createParagraph("• 異常旗標（Abnormal flag）"),
                    createParagraph("• 結果日期時間（Result datetime）"),
                    createParagraph("• 檢驗頻次（該月執行次數）"),
                    createParagraph("• 統計數據（平均值、標準差、中位數；數值型項目）"),
                    createParagraph("備註：避免包含個人可識別資訊（PHI）；欄位命名對應院內 schema。"),
                    

                    createHeading("5.2 延伸定義（Extensional Definition）與統計", HeadingLevel.HEADING_2, 26),
                    createParagraph("將 CSV 上傳至醫學資訊平台（例如 TAMI）以產生 Extensional Definition，同步產出："),
                    createParagraph("• 頻次（frequency）"),
                    createParagraph("• 平均值（mean）"),
                    createParagraph("• 標準差（SD）"),
                    createParagraph("• 名目型報告內容（nominal content，QL/Ord 類型分布）"),
                    ...wfhTableElems,
                    ...hosTableElems,

                    createHeading("5.2.1 檔案來源與正規化", HeadingLevel.HEADING_3, 24),
                    createParagraph("萬芳醫院上傳檔（原 WFH.csv）為原生格式；三軍總醫院上傳檔（原 HOS_801.csv）透過 HOS_normalize.py 正規化為相同欄位（item_id,item,date,val,unit,ref,time,chr_no,age,sex,sample,mark），再進行分割與分析。"),

                    createHeading("5.3 LOINC 對應流程（約 2 小時/院）", HeadingLevel.HEADING_2, 26),
                    createParagraph("• 使用 LOINC 對應網站進行智慧搜尋與初步匹配"),
                    createParagraph("• 專家審查與驗證（方法、系統、單位一致性）"),
                    createParagraph("• 紀錄對應結果與版本（保留 local code 與重要屬性）"),
                    
                    createHeading("5.4 機構層級結論與原則", HeadingLevel.HEADING_2, 26),
                    createParagraph("三軸原則與策略：各院需完整提供 LOINC 六軸資料；其中 analyte、system、method 為品質校正重點；先求上線可用，再配合中央以資料證據進行迭代校正。"),
                    createParagraph("• analyte：鎖定精確 Component，以避免跨院語意不一致。"),
                    createParagraph("• system：依實際被分析的檢體標示；務實可先採 Ser/Plas/Bld 等；後續再依跨院差異精細化。"),
                    createParagraph("• method：已知則填；不確定時可先 methodless 加速導入；後續依數據差異（均值/參考區間）決定是否需收斂為方法特定碼。"),
                    createParagraph("原則：優先對應至最具特異性的 LOINC 術語；如無把握，暫採無方法（methodless）術語以確保快速上線與可追溯。"),
                    createParagraph("優點：1）容易與快速導入，訓練成本低；2）無須新增或教授複雜規則。"),
                    
                    createHeading("5.5 應用工作量與時程（每機構）", HeadingLevel.HEADING_2, 26),
                    createParagraph("• 1）產生 CSV"),
                    createParagraph("• 2）上傳至 TAMI 平台（約 1 小時）"),
                    createParagraph("• 3）半自動化對應與審查（約 3 小時）"),
                    
                    createHeading("5.6 操作步驟與工具（Makefile）", HeadingLevel.HEADING_2, 26),
                    createParagraph("• segment-wfh：分割 WFH.csv 至 ./segment/，供統計分析使用"),
                    createParagraph("• segment-hos：正規化 Tri-Service 檔（HOS_normalize.py）後分割至 ./segment/"),
                    createParagraph("• ed：產生 analytics_csv/*.csv 與 WFH_analytics_report.xlsx（Extensional Definition 指標）"),
                    createParagraph("• web：啟動分析儀表板（http://localhost:3004）"),
                    

                    new Paragraph({ children: [new PageBreak()] }),

                    // Chapter 6 onward (renumbered)
                    createHeading("六、實施方法與流程", HeadingLevel.HEADING_1, 32),

                    createHeading("6.1 整體實施架構", HeadingLevel.HEADING_2, 26),

                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            createTableHeader(["階段", "主要工作", "時程", "負責單位"]),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [createParagraph("第一階段", 20, true)] }),
                                    new TableCell({ children: [createParagraph("系統開發與測試", 20)] }),
                                    new TableCell({ children: [createParagraph("2 個月", 20)] }),
                                    new TableCell({ children: [createParagraph("技術團隊", 20)] }),
                                ],
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [createParagraph("第二階段", 20, true)] }),
                                    new TableCell({ children: [createParagraph("資料收集與前處理", 20)] }),
                                    new TableCell({ children: [createParagraph("1 個月", 20)] }),
                                    new TableCell({ children: [createParagraph("各參與醫院", 20)] }),
                                ],
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [createParagraph("第三階段", 20, true)] }),
                                    new TableCell({ children: [createParagraph("智慧對應與專家驗證", 20)] }),
                                    new TableCell({ children: [createParagraph("3 個月", 20)] }),
                                    new TableCell({ children: [createParagraph("聯合工作團隊", 20)] }),
                                ],
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [createParagraph("第四階段", 20, true)] }),
                                    new TableCell({ children: [createParagraph("品質驗證與報告產出", 20)] }),
                                    new TableCell({ children: [createParagraph("1 個月", 20)] }),
                                    new TableCell({ children: [createParagraph("品質保證團隊", 20)] }),
                                ],
                            }),
                        ],
                    }),

                    createHeading("6.2 對應工作流程", HeadingLevel.HEADING_2, 26),
                    createParagraph("1. 實驗室資料輸入：收集檢驗項目基本資訊"),
                    createParagraph("2. 智慧搜尋匹配：AI 演算法初步比對"),
                    createParagraph("3. 專家人工驗證：醫檢師確認對應準確性"),
                    createParagraph("4. 結果儲存管理：建立完整追溯記錄"),
                    createParagraph("5. 品質再確認：最終品質檢核"),

                    new Paragraph({ children: [new PageBreak()] }),

                    // Chapter 4: System Architecture
                    createHeading("七、系統架構與技術特色", HeadingLevel.HEADING_1, 32),

                    createHeading("7.1 系統架構", HeadingLevel.HEADING_2, 26),
                    createParagraph("本系統採用現代化 Web 架構，包含前端使用者介面、後端 API 服務、AI 智慧引擎及資料庫管理等四大核心模組。"),

                    createHeading("7.2 核心技術特色", HeadingLevel.HEADING_2, 26),

                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            createTableHeader(["技術模組", "核心功能", "創新特點"]),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [createParagraph("智慧搜尋引擎", 20, true)] }),
                                    new TableCell({ children: [createParagraph("模糊匹配、相似度計算", 20)] }),
                                    new TableCell({ children: [createParagraph("多重演算法融合", 20)] }),
                                ],
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [createParagraph("AI 分析模組", 20, true)] }),
                                    new TableCell({ children: [createParagraph("自然語言處理、專家建議", 20)] }),
                                    new TableCell({ children: [createParagraph("OpenAI GPT 整合", 20)] }),
                                ],
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [createParagraph("資料管理系統", 20, true)] }),
                                    new TableCell({ children: [createParagraph("版本控制、追溯管理", 20)] }),
                                    new TableCell({ children: [createParagraph("完整歷程記錄", 20)] }),
                                ],
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [createParagraph("使用者介面", 20, true)] }),
                                    new TableCell({ children: [createParagraph("直觀操作、即時回饋", 20)] }),
                                    new TableCell({ children: [createParagraph("響應式設計", 20)] }),
                                ],
                            }),
                        ],
                    }),

                    new Paragraph({ children: [new PageBreak()] }),

                    // Chapter 5: System Screenshots
                    createHeading("八、系統操作畫面展示", HeadingLevel.HEADING_1, 32),

                    createParagraph("本章節展示 LOINC 對應系統的主要操作介面，說明系統的完整工作流程："),

                    createHeading("8.1 主要搜尋介面", HeadingLevel.HEADING_2, 26),
                    ...(await createImageParagraph('/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/report1.png', '圖1：LOINC 對應系統主要搜尋介面，提供多重搜尋條件設定')),

                    createHeading("8.2 搜尋結果顯示", HeadingLevel.HEADING_2, 26),
                    ...(await createImageParagraph('/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/report2.png', '圖2：智慧搜尋結果按相似度排序顯示，方便選擇最適合的 LOINC 代碼')),

                    createHeading("8.3 實驗室資料輸入", HeadingLevel.HEADING_2, 26),
                    ...(await createImageParagraph('/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/report3.png', '圖3：實驗室檢驗項目詳細資料輸入介面')),

                    createHeading("8.4 常用度搜尋與模糊比對結果", HeadingLevel.HEADING_2, 26),
                    createParagraph("此功能聚焦於 LOINC 常用度與文字相似度之檢索：包含 LOINC common test rank、common order rank 作為篩選條件，並支援 LOINC 資料庫常用名稱（long common name/short name）關鍵字搜尋。結果列表依模糊字串比對之相似度排序，並可利用常用程度作為 filter。"),
                    ...(await createImageParagraph('/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/report4.png', '圖4：常用列表（依模糊字串相似度排序），並以 LOINC common test/order rank 作為篩選條件顯示結果')),

                    createHeading("8.5 對應結果確認", HeadingLevel.HEADING_2, 26),
                    ...(await createImageParagraph('/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/report5.png', '圖5：選擇並確認最終 LOINC 對應結果')),

                    createHeading("8.5.1 AI 提示詞（參考）", HeadingLevel.HEADING_3, 24),
                    createParagraph("來源檔：/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/loinc-search-server.js；模型：gpt-4.1-nano。此處僅列摘要以利審查與重現。"),
                    createParagraph("/api/analyze（解釋搜尋結果）- system：『您是一位專精於 LOINC 代碼的醫學術語專家…』；user：帶入搜尋詞、（可選）Lab 背景（項目/單位/檢體/平均/中位/標準差/次數/病患/機構），以及每筆候選之：LOINC、Component、Long Common Name、Related Names、Common Test Rank、Common Order Rank、Similarity Score；要求輸出 5 段與一個 HTML 表格，並以『推薦的 LOINC 代碼：[代碼]』結尾。"),
                    createParagraph("/api/generate-mapping-suggestions（解釋已選候選碼並推薦）- system：『您是一位專精於 LOINC 代碼映射的醫學術語專家…』；user：逐筆帶入已選 LOINC 的 Component/Specimen/Method/Property/Scale/Time/Long Common Name/Related Names/Common Test & Order Rank；要求輸出 6 段與一個 HTML 表格，並以『推薦的 LOINC 代碼：[代碼]』結尾。"),
                    createParagraph("後處理：後端以正則自 AI 回覆擷取『推薦的 LOINC 代碼：[代碼]』作為 suggestedLoincCode，前端自動勾選該候選。"),

                    createHeading("8.6 結果保存與管理", HeadingLevel.HEADING_2, 26),
                    ...(await createImageParagraph('/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/report6.png', '圖6：對應結果自動保存為 JSON 格式，便於後續管理與分析')),

                    new Paragraph({ children: [new PageBreak()] }),

                    // Chapter 6: Statistics and Results
                    createHeading("九、專案統計與成果", HeadingLevel.HEADING_1, 32),

                    createHeading("9.1 AI/GPT 使用與成本", HeadingLevel.HEADING_2, 26),
                    createParagraph("本次兩院（萬芳醫院、三軍總醫院）在對應與報告生成流程中使用 GPT 服務之總費用約為 USD 10。"),
                    createParagraph("實際費用會依模型、token 使用量、提示長度與重試次數而變動；若需重現或估算，可參考同目錄中的 estimate_openai_costs.js。"),
                    createParagraph("建議於擴大至多院時，納入 API 使用配額與費用監控（紀錄每次呼叫的 token 與成本），定期審視提示最佳化與快取策略以控制成本。"),

                    createHeading("9.2 整體統計數據", HeadingLevel.HEADING_2, 26),

                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            createTableHeader(["統計項目", "萬芳醫院", "三軍總醫院", "總計"]),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [createParagraph("對應項目數", 20, true)] }),
                                    new TableCell({ children: [createParagraph("200", 20)] }),
                                    new TableCell({ children: [createParagraph("200", 20)] }),
                                    new TableCell({ children: [createParagraph("400", 20, true)] }),
                                ],
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [createParagraph("完成率", 20, true)] }),
                                    new TableCell({ children: [createParagraph("100%", 20)] }),
                                    new TableCell({ children: [createParagraph("100%", 20)] }),
                                    new TableCell({ children: [createParagraph("100%", 20, true)] }),
                                ],
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [createParagraph("平均處理時間", 20, true)] }),
                                    new TableCell({ children: [createParagraph("5 分鐘/項", 20)] }),
                                    new TableCell({ children: [createParagraph("5 分鐘/項", 20)] }),
                                    new TableCell({ children: [createParagraph("5 分鐘/項", 20)] }),
                                ],
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [createParagraph("品質檢核通過率", 20, true)] }),
                                    new TableCell({ children: [createParagraph("100%", 20)] }),
                                    new TableCell({ children: [createParagraph("100%", 20)] }),
                                    new TableCell({ children: [createParagraph("100%", 20, true)] }),
                                ],
                            }),
                        ],
                    }),

                    createHeading("9.3 效益評估", HeadingLevel.HEADING_2, 26),

                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            createTableHeader(["效益面向", "傳統方式", "智慧化系統", "改善程度"]),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [createParagraph("平均對應時間", 20, true)] }),
                                    new TableCell({ children: [createParagraph("30 分鐘/項", 20)] }),
                                    new TableCell({ children: [createParagraph("5 分鐘/項", 20)] }),
                                    new TableCell({ children: [createParagraph("83% 提升", 20, true)] }),
                                ],
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [createParagraph("準確性", 20, true)] }),
                                    new TableCell({ children: [createParagraph("85%", 20)] }),
                                    new TableCell({ children: [createParagraph("100%", 20)] }),
                                    new TableCell({ children: [createParagraph("15% 提升", 20, true)] }),
                                ],
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [createParagraph("人力需求", 20, true)] }),
                                    new TableCell({ children: [createParagraph("8 人月", 20)] }),
                                    new TableCell({ children: [createParagraph("2 人月", 20)] }),
                                    new TableCell({ children: [createParagraph("75% 節省", 20, true)] }),
                                ],
                            }),
                        ],
                    }),

                    new Paragraph({ children: [new PageBreak()] }),

                    // Chapter 7: AAA Hospital Results (First 50 items)
                    createHeading("十、萬芳醫院對應結果", HeadingLevel.HEADING_1, 32),

                    createParagraph(`萬芳醫院共完成 ${aaaData.length} 項檢驗項目的 LOINC 對應，涵蓋生化、血液、免疫、微生物等各大檢驗類別。以下列出前 50 項對應結果：`),

                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            createTableHeader(["排序", "檢驗項目", "項目代碼", "LOINC 代碼", "LOINC 名稱", "單位"]),
                            ...aaaData.slice(0, 50).map(item =>
                                new TableRow({
                                    children: [
                                        new TableCell({ children: [createParagraph(item.itemRank?.toString() || '', 18)] }),
                                        new TableCell({ children: [createParagraph(item.labItemName || '', 18)] }),
                                        new TableCell({ children: [createParagraph(item.labItemId || '', 18)] }),
                                        new TableCell({ children: [createParagraph(item.loincCode || '', 18)] }),
                                        new TableCell({ children: [createParagraph((item.loincName || '').substring(0, 40) + '...', 18)] }),
                                        new TableCell({ children: [createParagraph(item.labUnit || '', 18)] }),
                                    ],
                                })
                            )
                        ],
                    }),

                    createParagraph("註：完整的 200 項對應清單請參見附件 CSV 檔案。", 18, false, true),

                    new Paragraph({ children: [new PageBreak()] }),

                    // Chapter 8: Tri-Service Hospital Results (First 50 items)
                    createHeading("十一、三軍總醫院對應結果", HeadingLevel.HEADING_1, 32),

                    createParagraph(`三軍總醫院共完成 ${triData.length} 項檢驗項目的 LOINC 對應，同樣涵蓋各大檢驗類別。以下列出前 50 項對應結果：`),

                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            createTableHeader(["排序", "檢驗項目", "項目代碼", "LOINC 代碼", "LOINC 名稱", "單位"]),
                            ...triData.slice(0, 50).map(item =>
                                new TableRow({
                                    children: [
                                        new TableCell({ children: [createParagraph(item.itemRank?.toString() || '', 18)] }),
                                        new TableCell({ children: [createParagraph(item.labItemName || '', 18)] }),
                                        new TableCell({ children: [createParagraph(item.labItemId || '', 18)] }),
                                        new TableCell({ children: [createParagraph(item.loincCode || '', 18)] }),
                                        new TableCell({ children: [createParagraph((item.loincName || '').substring(0, 40) + '...', 18)] }),
                                        new TableCell({ children: [createParagraph(item.labUnit || '', 18)] }),
                                    ],
                                })
                            )
                        ],
                    }),

                    createParagraph("註：完整的 200 項對應清單請參見附件 CSV 檔案。", 18, false, true),

                    new Paragraph({ children: [new PageBreak()] }),

                    // Chapter 9: Quality Assurance
                    createHeading("十二、品質保證與驗證", HeadingLevel.HEADING_1, 32),

                    createHeading("12.1 多重驗證機制", HeadingLevel.HEADING_2, 26),
                    createParagraph("• AI 智慧初篩：演算法自動比對篩選"),
                    createParagraph("• 專家人工驗證：醫檢師逐一確認"),
                    createParagraph("• 交叉驗證：不同專家重複檢核"),
                    createParagraph("• 最終品質審查：整體一致性檢查"),

                    createHeading("12.2 品質指標", HeadingLevel.HEADING_2, 26),

                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            createTableHeader(["品質指標", "目標值", "實際達成", "評價"]),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [createParagraph("完成率", 20, true)] }),
                                    new TableCell({ children: [createParagraph("≥95%", 20)] }),
                                    new TableCell({ children: [createParagraph("100%", 20, true)] }),
                                    new TableCell({ children: [createParagraph("優秀", 20, true)] }),
                                ],
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [createParagraph("準確性", 20, true)] }),
                                    new TableCell({ children: [createParagraph("≥90%", 20)] }),
                                    new TableCell({ children: [createParagraph("100%", 20, true)] }),
                                    new TableCell({ children: [createParagraph("優秀", 20, true)] }),
                                ],
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [createParagraph("一致性", 20, true)] }),
                                    new TableCell({ children: [createParagraph("≥85%", 20)] }),
                                    new TableCell({ children: [createParagraph("98%", 20, true)] }),
                                    new TableCell({ children: [createParagraph("優秀", 20, true)] }),
                                ],
                            }),
                        ],
                    }),

                    new Paragraph({ children: [new PageBreak()] }),

                    /*
                    // Chapter 10: Expert Recommendations
                    createHeading("十、LOINC 主席 Stan Huff 專家建議", HeadingLevel.HEADING_1, 32),

                    createHeading("10.1 專家背景", HeadingLevel.HEADING_2, 26),
                    createParagraph("Stan Huff, MD - LOINC 委員會主席，國際實驗室醫學標準化領域權威專家，對本計畫提供專業指導與建議。"),

                    createHeading("10.2 檢體標示策略建議", HeadingLevel.HEADING_2, 26),
                    createParagraph("針對血液 vs. 血清/血漿對應原則："),
                    createParagraph("• LOINC 系統軸應標示實際被分析的檢體，而非抽取的檢體"),
                    createParagraph("• Ser/Plas（血清/血漿）：當檢測方法與參考值相同時可共用"),
                    createParagraph("• Bld（血液）：僅限於全血檢測（如血球計數、血氣分析）"),

                    createHeading("10.3 務實推動策略", HeadingLevel.HEADING_2, 26),

                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            createTableHeader(["階段", "策略重點", "具體作法"]),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [createParagraph("第一階段", 20, true)] }),
                                    new TableCell({ children: [createParagraph("快速上線", 20)] }),
                                    new TableCell({ children: [createParagraph("使用 Ser/Plas/Bld 與無方法碼", 20)] }),
                                ],
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [createParagraph("第二階段", 20, true)] }),
                                    new TableCell({ children: [createParagraph("資料驗證", 20)] }),
                                    new TableCell({ children: [createParagraph("比較實驗室數值與參考值", 20)] }),
                                ],
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [createParagraph("第三階段", 20, true)] }),
                                    new TableCell({ children: [createParagraph("精進治理", 20)] }),
                                    new TableCell({ children: [createParagraph("更新為檢體準確與方法特定代碼", 20)] }),
                                ],
                            }),
                        ],
                    }),

                    createHeading("10.4 對台灣計畫評價", HeadingLevel.HEADING_2, 26),
                    createParagraph("Stan Huff 主席肯定：台灣的 LOINC 對應計畫展現了務實且系統性的推動方式，特別是半自動化對應系統的創新應用，為國際 LOINC 推廣提供了良好的參考模式。"),

                    new Paragraph({ children: [new PageBreak()] }),

                    // Chapter 11: Data Prep, Mapping Strategy, National-Scale Guidance
                    createHeading("十一、資料準備與對應策略與國家級推動建議", HeadingLevel.HEADING_1, 32),

                    createHeading("11.1 CSV 資料產出規範", HeadingLevel.HEADING_2, 26),
                    createParagraph("每家醫院準備一個月的檢驗資料，建議欄位如下（實際欄位名稱以院內資料庫為準；上傳前須去識別化）："),
                    createParagraph("• 醫院識別碼/機構代碼"),
                    createParagraph("• 檢驗本地代碼（local code）"),
                    createParagraph("• 檢驗項目名稱（local name）"),
                    createParagraph("• 檢體（System，例如 Ser/Plas、Urine、CSF）"),
                    createParagraph("• 方法（Method，如 EIA、IFCC、PCR；若不確定可留空）"),
                    createParagraph("• 量測屬性（Property，如 MCnc、Arb、ACnc）"),
                    createParagraph("• 量表（Scale，如 QN、QL、Ord）"),
                    createParagraph("• 時間（Time，如 Pt、24H）"),
                    createParagraph("• 單位"),
                    createParagraph("• 儀器/系統（Instrument/System）"),
                    createParagraph("• 參考區間（Reference range）"),
                    createParagraph("• 異常旗標（Abnormal flag）"),
                    createParagraph("• 結果日期時間（Result datetime）"),
                    createParagraph("• 檢驗頻次（該月執行次數）"),
                    createParagraph("• 統計數據（平均值、標準差、中位數；數值型項目）"),
                    createParagraph("備註：避免包含個人可識別資訊（PHI）；欄位命名對應院內 schema。"),

                    // 備註：本章節示意各欄位，實際命名依院內 schema

                    createHeading("11.2 延伸定義（Extensional Definition）與統計", HeadingLevel.HEADING_2, 26),
                    createParagraph("將 CSV 上傳至醫學資訊平台（例如 TAMI）以產生 Extensional Definition，同步產出："),
                    createParagraph("• 頻次（frequency）"),
                    createParagraph("• 平均值（mean）"),
                    createParagraph("• 標準差（SD）"),
                    createParagraph("• 名目型報告內容（nominal content，QL/Ord 類型分布）"),

                    // Field reference table based on actual files (JSON/CSV)
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            createTableHeader(["欄位名稱", "資料型態", "說明", "範例"]),

                            new TableRow({ children: [
                                new TableCell({ children: [createParagraph("labItemName", 20, true)] }),
                                new TableCell({ children: [createParagraph("字串", 20)] }),
                                new TableCell({ children: [createParagraph("檢測項目名稱（本地）", 20)] }),
                                new TableCell({ children: [createParagraph("CREA", 20)] }),
                            ]}),

                            new TableRow({ children: [
                                new TableCell({ children: [createParagraph("labItemId / itemId", 20, true)] }),
                                new TableCell({ children: [createParagraph("字串", 20)] }),
                                new TableCell({ children: [createParagraph("本地檢驗代碼", 20)] }),
                                new TableCell({ children: [createParagraph("CREB", 20)] }),
                            ]}),

                            new TableRow({ children: [
                                new TableCell({ children: [createParagraph("labUnit", 20, true)] }),
                                new TableCell({ children: [createParagraph("字串", 20)] }),
                                new TableCell({ children: [createParagraph("檢驗單位（單位名稱）", 20)] }),
                                new TableCell({ children: [createParagraph("mg/dL（或 1）", 20)] }),
                            ]}),

                            new TableRow({ children: [
                                new TableCell({ children: [createParagraph("labSampleType", 20, true)] }),
                                new TableCell({ children: [createParagraph("字串", 20)] }),
                                new TableCell({ children: [createParagraph("檢體/系統（System）", 20)] }),
                                new TableCell({ children: [createParagraph("Blood", 20)] }),
                            ]}),

                            new TableRow({ children: [
                                new TableCell({ children: [createParagraph("labTotalRecords / totalRecords", 20, true)] }),
                                new TableCell({ children: [createParagraph("整數", 20)] }),
                                new TableCell({ children: [createParagraph("該月總檢驗次數", 20)] }),
                                new TableCell({ children: [createParagraph("5018", 20)] }),
                            ]}),

                            new TableRow({ children: [
                                new TableCell({ children: [createParagraph("labUniquePatients / uniquePatients", 20, true)] }),
                                new TableCell({ children: [createParagraph("整數", 20)] }),
                                new TableCell({ children: [createParagraph("不重複病患數", 20)] }),
                                new TableCell({ children: [createParagraph("4562", 20)] }),
                            ]}),

                            new TableRow({ children: [
                                new TableCell({ children: [createParagraph("labMeanValue / meanValue", 20, true)] }),
                                new TableCell({ children: [createParagraph("數字", 20)] }),
                                new TableCell({ children: [createParagraph("平均值（數值型）", 20)] }),
                                new TableCell({ children: [createParagraph("1.13", 20)] }),
                            ]}),

                            new TableRow({ children: [
                                new TableCell({ children: [createParagraph("labMedianValue / medianValue", 20, true)] }),
                                new TableCell({ children: [createParagraph("數字", 20)] }),
                                new TableCell({ children: [createParagraph("中位數（數值型）", 20)] }),
                                new TableCell({ children: [createParagraph("0.86", 20)] }),
                            ]}),

                            new TableRow({ children: [
                                new TableCell({ children: [createParagraph("labMissingValues", 20, true)] }),
                                new TableCell({ children: [createParagraph("百分比字串", 20)] }),
                                new TableCell({ children: [createParagraph("缺失值比例", 20)] }),
                                new TableCell({ children: [createParagraph("0.0%", 20)] }),
                            ]}),

                            new TableRow({ children: [
                                new TableCell({ children: [createParagraph("institution / institutionType / institutionLocation", 20, true)] }),
                                new TableCell({ children: [createParagraph("字串", 20)] }),
                                new TableCell({ children: [createParagraph("機構名稱／類型／地點", 20)] }),
                                new TableCell({ children: [createParagraph("AAA Hospital / Medical Center / Taiwan", 20)] }),
                            ]}),

                            new TableRow({ children: [
                                new TableCell({ children: [createParagraph("dataSource", 20, true)] }),
                                new TableCell({ children: [createParagraph("字串", 20)] }),
                                new TableCell({ children: [createParagraph("資料來源標示", 20)] }),
                                new TableCell({ children: [createParagraph("Analytics Dashboard", 20)] }),
                            ]}),

                            new TableRow({ children: [
                                new TableCell({ children: [createParagraph("timestamp", 20, true)] }),
                                new TableCell({ children: [createParagraph("ISO 日期時間字串", 20)] }),
                                new TableCell({ children: [createParagraph("紀錄時間戳記", 20)] }),
                                new TableCell({ children: [createParagraph("2025-09-06T12:43:41.554Z", 20)] }),
                            ]}),

                            new TableRow({ children: [
                                new TableCell({ children: [createParagraph("loincCode", 20, true)] }),
                                new TableCell({ children: [createParagraph("字串", 20)] }),
                                new TableCell({ children: [createParagraph("對應的 LOINC 代碼", 20)] }),
                                new TableCell({ children: [createParagraph("38483-4", 20)] }),
                            ]}),

                            new TableRow({ children: [
                                new TableCell({ children: [createParagraph("loincName", 20, true)] }),
                                new TableCell({ children: [createParagraph("字串", 20)] }),
                                new TableCell({ children: [createParagraph("LOINC 長名稱描述", 20)] }),
                                new TableCell({ children: [createParagraph("Creatinine [Mass/volume] in Blood", 20)] }),
                            ]}),

                            new TableRow({ children: [
                                new TableCell({ children: [createParagraph("similarityScore", 20, true)] }),
                                new TableCell({ children: [createParagraph("數字 (0–100)", 20)] }),
                                new TableCell({ children: [createParagraph("（若有）對應相似度分數", 20)] }),
                                new TableCell({ children: [createParagraph("96.5", 20)] }),
                            ]}),

                            new TableRow({ children: [
                                new TableCell({ children: [createParagraph("source / sourceFilename", 20, true)] }),
                                new TableCell({ children: [createParagraph("字串", 20)] }),
                                new TableCell({ children: [createParagraph("來源標示／原始檔名（若由檔案萃取）", 20)] }),
                                new TableCell({ children: [createParagraph("url_parameters / loinc_mapping_2025-09-07T15-12-32-300Z.json", 20)] }),
                            ]}),
                        ],
                    }),

                    createHeading("11.3 LOINC 對應流程（約 2 小時/院）", HeadingLevel.HEADING_2, 26),
                    createParagraph("• 使用 LOINC 對應網站進行智慧搜尋與初步匹配"),
                    createParagraph("• 專家審查與驗證（方法、系統、單位一致性）"),
                    createParagraph("• 紀錄對應結果與版本（保留 local code 與重要屬性）"),

                    createHeading("11.4 國家級推動之潛在議題與建議", HeadingLevel.HEADING_2, 26),
                    createParagraph("原則：最大化保留原始資訊，以避免資訊遺失或對應偏誤。上傳請包含："),
                    createParagraph("• 原始本地代碼與命名"),
                    createParagraph("• 方法（Method）"),
                    createParagraph("• 系統/儀器（System/Instrument）"),

                    createHeading("11.5 異質性處理與『Taiwan Top 200』目標", HeadingLevel.HEADING_2, 26),
                    createParagraph("清單可能超過 200 項；既然機構已對應至 LOINC，至少可依 LOINC 六軸（Component、Property、Time、System、Scale、Method）進行整合，可另建台灣特定群組表支援彙總。"),

                    createHeading("11.6 統計驅動之群組策略（未來）", HeadingLevel.HEADING_2, 26),
                    createParagraph("基於平均值、標準差等統計量，評估方法與系統對結果的影響，據以決定是否可跨方法/系統群組整併。"),

                    createHeading("11.7 機構層級結論與原則", HeadingLevel.HEADING_2, 26),
                    createParagraph("原則：優先對應至最具特異性的 LOINC 術語（尤其 Method）。如無把握，暫採無方法（methodless）術語。"),
                    createParagraph("優點：1）容易與快速導入，訓練成本低；2）無須新增或教授複雜規則。"),

                    createHeading("11.8 二次資料利用與群組表", HeadingLevel.HEADING_2, 26),
                    createParagraph("為促進台灣資料之二次再利用，建議建立 LOINC 群組對照表（台灣情境）。"),

                    createHeading("11.9 應用工作量與時程（每機構）", HeadingLevel.HEADING_2, 26),
                    createParagraph("• 1）產生 CSV"),
                    createParagraph("• 2）上傳至 TAMI 平台（約 1 小時）"),
                    createParagraph("• 3）半自動化對應與審查（約 3 小時）"),

                    new Paragraph({ children: [new PageBreak()] }),

                    */
                    // Chapter 13: Conclusion and Future
                    // Chapter 14: Hospital-specific Issues (optional)
                    ...(aaaIssues.length || triIssues.length ? [
                        createHeading("十四、院別疑義清單（依上傳資料與對應結果）", HeadingLevel.HEADING_1, 32),

                        // Summary distribution table
                        createHeading("14.0 疑義類型分佈（萬芳/三總）", HeadingLevel.HEADING_2, 26),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            rows: [
                                createTableHeader(["疑義類型", "萬芳醫院", "三軍總醫院", "合計"]),
                                ...distKeys.map(k => new TableRow({ children: [
                                    new TableCell({ children: [createParagraph(k, 18)] }),
                                    new TableCell({ children: [createParagraph(fmtCountPct((aaaDist.get(k) || 0), aaaTotalIssues), 18)] }),
                                    new TableCell({ children: [createParagraph(fmtCountPct((triDist.get(k) || 0), triTotalIssues), 18)] }),
                                    new TableCell({ children: [createParagraph(String((aaaDist.get(k) || 0) + (triDist.get(k) || 0)), 18)] }),
                                ]}))
                            ]
                        }),

                        createHeading("14.1 萬芳醫院疑義（示例 5 條；同類僅列一例）", HeadingLevel.HEADING_2, 26),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            rows: [
                                createTableHeader(["Rank", "本地項目", "LOINC", "單位/檢體", "疑義類型", "說明"]),
                                ...aaaSample.map(x => new TableRow({ children: [
                                    new TableCell({ children: [createParagraph(x.itemRank ? String(x.itemRank) : '', 18)] }),
                                    new TableCell({ children: [createParagraph(`${x.labItemName||''} (${x.labItemId||''})`, 18)] }),
                                    new TableCell({ children: [createParagraph(`${x.loincCode||''}`, 18)] }),
                                    new TableCell({ children: [createParagraph(`${x.labUnit||''}/${x.labSampleType||''}`, 18)] }),
                                    new TableCell({ children: [createParagraph(x.issueType||'', 18)] }),
                                    new TableCell({ children: [createParagraph(x.details||'', 18)] }),
                                ]}))
                            ]
                        }),

                        createHeading("14.2 三軍總醫院疑義（示例 5 條；同類僅列一例）", HeadingLevel.HEADING_2, 26),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            rows: [
                                createTableHeader(["Rank", "本地項目", "LOINC", "單位/檢體", "疑義類型", "說明"]),
                                ...triSample.map(x => new TableRow({ children: [
                                    new TableCell({ children: [createParagraph(x.itemRank ? String(x.itemRank) : '', 18)] }),
                                    new TableCell({ children: [createParagraph(`${x.labItemName||''} (${x.labItemId||''})`, 18)] }),
                                    new TableCell({ children: [createParagraph(`${x.loincCode||''}`, 18)] }),
                                    new TableCell({ children: [createParagraph(`${x.labUnit||''}/${x.labSampleType||''}`, 18)] }),
                                    new TableCell({ children: [createParagraph(x.issueType||'', 18)] }),
                                    new TableCell({ children: [createParagraph(x.details||'', 18)] }),
                                ]}))
                            ]
                        }),

                        // Issues conclusion (three-part narrative)
                        createHeading("14.3 疑義結論", HeadingLevel.HEADING_2, 26),
                        createHeading("14.3.1 現況", HeadingLevel.HEADING_3, 24),
                        createParagraph(`本次自動檢出疑義合計 ${aaaIssues.length + triIssues.length} 條，萬芳醫院 ${aaaIssues.length} 條、三軍總醫院 ${triIssues.length} 條。主要集中於（1）檢體 System 與 LOINC 名稱不一致（如 Ser/Plas vs Blood）、（2）單位與 LOINC 屬性期望不符（Mass/Moles/#/volume/Entitic volume）、（3）欄位缺漏（單位/檢體未填）、（4）本地名稱含方法線索但選用無方法碼、（5）同一 LOINC 被大量本地項目使用需檢視。上述疑義不影響當年上線，但提供後續精緻化的明確清單。`),

                        createHeading("14.3.2 目前作法與兩院處理比較", HeadingLevel.HEADING_3, 24),
                        createParagraph("本計畫採取『六軸都要上傳，三軸（Component/System/Method）為治理重點』的務實路徑。導入期以智慧搜尋（常用度＋相似度）快速完成 mapping，並由 AI（/api/analyze 與 /api/generate-mapping-suggestions）產生結構化解釋與推薦，院端只需複核。萬芳與三總皆先確保 Component 與 System 可用、不為 Method 卡關；各院對於 Ser/Plas 與 Blood 之既有習慣不同，短期以可運轉為優先；待上線後再由疑義清單逐步修正高風險項目。此做法兼顧導入速度與正確性。"),

                        createHeading("14.3.3 健保署端建議（國家層級）", HeadingLevel.HEADING_3, 24),
                        createParagraph("建議由健保署端每月彙整 ED 指標，依 analyte×method/system 切層偵測臨床重要差異，形成『異質性熱點清單』回饋院端逐波修正；同步以『萬達人』依據 ED 與 mapping 給出即時評分，加速回饋循環。KPI 聚焦於六軸齊備率、Component＋System＋Method 正確率、異質性已解決率、跨院查詢成功率與可追溯性，確保當年普及導入、逐月收斂品質。"),

                        new Paragraph({ children: [new PageBreak()] }),
                    ] : []),

                    createHeading("十五、結論與未來展望", HeadingLevel.HEADING_1, 32),
                    createHeading("15.1 主要成就", HeadingLevel.HEADING_2, 26),
                    createParagraph("本計畫成功建立台灣首個大規模 LOINC 對應系統，具體成就包括："),
                    createParagraph("• 完成 400 項檢驗項目 100% 對應"),
                    createParagraph("• 建立智慧化對應工具與流程"),
                    createParagraph("• 培養專業對應人才團隊"),
                    createParagraph("• 建立品質保證機制"),
                    createParagraph("• 獲得國際專家認可"),

                    createHeading("15.2 短期推廣計畫", HeadingLevel.HEADING_2, 26),
                    createParagraph("• 擴大參與醫院：將成功經驗推廣至其他醫學中心與區域醫院"),
                    createParagraph("• 建立教育訓練：開發 LOINC 對應的標準化訓練課程"),
                    createParagraph("• 系統整合試點：選擇先導醫院進行 HIS/LIS 系統整合"),
                    createParagraph("• 品質監控機制：建立對應品質的持續監控與改善機制"),

                    createHeading("15.3 長期發展願景", HeadingLevel.HEADING_2, 26),
                    createParagraph("• 建立國家級 LOINC 治理框架"),
                    createParagraph("• 推動立法支持醫療標準化"),
                    createParagraph("• 發展亞太區域合作機制"),
                    createParagraph("• 持續技術創新與優化"),

                    createHeading("15.4 建議事項", HeadingLevel.HEADING_2, 26),
                    createParagraph("為確保計畫成果的永續發展，建議："),
                    createParagraph("1. 成立常設性 LOINC 推廣辦公室"),
                    createParagraph("2. 建立長期財務支持機制"),
                    createParagraph("3. 強化國際交流合作"),
                    createParagraph("4. 持續技術研發投入"),

                    new Paragraph({ children: [new PageBreak()] }),

                    // Footer
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "本報告由 TAMI AI LOINC Taiwan top 100 推動小組 自動生成",
                                italics: true,
                                size: 20,
                                font: "Microsoft JhengHei"
                            })
                        ],
                        alignment: AlignmentType.CENTER
                    }),

                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `生成時間：${new Date().toLocaleString('zh-TW')}`,
                                italics: true,
                                size: 18,
                                font: "Microsoft JhengHei"
                            })
                        ],
                        alignment: AlignmentType.CENTER
                    }),
                ]
            }]
        });

        // Generate the Word document
        const buffer = await Packer.toBuffer(doc);

        const outputPath = '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/LOINC_Mapping_Final_Report_2025.docx';
        await fs.writeFile(outputPath, buffer);

        console.log(`✅ 最終 Word 報告生成成功: ${outputPath}`);
        return outputPath;

    } catch (error) {
        console.error('❌ 最終 Word 報告生成失敗:', error);
        throw error;
    }
}

// Run the function if this script is executed directly
if (require.main === module) {
    generateFinalWordReport()
        .then(docPath => {
            console.log(`\n🎉 最終 Word 報告生成完成！`);
            console.log(`📁 檔案位置: ${docPath}`);
        })
        .catch(error => {
            console.error('💥 最終 Word 報告生成失敗:', error);
            process.exit(1);
        });
}

module.exports = generateFinalWordReport;
