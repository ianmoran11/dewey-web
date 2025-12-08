import { sql } from './client';
import { Topic, ContentBlock, Template } from '../types';

export const getTopics = async (): Promise<Topic[]> => {
  const rows = await sql`
    SELECT id, parent_id, code, title, content, has_audio, created_at 
    FROM topics 
    ORDER BY code ASC, created_at ASC
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
  return rows[0].audio as Blob;
};

export const updateTopicContent = async (id: string, content: string) => {
  await sql`UPDATE topics SET content = ${content} WHERE id = ${id}`;
};

export const saveTopicAudio = async (id: string, audioBlob: Blob) => {
  await sql`UPDATE topics SET audio = ${audioBlob}, has_audio = true WHERE id = ${id}`;
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
    const rows = await sql`SELECT * FROM content_blocks WHERE topic_id = ${topicId} ORDER BY created_at ASC`;
    return rows as unknown as ContentBlock[];
}

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
