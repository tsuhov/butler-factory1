// Файл: astro.config.mjs (Правильная версия)
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://butlerspb-blog.netlify.app',
  // Убираем интеграцию sitemap, так как у нас есть свой postbuild.js
  // integrations: [sitemap()], 
  
  // Производительность сервера
  output: 'static',
  
  vite: {
    ssr: {
      // Эта строка нужна для корректной работы rss.xml.js
      external: ["sanitize-html"],
      // Оптимизация для статической генерации
      noExternal: ['@astrojs/*']
    },
    
    // НОВЫЕ НАСТРОЙКИ ДЛЯ РЕШЕНИЯ ПРОБЛЕМЫ ПАМЯТИ
    build: {
      // Отключаем sourcemaps в продакшене для экономии памяти
      sourcemap: false,
      // Оптимизация чанков
      rollupOptions: {
        output: {
          manualChunks: undefined,
          inlineDynamicImports: false,
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]'
        }
      },
      // Увеличиваем лимит для больших чанков
      chunkSizeWarningLimit: 2000,
      // Минификация только в продакшене
      minify: process.env.NODE_ENV === 'production' ? 'esbuild' : false,
      // Оптимизация ассетов
      assetsInlineLimit: 0, // Отключаем инлайн ассетов для экономии памяти
    },
    
    // Увеличиваем лимиты для обработки файлов
    server: {
      fs: {
        // Позволяем читать файлы из проекта
        allow: ['..']
      }
    }
  }
});
