export interface AIResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

export const generateSubtopics = async (
  apiKey: string,
  topicTitle: string,
  parentContext?: string
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
  
  // Example for OpenRouter (works with most OpenAI compatible APIs)
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      // 'HTTP-Referer': `${window.location.origin}`, // Optional for OpenRouter
    },
    body: JSON.stringify({
      model: 'openai/gpt-3.5-turbo', // Default cheap model, user can change if we add settings
      messages
    })
  });

  if (!response.ok) {
    throw new Error(`AI Request Failed: ${response.statusText}`);
  }

  const data = await response.json() as AIResponse;
  const content = data.choices[0].message.content;
  
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed as string[];
    return [];
  } catch (e) {
    console.error("Failed to parse AI response:", content);
    return [];
  }
};

export const generateContent = async (
  apiKey: string,
  topicTitle: string,
  template: string
): Promise<string> => {
  const prompt = `
    Write content for the topic "${topicTitle}" using the following style/template:
    "${template}"
    
    Format the output in clean Markdown.
  `;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-3.5-turbo',
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) {
     throw new Error(`AI Request Failed: ${response.statusText}`);
  }

  const data = await response.json() as AIResponse;
  return data.choices[0].message.content;
}

// NOTE: DeepInfra or other TTS providers needed.
// For now, implementing a placeholder that mocks it or uses a simple endpoint if available.
// Since OpenRouter doesn't do TTS natively, we might need a direct OpenAI endpoint or similar if user provides that key.
// We will structure this to take a generic endpoint in settings later.
export const generateAudio = async (
    apiKey: string, // Could be DeepInfra key
    text: string
): Promise<Blob> => {
    // Using DeepInfra for TTS as an example (since it's cheap/popular for devs)
    // https://api.deepinfra.com/v1/inference/deepinfra/tts
    
    // Fallback/Mock for safety if no key provided in this example context,
    // but in real app we expect key.
    
    // We will use a browser generic TTS if no API key is present for demo purposes?
    // No, requirements say "binary audio files" stored in DB.
    
    // Let's assume the user puts a DeepInfra key.
    
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
    
    // DeepInfra often returns a generic audio/wav
    return await response.blob();
}
