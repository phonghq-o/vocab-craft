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

  let kvUrl = process.env.KV_REST_API_URL;
  let kvToken = process.env.KV_REST_API_TOKEN;

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
      // Production: Read from Vercel KV via REST API
      const apiResponse = await fetch(kvUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${kvToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(['GET', id])
      });

      if (!apiResponse.ok) {
        const err = await apiResponse.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to retrieve quiz from database.');
      }

      const resData = await apiResponse.json();
      const rawVal = resData.result;
      
      if (!rawVal) {
        return response.status(404).json({ error: 'Quiz not found.' });
      }

      return response.status(200).json(JSON.parse(rawVal));
    } else {
      if (process.env.NODE_ENV === 'production') {
        return response.status(400).json({ 
          error: 'Vercel KV database is not connected. Please link a KV database on the Vercel Dashboard.' 
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
    return response.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
