# Data Setup Guide 📊

## LOINC Data Files

This application requires LOINC (Logical Observation Identifiers Names and Codes) data files to function properly.

### Required Files

1. **`Loinc.csv`** - Main LOINC database file (large file, ~74MB)
2. **`Loinc_small.csv`** - Smaller sample dataset for testing

### Getting LOINC Data

#### Option 1: Download from Official Source
1. Visit [LOINC.org](https://loinc.org/downloads/)
2. Download the latest LOINC release
3. Extract and place `Loinc.csv` in the project root directory

#### Option 2: Use Sample Data
For testing purposes, you can use the included `Loinc_small.csv` file.

#### Option 3: Contact TAMI
Contact the Taiwan Medical Informatics Association (TAMI) for access to LOINC data.

### File Structure
```
loincAI/
├── Loinc.csv          # Main LOINC database (download separately)
├── Loinc_small.csv    # Sample data (included)
└── ...
```

### Data Format
The CSV files should contain these columns:
- `LOINC_NUM` - LOINC number
- `COMPONENT` - Component name
- `RELATEDNAMES2` - Related names
- `COMMON_TEST_RANK` - Test ranking
- `COMMON_ORDER_RANK` - Order ranking
- `LONG_COMMON_NAME` - Full test name

### Environment Variables
Create a `.env` file with your OpenAI API key:
```env
OPENAI_API_KEY=your_api_key_here
```

### Notes
- Large CSV files are excluded from git due to size limits
- The application will automatically detect and use available data files
- Ensure proper file permissions for the data files
