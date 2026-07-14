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
    return response.status(400).json({ error: 'Quiz ID is required.' });
  }

  const redisUrl = process.env.REDIS_URL || process.env.KV_URL;

  try {
    if (redisUrl) {
      const client = createClient({
        url: redisUrl,
        socket: {
          tls: redisUrl.startsWith('rediss://'),
          rejectUnauthorized: false
        }
      });
      
      await client.connect();
      // Get all attempts for this quiz
      const records = await client.lRange(`stats_${id}`, 0, -1);
      await client.disconnect();

      const parsedRecords = records.map(r => JSON.parse(r));
      return response.status(200).json({ success: true, stats: parsedRecords });
    } else {
      // Fallback for local testing
      if (process.env.NODE_ENV === 'production') {
        return response.status(400).json({ 
          error: 'Vercel Redis connection string is missing.' 
        });
      } else {
        const filepath = path.join(process.cwd(), 'stats.json');
        try {
          const fileContent = await fs.readFile(filepath, 'utf8');
          const allStats = JSON.parse(fileContent);
          const stats = allStats[id] || [];
          return response.status(200).json({ success: true, stats, local: true });
        } catch (err) {
          // File doesn't exist, meaning no stats yet
          return response.status(200).json({ success: true, stats: [], local: true });
        }
      }
    }
  } catch (error) {
    console.error('Error fetching stats:', error);
    return response.status(500).json({ 
      error: error.message || 'Internal Server Error'
    });
  }
}
