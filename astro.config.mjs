import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // Указываем здесь правильный, финальный URL вашего сайта
  site: 'https://butlerspb-blog.netlify.app',
  
  // Включаем официальную интеграцию для автоматической генерации sitemap.xml
  integrations: [
    sitemap()
  ]
});
