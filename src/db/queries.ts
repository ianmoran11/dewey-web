import { sql } from './client';
import { Topic } from '../types';

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
