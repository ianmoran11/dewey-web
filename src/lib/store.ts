import { create } from 'zustand';
import { Topic, Settings } from '../types';
import { getTopics, getTopic, getAudio } from '../db/queries';
import { initDB, getSettings, saveSetting } from '../db/client';
import { seedDatabase } from '../db/seed';

interface AppState {
  topics: Topic[];
  selectedTopicId: string | null;
  selectedTopic: Topic | null;
  audioUrl: string | null;
  settings: Settings;
  isLoading: boolean;
  isInitializing: boolean;

  init: () => Promise<void>;
  selectTopic: (id: string | null) => Promise<void>;
  refreshTopics: () => Promise<void>;
  updateSetting: (key: keyof Settings, value: string) => Promise<void>;
  setLoading: (loading: boolean) => void;
}

export const useStore = create<AppState>((set, get) => ({
  topics: [],
  selectedTopicId: null,
  selectedTopic: null,
  audioUrl: null,
  settings: {},
  isLoading: false,
  isInitializing: true,

  init: async () => {
    try {
      await initDB();
      await seedDatabase();
      
      const openRouterKey = await getSettings('openRouterKey');
      const deepInfraKey = await getSettings('deepInfraKey');
      
      set({ 
        settings: { 
          openRouterKey: openRouterKey || undefined, 
          deepInfraKey: deepInfraKey || undefined 
        } 
      });

      await get().refreshTopics();
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
    
    set({ selectedTopicId: id, audioUrl: null, selectedTopic: null });
    
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
      } finally {
        set({ isLoading: false });
      }
    }
  },

  refreshTopics: async () => {
    const topics = await getTopics();
    set({ topics });
  },

  updateSetting: async (key: keyof Settings, value: string) => {
    await saveSetting(key, value);
    set((state) => ({ settings: { ...state.settings, [key]: value } }));
  },

  setLoading: (loading: boolean) => set({ isLoading: loading }),
}));
