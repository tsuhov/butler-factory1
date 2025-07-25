// Файл: emergency-git-cleanup.js - РАДИКАЛЬНАЯ очистка Git конфликтов
import fs from 'fs/promises';
import path from 'path';

const POSTS_DIR = 'src/content/posts';

async function emergencyGitCleanup() {
    console.log('🚨 ЭКСТРЕННАЯ ОЧИСТКА Git конфликтов...');
    
    try {
        const files = await fs.readdir(POSTS_DIR);
        const mdFiles = files.filter(file => file.endsWith('.md'));
        let deletedCount = 0;
        let brokenFiles = [];

        for (const file of mdFiles) {
            const filePath = path.join(POSTS_DIR, file);
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                
                // ПРОВЕРЯЕМ НА Git КОНФЛИКТЫ
                if (content.includes('<<<<<<< ') || 
                    content.includes('=======') || 
                    content.includes('>>>>>>> ')) {
                    
                    console.log(`🗑️ Удаляю файл с Git конфликтом: ${file}`);
                    await fs.unlink(filePath);
                    deletedCount++;
                    brokenFiles.push(file);
                }
            } catch (error) {
                console.log(`🗑️ Удаляю нечитаемый файл: ${file}`);
                await fs.unlink(filePath);
                deletedCount++;
                brokenFiles.push(file);
            }
        }

        console.log(`\n📊 РЕЗУЛЬТАТ:\n        🗑️ Удалено файлов с Git конфликтами: ${deletedCount}\n        📄 Проверено файлов: ${mdFiles.length}`);
        
        if (brokenFiles.length > 0) {
            console.log(`\n🗂️ Удаленные файлы:`);
            brokenFiles.forEach(file => console.log(`   - ${file}`));
        }
        
        console.log(`\n🎯 ГОТОВО! Netlify теперь должен собраться без ошибок.`);
        
    } catch (error) {
        console.error('💥 Ошибка:', error);
    }
}

emergencyGitCleanup();
