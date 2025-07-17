// Файл: src/content/config.ts (Версия 2.0, с heroImage)
import { defineCollection, z } from 'astro:content';

const postsCollection = defineCollection({
  type: 'content',
  // Здесь мы описываем все поля, которые ДОЛЖНЫ быть в каждой статье
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.string().transform((str) => new Date(str)), 
    author: z.string(),
    // --- ВОТ КЛЮЧЕВОЕ ИЗМЕНЕНИЕ ---
    // Мы "декларируем" новое поле и говорим, что оно может отсутствовать
    heroImage: z.string().optional(), 
    schema: z.any()
  }),
});

export const collections = {
  posts: postsCollection,
};
