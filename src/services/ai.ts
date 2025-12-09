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
  model?: string,
  customPrompt?: string
): Promise<string[]> => {
  let prompt = '';
  if (customPrompt) {
    prompt = customPrompt;
  } else {
    prompt = `
      You are a taxonomy expert.
      Generate a JSON list of 5-10 logical subtopics for the topic "${topicTitle}".
      ${parentContext ? `Context: This topic is part of "${parentContext}".` : ''}
      Return ONLY a JSON array of strings. No markdown, no explanations.
      Example: ["Subtopic 1", "Subtopic 2"]
    `;
  }

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
    // Clean up common markdown formatting for code blocks
    let jsonText = content.replace(/```json\n?|\n?```/g, '').trim();
    
    // Try to find array brackets if there is extra text
    const start = jsonText.indexOf('[');
    const end = jsonText.lastIndexOf(']');
    if (start !== -1 && end !== -1 && end > start) {
        jsonText = jsonText.substring(start, end + 1);
    }

    const parsed = JSON.parse(jsonText);
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

const stripMarkdown = (text: string): string => {
    return text
        // Remove headers
        .replace(/^#+\s+/gm, '')
        // Remove bold/italic
        .replace(/(\*\*|__)(.*?)\1/g, '$2')
        .replace(/(\*|_)(.*?)\1/g, '$2')
        // Remove links [text](url) -> text
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
        // Remove images ![alt](url) -> 
        .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '')
        // Remove code blocks
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`([^`]+)`/g, '$1')
        // Remove blockquotes
        .replace(/^\s*>\s+/gm, '')
        // Remove list markers
        .replace(/^\s*[-*+]\s+/gm, '')
        .replace(/^\s*\d+\.\s+/gm, '')
        // Remove math markers (optional, but good for TTS)
        .replace(/\$+/g, '')
        // Collapse newlines and multiple spaces to ensure continuous TTS generation
        .replace(/\s+/g, ' ')
        .trim();
}

export const generateAudio = async (
    apiKey: string,
    text: string
): Promise<Blob> => {
    const cleanText = stripMarkdown(text);
    
    // Switch back to native inference endpoint used by DeepInfra for Kokoro, 
    // as the OpenAI wrapper seems to truncate text.
    const response = await fetch('https://api.deepinfra.com/v1/inference/hexgrad/Kokoro-82M', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            text: cleanText,
            preset: "default"
        })
    });
    
    if (!response.ok) {
        throw new Error(`TTS Request Failed: ${response.statusText}`);
    }

    // Handle JSON response which contains base64 audio
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        
        let audioBase64 = data.audio;
        // Check for results array pattern
        if (!audioBase64 && data.results && Array.isArray(data.results)) {
             audioBase64 = data.results[0]?.audio;
        }

        if (audioBase64) {
            try {
                // Strip data URI prefix if present
                const cleanBase64 = audioBase64.replace(/^data:audio\/\w+;base64,/, "");
                
                const binaryString = atob(cleanBase64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                return new Blob([bytes], { type: 'audio/wav' });
            } catch (e) {
                console.error("Failed to decode audio base64. String start:", audioBase64?.substring(0, 50));
                throw new Error(`Failed to decode audio from API: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
        
        // If we get JSON but no audio field
        console.warn("Unexpected TTS JSON response:", data);
        // Fallback or throw? If it's just metadata, maybe the blob is somehow separate? 
        // But context suggests it's base64.
        throw new Error("API returned JSON without audio data");
    }
    
    // Fallback for direct binary response
    return await response.blob();
}
