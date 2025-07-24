// Файл: astro.config.mjs (Правильная версия)
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://butlerspb-blog.netlify.app',
  // Убираем интеграцию sitemap, так как у нас есть свой postbuild.js
  // integrations: [sitemap()], 
  vite: {
    ssr: {
      // Эта строка нужна для корректной работы rss.xml.js
      external: ["sanitize-html"], 
    },
  },
});
