import { create } from 'zustand';
import { Topic, Settings, Template, ContentBlock } from '../types';
import { getTopics, getTopic, getAudio, getTemplates, getContentBlocks } from '../db/queries';
import { initDB, getSettings, saveSetting } from '../db/client';
import { seedDatabase } from '../db/seed';

let initialized = false;

interface AppState {
  topics: Topic[];
  selectedTopicId: string | null;
  selectedTopic: Topic | null;
  selectedContentBlocks: ContentBlock[];
  templates: Template[];
  audioUrl: string | null;
  settings: Settings;
  isLoading: boolean;
  isInitializing: boolean;

  init: () => Promise<void>;
  selectTopic: (id: string | null) => Promise<void>;
  refreshTopics: () => Promise<void>;
  refreshTemplates: () => Promise<void>;
  refreshContentBlocks: () => Promise<void>;
  updateSetting: (key: keyof Settings, value: string) => Promise<void>;
  setLoading: (loading: boolean) => void;
}

export const useStore = create<AppState>((set, get) => ({
  topics: [],
  selectedTopicId: null,
  selectedTopic: null,
  selectedContentBlocks: [],
  templates: [],
  audioUrl: null,
  settings: {},
  isLoading: false,
  isInitializing: true,

  init: async () => {
    if (initialized) return;
    initialized = true;

    try {
      await initDB();
      await seedDatabase();
      
      const openRouterKey = await getSettings('openRouterKey');
      const deepInfraKey = await getSettings('deepInfraKey');
      const modelSubtopic = await getSettings('modelSubtopic');
      const modelContent = await getSettings('modelContent');
      
      set({ 
        settings: { 
          openRouterKey: openRouterKey || undefined, 
          deepInfraKey: deepInfraKey || undefined,
          modelSubtopic: modelSubtopic || undefined,
          modelContent: modelContent || undefined,
        } 
      });

      await get().refreshTopics();
      await get().refreshTemplates();
    } catch (e) {
      console.error('Initialization failed', e);
    } finally {
      set({ isInitializing: false });
    }
  },

  selectTopic: async (id: string | null) => {
    // Cleanup old audio url
    const oldUrl = get().audioUrl;
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    
    set({ selectedTopicId: id, audioUrl: null, selectedTopic: null, selectedContentBlocks: [] });
    
    if (id) {
      set({ isLoading: true });
      try {
        const topic = await getTopic(id);
        const audioBlob = await getAudio(id);
        
        let audioUrl = null;
        if (audioBlob) {
            audioUrl = URL.createObjectURL(audioBlob);
        }
        
        set({ selectedTopic: topic, audioUrl });
        await get().refreshContentBlocks();
      } finally {
        set({ isLoading: false });
      }
    }
  },

  refreshTopics: async () => {
    const topics = await getTopics();
    set({ topics });
  },

  refreshTemplates: async () => {
    const templates = await getTemplates();
    set({ templates });
  },

  refreshContentBlocks: async () => {
    const { selectedTopicId } = get();
    if (selectedTopicId) {
        const blocks = await getContentBlocks(selectedTopicId);
        set({ selectedContentBlocks: blocks });
    }
  },

  updateSetting: async (key: keyof Settings, value: string) => {
    await saveSetting(key, value);
    set((state) => ({ settings: { ...state.settings, [key]: value } }));
  },

  setLoading: (loading: boolean) => set({ isLoading: loading }),
}));
