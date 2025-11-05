const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  WidthType,
  ShadingType,
  ImageRun,
  PageBreak,
  TableLayoutType,
} = require('docx');
const cp = require('child_process');

async function generateTemplateAlignedWordReport() {
  try {
    const baseDir = '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC';

    // Load data
    const aaaData = JSON.parse(fs.readFileSync(path.join(baseDir, 'aaa_hospital_final_200.json'), 'utf8'));
    const triData = JSON.parse(fs.readFileSync(path.join(baseDir, 'tri_service_final_200.json'), 'utf8'));
    let crossAnalysis = null;
    try {
      crossAnalysis = JSON.parse(fs.readFileSync(path.join(baseDir, 'cross_analysis_results.json'), 'utf8'));
    } catch {}
    const aaaIssuesText = fs.existsSync(path.join(baseDir, 'aaa_hospital_missing_ranks.txt'))
      ? fs.readFileSync(path.join(baseDir, 'aaa_hospital_missing_ranks.txt'), 'utf8')
      : '';
    const triIssuesText = fs.existsSync(path.join(baseDir, 'tri_service_missing_ranks.txt'))
      ? fs.readFileSync(path.join(baseDir, 'tri_service_missing_ranks.txt'), 'utf8')
      : '';

    const totalItems = aaaData.length + triData.length;
    const todayStr = new Date().toLocaleDateString('zh-TW');

    // Helpers
    const createHeading = (text, level = HeadingLevel.HEADING_1, size = 28) =>
      new Paragraph({ children: [new TextRun({ text, bold: true, size, font: 'Microsoft JhengHei' })], heading: level });

    const createParagraph = (text, size = 22, opts = {}) =>
      new Paragraph({
        children: [
          new TextRun({
            text,
            size,
            font: 'Microsoft JhengHei',
            bold: !!opts.bold,
            italics: !!opts.italics,
          }),
        ],
        alignment: opts.align || AlignmentType.LEFT,
      });

    // De-duplicate paragraph-level content across the whole document
    const seen = new Set();
    const normalize = (s) => (s || '')
      .replace(/[ \t\u00A0\u3000]+/g, ' ')
      .replace(/\.{5,}/g, '.')
      .replace(/[\r\n]+/g, ' ')
      .trim()
      .toLowerCase();
    const addP = (text, size = 22, opts = {}) => {
      const n = normalize(text);
      if (!n) return null;
      if (seen.has(n)) return null;
      seen.add(n);
      return createParagraph(text, size, opts);
    };
    const pushNodes = (arr, ...nodes) => {
      nodes.filter(Boolean).forEach((n) => arr.push(n));
    };

    const createTableHeader = (headers) =>
      new TableRow({
        children: headers.map((h) =>
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: h, bold: true, font: 'Microsoft JhengHei', size: 20 })],
              }),
            ],
            shading: { fill: 'CCCCCC', type: ShadingType.SOLID },
          })
        ),
      });

    const createImageBlock = (imgPath, caption, width = 600, height = 340) => {
      try {
        const data = fs.readFileSync(imgPath);
        return [
          new Paragraph({
            children: [
              new ImageRun({ data, transformation: { width, height } }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          createParagraph(caption || '', 18, { italics: true, align: AlignmentType.CENTER }),
        ];
      } catch (e) {
        return [createParagraph(`[圖片載入失敗: ${path.basename(imgPath)}]`, 18, { italics: true, align: AlignmentType.CENTER })];
      }
    };

    // Extract template text per section from DOCX
    const templatePath = path.join(baseDir, '健保署 LOINC Mapping 計畫_Template.docx');
    let tmplSections = {};
    try {
      const xml = cp.execFileSync('unzip', ['-p', templatePath, 'word/document.xml'], { encoding: 'utf8' });
      // Split by paragraph blocks and join their text runs so we don't insert per-character lines
      const paraBlocks = xml.split(/<w:p[\s\S]*?>|<\/w:p>/).filter(Boolean);
      const paragraphs = [];
      for (const block of paraBlocks) {
        const runs = [];
        const reT = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
        let mm;
        while ((mm = reT.exec(block))) {
          const t = mm[1]
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');
          if (t) runs.push(t);
        }
        const joined = runs.join('');
        const trimmed = joined.trim();
        if (trimmed) paragraphs.push(trimmed);
      }

      const headings = [
        '一、執行摘要',
        '二、計畫背景與目標',
        '三、LOINC 主席 Stan Huff 專家建議',
        '四、國家級推動建議',
        '五、資料準備與對應策略',
        '六、實施方法與流程',
        '七、系統架構與技術特色',
        '八、系統操作畫面展示',
        '九、專案統計與成果',
        '十、萬芳醫院對應結果',
        '十一、三軍總醫院對應結果',
        '十二、品質保證與驗證',
        '十四、院別疑義清單（依上傳資料與對應結果）',
        '十五、結論與未來展望',
      ];
      const findLastIndex = (arr, pred) => {
        for (let i = arr.length - 1; i >= 0; i--) if (pred(arr[i], i)) return i;
        return -1;
      };
      const idx = {};
      headings.forEach((h) => { idx[h] = findLastIndex(paragraphs, (p) => p === h); }); // use body headings (last occurrence)
      headings.forEach((h, i) => {
        const start = idx[h];
        if (start >= 0) {
          let end = paragraphs.length;
          for (let j = i + 1; j < headings.length; j++) {
            const nIdx = idx[headings[j]];
            if (nIdx > start) { end = nIdx; break; }
          }
          // slice after heading, drop any residual TOC dot-leader lines
          const content = paragraphs
            .slice(start + 1, end)
            .filter((s) => !/\.{5,}/.test(s))
            .filter((s) => s.length > 0);
          tmplSections[h] = content;
        }
      });
    } catch (e) {
      console.warn('無法解析模板內容，將僅輸出動態內容：', e.message);
      tmplSections = {};
    }

    const addTemplateParas = (childrenArr, headingText) => {
      const arr = tmplSections[headingText];
      if (!arr || arr.length === 0) return;
      arr.slice(0, 200).forEach((line) => childrenArr.push(createParagraph(line, 22)));
    };

    // Build content nodes first
    const children = [];

    // Cover
    pushNodes(children,
      new Paragraph({
        children: [new TextRun({ text: '健保署 LOINC Mapping 計畫', bold: true, size: 36, font: 'Microsoft JhengHei' })],
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
      }),
      addP('完整實施報告', 32, { bold: true, align: AlignmentType.CENTER }),
      addP('Taiwan LOINC Implementation Project', 24, { italics: true, align: AlignmentType.CENTER }),
      addP('Complete Implementation Report', 20, { italics: true, align: AlignmentType.CENTER }),
      addP('TAMI AI LOINC Taiwan top 100 推動小組', 22, { italics: true, align: AlignmentType.CENTER }),
      addP(`報告生成日期：${todayStr}`, 22, { align: AlignmentType.CENTER }),
      addP('參與機構：萬芳醫院、三軍總醫院', 22, { align: AlignmentType.CENTER }),
      new Paragraph({ children: [new PageBreak()] }),

      // Add opening message
      addP('經檢視您昨日提供之資料，', 22),
      addP(''),
      addP('成果報告內容需請您補充參與特約醫事服務機構疑義、專家諮詢結果(或建議)、整體導入之成本(包括資訊成本、人力成本、時間及設備)、後續品質確保及資訊需求，', 22),
      addP(''),
      addP('請於9/29前提供，謝謝。', 22),
      new Paragraph({ children: [new PageBreak()] })
    );

    // 一、執行摘要
    pushNodes(children,
      createHeading('一、執行摘要', HeadingLevel.HEADING_1, 32),
      ...(addTemplateParas(children, '一、執行摘要'), []),
      addP('兩家醫學中心完成 Top 200 檢驗項目的完整對應，達成 100% 完成率。'),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          createTableHeader(['指標', '數值']),
          new TableRow({ children: [new TableCell({ children: [createParagraph('參與醫院', 20)] }), new TableCell({ children: [createParagraph('2', 20, { bold: true })] })] }),
          new TableRow({ children: [new TableCell({ children: [createParagraph('總對應項目', 20)] }), new TableCell({ children: [createParagraph(String(totalItems), 20, { bold: true })] })] }),
          new TableRow({ children: [new TableCell({ children: [createParagraph('完成率', 20)] }), new TableCell({ children: [createParagraph('100%', 20, { bold: true })] })] }),
        ],
      })
    );

    // 二、計畫背景與目標
    pushNodes(children,
      createHeading('二、計畫背景與目標', HeadingLevel.HEADING_1, 32),
      ...(addTemplateParas(children, '二、計畫背景與目標'), []),
      addP('LOINC 為國際通用之檢驗與臨床觀察標準代碼系統，推動本計畫以提升資料互通與再利用。'),
      addP('本計畫目標：'),
      addP('• 完成兩家醫學中心 Top 200 檢驗項目的 LOINC 對應', 22),
      addP('• 建立標準化流程、品質保證機制與審計軌跡', 22),
      addP('• 形成可全國推廣之治理與技術作法', 22)
    );

    // 三、LOINC 主席 Stan Huff 專家建議
    pushNodes(children,
      createHeading('三、LOINC 主席 Stan Huff 專家建議', HeadingLevel.HEADING_1, 32),
      ...(addTemplateParas(children, '三、LOINC 主席 Stan Huff 專家建議'), []),
      addP('• 檢體標示原則：Ser/Plas 在方法與參考值一致時可共用；Bld 僅限全血檢測', 22),
      addP('• 對應策略：機構層級鼓勵對應至最具體 LOINC；研究層級以群組表彈性聚合', 22)
    );

    // 四、國家級推動建議
    pushNodes(children,
      createHeading('四、國家級推動建議', HeadingLevel.HEADING_1, 32),
      ...(addTemplateParas(children, '四、國家級推動建議'), []),
      addP('• 建立國家級 LOINC 治理框架與最佳實務指引', 22),
      addP('• 階段性推廣：示範醫院 → 主要醫院 → 全國', 22)
    );

    // 五、資料準備與對應策略
    pushNodes(children,
      createHeading('五、資料準備與對應策略', HeadingLevel.HEADING_1, 32),
      ...(addTemplateParas(children, '五、資料準備與對應策略'), []),
      addP('資料準備：建立標準 CSV 欄位、清理重複、補齊缺漏、校正一致性。'),
      addP('對應策略：以名稱/檢體/單位為核心，方法碼依院所策略彈性採用；AI 輔助、專家確認、交叉驗證。')
    );

    // 六、實施方法與流程
    pushNodes(children,
      createHeading('六、實施方法與流程', HeadingLevel.HEADING_1, 32),
      ...(addTemplateParas(children, '六、實施方法與流程'), []),
      addP('1. 輸入搜尋條件 → 2. 智能搜尋 → 3. 瀏覽候選結果 → 4. 選擇最佳對應 → 5. AI 深度分析（選用） → 6. 專家確認 → 7. 保存結果')
    );

    // 七、系統架構與技術特色
    children.push(
      createHeading('七、系統架構與技術特色', HeadingLevel.HEADING_1, 32),
      ...(addTemplateParas(children, '七、系統架構與技術特色'), []),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        columnWidths: [1600, 2600, 5200],
        rows: [
          createTableHeader(['層級', '組件', '功能']),
          new TableRow({ children: [new TableCell({ children: [createParagraph('前端', 20, { bold: true })] }), new TableCell({ children: [createParagraph('Web 介面', 20)] }), new TableCell({ children: [createParagraph('條件設定、搜尋與結果檢視', 20)] })] }),
          new TableRow({ children: [new TableCell({ children: [createParagraph('後端', 20, { bold: true })] }), new TableCell({ children: [createParagraph('搜尋與比對服務', 20)] }), new TableCell({ children: [createParagraph('多欄位相似度排序與規則比對', 20)] })] }),
          new TableRow({ children: [new TableCell({ children: [createParagraph('資料', 20, { bold: true })] }), new TableCell({ children: [createParagraph('索引與結果庫', 20)] }), new TableCell({ children: [createParagraph('候選 LOINC 與對應紀錄保存', 20)] })] }),
          new TableRow({ children: [new TableCell({ children: [createParagraph('AI', 20, { bold: true })] }), new TableCell({ children: [createParagraph('分析 API', 20)] }), new TableCell({ children: [createParagraph('對應建議與決策支援', 20)] })] }),
        ],
      })
    );

    // 八、系統操作畫面展示（插圖）
    pushNodes(children, createHeading('八、系統操作畫面展示', HeadingLevel.HEADING_1, 32));
    addTemplateParas(children, '八、系統操作畫面展示');
    ['report1.png', 'report2.png', 'report3.png'].forEach((f, idx) => {
      const p = path.join(baseDir, f);
      const blocks = createImageBlock(p, `圖${idx + 1}`);
      blocks.forEach((b) => children.push(b));
    });
    children.push(new Paragraph({ children: [new PageBreak()] }));

    // 九、專案統計與成果
    pushNodes(children,
      createHeading('九、專案統計與成果', HeadingLevel.HEADING_1, 32),
      ...(addTemplateParas(children, '九、專案統計與成果'), []),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        columnWidths: [2200, 1200, 1400, 1400, 1000, 1200],
        rows: [
          createTableHeader(['醫院', '檔案數', '有效項目', '排名覆蓋', '缺漏', '完成率']),
          new TableRow({ children: [new TableCell({ children: [createParagraph('萬芳醫院', 20, { bold: true })] }), new TableCell({ children: [createParagraph('202', 20)] }), new TableCell({ children: [createParagraph(String(aaaData.length), 20)] }), new TableCell({ children: [createParagraph('1-200', 20)] }), new TableCell({ children: [createParagraph('0', 20)] }), new TableCell({ children: [createParagraph('100%', 20, { bold: true })] })] }),
          new TableRow({ children: [new TableCell({ children: [createParagraph('三軍總醫院', 20, { bold: true })] }), new TableCell({ children: [createParagraph('201', 20)] }), new TableCell({ children: [createParagraph(String(triData.length), 20)] }), new TableCell({ children: [createParagraph('1-200', 20)] }), new TableCell({ children: [createParagraph('0', 20)] }), new TableCell({ children: [createParagraph('100%', 20, { bold: true })] })] }),
          new TableRow({ children: [new TableCell({ children: [createParagraph('總計', 20, { bold: true })] }), new TableCell({ children: [createParagraph('403', 20, { bold: true })] }), new TableCell({ children: [createParagraph(String(totalItems), 20, { bold: true })] }), new TableCell({ children: [createParagraph('1-200 × 2', 20)] }), new TableCell({ children: [createParagraph('0', 20)] }), new TableCell({ children: [createParagraph('100%', 20, { bold: true })] })] }),
        ],
      })
    );

    // 十、萬芳醫院對應結果（列出前 40）
    pushNodes(children,
      createHeading('十、萬芳醫院對應結果', HeadingLevel.HEADING_1, 32),
      ...(addTemplateParas(children, '十、萬芳醫院對應結果'), []),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        columnWidths: [600, 2400, 1200, 1400, 5200, 900, 1400],
        rows: [
          createTableHeader(['排序', '檢驗項目', '項目代碼', 'LOINC 代碼', 'LOINC 名稱', '單位', '檢體']),
          ...aaaData.slice(0, 40).map((item) =>
            new TableRow({
              children: [
                new TableCell({ children: [createParagraph(String(item.itemRank || ''), 18)] }),
                new TableCell({ children: [createParagraph(item.labItemName || '', 18)] }),
                new TableCell({ children: [createParagraph(item.labItemId || '', 18)] }),
                new TableCell({ children: [createParagraph(item.loincCode || '', 18)] }),
                new TableCell({ children: [createParagraph((item.loincName || '').slice(0, 60) + (item.loincName && item.loincName.length > 60 ? '…' : ''), 18)] }),
                new TableCell({ children: [createParagraph(item.labUnit || '', 18)] }),
                new TableCell({ children: [createParagraph(item.labSampleType || '', 18)] }),
              ],
            })
          ),
        ],
      })
    );

    // 十一、三軍總醫院對應結果（列出前 40）
    pushNodes(children,
      createHeading('十一、三軍總醫院對應結果', HeadingLevel.HEADING_1, 32),
      ...(addTemplateParas(children, '十一、三軍總醫院對應結果'), []),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        columnWidths: [600, 2400, 1200, 1400, 5200, 900, 1400],
        rows: [
          createTableHeader(['排序', '檢驗項目', '項目代碼', 'LOINC 代碼', 'LOINC 名稱', '單位', '檢體']),
          ...triData.slice(0, 40).map((item) =>
            new TableRow({
              children: [
                new TableCell({ children: [createParagraph(String(item.itemRank || ''), 18)] }),
                new TableCell({ children: [createParagraph(item.labItemName || '', 18)] }),
                new TableCell({ children: [createParagraph(item.labItemId || '', 18)] }),
                new TableCell({ children: [createParagraph(item.loincCode || '', 18)] }),
                new TableCell({ children: [createParagraph((item.loincName || '').slice(0, 60) + (item.loincName && item.loincName.length > 60 ? '…' : ''), 18)] }),
                new TableCell({ children: [createParagraph(item.labUnit || '', 18)] }),
                new TableCell({ children: [createParagraph(item.labSampleType || '', 18)] }),
              ],
            })
          ),
        ],
      })
    );

    // 十二、品質保證與驗證
    pushNodes(children,
      createHeading('十二、品質保證與驗證', HeadingLevel.HEADING_1, 32),
      ...(addTemplateParas(children, '十二、品質保證與驗證'), []),
      addP('• 多重驗證機制：AI 初篩 → 專家確認 → 交叉驗證 → 最終審查'),
      addP('• 品質指標：完成率 ≥95%（實際 100%）、準確性 ≥90%、一致性 ≥85%')
    );

    // 十三、參與特約醫事服務機構疑義（新增）
    pushNodes(children,
      createHeading('十三、參與特約醫事服務機構疑義', HeadingLevel.HEADING_1, 32),
      addP('各參與醫療機構在實施過程中提出以下主要疑義：'),
      addP(''),
      addP('1. 檢體標示差異：部分醫院慣用 Blood，但多數檢驗為 Serum/Plasma；是否嚴格區分，機構意見不一。'),
      addP(''),
      addP('2. 方法學差異：同一檢測因方法不同（manual vs automated）對應不同代碼；避免過度細分以維持可交換性。'),
      addP(''),
      addP('3. 資訊需求與流程疑慮：CSV 匯出與 ED 轉換、是否需 LIS/HIS 改版、頻寬與資安成本。'),
      addP(''),
      addP('4. 品質控制標準：對於相同檢驗項目在不同醫院間的結果一致性要求。'),
      addP(''),
      addP('5. 人力培訓需求：醫檢師及資訊人員對於 LOINC 代碼系統的熟悉程度差異。')
    );

    // 十四、專家諮詢結果（新增）
    pushNodes(children,
      createHeading('十四、專家諮詢結果（或建議）', HeadingLevel.HEADING_1, 32),
      addP('One Taiwan, One Code 計劃有ㄧ個重點是要在一年內將台灣的 LOINC top 100 常用代碼上線，我們提出了兼顧速度與品質的 mapping 方案。'),
      addP(''),
      addP('為了在一年內，每一家可以達到半自動化的速度我們提除了整合半自動的 mapping tool, 可以確保 analyte, system, method 可以達到正確的對應，'),
      addP(''),
      addP('品質 （全國可互換性）'),
      addP('因為實驗室選擇的多樣性，要能讓各家的實驗代碼可以互換對應'),
      addP(''),
      addP('兼顧速度與品質：半自動化工具，確保 analyte/system/method 三軸向準確對應；以 Na/K/Glucose/Cholesterol 先行推動。'),
      addP('逐步導入可交換性檢核：初期以全國互換性為核心建立 mean/std/單位基準；中期針對 manual/automated、serum/plasma 跨院分析。'),
      addP('分層標準：第一層必須一致（如 Na, K）；第二層允許方法/檢體差異但需備註；第三層高差異項目待數據驗證。')
    );

    // 十五、整體導入之成本（新增）
    pushNodes(children,
      createHeading('十五、整體導入之成本(包括資訊成本、人力成本、時間及設備)', HeadingLevel.HEADING_1, 32)
    );

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        columnWidths: [2000, 6000, 1600],
        rows: [
          createTableHeader(['項目', '說明', '預估成本']),
          new TableRow({
            children: [
              new TableCell({ children: [createParagraph('資訊成本', 20, { bold: true })] }),
              new TableCell({ children: [createParagraph('將 csv 轉換成 ED 還有相關資料 由 醫學資訊學會提供轉換 網站工具', 20)] }),
              new TableCell({ children: [createParagraph('低', 20)] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [createParagraph('人力成本 1', 20, { bold: true })] }),
              new TableCell({ children: [createParagraph('1. 將一個月的實驗室檢查，根據所需要的欄位，輸出成 CSV 格式檔案', 20)] }),
              new TableCell({ children: [createParagraph('人力四個小時', 20)] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [createParagraph('人力成本 2', 20, { bold: true })] }),
              new TableCell({ children: [createParagraph('3. 半自動化 mapping', 20)] }),
              new TableCell({ children: [createParagraph('人力兩個小時', 20)] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [createParagraph('時間成本', 20, { bold: true })] }),
              new TableCell({ children: [createParagraph('初期準備與 mapping 約 1 週內可完成', 20)] }),
              new TableCell({ children: [createParagraph('中', 20)] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [createParagraph('設備成本', 20, { bold: true })] }),
              new TableCell({ children: [createParagraph('使用現有 HIS/LIS 匯出功能，僅需伺服器/網路穩定', 20)] }),
              new TableCell({ children: [createParagraph('低', 20)] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ children: [createParagraph('LLM 成本', 20, { bold: true })] }),
              new TableCell({ children: [createParagraph('4. LLM 約 20 美金 每兩百個 實驗室 query', 20)] }),
              new TableCell({ children: [createParagraph('20美金/200項', 20)] })
            ]
          }),
        ],
      })
    );

    // 十六、後續品質確保及資訊需求（新增）
    pushNodes(children,
      createHeading('十六、後續品質確保及資訊需求', HeadingLevel.HEADING_1, 32),
      addP('完整性'),
      addP('每一家的 top 100 lab code, 都要有 LOINC code 上傳'),
      addP(''),
      addP('正確性'),
      addP('針對上傳的 loinc code, 比對內容的ㄧ致性 在數字方面 比對 mean/std, unit of measure 跟收集的 central 標準'),
      addP(''),
      addP('ㄧ致性'),
      addP('因為終極目標我們希望同樣的 Component 如果是不同的 method or 類似的 specimen 意義要ㄧ致性，我們需要收集大規模的資料，然後根據實際的數據給出可交換性的建議'),
      addP(''),
      addP('例如'),
      addP('manual count/automated count'),
      addP('實際上 有沒有差異，需要收集到各家醫院不同的統計數據才能分析'),
      addP(''),
      addP('第一年目標'),
      addP(''),
      addP('常用的 Na, K, sodium, glucose 膽固醇 一些常見的檢驗檢查項目，可以正向表列，各家醫院應該都要有提出相對應的 LOINC mapping'),
      addP(''),
      addP('終極目標'),
      addP('正確的可交換性，需要針對 mean/sd, reference value 徹底討論'),
      ...(crossAnalysis
        ? [
            addP(`示例：共同 LOINC 代碼 ${crossAnalysis.summary?.loincCodes?.common || '-'} 個，重複率 ${crossAnalysis.summary?.loincCodes?.overlapPercentage || '-'}%`),
          ]
        : [])
    );

    // 十七、院別疑義清單
    pushNodes(children,
      createHeading('十七、院別疑義清單（依上傳資料與對應結果）', HeadingLevel.HEADING_1, 32),
      ...(addTemplateParas(children, '十四、院別疑義清單（依上傳資料與對應結果）'), []),
      addP('萬芳醫院：', 22, { bold: true }),
      ...aaaIssuesText.split(/\r?\n/).filter(Boolean).map((line) => addP(`• ${line}`, 20)).filter(Boolean),
      addP('三軍總醫院：', 22, { bold: true }),
      ...triIssuesText.split(/\r?\n/).filter(Boolean).map((line) => addP(`• ${line}`, 20)).filter(Boolean)
    );

    // 十八、結論與未來展望
    pushNodes(children,
      createHeading('十八、結論與未來展望', HeadingLevel.HEADING_1, 32),
      ...(addTemplateParas(children, '十五、結論與未來展望'), []),
      addP('結論：完成兩院共 400 項之對應，建立可推廣之方法論；治理、流程與品質三軸並行，成果穩健。'),
      addP('未來：六個月完善平台並訓練示範醫院；一年推廣至 50 家主要機構；持續整合品質指標、支援研究與國際接軌。')
    );

    // Create document and output
    const doc = new Document({ sections: [{ properties: {}, children }] });
    const buffer = await Packer.toBuffer(doc);
    const outPath = path.join(baseDir, 'LOINC_Mapping_Template_Aligned_Report_2025.docx');
    fs.writeFileSync(outPath, buffer);
    console.log('✅ Word 檔案已生成：', outPath);

    return outPath;
  } catch (e) {
    console.error('❌ 產生 Word 報告失敗：', e);
    process.exit(1);
  }
}

if (require.main === module) {
  generateTemplateAlignedWordReport();
}

module.exports = generateTemplateAlignedWordReport;
