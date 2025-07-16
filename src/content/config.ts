// Файл: src/content/config.ts
import { defineCollection, z } from 'astro:content';

const postsCollection = defineCollection({
  type: 'content',
  // Здесь мы описываем все поля, которые ДОЛЖНЫ быть в каждой статье
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.date(),
    author: z.string(), // Убедимся, что это поле есть
    schema: z.any() // И это поле тоже
  }),
});

export const collections = {
  posts: postsCollection,
};
