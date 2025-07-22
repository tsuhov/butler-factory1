// Файл: auditor.js - Скрипт для аудита и проверки тем
import fs from 'fs/promises';
import path from 'path';

const TOPICS_FILE = 'topics.txt';
const POSTS_DIR = 'src/content/posts';

// --- ТОЧНАЯ КОПИЯ ФУНКЦИИ ИЗ FACTORY.JS ---
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

async function auditTopics() {
    console.log('--- Запуск Аудита Тем ---');
    try {
        // 1. Читаем все существующие файлы статей
        const existingFiles = await fs.readdir(POSTS_DIR);
        const existingSlugs = new Set(existingFiles.map(file => file.replace('.md', '')));
        console.log(`[i] Найдено ${existingSlugs.size} уже существующих статей в папке /posts.`);

        // 2. Читаем все темы из topics.txt
        const fileContent = await fs.readFile(TOPICS_FILE, 'utf-8');
        const allTopics = fileContent.split(/\r?\n/).map(topic => topic.trim()).filter(Boolean);
        console.log(`[i] Найдено ${allTopics.length} тем в файле topics.txt.`);

        const newTopics = [];
        const existingTopics = [];

        // 3. Проводим сверку
        for (const topic of allTopics) {
            const topicSlug = slugify(topic);
            if (existingSlugs.has(topicSlug)) {
                existingTopics.push(topic);
            } else {
                newTopics.push(topic);
            }
        }

        // 4. Докладываем обстановку
        console.log('\n--- РЕЗУЛЬТАТ АУДИТА ---');
        console.log(`\n[✔] Обнаружено ${newTopics.length} ТЕМ, КОТОРЫЕ СЧИТАЮТСЯ НОВЫМИ:`);
        if (newTopics.length > 0) {
            console.log(newTopics);
        } else {
            console.log(' (пусто)');
        }

        console.log(`\n[!] Обнаружено ${existingTopics.length} ТЕМ, КОТОРЫЕ СЧИТАЮТСЯ УЖЕ СОЗДАННЫМИ (дубликаты):`);
        if (existingTopics.length > 0) {
            console.log(existingTopics);
        } else {
            console.log(' (пусто)');
        }
        
        console.log('\n--- Аудит Завершен ---');

    } catch (error) {
        console.error('[!] Критическая ошибка во время аудита:', error);
        process.exit(1);
    }
}

auditTopics();
