export interface Topic {
  id: string;
  parent_id: string | null;
  code?: string;
  title: string;
  content?: string;
  has_audio: boolean;
  created_at: number;
}

export interface TopicNode extends Topic {
  children: TopicNode[];
}

export interface Settings {
  openRouterKey?: string;
  deepInfraKey?: string;
  // Add others as needed
}
