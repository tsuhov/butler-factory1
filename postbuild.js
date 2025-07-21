// Файл: postbuild.js (Версия 3.0, "Динамический Навигатор")
import fs from 'fs/promises';
import path from 'path';

const SITE_URL = 'https://butlerspb-blog.netlify.app';
const DIST_DIR = './dist';

async function generateSitemap() {
  console.log('--- Запуск Динамического Генератора Sitemap.xml ---');
  try {
    // Рекурсивно ищем все HTML файлы в папке сборки 'dist'
    const files = await findHtmlFiles(DIST_DIR);

    const urls = files.map(file => {
      // Превращаем путь к файлу в URL
      let relativePath = path.relative(DIST_DIR, file).replace(/\\/g, '/');
      if (relativePath.endsWith('index.html')) {
        // Убираем 'index.html' для корневых страниц директорий
        relativePath = relativePath.slice(0, -10);
      } else {
        // Убираем '.html' для всех остальных
        relativePath = relativePath.slice(0, -5);
      }
      return `
    <url>
        <loc>${SITE_URL}/${relativePath}</loc>
        <lastmod>${new Date().toISOString()}</lastmod>
        <priority>0.8</priority>
    </url>`;
    });

    const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${urls.join('')}
</urlset>`;

    await fs.writeFile(path.join(DIST_DIR, 'sitemap.xml'), sitemapContent);
    console.log(`[✔] Sitemap.xml успешно сгенерирован! Найдено ${urls.length} страниц.`);

  } catch (error) {
    console.error('[!] Критическая ошибка при генерации Sitemap.xml:', error);
    process.exit(1); // Проваливаем сборку, если sitemap не создался
  }
}

// Вспомогательная функция для поиска всех .html файлов
async function findHtmlFiles(dir) {
    let htmlFiles = [];
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    for (const dirent of dirents) {
        const res = path.resolve(dir, dirent.name);
        if (dirent.isDirectory()) {
            htmlFiles = htmlFiles.concat(await findHtmlFiles(res));
        } else if (res.endsWith('.html')) {
            htmlFiles.push(res);
        }
    }
    return htmlFiles;
}

generateSitemap();
