// Файл: factory.js (Версия 5.0, "Транслитерация")
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
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

const ANCHORS = [
    `узнайте больше об управлении на <a href="${TARGET_URL_RENT}" target="_blank" rel="nofollow">сайте ButlerSPB</a>`,
    `профессиональные услуги по управлению можно найти <a href="${TARGET_URL_RENT}" target="_blank" rel="nofollow">здесь</a>`,
    `как советуют эксперты из <a href="${TARGET_URL_MAIN}" target="_blank" rel="nofollow">ButlerSPB</a>`,
    `подробности на <a href="${TARGET_URL_RENT}" target="_blank" rel="nofollow">этой странице</a>`,
    `доверительное управление квартирой - <a href="${TARGET_URL_RENT}" target="_blank" rel="nofollow">отличное решение</a>`
];

// НОВАЯ, ПРАВИЛЬНАЯ ФУНКЦИЯ SLUGIFY
function slugify(text) {
    const from = "а б в г д е ё ж з и й к л м н о п р с т у ф х ц ч ш щ ъ ы ь э ю я".split(' ');
    const to = "a b v g d e yo zh z i y k l m n o p r s t u f h c ch sh sch '' y ' e yu ya".split(' ');

    let newText = text.toString().toLowerCase().trim();

    for (let i = 0; i < from.length; i++) {
        newText = newText.replace(new RegExp(from[i], 'g'), to[i]);
    }

    return newText
        .replace(/\s+/g, '-') // заменяем пробелы на -
        .replace(/[^\w-]+/g, '') // удаляем все несловесные символы, кроме дефисов
        .replace(/--+/g, '-') // заменяем несколько - на один -
        .replace(/^-+/, '') // убираем дефисы в начале
        .replace(/-+$/, ''); // убираем дефисы в конце
}

async function generatePost(topic) {
    console.log(`[+] Генерирую статью на тему: ${topic}`);
    
    const planPrompt = `Создай детальный, экспертный план-структуру для статьи на тему "${topic}". Включи 3-4 основных раздела с подзаголовками H2 и несколько подпунктов для каждого.`;
    const planResult = await model.generateContent(planPrompt);
    const plan = planResult.response.text();

    const articlePrompt = `Напиши экспертную, полезную статью по этому плану:\n\n${plan}\n\nТема: "${topic}". Пиши без воды, структурированно, для владельцев недвижимости.`;
    const articleResult = await model.generateContent(articlePrompt);
    let articleText = articleResult.response.text();

    const paragraphs = articleText.split('\n\n');
    if (paragraphs.length > 2) {
        const randomIndex = Math.floor(Math.random() * (paragraphs.length - 2)) + 1;
        const randomAnchor = ANCHORS[Math.floor(Math.random() * ANCHORS.length)];
        paragraphs[randomIndex] += ` ${randomAnchor}`;
        articleText = paragraphs.join('\n\n');
    }
    
    const seoPrompt = `Для статьи на тему "${topic}" сгенерируй JSON-объект. ВАЖНО: твой ответ должен быть ТОЛЬКО валидным JSON-объектом, без какого-либо сопроводительного текста, комментариев или markdown-оберток. JSON должен содержать следующие поля: "title" (SEO-заголовок до 70 символов), "description" (мета-описание до 160 символов), "schema" (валидный JSON-LD schema.org для типа BlogPosting, включающий headline, description, author, publisher, datePublished).`;
    const seoResult = await model.generateContent(seoPrompt);
    let seoText = seoResult.response.text();

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

async function main() {
    try {
        const BATCH_SIZE = parseInt(process.env.BATCH_SIZE, 10) || 10;
        console.log(`[i] Размер пачки установлен на: ${BATCH_SIZE}`);

        const postsDir = path.join(process.cwd(), 'src', 'content', 'posts');
        await fs.mkdir(postsDir, { recursive: true });
        
        const topics = (await fs.readFile(TOPICS_FILE, 'utf-8'))
          .split('\n')
          .map(topic => topic.trim()) 
          .filter(Boolean);

        const existingFiles = await fs.readdir(postsDir);
        const existingSlugs = existingFiles.map(file => file.replace('.md', ''));

        const newTopics = topics.filter(topic => !existingSlugs.includes(slugify(topic)));

        if (newTopics.length === 0) {
            console.log("Нет новых тем для генерации. Завод в режиме ожидания.");
            return;
        }

        console.log(`Найдено ${newTopics.length} новых тем. Беру в работу первые ${BATCH_SIZE}.`);

        for (const topic of newTopics.slice(0, BATCH_SIZE)) { 
            try {
                const slug = slugify(topic);
                if (!slug) {
                    console.error(`[!] Пропускаю тему "${topic}", так как из нее не удалось создать имя файла.`);
                    continue;
                }
                const fullContent = await generatePost(topic);
                await fs.writeFile(path.join(postsDir, `${slug}.md`), fullContent);
                console.log(`[✔] Статья "${topic}" успешно создана и сохранена.`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (e) {
                console.error(`[!] Ошибка при генерации статьи "${topic}":`, e.message);
                continue;
            }
        }
    } catch (error) {
        console.error("[!] Критическая ошибка в работе завода:", error);
    }
}

main();
