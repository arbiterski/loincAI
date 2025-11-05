const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

async function generateAAAHospitalPDF() {
    try {
        const aaaHospitalDir = '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/saved_mappings/AAA_Hospital';

        // Read all JSON mapping files
        const files = fs.readdirSync(aaaHospitalDir)
            .filter(file => file.endsWith('.json'))
            .sort((a, b) => {
                // Sort by timestamp in filename (descending - newest first)
                const timeA = a.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/);
                const timeB = b.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/);
                if (timeA && timeB) {
                    return timeB[1].localeCompare(timeA[1]);
                }
                return b.localeCompare(a);
            });

        console.log(`Found ${files.length} mapping files for AAA Hospital`);

        // Read and process mapping data
        const mappings = [];
        for (const file of files) {
            try {
                const filePath = path.join(aaaHospitalDir, file);
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                mappings.push({
                    filename: file,
                    ...data
                });
            } catch (err) {
                console.warn(`Failed to read ${file}:`, err.message);
            }
        }

        console.log(`Successfully processed ${mappings.length} mapping files`);

        // Group mappings by lab item
        const groupedMappings = {};
        mappings.forEach(mapping => {
            const itemName = mapping.labDataContext?.labItemName || 'Unknown Item';
            if (!groupedMappings[itemName]) {
                groupedMappings[itemName] = [];
            }
            groupedMappings[itemName].push(mapping);
        });

        // Generate HTML content
        const htmlContent = generateHTMLReport(groupedMappings, mappings.length);

        // Generate PDF
        const browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const pdfPath = path.join(aaaHospitalDir, `AAA_Hospital_LOINC_Mappings_${timestamp}.pdf`);

        await page.pdf({
            path: pdfPath,
            format: 'A4',
            margin: {
                top: '1cm',
                right: '1cm',
                bottom: '1cm',
                left: '1cm'
            },
            printBackground: true
        });

        await browser.close();

        console.log(`PDF generated successfully: ${pdfPath}`);
        return pdfPath;

    } catch (error) {
        console.error('Error generating PDF:', error);
        throw error;
    }
}

function generateHTMLReport(groupedMappings, totalMappings) {
    const currentDate = new Date().toLocaleString('zh-TW');

    return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AAA Hospital LOINC Mappings Report</title>
    <style>
        body {
            font-family: 'Microsoft JhengHei', 'Arial', sans-serif;
            line-height: 1.4;
            color: #333;
            margin: 0;
            padding: 20px;
            font-size: 10px;
        }

        .header {
            text-align: center;
            border-bottom: 3px solid #2c3e50;
            padding-bottom: 15px;
            margin-bottom: 25px;
        }

        .header h1 {
            color: #2c3e50;
            margin: 0;
            font-size: 18px;
        }

        .header .subtitle {
            color: #7f8c8d;
            margin: 5px 0;
            font-size: 12px;
        }

        .summary {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
            border-left: 4px solid #3498db;
        }

        .summary h2 {
            margin: 0 0 10px 0;
            color: #2c3e50;
            font-size: 14px;
        }

        .summary-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 10px;
            margin-top: 10px;
        }

        .stat-item {
            background: white;
            padding: 8px;
            border-radius: 3px;
            border: 1px solid #ddd;
        }

        .stat-label {
            font-weight: bold;
            color: #2c3e50;
            font-size: 9px;
        }

        .stat-value {
            font-size: 12px;
            color: #e74c3c;
            font-weight: bold;
        }

        .mapping-group {
            margin-bottom: 20px;
            border: 1px solid #ddd;
            border-radius: 5px;
            overflow: hidden;
        }

        .group-header {
            background: #34495e;
            color: white;
            padding: 10px;
            font-weight: bold;
            font-size: 11px;
        }

        .mapping-item {
            border-bottom: 1px solid #eee;
            padding: 10px;
        }

        .mapping-item:last-child {
            border-bottom: none;
        }

        .mapping-meta {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 10px;
            margin-bottom: 8px;
            font-size: 9px;
            color: #666;
        }

        .loinc-code {
            font-weight: bold;
            color: #e74c3c;
            font-size: 11px;
        }

        .component-desc {
            margin: 5px 0;
            font-size: 10px;
        }

        .ai-analysis {
            background: #f0f8ff;
            padding: 8px;
            border-radius: 3px;
            margin-top: 8px;
            font-size: 9px;
            border-left: 3px solid #3498db;
        }

        .lab-context {
            background: #f9f9f9;
            padding: 8px;
            border-radius: 3px;
            margin: 5px 0;
            font-size: 9px;
        }

        .footer {
            margin-top: 30px;
            text-align: center;
            color: #7f8c8d;
            font-size: 8px;
            border-top: 1px solid #ddd;
            padding-top: 10px;
        }

        @media print {
            .mapping-group {
                page-break-inside: avoid;
                break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>AAA Hospital LOINC Mapping Report</h1>
        <div class="subtitle">LOINC 代碼對應完整報告</div>
        <div class="subtitle">Generated on: ${currentDate}</div>
    </div>

    <div class="summary">
        <h2>Executive Summary / 執行摘要</h2>
        <div class="summary-stats">
            <div class="stat-item">
                <div class="stat-label">Total Mappings / 總對應數</div>
                <div class="stat-value">${totalMappings}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Unique Lab Items / 唯一檢驗項目</div>
                <div class="stat-value">${Object.keys(groupedMappings).length}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Institution / 機構</div>
                <div class="stat-value">AAA Hospital</div>
            </div>
        </div>
    </div>

    ${Object.entries(groupedMappings).map(([itemName, mappings]) => `
        <div class="mapping-group">
            <div class="group-header">
                ${itemName} (${mappings.length} mappings)
            </div>
            ${mappings.map((mapping, index) => `
                <div class="mapping-item">
                    <div class="mapping-meta">
                        <div><strong>File:</strong> ${mapping.filename}</div>
                        <div><strong>Timestamp:</strong> ${mapping.metadata?.timestamp || 'N/A'}</div>
                        <div><strong>Mapping #:</strong> ${index + 1}</div>
                    </div>

                    ${mapping.labDataContext ? `
                        <div class="lab-context">
                            <strong>Lab Context:</strong><br>
                            Item: ${mapping.labDataContext.labItemName || 'N/A'}<br>
                            Unit: ${mapping.labDataContext.labUnit || 'N/A'}<br>
                            Sample Type: ${mapping.labDataContext.labSampleType || 'N/A'}<br>
                            Total Records: ${mapping.labDataContext.labTotalRecords || 'N/A'}<br>
                            Unique Patients: ${mapping.labDataContext.labUniquePatients || 'N/A'}
                        </div>
                    ` : ''}

                    ${mapping.selectedLoincCodes && mapping.selectedLoincCodes.length > 0 ? `
                        <div style="margin: 8px 0;">
                            <strong>Selected LOINC Codes:</strong>
                            ${mapping.selectedLoincCodes.map(code => `<span class="loinc-code">${code}</span>`).join(', ')}
                        </div>
                    ` : ''}

                    ${mapping.selectedDetails && mapping.selectedDetails.length > 0 ? `
                        ${mapping.selectedDetails.map(detail => `
                            <div class="component-desc">
                                <strong>Component:</strong> ${detail.component ? detail.component.replace(/<[^>]*>/g, '') : 'N/A'}<br>
                                <strong>Long Name:</strong> ${detail.longCommonName || 'N/A'}<br>
                                <strong>Similarity Score:</strong> ${detail.similarityScore || 'N/A'}
                            </div>
                        `).join('')}
                    ` : ''}

                    ${mapping.aiAnalysis ? `
                        <div class="ai-analysis">
                            <strong>AI Analysis:</strong><br>
                            ${mapping.aiAnalysis.replace(/<[^>]*>/g, '').substring(0, 300)}${mapping.aiAnalysis.length > 300 ? '...' : ''}
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    `).join('')}

    <div class="footer">
        <p>Generated by LOINC Search System | AAA Hospital | ${currentDate}</p>
        <p>This report contains ${totalMappings} LOINC mappings across ${Object.keys(groupedMappings).length} unique laboratory items.</p>
    </div>
</body>
</html>`;
}

// Run the function if this script is executed directly
if (require.main === module) {
    generateAAAHospitalPDF()
        .then(pdfPath => {
            console.log(`\n✅ PDF generation completed successfully!`);
            console.log(`📄 PDF saved to: ${pdfPath}`);
        })
        .catch(error => {
            console.error('❌ PDF generation failed:', error);
            process.exit(1);
        });
}

module.exports = generateAAAHospitalPDF;