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

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

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
      // Free public fallback bucket (KVdb.io) for zero-config universal sharing
      const bucketId = 'phonghq_vocab_craft_bucket_v1';
      const kvdbUrl = `https://kvdb.io/${bucketId}/${quizId}`;
      const value = { title: title || 'Đề Ôn Tập Từ Vựng', questions };

      const apiResponse = await fetch(kvdbUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value)
      });

      if (!apiResponse.ok) {
        throw new Error('Failed to save to public database fallback.');
      }

      return response.status(200).json({ success: true, id: quizId });
    }
  } catch (error) {
    console.error('Error saving quiz:', error);
    return response.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
