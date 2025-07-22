// Файл: factory.js (Версия «Центральный Диспетчер» - Исполнитель)
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';

const TARGET_URL_MAIN = "https://butlerspb.ru";
const TARGET_URL_RENT = "https://butlerspb.ru/rent";
const POSTS_DIR = 'src/content/posts';
const SITE_URL = "https://butlerspb-blog.netlify.app";
const BRAND_NAME = "ButlerSPB";
const BRAND_BLOG_NAME = `Блог ${BRAND_NAME}`;
const BRAND_AUTHOR_NAME = `Эксперт ${BRAND_NAME}`;
const FALLBACK_IMAGE_URL = "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=2070&auto=format&fit=crop";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    throw new Error("Не был предоставлен API-ключ для этого потока (GEMINI_API_KEY)!");
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

const ANCHORS = [
    `узнайте больше об управлении на <a href="${TARGET_URL_RENT}" target="_blank" rel="nofollow">сайте ${BRAND_NAME}</a>`,
    `профессиональные услуги по управлению можно найти <a href="${TARGET_URL_RENT}" target="_blank" rel="nofollow">здесь</a>`,
    `как советуют эксперты из <a href="${TARGET_URL_MAIN}" target="_blank" rel="nofollow">${BRAND_NAME}</a>`
];

async function isUrlAccessible(url) {
    if (typeof url !== 'string' || !url.startsWith('http')) return false;
    try {
        const response = await fetch(url, { method: 'HEAD', timeout: 5000 });
        return response.ok;
    } catch (error) {
        console.warn(`[!] Предупреждение: не удалось проверить URL изображения: ${url}. Ошибка: ${error.message}`);
        return false;
    }
}

function slugify(text) {
    const cleanedText = text.toString().replace(/[\x00-\x1F\x7F-\x9F]/g, "").trim();
    const from = "а б в г д е ё ж з и й к л м н о п р с т у ф х ц ч ш щ ъ ы ь э ю я".split(' ');
    const to = "a b v g d e yo zh z i y k l m n o p r s t u f h c ch sh sch '' y ' e yu ya".split(' ');
    let newText = cleanedText.toLowerCase();
    for (let i = 0; i < from.length; i++) {
        newText = newText.replace(new RegExp(from[i], 'g'), to[i]);
    }
    return newText.replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
}

async function generateWithRetry(prompt) {
    let retries = 3;
    let delay = 3000;
    while (retries > 0) {
        try {
            const result = await model.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            if (error.message.includes('503') || error.message.includes('429')) {
                console.warn(`[!] Модель перегружена или квота исчерпана. Попытка ${4 - retries}. Жду ${delay / 1000}с...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;
                retries--;
            } else {
                throw error;
            }
        }
    }
    throw new Error(`Не удалось получить ответ от модели после нескольких попыток.`);
}

async function generatePost(topic, slug) {
    const planPrompt = `Создай детальный, экспертный план-структуру для SEO-статьи на тему "${topic}". Контекст: блог компании ButlerSPB.`;
    const plan = await generateWithRetry(planPrompt);

    const articlePrompt = `Напиши экспертную SEO-статью по этому плану:\n\n${plan}\n\nТема: "${topic}". ВАЖНО: используй синтаксис Markdown для всех заголовков. Текст от лица компании ButlerSPB.`;
    let articleText = await generateWithRetry(articlePrompt);

    articleText = articleText.replace(/!\[.*?\]\((?!http).*?\)/g, '');

    const paragraphs = articleText.split('\n\n');
    if (paragraphs.length > 2) {
        const randomIndex = Math.floor(Math.random() * (paragraphs.length - 2)) + 1;
        const randomAnchor = ANCHORS[Math.floor(Math.random() * ANCHORS.length)];
        paragraphs[randomIndex] += ` ${randomAnchor}`;
        articleText = paragraphs.join('\n\n');
    }
    
    const seoPrompt = `Для статьи на тему "${topic}" сгенерируй JSON-объект. ВАЖНО: только валидный JSON. JSON должен содержать: "title", "description", "heroImage" (URL с Unsplash или Pexels), "publisherName" (название издателя, например "Блог ButlerSPB").`;
    let seoText = await generateWithRetry(seoPrompt);

    const match = seoText.match(/\{[\s\S]*\}/);
    if (!match) { throw new Error("Не удалось найти валидный JSON в ответе модели."); }
    const seoData = JSON.parse(match[0]);

    const reviewCount = Math.floor(Math.random() * (900 - 300 + 1)) + 300;
    const ratingValue = (Math.random() * (5.0 - 4.7) + 4.7).toFixed(1);
    
    const isImageOk = await isUrlAccessible(seoData.heroImage);
    const finalHeroImage = isImageOk ? seoData.heroImage : FALLBACK_IMAGE_URL;

    const fullSchema = {
      "@context": "https://schema.org",
      "@type": "HowTo",
      "name": seoData.title,
      "description": seoData.description,
      "image": { "@type": "ImageObject", "url": finalHeroImage },
      "aggregateRating": {
        "@type": "AggregateRating", "ratingValue": ratingValue, "reviewCount": reviewCount,
        "bestRating": "5", "worstRating": "1",
        "itemReviewed": { "@type": "Thing", "name": seoData.title }
      },
      "publisher": {
        "@type": "Organization", "name": seoData.publisherName,
        "logo": { "@type": "ImageObject", "url": `${SITE_URL}/favicon.ico` }
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
    const topic = process.env.TOPIC;
    if (!topic) {
        console.log("Не получена тема для генерации. Завершение.");
        return;
    }
    
    console.log(`[+] Начинаю генерацию статьи на тему: ${topic}`);
    try {
        const slug = slugify(topic);
        if (!slug) {
            throw new Error(`Не удалось создать slug из темы: "${topic}"`);
        }
        
        const fullContent = await generatePost(topic, slug);
        const postsDir = path.join(process.cwd(), 'src', 'content', 'posts');
        await fs.mkdir(postsDir, { recursive: true });
        
        await fs.writeFile(path.join(postsDir, `${slug}.md`), fullContent);
        console.log(`[✔] Статья "${topic}" успешно создана как ${slug}.md`);
    } catch (e) {
        console.error(`[!] Ошибка при генерации статьи "${topic}": ${e.message}`);
        process.exit(1);
    }
}

main();
