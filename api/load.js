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
      // Free public fallback bucket (KVdb.io) for zero-config universal sharing
      const bucketId = 'phonghq_vocab_craft_bucket_v1';
      const kvdbUrl = `https://kvdb.io/${bucketId}/${id}`;
      
      const apiResponse = await fetch(kvdbUrl);
      if (!apiResponse.ok) {
        return response.status(404).json({ error: 'Quiz not found on database fallback.' });
      }

      const data = await apiResponse.json();
      return response.status(200).json(data);
    }
  } catch (error) {
    console.error('Error loading quiz:', error);
    return response.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
