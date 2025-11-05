const fs = require('fs');

function createAAAHospitalCSV() {
    try {
        // Read the corrected final data
        const aaaData = JSON.parse(fs.readFileSync('/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/aaa_hospital_final_200.json', 'utf8'));

        console.log(`Processing ${aaaData.length} AAA Hospital mappings...`);

        // Create CSV header
        const csvHeader = [
            'Item Rank',
            'Lab Item Name',
            'Lab Item ID',
            'Lab Unit',
            'Lab Sample Type',
            'LOINC Code',
            'LOINC Name',
            'Mean Value',
            'Median Value',
            'Timestamp',
            'Source Filename'
        ].join(',');

        // Create CSV rows
        const csvRows = aaaData.map(item => {
            return [
                item.itemRank || '',
                `"${(item.labItemName || '').replace(/"/g, '""')}"`,
                item.labItemId || '',
                `"${(item.labUnit || '').replace(/"/g, '""')}"`,
                `"${(item.labSampleType || '').replace(/"/g, '""')}"`,
                item.loincCode || '',
                `"${(item.loincName || '').replace(/"/g, '""')}"`,
                item.meanValue || '',
                item.medianValue || '',
                item.timestamp || '',
                item.filename || ''
            ].join(',');
        });

        // Combine header and rows
        const csvContent = [csvHeader, ...csvRows].join('\n');

        // Write to file
        const outputPath = '/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/AAA_Hospital_LOINC_Mappings.csv';
        fs.writeFileSync(outputPath, csvContent, 'utf8');

        console.log(`✅ CSV file created successfully: ${outputPath}`);
        console.log(`📊 Total mappings: ${aaaData.length}`);

        // Show some sample data
        console.log('\n📋 Sample of mappings:');
        aaaData.slice(0, 5).forEach((item, index) => {
            console.log(`${index + 1}. ${item.labItemName} (${item.labItemId}) → ${item.loincCode} - ${item.loincName}`);
        });

        return outputPath;

    } catch (error) {
        console.error('❌ Error creating CSV:', error);
        throw error;
    }
}

// Run the function if this script is executed directly
if (require.main === module) {
    createAAAHospitalCSV()
        .then(csvPath => {
            console.log(`\n🎉 CSV generation completed!`);
            console.log(`📁 File location: ${csvPath}`);
        })
        .catch(error => {
            console.error('💥 CSV generation failed:', error);
            process.exit(1);
        });
}

module.exports = createAAAHospitalCSV;