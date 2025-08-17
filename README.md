# loincAI 🔬

**AI-Powered LOINC Code Search and Analysis Tool**

A sophisticated web application that leverages artificial intelligence to search, analyze, and interpret LOINC (Logical Observation Identifiers Names and Codes) data for medical laboratory testing.

## ✨ Features

- **🔍 AI-Powered Search**: Advanced search algorithms for LOINC codes
- **📊 Smart Ranking**: Intelligent result ranking and filtering
- **🌐 Web Interface**: Modern, responsive web application
- **📱 Mobile Friendly**: Optimized for all device sizes
- **🔗 URL Parameters**: Shareable search results via URL
- **📈 Search Analytics**: Track and analyze search patterns
- **👥 User Management**: Admin panel for user oversight

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/loincAI.git
   cd loincAI
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   node loinc-search-server.js
   ```

4. **Open your browser**
   Navigate to `http://localhost:3002`

## 🏗️ Architecture

### Frontend
- **HTML5**: Semantic markup with modern web standards
- **CSS3**: Responsive design with CSS Grid and Flexbox
- **JavaScript**: Vanilla JS with ES6+ features
- **AI Integration**: OpenAI API for intelligent search

### Backend
- **Node.js**: Server-side JavaScript runtime
- **Express.js**: Web application framework
- **CSV Processing**: Efficient LOINC data handling
- **Search Algorithms**: Advanced text search and ranking

### Data
- **LOINC Database**: Comprehensive medical coding data
- **CSV Format**: Optimized for fast data access
- **Search Index**: Pre-processed search optimization

## 📁 Project Structure

```
loincAI/
├── public/                 # Frontend assets
│   ├── index.html         # Main application
│   ├── admin.html         # Admin panel
│   └── search-history.html # Search analytics
├── loinc-search-server.js # Main server file
├── package.json           # Dependencies
├── Loinc.csv             # LOINC database
├── custom-search.js      # Search algorithms
└── README.md             # This file
```

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the root directory:

```env
PORT=3002
OPENAI_API_KEY=your_openai_api_key_here
NODE_ENV=development
```

### Server Configuration
The server runs on port 3002 by default. You can change this in `loinc-search-server.js` or via environment variables.

## 🎯 Usage

### Basic Search
1. Enter search terms in the main search box
2. Use filters to narrow results
3. Click search to get AI-powered results

### Advanced Features
- **URL Parameters**: Share searches via URL
- **Ranking Filters**: Customize result ordering
- **Admin Panel**: Monitor system usage
- **Search History**: Track user interactions

### Example Search URLs
```
http://localhost:3002/?searchTerms=CREA+mg%2FdL+Blood&rankFilter1=true
http://localhost:3002/?searchTerms=glucose+fasting&rankFilter2=true
```

## 🤖 AI Features

- **Semantic Search**: Understands medical terminology context
- **Smart Ranking**: Prioritizes most relevant results
- **Query Expansion**: Automatically suggests related terms
- **Context Awareness**: Considers medical domain knowledge

## 📊 Data Sources

- **LOINC Database**: Official LOINC codes and descriptions
- **Medical Terminology**: Standardized medical vocabulary
- **Search Patterns**: User behavior analytics

## 🔒 Security

- **Input Validation**: Sanitized user inputs
- **Rate Limiting**: API usage controls
- **Secure Headers**: HTTP security best practices
- **Admin Authentication**: Protected admin functions

## 🧪 Testing

Run the test suite:

```bash
# Test search functionality
node test-search.js

# Test API endpoints
node test-api.js

# Test search logging
node test-search-log.js
```

## 📈 Performance

- **Fast Search**: Optimized CSV processing
- **Efficient Indexing**: Pre-processed search data
- **Caching**: Intelligent result caching
- **Compression**: Gzip compression for responses

## 🌍 Browser Support

- **Chrome**: 80+
- **Firefox**: 75+
- **Safari**: 13+
- **Edge**: 80+

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Maintainers

- **林明錦 (Mark Lin2)** - *Initial work* - [TAMI](https://www.tami.org.tw/)

## 🙏 Acknowledgments

- **台灣醫學資訊學會 (TAMI)** - Medical informatics expertise
- **LOINC Committee** - Data standards and codes
- **OpenAI** - AI capabilities and API

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Contact the maintainers
- Check the documentation

---

**Made with ❤️ for the medical community**

*This tool helps healthcare professionals quickly and accurately identify LOINC codes for laboratory tests, improving patient care and data standardization.*
