import { defineConfig } from 'astro/config';
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: 'https://butlerspb-blog.netlify.app',
  integrations: [sitemap()], // <-- Эта строка "включает" генератор карты сайта
  vite: {
    ssr: {
      external: ["sanitize-html"], // <-- Эта строка "чинит" ошибку со сборкой RSS
    },
  },
});
