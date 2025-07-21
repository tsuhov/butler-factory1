// Файл: surgeon.js - Скрипт для хирургического ремонта frontmatter
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter'; // Специальный инструмент для работы с frontmatter

const POSTS_DIR = 'src/content/posts';
const SITE_URL = "https://butlerspb-blog.netlify.app";
const BRAND_NAME = "ButlerSPB";
const BRAND_BLOG_NAME = `Блог ${BRAND_NAME}`;
const BRAND_AUTHOR_NAME = `Эксперт ${BRAND_NAME}`;
const FALLBACK_IMAGE_URL = "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=2070&auto=format&fit=crop";

async function fixPosts() {
    console.log('--- Запуск Хирургического Ремонта ---');
    try {
        const files = await fs.readdir(POSTS_DIR);
        const mdFiles = files.filter(file => file.endsWith('.md'));
        let fixedCount = 0;

        for (const file of mdFiles) {
            const filePath = path.join(POSTS_DIR, file);
            const content = await fs.readFile(filePath, 'utf-8');
            
            try {
                const { data: oldData, content: body } = matter(content);

                // --- ПЕРЕСБОРКА "ПАСПОРТА" ---
                const slug = path.basename(file, '.md');
                
                const reviewCount = Math.floor(Math.random() * (900 - 300 + 1)) + 300;
                const ratingValue = (Math.random() * (5.0 - 4.7) + 4.7).toFixed(1);

                const fullSchema = {
                    "@context": "https://schema.org",
                    "@type": "HowTo",
                    "name": oldData.title,
                    "description": oldData.description,
                    "image": { "@type": "ImageObject", "url": oldData.heroImage || FALLBACK_IMAGE_URL },
                    "aggregateRating": {
                        "@type": "AggregateRating",
                        "ratingValue": ratingValue,
                        "reviewCount": reviewCount,
                        "bestRating": "5",
                        "worstRating": "1"
                    },
                    "publisher": {
                        "@type": "Organization",
                        "name": BRAND_BLOG_NAME,
                        "logo": { "@type": "ImageObject", "url": `${SITE_URL}/favicon.ico` }
                    },
                    "mainEntityOfPage": { "@type": "WebPage", "@id": `${SITE_URL}/blog/${slug}/` }
                };

                const newData = {
                    title: oldData.title,
                    description: oldData.description,
                    pubDate: new Date(oldData.pubDate).toISOString(),
                    author: BRAND_AUTHOR_NAME,
                    heroImage: oldData.heroImage || FALLBACK_IMAGE_URL,
                    schema: fullSchema
                };
                
                const newContent = matter.stringify(body, newData);

                await fs.writeFile(filePath, newContent, 'utf-8');
                console.log(`[FIX] Файл ${file} успешно отремонтирован.`);
                fixedCount++;

            } catch (e) {
                console.error(`[!] Ошибка при обработке файла ${file}: ${e.message}. Пропускаю...`);
                continue;
            }
        }
        console.log(`[✔] Ремонт завершен! Обработано файлов: ${fixedCount}`);
    } catch (error) {
        console.error('[!] Критическая ошибка во время ремонта:', error);
    }
}

fixPosts();
