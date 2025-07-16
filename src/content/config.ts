// Файл: src/content/config.ts
import { defineCollection, z } from 'astro:content';

const postsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    // Делаем поле более гибким: принимаем и строку, и объект Даты
    pubDate: z.string().transform((str) => new Date(str)), 
    author: z.string(),
    schema: z.any()
  }),
});

export const collections = {
  posts: postsCollection,
};
