import fs from 'fs';
import path from 'path';

const publicDir = './dist';
const sitemapPath = './dist/sitemap.xml';
const siteUrl = 'https://ВАШ-БУДУЩИЙ-АДРЕС.netlify.app'; // Мы заменим это позже

function getHtmlFiles(dir) {
    let files = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            files = [...files, ...getHtmlFiles(fullPath)];
        } else if (item.name.endsWith('.html')) {
            files.push(fullPath);
        }
    }
    return files;
}

const allFiles = getHtmlFiles(publicDir);
const urls = allFiles.map(file => {
    const urlPath = file.replace(publicDir, '').replace(/\\/g, '/').replace('index.html', '');
    return `
    <url>
        <loc>${siteUrl}${urlPath}</loc>
        <lastmod>${new Date().toISOString()}</lastmod>
        <priority>0.8</priority>
    </url>`;
});

const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${urls.join('')}
</urlset>`;

fs.writeFileSync(sitemapPath, sitemapContent);
console.log(`[✔] Sitemap.xml успешно сгенерирован! Найдено ${urls.length} страниц.`);
