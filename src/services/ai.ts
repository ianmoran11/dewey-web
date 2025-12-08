export interface AIResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

export interface OpenRouterModel {
    id: string;
    name: string;
    pricing?: {
        prompt: string;
        completion: string;
    };
    context_length?: number;
}

export const getModels = async (apiKey: string): Promise<OpenRouterModel[]> => {
    try {
        const response = await fetch('https://openrouter.ai/api/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (!response.ok) {
            console.error("Failed to fetch models:", response.statusText);
            return [];
        }
        const data = await response.json();
        return (data.data as OpenRouterModel[]) || [];
    } catch (e) {
        console.error("Failed to fetch models", e);
        return [];
    }
}

export const generateSubtopics = async (
  apiKey: string,
  topicTitle: string,
  parentContext?: string,
  model?: string
): Promise<string[]> => {
  const prompt = `
    You are a taxonomy expert.
    Generate a JSON list of 5-10 logical subtopics for the topic "${topicTitle}".
    ${parentContext ? `Context: This topic is part of "${parentContext}".` : ''}
    Return ONLY a JSON array of strings. No markdown, no explanations.
    Example: ["Subtopic 1", "Subtopic 2"]
  `;

  const messages = [
     { role: "system", content: "You are a helpful assistant that outputs JSON only." },
     { role: "user", content: prompt }
  ];
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      // 'HTTP-Referer': `${window.location.origin}`,
    },
    body: JSON.stringify({
      model: model || 'openai/gpt-3.5-turbo',
      messages
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`AI Request Failed: ${response.statusText} - ${err}`);
  }

  const data = await response.json() as AIResponse;
  const content = data.choices[0].message.content;
  
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed as string[];
    // Sometimes returns { "subtopics": [...] }
    if (typeof parsed === 'object' && parsed.subtopics && Array.isArray(parsed.subtopics)) {
        return parsed.subtopics as string[];
    }
    return [];
  } catch (e) {
    console.error("Failed to parse AI response:", content);
    // Fallback: split by newlines if it looks like a list
    return content.split('\n').filter(l => l.trim().startsWith('-')).map(l => l.replace(/^- /, '').trim());
  }
};

export const generateAIContent = async (
  apiKey: string,
  prompt: string,
  model?: string
): Promise<string> => {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'openai/gpt-3.5-turbo',
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) {
     const err = await response.text();
     throw new Error(`AI Request Failed: ${response.statusText} - ${err}`);
  }

  const data = await response.json() as AIResponse;
  return data.choices[0].message.content;
}

export const generateAudio = async (
    apiKey: string,
    text: string
): Promise<Blob> => {
    const response = await fetch('https://api.deepinfra.com/v1/inference/kokoro-82m', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            text: text,
            preset: "default"
        })
    });
    
    if (!response.ok) {
        throw new Error(`TTS Request Failed: ${response.statusText}`);
    }
    
    return await response.blob();
}
