#!/usr/bin/env node

/**
 * WordPress 文章發表工具
 * 用於發表文章到 loinc.org.tw
 */

const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

class WordPressPublisher {
  constructor(config) {
    this.siteUrl = config.siteUrl || 'https://loinc.org.tw';
    this.username = config.username || process.env.WP_USERNAME;
    this.appPassword = config.appPassword || process.env.WP_APP_PASSWORD;

    if (!this.username || !this.appPassword) {
      throw new Error('需要 WordPress 使用者名稱和應用程式密碼');
    }

    this.apiUrl = `${this.siteUrl}/wp-json/wp/v2`;
    this.auth = Buffer.from(`${this.username}:${this.appPassword}`).toString('base64');
  }

  /**
   * 發表新文章
   */
  async publishPost(postData) {
    try {
      const response = await axios.post(
        `${this.apiUrl}/posts`,
        {
          title: postData.title,
          content: postData.content,
          status: postData.status || 'publish', // publish, draft, pending
          excerpt: postData.excerpt || '',
          categories: postData.categories || [],
          tags: postData.tags || [],
          featured_media: postData.featuredMedia || null,
          format: postData.format || 'standard', // standard, aside, gallery, etc.
        },
        {
          headers: {
            'Authorization': `Basic ${this.auth}`,
            'Content-Type': 'application/json',
          }
        }
      );

      console.log('✅ 文章發表成功！');
      console.log(`📝 標題: ${response.data.title.rendered}`);
      console.log(`🔗 連結: ${response.data.link}`);
      console.log(`🆔 文章 ID: ${response.data.id}`);

      return response.data;
    } catch (error) {
      console.error('❌ 發表失敗:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * 更新現有文章
   */
  async updatePost(postId, postData) {
    try {
      const response = await axios.post(
        `${this.apiUrl}/posts/${postId}`,
        postData,
        {
          headers: {
            'Authorization': `Basic ${this.auth}`,
            'Content-Type': 'application/json',
          }
        }
      );

      console.log('✅ 文章更新成功！');
      console.log(`🔗 連結: ${response.data.link}`);

      return response.data;
    } catch (error) {
      console.error('❌ 更新失敗:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * 建立草稿
   */
  async createDraft(postData) {
    return this.publishPost({ ...postData, status: 'draft' });
  }

  /**
   * 刪除文章
   */
  async deletePost(postId, force = false) {
    try {
      const response = await axios.delete(
        `${this.apiUrl}/posts/${postId}?force=${force}`,
        {
          headers: {
            'Authorization': `Basic ${this.auth}`,
          }
        }
      );

      if (force) {
        console.log('✅ 文章已永久刪除！');
      } else {
        console.log('✅ 文章已移至垃圾桶！');
      }
      console.log(`📝 標題: ${response.data.previous?.title?.rendered || response.data.title?.rendered}`);

      return response.data;
    } catch (error) {
      console.error('❌ 刪除失敗:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * 建立新頁面
   */
  async publishPage(pageData) {
    try {
      const response = await axios.post(
        `${this.apiUrl}/pages`,
        {
          title: pageData.title,
          content: pageData.content,
          status: pageData.status || 'publish', // publish, draft
          excerpt: pageData.excerpt || '',
          parent: pageData.parent || 0,
          menu_order: pageData.menuOrder || 0,
        },
        {
          headers: {
            'Authorization': `Basic ${this.auth}`,
            'Content-Type': 'application/json',
          }
        }
      );

      console.log('✅ 頁面建立成功！');
      console.log(`📝 標題: ${response.data.title.rendered}`);
      console.log(`🔗 連結: ${response.data.link}`);
      console.log(`🆔 頁面 ID: ${response.data.id}`);

      return response.data;
    } catch (error) {
      console.error('❌ 建立失敗:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * 更新現有頁面
   */
  async updatePage(pageId, pageData) {
    try {
      const response = await axios.post(
        `${this.apiUrl}/pages/${pageId}`,
        pageData,
        {
          headers: {
            'Authorization': `Basic ${this.auth}`,
            'Content-Type': 'application/json',
          }
        }
      );

      console.log('✅ 頁面更新成功！');
      console.log(`🔗 連結: ${response.data.link}`);

      return response.data;
    } catch (error) {
      console.error('❌ 更新失敗:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * 取得所有分類
   */
  async getCategories() {
    try {
      const response = await axios.get(`${this.apiUrl}/categories`, {
        headers: {
          'Authorization': `Basic ${this.auth}`,
        }
      });

      console.log('📁 可用分類:');
      response.data.forEach(cat => {
        console.log(`  - ${cat.name} (ID: ${cat.id})`);
      });

      return response.data;
    } catch (error) {
      console.error('❌ 取得分類失敗:', error.message);
      throw error;
    }
  }

  /**
   * 取得所有標籤
   */
  async getTags() {
    try {
      const response = await axios.get(`${this.apiUrl}/tags`, {
        headers: {
          'Authorization': `Basic ${this.auth}`,
        }
      });

      console.log('🏷️  可用標籤:');
      response.data.forEach(tag => {
        console.log(`  - ${tag.name} (ID: ${tag.id})`);
      });

      return response.data;
    } catch (error) {
      console.error('❌ 取得標籤失敗:', error.message);
      throw error;
    }
  }

  /**
   * 上傳圖片
   */
  async uploadImage(imagePath, title = '') {
    try {
      const imageBuffer = fs.readFileSync(imagePath);
      const filename = imagePath.split('/').pop();

      const response = await axios.post(
        `${this.apiUrl}/media`,
        imageBuffer,
        {
          headers: {
            'Authorization': `Basic ${this.auth}`,
            'Content-Type': 'image/jpeg',
            'Content-Disposition': `attachment; filename="${filename}"`,
          }
        }
      );

      console.log('✅ 圖片上傳成功！');
      console.log(`🖼️  圖片 ID: ${response.data.id}`);
      console.log(`🔗 URL: ${response.data.source_url}`);

      return response.data;
    } catch (error) {
      console.error('❌ 圖片上傳失敗:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * 從 Markdown 轉換為 HTML
   */
  markdownToHtml(markdown) {
    // 簡單的 Markdown 轉換（可以用更完整的 library）
    let html = markdown
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/\n\n/gim, '</p><p>')
      .replace(/\n/gim, '<br>');

    return `<p>${html}</p>`;
  }

  /**
   * 從檔案發表文章
   */
  async publishFromFile(filePath, options = {}) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const isMarkdown = filePath.endsWith('.md');

    const postData = {
      title: options.title || '未命名文章',
      content: isMarkdown ? this.markdownToHtml(content) : content,
      status: options.status || 'draft',
      categories: options.categories || [],
      tags: options.tags || [],
    };

    return this.publishPost(postData);
  }
}

// CLI 使用範例
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
📝 WordPress 發表工具使用說明:

環境變數設定（在 .env 檔案中）:
  WP_USERNAME=你的使用者名稱
  WP_APP_PASSWORD=你的應用程式密碼

使用方式:
  node publish-to-wordpress.js <命令> [參數]

命令:
  categories              列出所有分類
  tags                    列出所有標籤
  publish <file>          從檔案發表文章
  draft <file>            從檔案建立草稿
  delete <id> [--force]   刪除文章（--force 永久刪除，否則移至垃圾桶）
  test                    測試連線

範例:
  node publish-to-wordpress.js categories
  node publish-to-wordpress.js publish article.md
  node publish-to-wordpress.js delete 96 --force
  node publish-to-wordpress.js test

建立應用程式密碼:
  1. 登入 WordPress 後台
  2. 到 使用者 > 個人資料
  3. 找到「應用程式密碼」區塊
  4. 輸入名稱後點擊「新增」
  5. 複製產生的密碼到 .env 檔案
    `);
    return;
  }

  try {
    const publisher = new WordPressPublisher({
      siteUrl: 'https://loinc.org.tw'
    });

    const command = args[0];

    switch (command) {
      case 'categories':
        await publisher.getCategories();
        break;

      case 'tags':
        await publisher.getTags();
        break;

      case 'publish':
        if (!args[1]) {
          console.error('❌ 請提供檔案路徑');
          return;
        }
        await publisher.publishFromFile(args[1], { status: 'publish' });
        break;

      case 'draft':
        if (!args[1]) {
          console.error('❌ 請提供檔案路徑');
          return;
        }
        await publisher.publishFromFile(args[1], { status: 'draft' });
        break;

      case 'delete':
        if (!args[1]) {
          console.error('❌ 請提供文章 ID');
          return;
        }
        const postId = parseInt(args[1]);
        const force = args.includes('--force');
        await publisher.deletePost(postId, force);
        break;

      case 'test':
        console.log('🔍 測試連線到 loinc.org.tw...');
        await publisher.getCategories();
        console.log('✅ 連線成功！');
        break;

      default:
        console.error(`❌ 未知命令: ${command}`);
    }

  } catch (error) {
    console.error('執行失敗:', error.message);
    process.exit(1);
  }
}

// 如果直接執行此檔案
if (require.main === module) {
  main();
}

// 匯出供其他模組使用
module.exports = WordPressPublisher;
