# LOINC 首頁設置說明

目前遇到的問題：WordPress 主題的 header/footer 和我們自己的設計衝突

## 🎯 最佳解決方案（3選1）

### 方案 1：使用 Elementor（推薦，最簡單）

1. **安裝 Elementor**
   - WordPress 後台 > 外掛 > 安裝外掛
   - 搜尋 "Elementor"
   - 安裝並啟用 "Elementor Page Builder"

2. **編輯首頁**
   - 前往「頁面」> 找到「首頁」
   - 點擊「使用 Elementor 編輯」
   - 在 Elementor 設定中：
     - 點擊左下角設定圖示⚙️
     - Page Layout > 選擇「Canvas」（完全空白，無 header/footer）

3. **插入 HTML**
   - 拖曳「HTML」元素到頁面
   - 複製 `homepage-template.html` 的 body 內容
   - 貼上到 HTML 元素中
   - 發佈

4. **套用 CSS**
   - 外觀 > 自定義 > 額外 CSS
   - 複製 `custom-theme.css` 內容
   - 發佈

---

### 方案 2：使用空白模板（需要技術能力）

1. **建立空白頁面模板**
   ```php
   <?php
   /*
   Template Name: 完全空白
   */
   ?>
   <!DOCTYPE html>
   <html <?php language_attributes(); ?>>
   <head>
       <meta charset="<?php bloginfo( 'charset' ); ?>">
       <meta name="viewport" content="width=device-width, initial-scale=1">
       <?php wp_head(); ?>
   </head>
   <body <?php body_class(); ?>>
       <?php while ( have_posts() ) : the_post(); ?>
           <?php the_content(); ?>
       <?php endwhile; ?>
       <?php wp_footer(); ?>
   </body>
   </html>
   ```

2. **上傳模板**
   - 將此檔案命名為 `template-blank.php`
   - 上傳到主題目錄：`wp-content/themes/你的主題/`

3. **套用模板到首頁**
   - 編輯首頁
   - 在右側「頁面屬性」> 模板 > 選擇「完全空白」

---

### 方案 3：更換主題為 Landing Page 主題

1. **安裝 Astra 主題**（免費，支援 Landing Page）
   - 後台 > 外觀 > 佈景主題 > 安裝佈景主題
   - 搜尋 "Astra"
   - 安裝並啟用

2. **編輯首頁**
   - 編輯首頁
   - 右側「Astra 設定」
   - Disable Title: 開啟
   - Disable Primary Header: 開啟
   - Disable Footer: 開啟
   - Content Layout: Full Width Stretched

3. **插入內容**
   - 使用「自訂 HTML」區塊
   - 貼上我們的 HTML

---

## 🚀 我的推薦

**使用方案 1（Elementor）**，因為：
✅ 最簡單，只需點擊安裝
✅ 不需要寫程式
✅ 可視化編輯
✅ 完全控制版面
✅ 免費版就夠用

---

## 📋 需要的檔案

已準備好的檔案：
- `homepage-template.html` - HTML 內容
- `custom-theme.css` - CSS 樣式
- `homepage-complete-preview.html` - 完整預覽（可在本地開啟查看）

---

## 💡 如果您選擇方案 1

我可以幫您：
1. 準備好適合 Elementor 的 HTML 程式碼
2. 提供詳細的步驟截圖說明

請告訴我您想用哪個方案？
