#!/usr/bin/env node

/**
 * 上傳首頁到 WordPress
 * 將 homepage-complete-preview.html 上傳為 WordPress 頁面
 */

const fs = require('fs');
const WordPressPublisher = require('./publish-to-wordpress.js');

async function uploadHomepage() {
  try {
    console.log('📖 讀取首頁 HTML 檔案...');
    const htmlContent = fs.readFileSync('./homepage-complete-preview.html', 'utf-8');

    console.log('🔍 解析 HTML 內容...');

    // 提取 <style> 標籤內容
    const styleMatch = htmlContent.match(/<style>([\s\S]*?)<\/style>/);
    const styles = styleMatch ? styleMatch[1] : '';

    // 提取 <body> 標籤內容
    const bodyMatch = htmlContent.match(/<body>([\s\S]*?)<\/body>/);
    const bodyContent = bodyMatch ? bodyMatch[1] : '';

    // 組合內容：將 CSS 放在 <style> 標籤中，然後是 HTML 內容
    const pageContent = `
<!-- 自定義樣式 -->
<style>
${styles}
</style>

<!-- 頁面內容 -->
${bodyContent}
`;

    console.log('🚀 連線到 WordPress...');
    const publisher = new WordPressPublisher({
      siteUrl: 'https://loinc.org.tw'
    });

    console.log('📤 上傳首頁...');
    const result = await publisher.publishPage({
      title: '台灣標準醫學詞庫 - 首頁',
      content: pageContent,
      status: 'publish'
    });

    console.log('\n✅ 首頁上傳成功！');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📝 頁面標題: ${result.title.rendered}`);
    console.log(`🔗 頁面連結: ${result.link}`);
    console.log(`🆔 頁面 ID: ${result.id}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    console.log('\n📋 下一步操作：');
    console.log('1. 前往 WordPress 後台：https://loinc.org.tw/wp-admin');
    console.log('2. 到「設定」>「閱讀」');
    console.log(`3. 選擇「靜態頁面」，並選擇「台灣標準醫學詞庫 - 首頁」（ID: ${result.id}）`);
    console.log('4. 點擊「儲存變更」');
    console.log('\n🎉 完成後，https://loinc.org.tw 就會顯示新的首頁設計！');

  } catch (error) {
    console.error('❌ 上傳失敗:', error.message);

    if (error.response?.data) {
      console.error('詳細錯誤:', JSON.stringify(error.response.data, null, 2));
    }

    process.exit(1);
  }
}

// 執行上傳
uploadHomepage();
