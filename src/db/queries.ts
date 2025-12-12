import { sql } from './client';
import { Topic, ContentBlock, Template } from '../types';

export const getTopics = async (): Promise<Topic[]> => {
  const rows = await sql`
    SELECT 
      t.id, t.parent_id, t.code, t.title, t.content, t.has_audio, t.created_at,
      ((SELECT COUNT(*) FROM content_blocks WHERE topic_id = t.id) > 0 OR (t.content IS NOT NULL AND t.content != '')) AS has_content,
      (SELECT COUNT(*) FROM content_blocks WHERE topic_id = t.id AND has_audio = 1) > 0 AS has_block_audio
    FROM topics t 
    ORDER BY t.code ASC, t.created_at ASC
  `;
  // Cast the result
  return rows as unknown as Topic[];
};

export const getTopic = async (id: string): Promise<Topic | null> => {
  const rows = await sql`SELECT * FROM topics WHERE id = ${id}`;
  if (rows.length === 0) return null;
  return rows[0] as unknown as Topic;
};

export const getAudio = async (id: string): Promise<Blob | null> => {
  const rows = await sql`SELECT audio FROM topics WHERE id = ${id}`;
  if (rows.length === 0 || !rows[0].audio) return null;
  // Convert Uint8Array (from DB) back to Blob for URL.createObjectURL
  const uint8 = rows[0].audio as Uint8Array;
  // DeepInfra Kokoro-82M typically returns WAV, not MP3.
  // Using generic audio/wav or correct mime type is safest.
  return new Blob([uint8 as any], { type: 'audio/wav' });
};

export const updateTopicContent = async (id: string, content: string) => {
  await sql`UPDATE topics SET content = ${content} WHERE id = ${id}`;
};

export const updateTopic = async (topic: Partial<Topic> & { id: string }) => {
    // Only update allowed fields
    if (topic.title !== undefined && topic.code !== undefined) {
        await sql`UPDATE topics SET title = ${topic.title}, code = ${topic.code} WHERE id = ${topic.id}`;
    } else if (topic.title !== undefined) {
        await sql`UPDATE topics SET title = ${topic.title} WHERE id = ${topic.id}`;
    } else if (topic.code !== undefined) {
        await sql`UPDATE topics SET code = ${topic.code} WHERE id = ${topic.id}`;
    }
}

export const updateTopicParent = async (id: string, newParentId: string | null) => {
    await sql`UPDATE topics SET parent_id = ${newParentId} WHERE id = ${id}`;
}

export const saveTopicAudio = async (id: string, audioBlob: Blob) => {
  const buffer = await audioBlob.arrayBuffer();
  const data = new Uint8Array(buffer);
  await sql`UPDATE topics SET audio = ${data}, has_audio = true WHERE id = ${id}`;
};

export const createTopic = async (topic: Topic) => {
  await sql`
    INSERT INTO topics (id, parent_id, code, title, created_at)
    VALUES (${topic.id}, ${topic.parent_id}, ${topic.code || null}, ${topic.title}, ${topic.created_at})
  `;
};

export const deleteTopic = async (id: string) => {
  // Cascading delete handles children if configured, but let's be safe later
  await sql`DELETE FROM topics WHERE id = ${id}`;
};

// --- Content Blocks ---

export const getContentBlocks = async (topicId: string): Promise<ContentBlock[]> => {
    const rows = await sql`
        SELECT id, topic_id, label, content, has_audio, created_at 
        FROM content_blocks 
        WHERE topic_id = ${topicId} 
        ORDER BY created_at ASC
    `;
    return rows as unknown as ContentBlock[];
}

export const getBlockAudio = async (id: string): Promise<Blob | null> => {
    const rows = await sql`SELECT audio FROM content_blocks WHERE id = ${id}`;
    if (rows.length === 0 || !rows[0].audio) return null;
    const uint8 = rows[0].audio as Uint8Array;
    return new Blob([uint8 as any], { type: 'audio/wav' });
};

export const saveBlockAudio = async (id: string, audioBlob: Blob) => {
    const buffer = await audioBlob.arrayBuffer();
    const data = new Uint8Array(buffer);
    await sql`UPDATE content_blocks SET audio = ${data}, has_audio = true WHERE id = ${id}`;
};

export const createContentBlock = async (block: ContentBlock) => {
    await sql`
        INSERT INTO content_blocks (id, topic_id, label, content, created_at)
        VALUES (${block.id}, ${block.topic_id}, ${block.label}, ${block.content}, ${block.created_at})
    `;
}

export const updateContentBlock = async (id: string, content: string) => {
    await sql`UPDATE content_blocks SET content = ${content} WHERE id = ${id}`;
}

export const deleteContentBlock = async (id: string) => {
    await sql`DELETE FROM content_blocks WHERE id = ${id}`;
}

// --- Templates ---

export const getTemplates = async (): Promise<Template[]> => {
    const rows = await sql`SELECT * FROM templates ORDER BY is_default DESC, name ASC`;
    return rows as unknown as Template[];
}

export const saveTemplate = async (template: Template) => {
    // Upsert
    const existing = await sql`SELECT id FROM templates WHERE id = ${template.id}`;
    if (existing.length > 0) {
        await sql`UPDATE templates SET name=${template.name}, prompt=${template.prompt}, type=${template.type} WHERE id=${template.id}`;
    } else {
        await sql`INSERT INTO templates (id, name, prompt, type, is_default) VALUES (${template.id}, ${template.name}, ${template.prompt}, ${template.type}, 0)`;
    }
}

export const deleteTemplate = async (id: string) => {
     await sql`DELETE FROM templates WHERE id = ${id}`;
}

export const getSiblings = async (parentId: string | null, currentId: string): Promise<Topic[]> => {
    if (parentId) {
        const rows = await sql`SELECT * FROM topics WHERE parent_id = ${parentId} AND id != ${currentId} LIMIT 20`;
        return rows as unknown as Topic[];
    } else {
        const rows = await sql`SELECT * FROM topics WHERE parent_id IS NULL AND id != ${currentId} LIMIT 20`;
        return rows as unknown as Topic[];
    }
}

export const getAncestors = async (id: string): Promise<Topic[]> => {
    const rows = await sql`
        WITH RECURSIVE ancestors AS (
            SELECT id, parent_id, code, title, content, has_audio, created_at, 0 as level 
            FROM topics WHERE id = ${id}
            UNION ALL
            SELECT t.id, t.parent_id, t.code, t.title, t.content, t.has_audio, t.created_at, a.level + 1
            FROM topics t
            JOIN ancestors a ON t.id = a.parent_id
        )
        SELECT * FROM ancestors WHERE id != ${id} ORDER BY level DESC;
    `;
    return rows as unknown as Topic[];
}

// --- Data Management ---

function bufferToBase64(buffer: Uint8Array): string {
    let binary = '';
    const len = buffer.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(buffer[i]);
    }
    return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

export const exportDatabase = async () => {
    console.log("DEBUG: Starting export");
    
    // Helper to serialize BigInts and other non-JSON types
    const serialize = (rows: any) => {
        if (!Array.isArray(rows)) {
            try {
                rows = Array.from(rows);
            } catch (e) {
                return [];
            }
        }

        return rows.map((row: any) => {
            const newRow: any = {};
            for (const key in row) {
                let value = row[key];
                if (typeof value === 'bigint') {
                    value = Number(value);
                }
                // Convert Uint8Array to base64 string for efficient JSON
                if (value instanceof Uint8Array) {
                    value = bufferToBase64(value);
                }
                newRow[key] = value;
            }
            return newRow;
        });
    };

    try {
        const topics = await sql`SELECT * FROM topics`;
        const contentBlocks = await sql`SELECT * FROM content_blocks`;
        const templates = await sql`SELECT * FROM templates`;
        const settings = await sql`SELECT * FROM settings`;
        
        return {
            timestamp: Date.now(),
            topics: serialize(topics),
            contentBlocks: serialize(contentBlocks),
            templates: serialize(templates),
            settings: serialize(settings)
        };
    } catch (e) {
        console.error("DEBUG: Export error", e);
        throw e;
    }
}

export const clearDatabase = async () => {
    await sql`DELETE FROM content_blocks`;
    await sql`DELETE FROM topics`;
    await sql`DELETE FROM templates`;
    await sql`DELETE FROM settings`;
}

export const importDatabase = async (data: any) => {
    if (!data.topics || !data.contentBlocks) {
        throw new Error("Invalid import file format");
    }

    await clearDatabase();

    // Helper to decode audio if string
    const resolveAudio = (val: any) => {
        if (typeof val === 'string') {
            return base64ToBuffer(val);
        }
        if (val && typeof val === 'object') {
            // Legacy fallback if user has an old export using array format
            return new Uint8Array(Object.values(val)); 
        }
        return null;
    }

    // Import Topics
    for (const t of data.topics) {
        await sql`
            INSERT INTO topics (id, parent_id, code, title, content, has_audio, created_at, audio)
            VALUES (${t.id}, ${t.parent_id}, ${t.code}, ${t.title}, ${t.content}, ${t.has_audio}, ${t.created_at}, ${resolveAudio(t.audio)})
        `;
    }

    // Import Content Blocks
    for (const b of data.contentBlocks) {
         await sql`
            INSERT INTO content_blocks (id, topic_id, label, content, has_audio, created_at, audio)
            VALUES (${b.id}, ${b.topic_id}, ${b.label}, ${b.content}, ${b.has_audio}, ${b.created_at}, ${resolveAudio(b.audio)})
        `;
    }

    // Import Templates
    if (data.templates) {
        for (const t of data.templates) {
            await sql`
                INSERT INTO templates (id, name, prompt, type, is_default)
                VALUES (${t.id}, ${t.name}, ${t.prompt}, ${t.type}, ${t.is_default})
            `;
        }
    }
    
    // Import Settings
    if (data.settings) {
        for (const s of data.settings) {
             await sql`
                INSERT INTO settings (key, value) VALUES (${s.key}, ${s.value})
            `;
        }
    }
}
