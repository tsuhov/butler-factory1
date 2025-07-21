// Файл: fixer.js (Версия «Восстановитель»)
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

// --- НАСТРОЙКИ ---
const POSTS_DIR = 'src/content/posts';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY_CURRENT; // Используем ключ потока
const SITE_URL = "https://butlerspb-blog.netlify.app";
const BRAND_NAME = "ButlerSPB";
const BRAND_BLOG_NAME = `Блог ${BRAND_NAME}`;
const BRAND_AUTHOR_NAME = `Эксперт ${BRAND_NAME}`;
const FALLBACK_IMAGE_URL = "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=2070&auto=format&fit=crop";

const IMAGE_ARSENAL = [
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=2070&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1618221195710-dd6b41fa2247?q=80&w=2070&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=2070&auto=format&fit=crop"
];

if (!GEMINI_API_KEY) throw new Error("API-ключ не найден!");

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

async function restorePost(file) {
    console.log(`[RESTORE] Начинаю восстановление файла: ${file}`);
    const filePath = path.join(POSTS_DIR, file);
    const fileContent = await fs.readFile(filePath, 'utf-8');

    // Используем gray-matter, чтобы аккуратно отделить "паспорт" от "тела"
    const { content: body, data: oldData } = matter(fileContent);

    if (!body || body.trim().length < 100) {
        console.warn(`[!] Пропускаю файл ${file}: тело статьи слишком короткое или отсутствует.`);
        return;
    }
    
    // Отправляем тело статьи в ИИ, чтобы он заново создал SEO-данные
    const seoPrompt = `Вот текст статьи:\n\n${body.substring(0, 4000)}\n\nНа основе этого текста сгенерируй JSON-объект. ВАЖНО: твой ответ должен быть ТОЛЬКО валидным JSON-объектом. JSON должен содержать: "title" (SEO-заголовок), "description" (мета-описание). Контекст: это блог компании ButlerSPB.`;
    
    const responseText = await model.generateContent(seoPrompt).then(res => res.response.text());
    const match = responseText.match(/\{[\s\S]*\}/);
    if (!match) {
        throw new Error(`Не удалось извлечь JSON для файла ${file}`);
    }
    const seoData = JSON.parse(match[0]);

    // --- ПЕРЕСБОРКА "ПАСПОРТА" ---
    const slug = path.basename(file, '.md');
    const reviewCount = Math.floor(Math.random() * (900 - 300 + 1)) + 300;
    const ratingValue = (Math.random() * (5.0 - 4.7) + 4.7).toFixed(1);
    const finalHeroImage = IMAGE_ARSENAL[Math.floor(Math.random() * IMAGE_ARSENAL.length)];

    const fullSchema = {
      "@context": "https://schema.org",
      "@type": "HowTo",
      "name": seoData.title,
      "description": seoData.description,
      "image": { "@type": "ImageObject", "url": finalHeroImage },
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

    const newData = {
        title: seoData.title,
        description: seoData.description,
        pubDate: new Date(oldData.pubDate || Date.now()).toISOString(),
        author: BRAND_AUTHOR_NAME,
        heroImage: finalHeroImage,
        schema: fullSchema
    };
    
    const newContent = matter.stringify(body, newData);
    await fs.writeFile(filePath, newContent, 'utf-8');
    console.log(`[✔] Файл ${file} успешно восстановлен.`);
}

async function main() {
    try {
        const files = await fs.readdir(POSTS_DIR);
        const mdFiles = files.filter(file => file.endsWith('.md'));

        for (const file of mdFiles) {
            try {
                await restorePost(file);
                await new Promise(resolve => setTimeout(resolve, 2000)); // Пауза между файлами
            } catch (e) {
                console.error(`[!] Критическая ошибка при восстановлении файла ${file}:`, e.message);
                continue;
            }
        }
        console.log('--- Восстановление завершено ---');
    } catch (error) {
        console.error('[!] Критическая ошибка в работе восстановителя:', error);
    }
}

main();
