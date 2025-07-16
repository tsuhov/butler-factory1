import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';

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
    console.log(`[+] Generating article for topic: ${topic}`);
    
    const planPrompt = `Create a detailed, expert-level structure for an article on the topic "${topic}". Include 3-4 main sections with H2 headings and several sub-points for each.`;
    const planResult = await model.generateContent(planPrompt);
    const plan = planResult.response.text();

    const articlePrompt = `Write an expert, useful article based on this plan:\n\n${plan}\n\nTopic: "${topic}". Write concisely, in a structured manner, for property owners.`;
    const articleResult = await model.generateContent(articlePrompt);
    let articleText = articleResult.response.text();

    const paragraphs = articleText.split('\n\n');
    if (paragraphs.length > 2) {
        const randomIndex = Math.floor(Math.random() * (paragraphs.length - 2)) + 1;
        const randomAnchor = ANCHORS[Math.floor(Math.random() * ANCHORS.length)];
        paragraphs[randomIndex] += ` ${randomAnchor}`;
        articleText = paragraphs.join('\n\n');
    }
    
    const seoPrompt = `For an article on the topic "${topic}", generate a JSON object. IMPORTANT: your response must ONLY be a valid JSON object, without any accompanying text, comments, or markdown wrappers. The JSON must contain the following fields: "title" (SEO title up to 70 characters), "description" (meta description up to 160 characters), "schema" (a valid JSON-LD schema.org for a BlogPosting type, including headline, description, author, publisher, datePublished).`;
    const seoResult = await model.generateContent(seoPrompt);
    let seoText = seoResult.response.text();

    const match = seoText.match(/\{[\s\S]*\}/);
    if (!match) {
        throw new Error("Could not find a valid JSON in the model's response.");
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
        console.log(`[i] Batch size set to: ${BATCH_SIZE}`);

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
            console.log("No new topics to generate. Factory is in standby mode.");
            return;
        }

        console.log(`Found ${newTopics.length} new topics. Processing the first ${BATCH_SIZE}.`);

        for (const topic of newTopics.slice(0, BATCH_SIZE)) { 
            try {
                const slug = slugify(topic);
                if (!slug) {
                    console.error(`[!] Skipping topic "${topic}" as it resulted in an empty slug.`);
                    continue;
                }
                const fullContent = await generatePost(topic);
                await fs.writeFile(path.join(postsDir, `${slug}.md`), fullContent);
                console.log(`[✔] Article "${topic}" created and saved successfully.`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (e) {
                console.error(`[!] Error generating article for topic "${topic}":`, e.message);
                continue;
            }
        }
    } catch (error) {
        console.error("[!] Critical error in factory operation:", error);
    }
}

main();
