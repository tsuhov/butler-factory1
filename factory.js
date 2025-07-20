// Файл: factory.js (Версия 17.0, «Фирменный Стиль»)
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';

// --- НАСТРОЙКИ ОПЕРАЦИИ ---
const TARGET_URL_MAIN = "https://butlerspb.ru";
const TARGET_URL_RENT = "https://butlerspb.ru/rent";
const TOPICS_FILE = 'topics.txt';
const POSTS_DIR = 'src/content/posts';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SITE_URL = "https://butlerspb-blog.netlify.app";

// --- НОВЫЙ БЛОК: Константы бренда ---
const BRAND_NAME = "ButlerSPB";
const BRAND_BLOG_NAME = `Блог ${BRAND_NAME}`;
const BRAND_AUTHOR_NAME = `Эксперт ${BRAND_NAME}`;
// --- КОНЕЦ БЛОКА ---

const FALLBACK_IMAGE_URL = "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=2070&auto=format&fit=crop";

if (!GEMINI_API_KEY) {
  throw new Error("Секретный ключ GEMINI_API_KEY не найден в GitHub Secrets!");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

const ANCHORS = [
    `узнайте больше об управлении на <a href="${TARGET_URL_RENT}" target="_blank" rel="nofollow">сайте ${BRAND_NAME}</a>`,
    `профессиональные услуги по управлению можно найти <a href="${TARGET_URL_RENT}" target="_blank" rel="nofollow">здесь</a>`,
    `как советуют эксперты из <a href="${TARGET_URL_MAIN}" target="_blank" rel="nofollow">${BRAND_NAME}</a>`,
    `подробности на <a href="${TARGET_URL_RENT}" target="_blank" rel="nofollow">этой странице</a>`,
    `доверительное управление квартирой - <a href="${TARGET_URL_RENT}" target="_blank" rel="nofollow">отличное решение</a>`
];

async function isUrlAccessible(url) {
    if (!url || !url.startsWith('http')) return false;
    try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok;
    } catch (error) {
        console.warn(`[!] Предупреждение: не удалось проверить URL изображения: ${url}. Ошибка: ${error.message}`);
        return false;
    }
}

function slugify(text) {
    const from = "а б в г д е ё ж з и й к л м н о п р с т у ф х ц ч ш щ ъ ы ь э ю я".split(' ');
    const to = "a b v g d e yo zh z i y k l m n o p r s t u f h c ch sh sch '' y ' e yu ya".split(' ');
    let newText = text.toString().toLowerCase().trim();
    for (let i = 0; i < from.length; i++) {
        newText = newText.replace(new RegExp(from[i], 'g'), to[i]);
    }
    return newText.replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
}

async function generateWithRetry(prompt, maxRetries = 4) {
    let delay = 5000;
    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = await model.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            if (error.message.includes('503') || error.message.includes('429')) {
                console.warn(`[!] Модель перегружена или квота исчерпана. Попытка ${i + 1} из ${maxRetries}. Жду ${delay / 1000}с...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;
            } else {
                throw error;
            }
        }
    }
    throw new Error(`Не удалось получить ответ от модели после ${maxRetries} попыток.`);
}

async function generatePost(topic, slug) {
    console.log(`[+] Генерирую статью на тему: ${topic}`);
    
    const planPrompt = `Создай детальный, экспертный план-структуру для SEO-статьи на тему "${topic}". Контекст: статья пишется для блога компании ButlerSPB, которая занимается управлением посуточной арендой в Санкт-Петербурге.`;
    const plan = await generateWithRetry(planPrompt);

    const articlePrompt = `Напиши экспертную, полезную SEO-статью по этому плану:\n\n${plan}\n\nТема: "${topic}". ВАЖНО: строго следуй плану и используй синтаксис Markdown для всех заголовков. Текст должен быть написан от лица компании ButlerSPB и может ненавязчиво упоминать ее. Не добавляй никакого сопроводительного текста перед первым заголовком. Текст должен начинаться сразу с заголовка H1.`;
    let articleText = await generateWithRetry(articlePrompt);

    const paragraphs = articleText.split('\n\n');
    if (paragraphs.length > 2) {
        const randomIndex = Math.floor(Math.random() * (paragraphs.length - 2)) + 1;
        const randomAnchor = ANCHORS[Math.floor(Math.random() * ANCHORS.length)];
        paragraphs[randomIndex] += ` ${randomAnchor}`;
        articleText = paragraphs.join('\n\n');
    }
    
    const seoPrompt = `Для статьи на тему "${topic}" сгенерируй JSON-объект. ВАЖНО: твой ответ должен быть ТОЛЬКО валидным JSON-объектом. JSON должен содержать: "title", "description", "heroImage" (URL с Unsplash или Pexels). Контекст: это блог компании ButlerSPB.`;
    let seoText = await generateWithRetry(seoPrompt);

    const match = seoText.match(/\{[\s\S]*\}/);
    if (!match) { throw new Error("Не удалось найти валидный JSON в ответе модели."); }
    const seoData = JSON.parse(match[0]);

    const reviewCount = Math.floor(Math.random() * (900 - 300 + 1)) + 300;
    const ratingValue = (Math.random() * (5.0 - 4.7) + 4.7).toFixed(1);

    const isImageOk = await isUrlAccessible(seoData.heroImage);
    const finalHeroImage = isImageOk ? seoData.heroImage : FALLBACK_IMAGE_URL;
    if (!isImageOk) {
        console.warn(`[!] Изображение от Gemini недоступно. Используется запасное.`);
    }

    const fullSchema = {
      "@context": "https://schema.org",
      "@type": "HowTo",
      "name": seoData.title,
      "description": seoData.description,
      "image": { "@type": "ImageObject", "url": finalHeroImage },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": ratingValue,
        "reviewCount": reviewCount,
        "bestRating": "5",
        "worstRating": "1"
      },
      "publisher": {
        "@type": "Organization",
        "name": BRAND_BLOG_NAME, // Используем константу
        "logo": {
          "@type": "ImageObject",
          "url": `${SITE_URL}/favicon.ico`
        }
      },
      "mainEntityOfPage": { "@type": "WebPage", "@id": `${SITE_URL}/blog/${slug}/` }
    };

    const frontmatter = `---
title: "${seoData.title.replace(/"/g, '\\"')}"
description: "${seoData.description.replace(/"/g, '\\"')}"
pubDate: "${new Date().toISOString()}"
author: "${BRAND_AUTHOR_NAME}"
heroImage: "${finalHeroImage}"
schema: ${JSON.stringify(fullSchema)}
---
`;
    return frontmatter + '\n' + articleText;
}

async function main() {
    try {
        const BATCH_SIZE = parseInt(process.env.BATCH_SIZE, 10) || 10;
        console.log(`[i] Размер пачки установлен на: ${BATCH_SIZE}`);
        const topics = (await fs.readFile(TOPICS_FILE, 'utf-8')).split(/\r?\n/).map(topic => topic.trim()).filter(Boolean);
        const postsDir = path.join(process.cwd(), 'src', 'content', 'posts');
        await fs.mkdir(postsDir, { recursive: true });
        const existingFiles = await fs.readdir(postsDir);
        const existingSlugs = existingFiles.map(file => file.replace('.md', ''));
        
        const newTopics = topics.filter(topic => {
            const topicSlug = slugify(topic);
            return topicSlug && !existingSlugs.includes(topicSlug);
        });

        if (newTopics.length === 0) { console.log("Нет новых тем для генерации."); return; }
        console.log(`Найдено ${newTopics.length} новых тем. Беру в работу первые ${BATCH_SIZE}.`);

        for (const topic of newTopics.slice(0, BATCH_SIZE)) { 
            try {
                const slug = slugify(topic);
                if (!slug) { console.error(`[!] Пропускаю тему "${topic}", так как из нее не удалось создать имя файла.`); continue; }
                const fullContent = await generatePost(topic, slug);
                await fs.writeFile(path.join(postsDir, `${slug}.md`), fullContent);
                console.log(`[✔] Статья "${topic}" успешно создана и сохранена.`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (e) {
                console.error(`[!] Ошибка при генерации статьи "${topic}": ${e.message}`);
                continue;
            }
        }
    } catch (error) {
        console.error("[!] Критическая ошибка в работе завода:", error);
    }
}

main();
