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

  let kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  let kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  // Auto-parse from REDIS_URL or KV_URL if explicit REST variables are missing
  const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
  if (!kvUrl && redisUrl) {
    try {
      const match = redisUrl.match(/^rediss?:\/\/(?:([^:]*):)?([^@]+)@([^:]+):(\d+)/);
      if (match) {
        const host = match[3];
        const port = match[4];
        const token = match[2];
        
        let restHost = host;
        if (host.endsWith('.upstash.io')) {
          const prefix = host.slice(0, -11);
          restHost = `${prefix}-${port}.upstash.io`;
        }
        kvUrl = `https://${restHost}`;
        kvToken = token;
      }
    } catch (err) {
      console.error('Failed to parse REDIS_URL:', err);
    }
  }

  try {
    if (kvUrl && kvToken) {
      // Production: Save to Vercel KV via REST API
      const value = { title: title || 'Đề Ôn Tập Từ Vựng', questions };
      const apiResponse = await fetch(kvUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${kvToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(['SET', quizId, JSON.stringify(value)])
      });

      if (!apiResponse.ok) {
        const err = await apiResponse.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save to database.');
      }

      return response.status(200).json({ success: true, id: quizId });
    } else {
      // Fallback logic
      const kvKeys = Object.keys(process.env).filter(k => k.startsWith('KV_'));
      if (process.env.NODE_ENV === 'production') {
        return response.status(400).json({ 
          error: `Vercel KV database is not connected to this project. Found KV environment keys: [${kvKeys.join(', ')}]. Please go to your Vercel Dashboard -> Storage and link a KV database, then redeploy your project.` 
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
    return response.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
