export interface Topic {
  id: string;
  parent_id: string | null;
  code?: string;
  title: string;
  // content is deprecated in favor of content_blocks, but keeping optional for backward compat/migration if needed
  content?: string; 
  has_audio: boolean;
  has_content?: boolean;
  has_block_audio?: boolean;
  has_flashcards?: boolean;
  is_pinned?: boolean;
  created_at: number;
}

export interface TopicNode extends Topic {
  children: TopicNode[];
}

export interface ContentBlock {
  id: string;
  topic_id: string;
  label: string;
  content: string;
  has_audio?: boolean;
  created_at: number;
}

export interface Flashcard {
  id: string;
  topic_id: string;
  front: string;
  back: string;
  created_at: number;
  // SM-2 Algorithm Fields
  next_review?: number | null; // Timestamp
  interval: number; // Days
  ease_factor: number;
  repetitions: number;
}

// Extended flashcard with topic info for library view
export interface FlashcardWithTopic extends Flashcard {
  topic_title?: string;
  topic_code?: string;
}

export type AudioEpisodeScope = 'topic' | 'block';

export interface AudioEpisode {
  id: string;
  created_at: number;
  title: string;
  scope: AudioEpisodeScope;
  topic_id: string;
  block_id?: string | null;

  // Derived/joined display fields
  topic_title?: string;
  topic_code?: string;
  block_label?: string | null;
}

export interface Template {
  id: string;
  name: string;
  prompt: string;
  type: 'content' | 'subtopics' | 'flashcards';
  auto_generate_audio?: boolean;
}

export interface Settings {
  openRouterKey?: string;
  deepInfraKey?: string;
  modelSubtopic?: string;
  modelContent?: string;
  lastExportAt?: string; // ISO string timestamp
}

export type JobType = 'subtopics' | 'content' | 'audio' | 'flashcards';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Job {
    id: string;
    type: JobType;
    status: JobStatus;
    payload: any;
    error?: string;
    createdAt: number;
    startedAt?: number;
    completedAt?: number;
}
