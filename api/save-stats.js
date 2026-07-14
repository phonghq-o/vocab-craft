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

  const { quizId, score, totalQuestions, timeSpent, date } = request.body;
  if (!quizId) {
    return response.status(400).json({ error: 'Quiz ID is required.' });
  }

  const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
  const statRecord = {
    score,
    totalQuestions,
    timeSpent,
    date: date || new Date().toISOString()
  };

  try {
    if (redisUrl) {
      // Connect using TCP redis client
      const client = createClient({
        url: redisUrl,
        socket: {
          tls: redisUrl.startsWith('rediss://'),
          rejectUnauthorized: false
        }
      });
      
      await client.connect();
      // Push the attempt to the right of the list
      await client.rPush(`stats_${quizId}`, JSON.stringify(statRecord));
      await client.disconnect();

      return response.status(200).json({ success: true });
    } else {
      // Fallback logic for local testing
      if (process.env.NODE_ENV === 'production') {
        return response.status(400).json({ 
          error: 'Vercel Redis connection string is missing (REDIS_URL / KV_URL).' 
        });
      } else {
        // Local fallback: Save to stats.json
        const filepath = path.join(process.cwd(), 'stats.json');
        let allStats = {};

        try {
          const fileContent = await fs.readFile(filepath, 'utf8');
          allStats = JSON.parse(fileContent);
        } catch (err) {
          // File doesn't exist yet
        }

        if (!allStats[quizId]) {
          allStats[quizId] = [];
        }
        allStats[quizId].push(statRecord);

        await fs.writeFile(filepath, JSON.stringify(allStats, null, 2), 'utf8');
        return response.status(200).json({ success: true, local: true });
      }
    }
  } catch (error) {
    console.error('Error saving stats:', error);
    return response.status(500).json({ 
      error: error.message || 'Internal Server Error'
    });
  }
}
