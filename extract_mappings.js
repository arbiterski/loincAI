const fs = require('fs');
const path = require('path');

function extractMappings(hospitalDir, hospitalName) {
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
                    totalRecords: data.labDataContext.labTotalRecords || '',
                    uniquePatients: data.labDataContext.labUniquePatients || '',
                    meanValue: data.labDataContext.labMeanValue || '',
                    timestamp: data.metadata.timestamp || ''
                });
            }
        } catch (e) {
            console.error(`Error processing ${file}: ${e.message}`);
        }
    });

    // Remove duplicates based on labItemName and keep the latest one
    const uniqueMappings = {};
    mappings.forEach(m => {
        const key = m.labItemName;
        if (!uniqueMappings[key] || new Date(m.timestamp) > new Date(uniqueMappings[key].timestamp)) {
            uniqueMappings[key] = m;
        }
    });

    return Object.values(uniqueMappings).sort((a, b) => a.itemRank - b.itemRank);
}

// Extract mappings for both hospitals
const aaa_hospital_dir = '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/saved_mappings/AAA_Hospital';
const tri_service_dir = '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/saved_mappings/Tri-Service_General_Hospital';

const aaa_mappings = extractMappings(aaa_hospital_dir, '萬芳醫院');
const tri_mappings = extractMappings(tri_service_dir, '三軍總醫院');

// Save to JSON files
fs.writeFileSync(
    '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/aaa_hospital_mappings.json',
    JSON.stringify(aaa_mappings, null, 2)
);

fs.writeFileSync(
    '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/tri_service_mappings.json',
    JSON.stringify(tri_mappings, null, 2)
);

console.log(`萬芳醫院 mappings: ${aaa_mappings.length} unique items`);
console.log(`三軍總醫院 mappings: ${tri_mappings.length} unique items`);

// Create CSV format for easy viewing
function toCSV(mappings, hospitalName) {
    let csv = `Hospital,Rank,Lab Item Name,Lab Item ID,LOINC Code,LOINC Name,Unit,Sample Type,Total Records,Unique Patients,Mean Value\n`;
    mappings.forEach(m => {
        csv += `"${hospitalName}",${m.itemRank},"${m.labItemName}","${m.labItemId}","${m.loincCode}","${m.loincName}","${m.labUnit}","${m.labSampleType}","${m.totalRecords}","${m.uniquePatients}","${m.meanValue}"\n`;
    });
    return csv;
}

fs.writeFileSync(
    '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/aaa_hospital_mappings.csv',
    toCSV(aaa_mappings, '萬芳醫院')
);

fs.writeFileSync(
    '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/tri_service_mappings.csv',
    toCSV(tri_mappings, '三軍總醫院')
);

console.log('CSV files created successfully');