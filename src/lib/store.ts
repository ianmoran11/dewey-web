import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { Topic, Settings, Template, ContentBlock, Job, JobType } from '../types';
import { 
    getTopics, getTopic, getAudio, getTemplates, getContentBlocks,
    createAudioEpisode,
    createTopic, createContentBlock, saveTopicAudio, saveBlockAudio,
    updateTopic, deleteTopic, updateTopicParent
} from '../db/queries';
import { generateSubtopics, generateAIContent, generateAudio } from '../services/ai';
import { initDB, getSettings, saveSetting } from '../db/client';
import { seedDatabase } from '../db/seed';
import { concatWavBlobs, splitTextForTTS } from '../utils/audio';

let initialized = false;
const MAX_CONCURRENT_JOBS = 3;
const JOB_DELAY_MS = 5000;

interface AppState {
  jobs: Job[];
  lastJobStartedAt: number;
  unreadTopics: Set<string>;
  topics: Topic[];
  selectedTopicId: string | null;
  selectedTopic: Topic | null;
  checkedTopicIds: Set<string>;
  expandedTopicIds: Set<string>;
  selectedContentBlocks: ContentBlock[];
  templates: Template[];
  audioUrl: string | null;
  settings: Settings;
  isLoading: boolean;
  isInitializing: boolean;

  init: () => Promise<void>;
  selectTopic: (id: string | null) => Promise<void>;
  setCheckedTopicIds: (ids: Set<string>) => void;
  clearCheckedTopicIds: () => void;
  toggleTopicExpansion: (id: string) => void;
  refreshTopics: () => Promise<void>;
  refreshTemplates: () => Promise<void>;
  refreshContentBlocks: () => Promise<void>;
  updateSetting: (key: keyof Settings, value: string) => Promise<void>;
  setLoading: (loading: boolean) => void;

  createManualTopic: (parentId: string | null, title: string, code?: string) => Promise<void>;
  updateTopicDetails: (id: string, title: string, code?: string) => Promise<void>;
  moveTopic: (id: string, newParentId: string | null) => Promise<void>;
  deleteTopic: (id: string) => Promise<void>;
  
  // Job Queue Actions
  addJob: (type: JobType, payload: any) => void;
  removeJob: (id: string) => void;
  clearCompletedJobs: () => void;
  cancelQueue: () => void;
  processQueue: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  jobs: [],
  lastJobStartedAt: 0,
  unreadTopics: new Set(),
  topics: [],
  selectedTopicId: null,
  selectedTopic: null,
  checkedTopicIds: new Set(),
  expandedTopicIds: new Set(),
  selectedContentBlocks: [],
  templates: [],
  audioUrl: null,
  settings: {},
  isLoading: false,
  isInitializing: true,

  addJob: (type: JobType, payload: any) => {
    const job: Job = {
        id: uuidv4(),
        type,
        payload,
        status: 'pending',
        createdAt: Date.now()
    };
    set((state) => ({ jobs: [...state.jobs, job] }));
    get().processQueue();
  },

  removeJob: (id: string) => {
    set((state) => ({ jobs: state.jobs.filter(j => j.id !== id) }));
  },

  clearCompletedJobs: () => {
    set((state) => ({ jobs: state.jobs.filter(j => j.status !== 'completed' && j.status !== 'failed') }));
  },

  cancelQueue: () => {
    set((state) => ({ jobs: state.jobs.filter(j => j.status !== 'pending') }));
  },

  processQueue: async () => {
    const { jobs, lastJobStartedAt, settings } = get();
    
    // Concurrency Check
    const activeJobs = jobs.filter(j => j.status === 'processing');
    if (activeJobs.length >= MAX_CONCURRENT_JOBS) return;

    // Find next pending job
    const pendingJob = jobs.find(j => j.status === 'pending');
    if (!pendingJob) return;

    // Rate Limit Check
    const now = Date.now();
    const timeSinceLast = now - lastJobStartedAt;
    if (timeSinceLast < JOB_DELAY_MS) {
        // Schedule retry
        setTimeout(() => get().processQueue(), JOB_DELAY_MS - timeSinceLast + 100);
        return;
    }

    // Start Job
    set((state) => ({
        lastJobStartedAt: now,
        jobs: state.jobs.map(j => j.id === pendingJob.id ? { ...j, status: 'processing', startedAt: now } : j)
    }));

    // Trigger next check immediately for concurrency filling
    get().processQueue();

    try {
        const apiKey = settings.openRouterKey;
        const deepInfraKey = settings.deepInfraKey || settings.openRouterKey;

        if (pendingJob.type === 'subtopics') {
            if (!apiKey) throw new Error("Missing API Key");
            const { parentId, topicTitle, customPrompt, model } = pendingJob.payload;
            
            const children = await generateSubtopics(
                apiKey, 
                topicTitle, 
                undefined,
                model,
                customPrompt
            );

            for (const child of children) {
                await createTopic({
                    id: uuidv4(),
                    parent_id: parentId,
                    title: child,
                    has_audio: false,
                    created_at: Date.now()
                });
            }
            await get().refreshTopics();
        } 
        else if (pendingJob.type === 'content') {
            if (!apiKey) throw new Error("Missing API Key");
            const { topicId, label, prompt, model } = pendingJob.payload;
            
            const content = await generateAIContent(apiKey, prompt, model);
            
            await createContentBlock({
                id: uuidv4(),
                topic_id: topicId,
                label,
                content,
                created_at: Date.now()
            });

            // Only refresh if we are looking at this topic
            if (get().selectedTopicId === topicId) {
                await get().refreshContentBlocks();
            }
        }
        else if (pendingJob.type === 'audio') {
             if (!deepInfraKey) throw new Error("Missing API Key");
             const { targetId, isBlock, text } = pendingJob.payload;

             // Generate audio for long text by chunking into multiple TTS calls, then
             // concatenating the resulting WAV PCM data into a single WAV.
             //
             // NOTE: generateAudio() itself strips markdown; we chunk here to avoid
             // provider timeouts/truncation and remove the previous 5,000 char cutoff.
             const MAX_CHARS_PER_CHUNK = 2500;
             const MAX_TOTAL_CHARS = 100_000;

             const originalLen = (text || '').length;
             if (originalLen > MAX_TOTAL_CHARS) {
               throw new Error(`Text too long to narrate (${originalLen} chars). Try narrating smaller sections.`);
             }

             const chunks = splitTextForTTS(text || '', MAX_CHARS_PER_CHUNK);
             if (chunks.length === 0) throw new Error('No text to narrate');

             if (chunks.length > 1) {
               console.log(`[TTS] Chunked narration: ${originalLen} chars -> ${chunks.length} chunks (max ${MAX_CHARS_PER_CHUNK})`);
             }

             const chunkBlobs: Blob[] = [];
             for (let i = 0; i < chunks.length; i++) {
               const chunk = chunks[i];
               console.log(`[TTS] Generating chunk ${i + 1}/${chunks.length} (${chunk.length} chars)`);
               const b = await generateAudio(deepInfraKey, chunk);
               console.log(`[TTS] Chunk ${i + 1}/${chunks.length} blob size: ${b.size}`);
               chunkBlobs.push(b);
             }

             const blob = await concatWavBlobs(chunkBlobs);
             console.log(`[TTS] Final combined blob size: ${blob.size}`);

             if (isBlock) {
                 // Keep legacy storage for now
                 await saveBlockAudio(targetId, blob);

                 // Also create an audio episode (auto-title)
                 // targetId here is block id, so topic_id comes from payload (if provided)
                 const topicId = pendingJob.payload.topicId as string | undefined;
                 if (topicId) {
                   await createAudioEpisode({
                     id: uuidv4(),
                     created_at: Date.now(),
                     title: pendingJob.payload.title || `Narration: ${pendingJob.payload.topicTitle || 'Section'} — ${pendingJob.payload.blockLabel || ''}`.trim(),
                     scope: 'block',
                     topic_id: topicId,
                     block_id: targetId,
                     audioBlob: blob
                   });
                 }

                 if (get().selectedTopicId) await get().refreshContentBlocks();
             } else {
                 // Keep legacy storage for now
                 await saveTopicAudio(targetId, blob);

                 // Also create an audio episode (auto-title)
                 await createAudioEpisode({
                   id: uuidv4(),
                   created_at: Date.now(),
                   title: pendingJob.payload.title || `Narration: ${pendingJob.payload.topicTitle || 'Topic'}`,
                   scope: 'topic',
                   topic_id: targetId,
                   block_id: null,
                   audioBlob: blob
                 });

                 // If this is the currently selected topic, reload it to update audioUrl
                 if (get().selectedTopicId === targetId) {
                     await get().selectTopic(targetId);
                 } else {
                    await get().refreshTopics(); // Update icon
                 }
             }
        }

        // Job Success
        let targetTopicId = null;
        if (pendingJob.type === 'subtopics') targetTopicId = pendingJob.payload.parentId;
        if (pendingJob.type === 'content') targetTopicId = pendingJob.payload.topicId;
        if (pendingJob.type === 'audio') targetTopicId = pendingJob.payload.targetId; // Assuming target is topic or block

        set((state) => {
            const newUnread = new Set(state.unreadTopics);
            if (targetTopicId && targetTopicId !== state.selectedTopicId) {
                newUnread.add(targetTopicId);
            }
            return {
                jobs: state.jobs.map(j => j.id === pendingJob.id ? { ...j, status: 'completed', completedAt: Date.now() } : j),
                unreadTopics: newUnread
            };
        });

    } catch (e: any) {
        console.error(`Job ${pendingJob.id} failed:`, e);
        set((state) => ({
            jobs: state.jobs.map(j => j.id === pendingJob.id ? { ...j, status: 'failed', error: e.message || "Unknown error", completedAt: Date.now() } : j)
        }));
    } finally {
        // Trigger queue again to pick up next tasks
        get().processQueue();
    }
  },

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

  setCheckedTopicIds: (ids: Set<string>) => set({ checkedTopicIds: ids }),
  clearCheckedTopicIds: () => set({ checkedTopicIds: new Set() }),

  toggleTopicExpansion: (id: string) => set((state) => {
      const newExpanded = new Set(state.expandedTopicIds);
      if (newExpanded.has(id)) {
          newExpanded.delete(id);
      } else {
          newExpanded.add(id);
      }
      return { expandedTopicIds: newExpanded };
  }),

  selectTopic: async (id: string | null) => {
    // Cleanup old audio url
    const oldUrl = get().audioUrl;
    if (oldUrl) URL.revokeObjectURL(oldUrl);

    // Mark as read
    if (id && get().unreadTopics.has(id)) {
        const newUnread = new Set(get().unreadTopics);
        newUnread.delete(id);
        set({ unreadTopics: newUnread });
    }
    
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

  createManualTopic: async (parentId: string | null, title: string, code?: string) => {
      await createTopic({
          id: uuidv4(),
          parent_id: parentId,
          title,
          code,
          has_audio: false,
          created_at: Date.now()
      });
      await get().refreshTopics();
  },

  updateTopicDetails: async (id: string, title: string, code?: string) => {
      await updateTopic({
          id,
          title,
          code
      });
      await get().refreshTopics();
      if (get().selectedTopicId === id) {
          const updated = await getTopic(id);
          set({ selectedTopic: updated });
      }
  },

  deleteTopic: async (id: string) => {
      await deleteTopic(id);
      await get().refreshTopics();
      if (get().selectedTopicId === id) {
          get().selectTopic(null);
      }
  },

  moveTopic: async (id: string, newParentId: string | null) => {
      await updateTopicParent(id, newParentId);
      await get().refreshTopics();
  }
}));
