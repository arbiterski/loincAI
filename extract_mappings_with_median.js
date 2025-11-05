const fs = require('fs');
const path = require('path');

function extractMappingsWithMedian(hospitalDir, hospitalName) {
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
                    medianValue: data.labDataContext.labMedianValue || '',
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

const aaa_mappings = extractMappingsWithMedian(aaa_hospital_dir, '萬芳醫院');
const tri_mappings = extractMappingsWithMedian(tri_service_dir, '三軍總醫院');

// Filter to get 1-200 rankings only and remove duplicates
const aaaFiltered = aaa_mappings.filter(m => m.itemRank >= 1 && m.itemRank <= 200);
const triFiltered = tri_mappings.filter(m => m.itemRank >= 1 && m.itemRank <= 200);

console.log(`萬芳醫院 1-200 mappings: ${aaaFiltered.length} items`);
console.log(`三軍總醫院 1-200 mappings: ${triFiltered.length} items`);

// Save updated files
fs.writeFileSync(
    '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/aaa_hospital_mappings_with_median.json',
    JSON.stringify(aaaFiltered, null, 2)
);

fs.writeFileSync(
    '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/tri_service_mappings_with_median.json',
    JSON.stringify(triFiltered, null, 2)
);

console.log('Updated mapping files with median values created successfully');