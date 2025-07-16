// Файл: factory.js (Версия 2.0, "Бронебойный")
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';

// --- НАСТРОЙКИ ОПЕРАЦИИ ---
const TARGET_URL_MAIN = "https://butlerspb.ru";
const TARGET_URL_RENT = "https://butlerspb.ru/rent";
const TOPICS_FILE = 'topics.txt';
const POSTS_DIR = 'src/content/posts';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error("Секретный ключ GEMINI_API_KEY не найден в GitHub Secrets!");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
// Используем новую, более мощную модель, как вы и просили
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

const ANCHORS = [
    `узнайте больше об управлении на <a href="${TARGET_URL_RENT}" target="_blank" rel="nofollow">сайте ButlerSPB</a>`,
    `профессиональные услуги по управлению можно найти <a href="${TARGET_URL_RENT}" target="_blank" rel="nofollow">здесь</a>`,
    `как советуют эксперты из <a href="${TARGET_URL_MAIN}" target="_blank" rel="nofollow">ButlerSPB</a>`,
    `подробности на <a href="${TARGET_URL_RENT}" target="_blank" rel="nofollow">этой странице</a>`,
    `доверительное управление квартирой - <a href="${TARGET_URL_RENT}" target="_blank" rel="nofollow">отличное решение</a>`
];

function slugify(text) {
  const a = "àáâäæãåāăąçćčđďèéêëēėęěğǵḧîïíīįìłḿñńǹňôöòóœøōõőṕŕřßśšşșťțûüùúūǘůűųẃẍÿýžźż·/_,:;"
  const b = "aaaaaaaaaacccddeeeeeeeegghiiiiiilmnnnnoooooooooprrsssssttuuuuuuuuuwxyyzzz------"
  const p = new RegExp(a.split('').join('|'), 'g')
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(p, c => b.charAt(a.indexOf(c)))
    .replace(/&/g, '-and-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
}

async function generatePost(topic) {
    console.log(`[+] Генерирую статью на тему: ${topic}`);
    
    // 1. Создаем структуру
    const planPrompt = `Создай детальный, экспертный план-структуру для статьи на тему "${topic}". Включи 3-4 основных раздела с подзаголовками H2 и несколько подпунктов для каждого.`;
    const planResult = await model.generateContent(planPrompt);
    const plan = planResult.response.text();

    // 2. Пишем статью по плану
    const articlePrompt = `Напиши экспертную, полезную статью по этому плану:\n\n${plan}\n\nТема: "${topic}". Пиши без воды, структурированно, для владельцев недвижимости.`;
    const articleResult = await model.generateContent(articlePrompt);
    let articleText = articleResult.response.text();

    // 3. Вставляем ссылку
    const paragraphs = articleText.split('\n\n');
    if (paragraphs.length > 2) {
        const randomIndex = Math.floor(Math.random() * (paragraphs.length - 2)) + 1;
        const randomAnchor = ANCHORS[Math.floor(Math.random() * ANCHORS.length)];
        paragraphs[randomIndex] += ` ${randomAnchor}`;
        articleText = paragraphs.join('\n\n');
    }
    
    // 4. Генерируем SEO и Schema (УЛУЧШЕННЫЙ, БОЛЕЕ СТРОГИЙ ПРОМПТ)
    const seoPrompt = `Для статьи на тему "${topic}" сгенерируй JSON-объект. ВАЖНО: твой ответ должен быть ТОЛЬКО валидным JSON-объектом, без какого-либо сопроводительного текста, комментариев или markdown-оберток. JSON должен содержать следующие поля: "title" (SEO-заголовок до 70 символов), "description" (мета-описание до 160 символов), "schema" (валидный JSON-LD schema.org для типа BlogPosting, включающий headline, description, author, publisher, datePublished).`;
    const seoResult = await model.generateContent(seoPrompt);
    let seoText = seoResult.response.text();

    // **НОВЫЙ БРОНЕБОЙНЫЙ ПАРСЕР**
    const match = seoText.match(/\{[\s\S]*\}/);
    if (!match) {
        throw new Error("Не удалось найти валидный JSON в ответе модели.");
    }
    const seoJson = match[0];
    const seoData = JSON.parse(seoJson);

    const frontmatter = `---
title: "${seoData.title.replace(/"/g, '\\"')}"
description: "${seoData.description.replace(/"/g, '\\"')}"
pubDate: "${new Date().toISOString()}"
author: "ButlerSPB Expert"
schema: ${JSON.stringify(seoData.schema)}
---
`;
    return frontmatter + '\n' + articleText;
}

// ... (остальной код функции main() остается без изменений)
async function main() {
    try {
        const postsDir = path.join(process.cwd(), 'src', 'content', 'posts');
        await fs.mkdir(postsDir, { recursive: true });
        
        const topics = (await fs.readFile(TOPICS_FILE, 'utf-8')).split('\n').filter(Boolean);
        const existingFiles = await fs.readdir(postsDir);
        const existingSlugs = existingFiles.map(file => file.replace('.md', ''));

        const newTopics = topics.filter(topic => !existingSlugs.includes(slugify(topic)));

        if (newTopics.length === 0) {
            console.log("Нет новых тем для генерации. Завод в режиме ожидания.");
            return;
        }

        console.log(`Найдено ${newTopics.length} новых тем. Начинаю генерацию...`);

        for (const topic of newTopics.slice(0, 50)) { // Лимит на 50 статей за один запуск
            try {
                const slug = slugify(topic);
                const fullContent = await generatePost(topic);
                await fs.writeFile(path.join(postsDir, `${slug}.md`), fullContent);
                console.log(`[✔] Статья "${topic}" успешно создана и сохранена.`);
                await new Promise(resolve => setTimeout(resolve, 5000)); // Увеличим паузу до 5 секунд для стабильности
            } catch (e) {
                console.error(`Ошибка при генерации статьи "${topic}":`, e.message);
            }
        }
    } catch (error) {
        console.error("Критическая ошибка в работе завода:", error);
    }
}

main();
