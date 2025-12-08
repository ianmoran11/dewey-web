import React, { useState } from 'react';
import { useStore } from '../lib/store';
import ReactMarkdown from 'react-markdown';
import { Wand2, FileText as FileIcon, Volume2 } from 'lucide-react';
import { generateSubtopics, generateContent, generateAudio } from '../services/ai';
import { createTopic, updateTopicContent, saveTopicAudio } from '../db/queries';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';

export const MainArea = () => {
    const { selectedTopic, audioUrl, settings, refreshTopics, selectTopic } = useStore();
    const [generating, setGenerating] = useState(false);

    if (!selectedTopic) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50/30 text-gray-400 p-8 text-center">
                <div>
                  <h3 className="text-lg font-medium text-gray-500 mb-1">No Topic Selected</h3>
                  <p>Select a topic from the sidebar to view details or generate content.</p>
                </div>
            </div>
        );
    }

    const handleGenerateSubtopics = async () => {
        if (!settings.openRouterKey) return toast.error("Please configure API Key (OpenRouter) first");
        setGenerating(true);
        const toastId = toast.loading("Thinking...");
        try {
            const children = await generateSubtopics(settings.openRouterKey, selectedTopic.title);
            
            // Insert sequentially to ensure order/safety
            for (const child of children) {
                await createTopic({
                    id: uuidv4(),
                    parent_id: selectedTopic.id,
                    title: child,
                    has_audio: false,
                    created_at: Date.now()
                });
            }
            toast.success(`Generated ${children.length} subtopics`, { id: toastId });
            await refreshTopics();
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Failed to generate", { id: toastId });
        } finally {
            setGenerating(false);
        }
    }

    const handleGenerateContent = async () => {
        if (!settings.openRouterKey) return toast.error("Please configure API Key (OpenRouter) first");
        
        // Simple prompt for template choice could be a modal, but sticking to simple requirement:
        // "Select a template" -> For now, default or cycle?
        // Let's us a fixed template for MVP or randomize/simple prompt.
        const template = "Academic Description"; 

        setGenerating(true);
        const toastId = toast.loading("Writing content...");
        try {
            const content = await generateContent(settings.openRouterKey, selectedTopic.title, template);
            await updateTopicContent(selectedTopic.id, content);
            await selectTopic(selectedTopic.id); // reload data
            toast.success("Content updated", { id: toastId });
        } catch (e: any) {
             console.error(e);
             toast.error(e.message || "Failed to generate", { id: toastId });
        } finally {
            setGenerating(false);
        }
    }

    const handleGenerateAudio = async () => {
        const key = settings.deepInfraKey || settings.openRouterKey;
        if (!key) return toast.error("Please configure an API Key first");
        
        if (!selectedTopic.content) return toast.error("Generate content first");
        
        setGenerating(true);
        const toastId = toast.loading("Synthesizing audio...");
        try {
            // Truncate content for TTS delta if needed, but let's try full
            const blob = await generateAudio(key, selectedTopic.content);
            await saveTopicAudio(selectedTopic.id, blob);
            await selectTopic(selectedTopic.id); // reload data
            toast.success("Audio attached", { id: toastId });
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "TTS Failed", { id: toastId });
        } finally {
            setGenerating(false);
        }
    }

    return (
        <div key={selectedTopic.id} className="flex-1 h-full overflow-y-auto bg-white custom-scrollbar">
            <div className="max-w-4xl mx-auto p-8 min-h-full flex flex-col">
                {/* Header */}
                <div className="mb-8 border-b border-gray-100 pb-6">
                    <div className="flex items-baseline gap-3 mb-4">
                        {selectedTopic.code && (
                             <span className="text-2xl font-light text-gray-400 font-mono tracking-tighter">
                                {selectedTopic.code}
                            </span>
                        )}
                        <h1 className="text-4xl font-bold text-gray-900 tracking-tight leading-tight">
                            {selectedTopic.title}
                        </h1>
                    </div>
                    
                    {/* Action Bar */}
                     <div className="flex flex-wrap gap-3">
                        <button 
                            onClick={handleGenerateSubtopics} 
                            disabled={generating}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:text-blue-600 rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Wand2 size={16} className={generating ? "animate-pulse" : ""} />
                            Expand Subtopics
                        </button>
                         <button 
                            onClick={handleGenerateContent} 
                            disabled={generating}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:text-green-600 rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <FileIcon size={16} />
                            Write Content
                        </button>
                         <button 
                            onClick={handleGenerateAudio} 
                            disabled={generating}
                             className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:text-purple-600 rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Volume2 size={16} />
                            Narrate
                        </button>
                    </div>
                </div>

                {/* Audio Player */}
                {audioUrl && (
                    <div className="mb-8 bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0">
                            <Volume2 size={20} />
                        </div>
                        <div className="flex-1">
                             <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Audio Guide</div>
                             <audio controls src={audioUrl} className="w-full h-8" />
                        </div>
                    </div>
                )}

                {/* Content */}
                <div className="prose prose-lg prose-slate max-w-none flex-1">
                    {selectedTopic.content ? (
                        <ReactMarkdown>{selectedTopic.content}</ReactMarkdown>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400">
                                <FileIcon size={32} />
                            </div>
                            <p className="text-gray-500 font-medium">No content yet.</p>
                            <p className="text-gray-400 text-sm mt-1">Click "Write Content" to generate using AI.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
