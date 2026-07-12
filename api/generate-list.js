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

  const { prompt } = request.body;
  if (!prompt) {
    return response.status(400).json({ error: 'Prompt is required.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ error: 'Gemini API Key is not configured on the server.' });
  }

  const responseSchema = {
    type: "OBJECT",
    properties: {
      title: { type: "STRING", description: "Short, catchy title in Vietnamese describing this vocabulary list" },
      words: {
        type: "ARRAY",
        description: "List of vocabulary items matching the teacher prompt",
        items: {
          type: "OBJECT",
          properties: {
            word: { type: "STRING", description: "The English word in lowercase (e.g. tortoise, apple, run)" },
            kind: { type: "STRING", description: "Part of speech in Vietnamese (e.g. danh từ, động từ, tính từ, trạng từ)" },
            ipa: { type: "STRING", description: "IPA English pronunciation guide (e.g. /ˈtɔː.təs/)" },
            example_en: { type: "STRING", description: "An interesting, educational example sentence using the word in English" },
            example_vi: { type: "STRING", description: "The natural translation of the example sentence in Vietnamese" }
          },
          required: ["word", "kind", "ipa", "example_en", "example_vi"]
        }
      }
    },
    required: ["title", "words"]
  };

  const systemInstruction = `You are a helpful assistant for a bilingual English-Vietnamese vocabulary handbook.
Your task is to take the teacher's input vocabulary words or prompt and generate a structured list of vocabulary cards.

For each word:
1. Find the standard English spelling (all lowercase).
2. Identify the part of speech in Vietnamese (kind: e.g. "danh từ", "động từ", "tính từ", "trạng từ").
3. Formulate the standard English IPA pronunciation guide.
4. Write a simple, educational English example sentence illustrating the usage of the word.
5. Translate this example sentence naturally into Vietnamese.

Ensure that the title of the list generated is strictly in Vietnamese.
Ensure that all words matching the teacher's list are correctly processed and included in the output.`;

  const requestBody = {
    contents: [{
      parts: [{ text: `Teacher prompt: ${prompt}` }]
    }],
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
      temperature: 0.2
    }
  };

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  try {
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!apiResponse.ok) {
      const errData = await apiResponse.json().catch(() => ({}));
      const errMsg = errData.error?.message || apiResponse.statusText || 'Gemini API call failed.';
      throw new Error(errMsg);
    }

    const result = await apiResponse.json();
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!rawText) {
      throw new Error('Empty response from model.');
    }

    return response.status(200).json(JSON.parse(rawText));
  } catch (error) {
    console.error('Error generating list:', error);
    return response.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
