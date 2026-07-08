export default async function handler(request, response) {
  // CORS configuration (optional but good practice for API endpoints)
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ 
      error: 'Gemini API Key is not configured on the server. Please check your deployment settings.' 
    });
  }

  const { prompt } = request.body;
  if (!prompt) {
    return response.status(400).json({ error: 'Prompt input is required.' });
  }

  const responseSchema = {
    type: "OBJECT",
    properties: {
      title: { type: "STRING", description: "A catchy, short title for this vocabulary test" },
      questions: {
        type: "ARRAY",
        description: "List of generated vocabulary questions",
        items: {
          type: "OBJECT",
          properties: {
            id: { type: "INTEGER", description: "Sequential question ID starting from 1" },
            english_word: { type: "STRING", description: "The English translation of the vocabulary word (e.g. tortoise, dolphin, elephant) in lowercase" },
            vietnamese_word: { type: "STRING", description: "The Vietnamese meaning of the vocabulary word (e.g. con rùa, con cá heo, con voi) in lowercase" },
            pronunciation: { type: "STRING", description: "The standard IPA pronunciation guide of the English word (e.g. /ˈtɔː.təs/)" },
            clue: { 
              type: "STRING", 
              description: "A short English contextual description containing a blank (marked as _______) indicating where the English word belongs. Must include a blank and be grammatically sound."
            },
            correct_answer: { 
              type: "STRING", 
              description: "The answer formatted exactly as 'english_word:vietnamese_word' in lowercase, e.g. 'tortoise:con rùa'." 
            }
          },
          required: ["id", "english_word", "vietnamese_word", "pronunciation", "clue", "correct_answer"]
        }
      }
    },
    required: ["title", "questions"]
  };

  const systemInstruction = `You are a helpful assistant for an English tutoring web application. 
Your task is to translate the teacher's input vocabulary list or general instruction prompt into high-quality fill-in-the-blank style exercise questions.

For each word:
1. Identify the English translation and standard Vietnamese translation.
2. Provide the standard English IPA pronunciation.
3. Formulate an interesting English sentence with a blank (represented as "_______") that the student must fill with the English word.
4. Set the correct_answer field strictly in the format: "english_word:vietnamese_word" (all lowercase, e.g. "tortoise:con rùa").

Ensure that the title of the quiz generated is strictly in Vietnamese.
Ensure that all words matching the teacher's list are correctly processed and included in the output.`;

  try {
    const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
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
      })
    });

    if (!apiResponse.ok) {
      const errData = await apiResponse.json().catch(() => ({}));
      const errMsg = errData.error?.message || apiResponse.statusText || 'API request failed';
      throw new Error(errMsg);
    }

    const result = await apiResponse.json();
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!rawText) {
      throw new Error('Empty response from Gemini.');
    }

    return response.status(200).json(JSON.parse(rawText));
  } catch (error) {
    console.error('API Error in /api/generate:', error);
    return response.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
