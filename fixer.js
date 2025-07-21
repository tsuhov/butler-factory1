// Файл: fixer.js - Одноразовый скрипт для ремонта существующих статей
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';

const POSTS_DIR = 'src/content/posts';
const FALLBACK_IMAGE_URL = "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=2070&auto=format&fit=crop";

async function isUrlAccessible(url) {
    if (typeof url !== 'string' || !url.startsWith('http')) {
        return false;
    }
    try {
        const response = await fetch(url, { method: 'HEAD', timeout: 5000 });
        return response.ok;
    } catch (error) {
        return false;
    }
}

async function fixPosts() {
    console.log('--- Запуск Ремонтного Батальона ---');
    try {
        const files = await fs.readdir(POSTS_DIR);
        const mdFiles = files.filter(file => file.endsWith('.md'));
        let fixedCount = 0;

        for (const file of mdFiles) {
            const filePath = path.join(POSTS_DIR, file);
            const content = await fs.readFile(filePath, 'utf-8');
            
            const frontmatterMatch = content.match(/---([\s\S]*?)---/);
            if (!frontmatterMatch) {
                console.warn(`[!] Пропускаю файл ${file}: не найден frontmatter.`);
                continue;
            }

            const frontmatterText = frontmatterMatch[1];
            const imageMatch = frontmatterText.match(/heroImage:\s*["']?(.*?)["']?$/m);

            if (imageMatch) {
                const imageUrl = imageMatch[1];
                const isImageOk = await isUrlAccessible(imageUrl);

                if (!isImageOk) {
                    console.log(`[FIX] В файле ${file} найдена "бракованная" картинка: ${imageUrl}. Заменяю...`);
                    const newFrontmatterText = frontmatterText.replace(imageMatch[0], `heroImage: "${FALLBACK_IMAGE_URL}"`);
                    const newContent = content.replace(frontmatterText, newFrontmatterText);
                    await fs.writeFile(filePath, newContent, 'utf-8');
                    fixedCount++;
                }
            } else {
                console.log(`[FIX] В файле ${file} отсутствует поле heroImage. Добавляю...`);
                const newFrontmatterText = frontmatterText + `\nheroImage: "${FALLBACK_IMAGE_URL}"`;
                const newContent = content.replace(frontmatterText, newFrontmatterText);
                await fs.writeFile(filePath, newContent, 'utf-8');
                fixedCount++;
            }
        }

        if (fixedCount > 0) {
            console.log(`[✔] Ремонт завершен! Исправлено ${fixedCount} файлов.`);
        } else {
            console.log(`[✔] Проверка завершена. Все файлы в порядке, ремонт не требуется.`);
        }

    } catch (error) {
        console.error('[!] Критическая ошибка во время ремонта:', error);
        process.exit(1);
    }
}

fixPosts();
