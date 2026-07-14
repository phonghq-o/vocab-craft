import { createClient } from 'redis';
import { promises as fs } from 'fs';
import path from 'path';

export default async function handler(request, response) {
  // CORS configuration
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { title, questions } = request.body;
  if (!questions || !Array.isArray(questions)) {
    return response.status(400).json({ error: 'Questions list is required and must be an array.' });
  }

  const quizId = 'q_' + Math.random().toString(36).substring(2, 10);
  const redisUrl = process.env.REDIS_URL || process.env.KV_URL;

  try {
    if (redisUrl) {
      // Connect using TCP redis client (universal support for redis.io, Upstash, Vercel KV)
      const client = createClient({
        url: redisUrl,
        socket: {
          tls: redisUrl.startsWith('rediss://'),
          rejectUnauthorized: false // Avoid SSL handshake errors with some cloud databases
        }
      });
      
      await client.connect();
      const value = { title: title || 'Đề Ôn Tập Từ Vựng', questions };
      await client.set(quizId, JSON.stringify(value));
      await client.disconnect();

      return response.status(200).json({ success: true, id: quizId });
    } else {
      // Fallback logic
      if (process.env.NODE_ENV === 'production') {
        return response.status(400).json({ 
          error: 'Vercel Redis connection string is missing (REDIS_URL / KV_URL). Please check Vercel environment variables.' 
        });
      } else {
        // Local fallback: Save to quizzes.json
        const filepath = path.join(process.cwd(), 'quizzes.json');
        let quizzes = {};

        try {
          const fileContent = await fs.readFile(filepath, 'utf8');
          quizzes = JSON.parse(fileContent);
        } catch (err) {
          // File doesn't exist yet
        }

        quizzes[quizId] = {
          title: title || 'Đề Ôn Tập Từ Vựng',
          questions
        };

        await fs.writeFile(filepath, JSON.stringify(quizzes, null, 2), 'utf8');
        return response.status(200).json({ success: true, id: quizId, local: true });
      }
    }
  } catch (error) {
    console.error('Error saving quiz:', error);
    return response.status(500).json({ 
      error: error.message || 'Internal Server Error',
      diagnostic: {
        redisUrlObscured: redisUrl ? redisUrl.replace(/:[^@]+@/, ':***@') : 'undefined',
        nodeVersion: process.version
      }
    });
  }
}
