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

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

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
      // Local fallback: Read from E:\Project Web\quizzes.json
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
  } catch (error) {
    console.error('Error loading quiz:', error);
    return response.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
