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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ 
      error: 'Gemini API Key is not configured on the server. Please check your deployment settings.' 
    });
  }

  const { payload } = request.body;
  if (!payload) {
    return response.status(400).json({ error: 'Payload data is required.' });
  }

  const responseSchema = {
    type: "OBJECT",
    properties: {
      evaluations: {
        type: "ARRAY",
        description: "List of graded Vietnamese answers",
        items: {
          type: "OBJECT",
          properties: {
            question_id: { type: "INTEGER", description: "The ID of the graded question" },
            vietnamese_status: { type: "STRING", enum: ["correct", "incorrect"], description: "Whether the student's translation is correct, semantically equivalent, or an accurate synonym" },
            vietnamese_feedback: { type: "STRING", description: "Short feedback message in Vietnamese, e.g. explaining if synonym was accepted or why it is wrong" }
          },
          required: ["question_id", "vietnamese_status", "vietnamese_feedback"]
        }
      }
    },
    required: ["evaluations"]
  };

  const systemInstruction = `You are a professional bilingual English-Vietnamese grading assistant.
Your task is to grade the student's Vietnamese vocabulary translation answer.
For each item in the payload, you are given:
- question_id
- english_word (the target English word)
- expected_vietnamese (the primary translation)
- student_vietnamese (what the student typed)

Your criteria:
1. If the student left it blank, mark it as "incorrect" with feedback like "Chưa có câu trả lời.".
2. Determine if the student's Vietnamese translation is semantically correct, accurate, or a valid synonym for the English word. For example, if the English word is "tortoise" (primary: "con rùa"), and the student typed "rùa", "rùa cạn", or "rùa đất", mark it as "correct" because it is a correct translation. 
3. If they made a minor typo in Vietnamese but it's clearly recognizable and correct, you may mark it as "correct" and note the typo.
4. If it means something completely different, mark it as "incorrect" with a helpful tip explaining the correct meaning.

Always respond in valid JSON matching the specified schema.`;

  try {
    const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `Payload to grade: ${JSON.stringify(payload)}` }]
        }],
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          temperature: 0.1
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
    console.error('API Error in /api/grade:', error);
    return response.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
