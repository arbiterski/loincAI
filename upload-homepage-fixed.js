#!/usr/bin/env node

/**
 * 上傳首頁到 WordPress（修正版）
 * 只上傳 HTML 內容，CSS 需要手動放到「自定義 CSS」
 */

const fs = require('fs');
const WordPressPublisher = require('./publish-to-wordpress.js');

async function uploadHomepage() {
  try {
    console.log('📖 讀取首頁 HTML 檔案...');
    const htmlContent = fs.readFileSync('./homepage-template.html', 'utf-8');

    console.log('🔍 解析 HTML 內容...');

    // 只提取 body 內容（不包含 header、footer 標籤本身）
    const bodyMatch = htmlContent.match(/<body>([\s\S]*?)<\/body>/);
    let bodyContent = bodyMatch ? bodyMatch[1] : '';

    // 移除 HTML 註解
    bodyContent = bodyContent.replace(/<!--[\s\S]*?-->/g, '');

    console.log('🚀 連線到 WordPress...');
    const publisher = new WordPressPublisher({
      siteUrl: 'https://loinc.org.tw'
    });

    console.log('📤 更新首頁（頁面 ID: 98）...');
    const result = await publisher.updatePage(98, {
      title: '首頁',
      content: bodyContent,
      status: 'publish'
    });

    console.log('\n✅ 首頁更新成功！');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📝 頁面標題: ${result.title.rendered}`);
    console.log(`🔗 頁面連結: ${result.link}`);
    console.log(`🆔 頁面 ID: ${result.id}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    console.log('\n⚠️  重要：CSS 樣式尚未套用！');
    console.log('\n📋 請手動完成以下步驟：');
    console.log('\n1️⃣  套用 CSS 樣式：');
    console.log('   a. 前往：https://loinc.org.tw/wp-admin/customize.php');
    console.log('   b. 點擊「額外的 CSS」');
    console.log('   c. 開啟檔案：custom-theme.css');
    console.log('   d. 複製全部內容貼到 WordPress 的「額外 CSS」區域');
    console.log('   e. 點擊「發佈」');
    console.log('\n2️⃣  設定為首頁：');
    console.log('   a. 前往：https://loinc.org.tw/wp-admin/options-reading.php');
    console.log('   b. 選擇「靜態頁面」');
    console.log(`   c. 在「首頁」選擇「首頁」（ID: ${result.id}）`);
    console.log('   d. 點擊「儲存變更」');
    console.log('\n🎉 完成後，https://loinc.org.tw 就會顯示新的首頁設計！');

    // 顯示 CSS 檔案路徑
    console.log('\n📁 CSS 檔案位置：');
    console.log('   ~/Dropbox/!Umysql_PVM/LOINC/custom-theme.css');

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
