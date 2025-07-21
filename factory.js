// Файл: factory.js (Версия «Многопоток»)
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';

const TARGET_URL_MAIN = "https://butlerspb.ru";
const TARGET_URL_RENT = "https://butlerspb.ru/rent";
const TOPICS_FILE = 'topics.txt';
const POSTS_DIR = 'src/content/posts';
const SITE_URL = "https://butlerspb-blog.netlify.app";
const BRAND_NAME = "ButlerSPB";
const BRAND_BLOG_NAME = `Блог ${BRAND_NAME}`;
const BRAND_AUTHOR_NAME = `Эксперт ${BRAND_NAME}`;
const FALLBACK_IMAGE_URL = "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=2070&auto-format&fit=crop";

// --- КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: Теперь мы принимаем API-ключ как аргумент ---
const apiKey = process.env.GEMINI_API_KEY_CURRENT;
if (!apiKey) {
    throw new Error("Не был предоставлен API-ключ для этого потока (GEMINI_API_KEY_CURRENT)!");
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

// ... (все остальные функции: ANCHORS, isUrlAccessible, slugify, generateWithRetry, generatePost - остаются без изменений) ...

async function generatePost(topic, slug, interlinks) {
    // ... (код этой функции не меняется)
}

// --- КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: main() теперь принимает свою "порцию" задач ---
async function main() {
    const threadId = process.env.THREAD_ID || 'main';
    console.log(`[Поток #${threadId}] Запуск рабочего потока...`);

    try {
        const BATCH_SIZE = parseInt(process.env.BATCH_SIZE, 10) || 1; // Каждый поток берет свою пачку
        
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

        // --- НОВЫЙ БЛОК: Разделение задач между потоками ---
        const totalThreads = parseInt(process.env.TOTAL_THREADS, 10) || 1;
        const topicsForThisThread = newTopics.filter((_, index) => index % totalThreads === (threadId - 1));
        // --- КОНЕЦ БЛОКА ---

        if (topicsForThisThread.length === 0) {
            console.log(`[Поток #${threadId}] Нет новых тем для этого потока. Завершение.`);
            return;
        }
        
        console.log(`[Поток #${threadId}] Найдено ${topicsForThisThread.length} новых тем. Беру в работу первые ${BATCH_SIZE}.`);

        let allPostsForLinking = []; // Перелинковка будет работать в рамках пачки
        
        for (const topic of topicsForThisThread.slice(0, BATCH_SIZE)) { 
            try {
                const slug = slugify(topic);
                if (!slug) continue;
                
                const fullContent = await generatePost(topic, slug, []); // Перелинковку временно упрощаем
                await fs.writeFile(path.join(postsDir, `${slug}.md`), fullContent);
                console.log(`[Поток #${threadId}] [✔] Статья "${topic}" успешно создана.`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (e) {
                if (e.message.includes('429')) {
                    console.error(`[Поток #${threadId}] [!] Квота для текущего ключа исчерпана. Поток завершает работу.`);
                    process.exit(0); // Завершаемся штатно, чтобы не сломать весь билд
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
```</details>

#### **Шаг 2: Модернизация "Конвейера" (`.github/workflows/factory.yml`)**

Мы полностью перестраиваем наш воркфлоу. Вместо одного цикла он теперь будет запускать **матрицу параллельных задач**.

1.  Откройте файл `.github/workflows/factory.yml`.
2.  **Полностью удалите** всё его содержимое.
3.  **Скопируйте и вставьте** на его место этот финальный, **многопоточный** код.

<details>
<summary><strong>Нажмите, чтобы развернуть ФИНАЛЬНЫЙ код для `.github/workflows/factory.yml` (Версия «Параллельный Удар»)</strong></summary>

```yaml
name: 🚀 Content Factory (Parallel Strike)

on:
  workflow_dispatch:
    inputs:
      batch_size_per_thread:
        description: 'Сколько статей генерировать КАЖДЫМ потоком?'
        required: true
        default: '10'
      threads:
        description: 'Сколько потоков запустить ОДНОВРЕМЕННО?'
        required: true
        default: '5'

jobs:
  # --- ЗАДАЧА №1: Запуск параллельных генераторов ---
  generate:
    permissions:
      contents: write
      
    runs-on: ubuntu-latest
    
    strategy:
      # Запускаем матрицу задач. Если одна упадет, другие продолжат работу.
      fail-fast: false
      matrix:
        # Создаем массив от 1 до N, где N - количество потоков
        thread: ${{ fromJson(format('[{0}]', range(1, github.event.inputs.threads + 1))) }}

    steps:
      - name: ⬇️ Checkout repo
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 

      - name: ⚙️ Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: 📦 Install dependencies
        run: npm install

      - name: 🏭 Run Content Factory (Thread ${{ matrix.thread }})
        env:
          # Передаем API-ключ, соответствующий номеру потока
          GEMINI_API_KEY_CURRENT: ${{ secrets[format('GEMINI_API_KEY_{0}', matrix.thread)] }}
          BATCH_SIZE: ${{ github.event.inputs.batch_size_per_thread }}
          TOTAL_THREADS: ${{ github.event.inputs.threads }}
          THREAD_ID: ${{ matrix.thread }}
        run: |
          npm run factory
          
  # --- ЗАДАЧА №2: Публикация и отправка в IndexNow (после завершения ВСЕХ генераторов) ---
  publish-and-notify:
    # Эта задача ждет, пока ВСЕ задачи из 'generate' завершатся
    needs: generate
    # Выполняется всегда, даже если некоторые генераторы упали, но есть что публиковать
    if: always()

    permissions:
      contents: write
      
    runs-on: ubuntu-latest
    steps:
      - name: ⬇️ Checkout repo
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 

      - name: 🚀 Commit and Push All New Posts
        run: |
          git config --global user.name 'GitHub Actions Bot'
          git config --global user.email 'actions-bot@github.com'
          
          # Если нет новых файлов, выходим
          if [[ -z $(git status --porcelain) ]]; then
            echo "✅ Новых статей для публикации не найдено."
            exit 0
          fi

          echo "🔥 Обнаружены новые статьи со всех потоков. Публикую..."
          git add src/content/posts/*.md
          git commit -m "🚀 Авто-публикация: пачка статей со всех потоков"
          git pull --rebase
          git push

      - name: 📢 Notify IndexNow (Yandex & Bing)
        run: |
          # ... (этот шаг остается таким же, как в последней версии)
