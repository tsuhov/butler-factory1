// Файл: fixer.js - Хирургический ремонт существующих статей
import fs from 'fs/promises';
import path from 'path';

const POSTS_DIR = 'src/content/posts';
const SITE_URL = "https://butlerspb-blog.netlify.app";
const BRAND_NAME = "ButlerSPB";
const BRAND_BLOG_NAME = `Блог ${BRAND_NAME}`;
const BRAND_AUTHOR_NAME = `Эксперт ${BRAND_NAME}`;
const FALLBACK_IMAGE_URL = "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=2070&auto=format&fit=crop";

// --- Функция "мягкого" извлечения данных ---
function extractData(frontmatterText, field) {
    const regex = new RegExp(`${field}:\\s*["']?(.*?)["']?$`, 'm');
    const match = frontmatterText.match(regex);
    return match ? match[1] : null;
}

async function fixPosts() {
    console.log('--- Запуск Хирургического Ремонта ---');
    try {
        const files = await fs.readdir(POSTS_DIR);
        const mdFiles = files.filter(file => file.endsWith('.md'));
        let fixedCount = 0;
        let skippedCount = 0;

        for (const file of mdFiles) {
            const filePath = path.join(POSTS_DIR, file);
            const content = await fs.readFile(filePath, 'utf-8');
            
            const parts = content.split('---');
            if (parts.length < 3) {
                console.warn(`[!] Пропускаю файл ${file}: некорректная структура frontmatter.`);
                skippedCount++;
                continue;
            }
            
            const oldFrontmatterText = parts[1];
            const body = parts.slice(2).join('---');

            const title = extractData(oldFrontmatterText, 'title');
            const description = extractData(oldFrontmatterText, 'description');
            const pubDate = extractData(oldFrontmatterText, 'pubDate') || new Date().toISOString();

            if (!title || !description) {
                 console.warn(`[!] Пропускаю файл ${file}: не удалось извлечь title или description.`);
                 skippedCount++;
                 continue;
            }
            
            const slug = path.basename(file, '.md');
            const reviewCount = Math.floor(Math.random() * (900 - 300 + 1)) + 300;
            const ratingValue = (Math.random() * (5.0 - 4.7) + 4.7).toFixed(1);

            const fullSchema = {
                "@context": "https://schema.org",
                "@type": "HowTo",
                "name": title,
                "description": description,
                "image": { "@type": "ImageObject", "url": FALLBACK_IMAGE_URL },
                "aggregateRating": {
                    "@type": "AggregateRating", "ratingValue": ratingValue, "reviewCount": reviewCount,
                    "bestRating": "5", "worstRating": "1"
                },
                "publisher": {
                    "@type": "Organization", "name": BRAND_BLOG_NAME,
                    "logo": { "@type": "ImageObject", "url": `${SITE_URL}/favicon.ico` }
                },
                "mainEntityOfPage": { "@type": "WebPage", "@id": `${SITE_URL}/blog/${slug}/` }
            };

            const newFrontmatter = `---
title: "${title.replace(/"/g, '\\"')}"
description: "${description.replace(/"/g, '\\"')}"
pubDate: "${new Date(pubDate).toISOString()}"
author: "${BRAND_AUTHOR_NAME}"
heroImage: "${FALLBACK_IMAGE_URL}"
schema: ${JSON.stringify(fullSchema)}
---`;
            
            const newContent = newFrontmatter + body;

            await fs.writeFile(filePath, newContent, 'utf-8');
            console.log(`[FIX] Файл ${file} успешно отремонтирован.`);
            fixedCount++;
        }
        
        console.log(`[✔] Ремонт завершен! Отремонтировано: ${fixedCount} файлов. Пропущено: ${skippedCount} файлов.`);

    } catch (error) {
        console.error('[!] Критическая ошибка во время ремонта:', error);
    }
}

fixPosts();
