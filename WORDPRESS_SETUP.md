# WordPress 發表工具設定指南

## 📝 如何取得 WordPress 應用程式密碼

### 步驟 1: 登入 WordPress 後台

1. 前往 https://loinc.org.tw/wp-admin
2. 使用您的管理員帳號登入

### 步驟 2: 前往個人資料頁面

1. 點擊右上角的個人資料
2. 或直接前往：https://loinc.org.tw/wp-admin/profile.php

### 步驟 3: 建立應用程式密碼

1. 向下捲動找到「應用程式密碼」區塊
2. 在「新增應用程式密碼名稱」輸入框中填寫：`LOINC CLI Tool`
3. 點擊「新增」按鈕
4. **重要**：複製產生的密碼（格式：xxxx xxxx xxxx xxxx xxxx xxxx）
5. 這個密碼只會顯示一次，請妥善保存

### 步驟 4: 更新 .env 檔案

編輯 `/Users/arbiter/Dropbox/!Umysql_PVM/LOINC/.env`，填入您的資訊：

```env
# WordPress Configuration for loinc.org.tw
WP_USERNAME=您的WordPress使用者名稱
WP_APP_PASSWORD=剛才複製的應用程式密碼
```

**範例**：
```env
WP_USERNAME=mark
WP_APP_PASSWORD=abcd efgh ijkl mnop qrst uvwx
```

## 🚀 使用方法

### 測試連線

```bash
cd ~/Dropbox/!Umysql_PVM/LOINC
node publish-to-wordpress.js test
```

### 查看可用分類

```bash
node publish-to-wordpress.js categories
```

### 查看可用標籤

```bash
node publish-to-wordpress.js tags
```

### 發表文章（草稿）

```bash
node publish-to-wordpress.js draft my-article.md
```

### 發表文章（直接發布）

```bash
node publish-to-wordpress.js publish my-article.md
```

## 📝 在程式中使用

```javascript
const WordPressPublisher = require('./publish-to-wordpress.js');

const publisher = new WordPressPublisher({
  siteUrl: 'https://loinc.org.tw'
});

// 發表文章
await publisher.publishPost({
  title: 'LOINC Mapping 完整報告',
  content: '<p>這是文章內容...</p>',
  status: 'publish',  // 或 'draft'
  categories: [1, 5], // 分類 ID
  tags: [2, 8],       // 標籤 ID
  excerpt: '摘要...'
});

// 建立草稿
await publisher.createDraft({
  title: '草稿標題',
  content: '內容...'
});

// 上傳圖片
const image = await publisher.uploadImage('./report.png', 'LOINC Report');
console.log('圖片 URL:', image.source_url);

// 發表帶圖片的文章
await publisher.publishPost({
  title: '帶圖片的文章',
  content: '<p>內容...</p>',
  featured_media: image.id  // 設定特色圖片
});
```

## 🔧 進階功能

### 自動從 Markdown 發表

```javascript
await publisher.publishFromFile('article.md', {
  title: '文章標題',
  status: 'draft',
  categories: [1],
  tags: [2, 3]
});
```

### 更新現有文章

```javascript
await publisher.updatePost(123, {
  title: '更新後的標題',
  content: '<p>更新後的內容</p>'
});
```

## 🛡️ 安全注意事項

1. **不要提交 .env 檔案**
   - .env 檔案已在 .gitignore 中
   - 不要分享您的應用程式密碼

2. **應用程式密碼權限**
   - 應用程式密碼擁有與您帳號相同的權限
   - 如果密碼洩漏，可以在 WordPress 後台撤銷

3. **定期更換密碼**
   - 建議定期更換應用程式密碼
   - 刪除不再使用的應用程式密碼

## 📚 WordPress REST API 文件

- [WordPress REST API 手冊](https://developer.wordpress.org/rest-api/)
- [應用程式密碼說明](https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/)

## ❓ 常見問題

### Q: 找不到「應用程式密碼」選項？

A: 確認您的 WordPress 版本 ≥ 5.6，且使用 HTTPS 連線。

### Q: 發表失敗：401 Unauthorized

A: 檢查 .env 中的使用者名稱和密碼是否正確。

### Q: 如何撤銷應用程式密碼？

A: 前往 WordPress 後台 > 個人資料 > 應用程式密碼，點擊「撤銷」。

### Q: 可以用一般密碼嗎？

A: 不建議。WordPress REST API 要求使用應用程式密碼，這更安全。

## 🎯 實用範例

### 範例 1: 發表 LOINC Mapping 報告

```bash
# 建立報告草稿
node publish-to-wordpress.js draft LOINC_Mapping_Report_2025.md

# 檢查草稿後，更新為發布狀態（需要在程式中實作）
```

### 範例 2: 批次發表多篇文章

```javascript
const fs = require('fs');
const WordPressPublisher = require('./publish-to-wordpress.js');

async function batchPublish() {
  const publisher = new WordPressPublisher({ siteUrl: 'https://loinc.org.tw' });

  const articles = [
    { file: 'article1.md', title: '文章一' },
    { file: 'article2.md', title: '文章二' },
    { file: 'article3.md', title: '文章三' }
  ];

  for (const article of articles) {
    await publisher.publishFromFile(article.file, {
      title: article.title,
      status: 'draft',  // 先建立草稿
      categories: [1]
    });
    console.log(`✅ ${article.title} 已發表`);
  }
}

batchPublish();
```

---

**建立日期**: 2025-10-21
**維護者**: Mark Lin
