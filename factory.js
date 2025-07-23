// Файл: factory.js (Версия «Гибридный Двигатель»)
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import { execa } from 'execa';

// --- НАСТРОЙКИ ОПЕРАЦИИ ---
const TARGET_URL_MAIN = "https://butlerspb.ru";
const TARGET_URL_RENT = "https://butlerspb.ru/rent";
const TOPICS_FILE = 'topics.txt';
const POSTS_DIR = 'src/content/posts';
const SITE_URL = "https://butlerspb-blog.netlify.app";
const BRAND_NAME = "ButlerSPB";
const BRAND_BLOG_NAME = `Блог ${BRAND_NAME}`;
const BRAND_AUTHOR_NAME = `Эксперт ${BRAND_NAME}`;
const FALLBACK_IMAGE_URL = "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=2070&auto=format&fit=crop";

// --- НАСТРОЙКИ МОДЕЛЕЙ ---
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEEPSEEK_MODEL_NAME = "deepseek/deepseek-r1-0528:free"; // Модель по умолчанию для OpenRouter
const GEMINI_MODEL_NAME = "gemini-2.5-pro"; // Убедитесь, что эта модель доступна для вашего ключа

// Читаем переменные окружения
const modelChoice = process.env.MODEL_CHOICE || 'gemini'; // По умолчанию Gemini
const geminiApiKey = process.env.GEMINI_API_KEY_CURRENT;
const openRouterApiKey = process.env.OPENROUTER_API_KEY_CURRENT;

// Инициализация API в зависимости от выбора
let genAI;
if (modelChoice === 'gemini') {
    if (!geminiApiKey) {
        throw new Error("Не был предоставлен API-ключ Gemini для этого потока (GEMINI_API_KEY_CURRENT)!");
    }
    genAI = new GoogleGenerativeAI(geminiApiKey);
    console.log("✨ Использую модель Gemini...");
} else if (modelChoice === 'deepseek') {
    if (!openRouterApiKey) {
        throw new Error("Не был предоставлен API-ключ OpenRouter для этого потока (OPENROUTER_API_KEY_CURRENT)!");
    }
    console.log("🚀 Использую модель DeepSeek через OpenRouter...");
}

const ANCHORS = [
    `узнайте больше об управлении на <a href="${TARGET_URL_RENT}" target="_blank" rel="nofollow">сайте ${BRAND_NAME}</a>`,
    `профессиональные услуги по управлению можно найти <a href="${TARGET_URL_RENT}" target="_blank" rel="nofollow">здесь</a>`,
    `как советуют эксперты из <a href="${TARGET_URL_MAIN}" target="_blank" rel="nofollow">${BRAND_NAME}</a>`,
    `подробности на <a href="${TARGET_URL_RENT}" target="_blank" rel="nofollow">этой странице</a>`,
    `доверительное управление квартирой - <a href="${TARGET_URL_RENT}" target="_blank" rel="nofollow">отличное решение</a>`
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

async function generateWithRetry(prompt, maxRetries = 4) {
    let delay = 5000;
    for (let i = 0; i < maxRetries; i++) {
        try {
            if (modelChoice === 'deepseek') {
                const response = await fetch(OPENROUTER_API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${openRouterApiKey}`,
                        'HTTP-Referer': TARGET_URL_MAIN,
                        'X-Title': BRAND_BLOG_NAME
                    },
                    body: JSON.stringify({
                        model: DEEPSEEK_MODEL_NAME,
                        messages: [{ role: "user", content: prompt }]
                    })
                });

                if (!response.ok) {
                    if (response.status === 429) throw new Error(`429 Too Many Requests`);
                    throw new Error(`Ошибка HTTP от OpenRouter: ${response.status}`);
                }
                const data = await response.json();
                if (!data.choices || data.choices.length === 0) throw new Error("Ответ от API OpenRouter не содержит поля 'choices'.");
                return data.choices[0].message.content;

            } else { // Логика для Gemini
                const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_NAME });
                const result = await model.generateContent(prompt);
                return result.response.text();
            }
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
    throw new Error(`Не удалось получить ответ от модели ${modelChoice} после ${maxRetries} попыток.`);
}

async function notifyIndexNow(url) {
    console.log(`📢 Отправляю уведомление для ${url} в IndexNow...`);
    const API_KEY = "d1b055ab1eb146d892169bbb2c96550e";
    const HOST = "butlerspb-blog.netlify.app";
    
    const payload = JSON.stringify({
        host: HOST,
        key: API_KEY,
        urlList: [url]
    });

    try {
        console.log("--- Отправка в Яндекс ---");
        await execa('curl', ['-X', 'POST', 'https://yandex.com/indexnow', '-H', 'Content-Type: application/json; charset=utf-8', '-d', payload]);
        console.log("--- Отправка в Bing ---");
        await execa('curl', ['-X', 'POST', 'https://www.bing.com/indexnow', '-H', 'Content-Type: application/json; charset=utf-8', '-d', payload]);
        console.log(`[✔] Уведомление для ${url} успешно отправлено.`);
    } catch (error) {
        console.error(`[!] Ошибка при отправке в IndexNow для ${url}:`, error.stderr);
    }
}

async function generatePost(topic, slug, interlinks) {
    console.log(`[+] Генерирую статью на тему: ${topic}`);
    
    const planPrompt = `Создай детальный, экспертный план-структуру для SEO-статьи на тему "${topic}". Контекст: статья пишется для блога компании ButlerSPB.`;
    const plan = await generateWithRetry(planPrompt);

    const articlePrompt = `Напиши экспертную, полезную SEO-статью по этому плану:\n\n${plan}\n\nТема: "${topic}". ВАЖНО: строго следуй плану и используй синтаксис Markdown для всех заголовков (# для H1, ## для H2, ### для H3). Текст должен быть написан от лица компании ButlerSPB. Не добавляй никакого сопроводительного текста перед первым заголовком.`;
    let articleText = await generateWithRetry(articlePrompt);

    articleText = articleText.replace(/!\[.*?\]\((?!http).*?\)/g, '');

    if (interlinks.length > 0) {
        let interlinkingBlock = '\n\n---\n\n## Читайте также\n\n';
        interlinks.forEach(link => {
            interlinkingBlock += `*   [${link.title}](${link.url})\n`;
        });
        articleText += interlinkingBlock;
    }

    const paragraphs = articleText.split('\n\n');
    if (paragraphs.length > 2) {
        const randomIndex = Math.floor(Math.random() * (paragraphs.length - 2)) + 1;
        const randomAnchor = ANCHORS[Math.floor(Math.random() * ANCHORS.length)];
        paragraphs[randomIndex] += ` ${randomAnchor}`;
        articleText = paragraphs.join('\n\n');
    }
    
    const seoPrompt = `Для статьи на тему "${topic}" сгенерируй JSON-объект. ВАЖНО: твой ответ должен быть ТОЛЬКО валидным JSON-объектом. JSON должен содержать: "title", "description". Контекст: это блог компании ButlerSPB.`;
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
    const threadId = parseInt(process.env.THREAD_ID, 10) || 1;
    console.log(`[Поток #${threadId}] Запуск рабочего потока...`);

    try {
        const BATCH_SIZE = parseInt(process.env.BATCH_SIZE, 10) || 1;
        
        const fileContent = await fs.readFile(TOPICS_FILE, 'utf-8');
        const allTopics = fileContent.split(/\r?\n/).map(topic => topic.trim()).filter(Boolean);

        const postsDir = path.join(process.cwd(), 'src', 'content', 'posts');
        await fs.mkdir(postsDir, { recursive: true });
        
        const existingFiles = await fs.readdir(postsDir);
        const existingSlugs = existingFiles.map(file => file.replace('.md', ''));
        
        let newTopics = allTopics.filter(topic => {
            const topicSlug = slugify(topic);
            return topicSlug && !existingSlugs.includes(topicSlug);
        });

        const totalThreads = parseInt(process.env.TOTAL_THREADS, 10) || 1;
        const topicsForThisThread = newTopics.filter((_, index) => index % totalThreads === (threadId - 1));

        if (topicsForThisThread.length === 0) {
            console.log(`[Поток #${threadId}] Нет новых тем для этого потока. Завершение.`);
            return;
        }
        
        console.log(`[Поток #${threadId}] Найдено ${topicsForThisThread.length} новых тем. Беру в работу первые ${BATCH_SIZE}.`);

        let allPostsForLinking = [];
        for (const slug of existingSlugs) {
            const content = await fs.readFile(path.join(postsDir, `${slug}.md`), 'utf-8');
            const titleMatch = content.match(/title:\s*["']?(.*?)["']?$/m);
            if (titleMatch) {
                allPostsForLinking.push({ title: titleMatch[1], url: `/blog/${slug}/` });
            }
        }
        
        for (const topic of topicsForThisThread.slice(0, BATCH_SIZE)) { 
            try {
                const slug = slugify(topic);
                if (!slug) continue;
                
                let randomInterlinks = [];
                if (allPostsForLinking.length > 0) {
                    randomInterlinks = [...allPostsForLinking].sort(() => 0.5 - Math.random()).slice(0, 3);
                }
                
                const fullContent = await generatePost(topic, slug, randomInterlinks);
                await fs.writeFile(path.join(postsDir, `${slug}.md`), fullContent);
                console.log(`[Поток #${threadId}] [✔] Статья "${topic}" успешно создана.`);
                
                const newUrl = `${SITE_URL}/blog/${slug}/`;
                await notifyIndexNow(newUrl);

                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (e) {
                if (e.message.includes('429')) {
                    console.error(`[Поток #${threadId}] [!] Квота для текущего ключа исчерпана. Поток завершает работу.`);
                    process.exit(0);
                }
                console.error(`[Поток #${threadId}] [!] Ошибка при генерации статьи "${topic}": ${e.message}`);
                continue;
            }
        }
    } catch (error) {
        console.error(`[Поток #${threadId}] [!] Критическая ошибка:`, error);
        process.exit(1);
    }
}

main();
