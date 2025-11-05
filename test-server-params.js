const express = require('express');
const app = express();

app.get('/test-params', (req, res) => {
    const params = {
        labItemName: req.query.labItemName,
        labUnit: req.query.labUnit,
        labSampleType: req.query.labSampleType,
        searchTerms: req.query.searchTerms,
        mustHaveTerms: req.query.mustHaveTerms,
        rankFilter1: req.query.rankFilter1,
        rankFilter2: req.query.rankFilter2
    };
    
    res.json({
        message: 'URL parameters received',
        params: params,
        rawQuery: req.query
    });
});

const PORT = 3003;
app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
});
