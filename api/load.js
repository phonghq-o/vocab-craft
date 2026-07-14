import { createClient } from 'redis';
import { promises as fs } from 'fs';
import path from 'path';

export default async function handler(request, response) {
  // CORS configuration
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { id } = request.query;
  if (!id) {
    return response.status(400).json({ error: 'Quiz ID parameter is required.' });
  }

  const redisUrl = process.env.REDIS_URL || process.env.KV_URL;

  try {
    if (redisUrl) {
      // Connect using TCP redis client (universal support for redis.io, Upstash, Vercel KV)
      const client = createClient({
        url: redisUrl,
        socket: {
          tls: redisUrl.startsWith('rediss://'),
          rejectUnauthorized: false
        }
      });

      await client.connect();
      const rawVal = await client.get(id);
      await client.disconnect();

      if (!rawVal) {
        return response.status(404).json({ error: 'Quiz not found.' });
      }

      return response.status(200).json(JSON.parse(rawVal));
    } else {
      if (process.env.NODE_ENV === 'production') {
        return response.status(400).json({ 
          error: 'Vercel Redis connection string is missing (REDIS_URL / KV_URL).' 
        });
      } else {
        // Local dev fallback: Read from quizzes.json
        const filepath = path.join(process.cwd(), 'quizzes.json');
        
        try {
          const fileContent = await fs.readFile(filepath, 'utf8');
          const quizzes = JSON.parse(fileContent);
          const quizData = quizzes[id];

          if (!quizData) {
            return response.status(404).json({ error: 'Quiz not found.' });
          }

          return response.status(200).json(quizData);
        } catch (err) {
          return response.status(404).json({ error: 'No quizzes saved locally yet.' });
        }
      }
    }
  } catch (error) {
    console.error('Error loading quiz:', error);
    return response.status(500).json({ 
      error: error.message || 'Internal Server Error',
      diagnostic: {
        redisUrlObscured: redisUrl ? redisUrl.replace(/:[^@]+@/, ':***@') : 'undefined',
        nodeVersion: process.version
      }
    });
  }
}
