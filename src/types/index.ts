export interface Topic {
  id: string;
  parent_id: string | null;
  code?: string;
  title: string;
  // content is deprecated in favor of content_blocks, but keeping optional for backward compat/migration if needed
  content?: string; 
  has_audio: boolean;
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

export interface Template {
  id: string;
  name: string;
  prompt: string;
  type: 'content' | 'subtopics';
}

export interface Settings {
  openRouterKey?: string;
  deepInfraKey?: string;
  modelSubtopic?: string;
  modelContent?: string;
}
