import React, { useState } from 'react';
import { useStore } from '../lib/store';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import { Wand2, FileText as FileIcon, Volume2, ChevronDown, Trash2, Plus } from 'lucide-react';
import { deleteContentBlock, getSiblings, getAncestors, getBlockAudio } from '../db/queries';
import toast from 'react-hot-toast';
import { Topic } from '../types';

const BlockAudioPlayer = ({ blockId }: { blockId: string }) => {
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
        getBlockAudio(blockId).then(blob => {
            if (blob) setUrl(URL.createObjectURL(blob));
            setLoading(false);
        });
        return () => {
            if (url) URL.revokeObjectURL(url);
        }
    }, [blockId]);

    if (loading) return <div className="text-xs text-gray-400 py-2">Loading audio...</div>;
    if (!url) return null;

    return (
        <div className="mt-4 mb-2 bg-gray-50 p-2 rounded-lg border border-gray-200 flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0">
                 <Volume2 size={16} />
             </div>
             <audio controls src={url} className="w-full h-8" />
        </div>
    )
}

export const MainArea = () => {
    const { 
        selectedTopic, 
        checkedTopicIds,
        topics,
        selectedContentBlocks, 
        audioUrl, 
        settings, 
        templates, 
        refreshContentBlocks,
        addJob
    } = useStore();
    
    const [showContentMenu, setShowContentMenu] = useState(false);
    const [showSubtopicMenu, setShowSubtopicMenu] = useState(false);

    const isBulk = checkedTopicIds.size > 0;
    const targetCount = isBulk ? checkedTopicIds.size : 1;

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

    const interpolatePrompt = async (promptTemplate: string, targetTopic: Topic) => {
        let text = promptTemplate.replace(/{{topic}}/g, targetTopic.title);
        
        if (text.includes('{{neighbors}}')) {
            const siblings = await getSiblings(targetTopic.parent_id, targetTopic.id);
            text = text.replace(/{{neighbors}}/g, siblings.map(s => s.title).join(', '));
        }
        
        if (text.includes('{{ancestors}}')) {
            const ancestors = await getAncestors(targetTopic.id);
            text = text.replace(/{{ancestors}}/g, ancestors.map(a => a.title).join(' > '));
        }
        
        return text;
    }

    const getTargetTopics = () => {
        if (checkedTopicIds.size > 0) {
            return topics.filter(t => checkedTopicIds.has(t.id));
        }
        return [selectedTopic];
    };

    const handleGenerateSubtopics = async (templateId?: string) => {
        if (!settings.openRouterKey) return toast.error("Please configure API Key (OpenRouter) first");
        
        setShowSubtopicMenu(false);
        const targets = getTargetTopics();
        
        let queuedCount = 0;
        for (const target of targets) {
            try {
                let customPrompt: string | undefined = undefined;
                
                if (templateId) {
                    const subtopicTemplate = templates.find(t => t.id === templateId);
                    if (subtopicTemplate) {
                        let t = await interpolatePrompt(subtopicTemplate.prompt, target);
                        customPrompt = t + "\n\nIMPORTANT: Return ONLY a JSON array of strings. Example: [\"Subtopic 1\"]";
                    }
                }

                addJob('subtopics', {
                    parentId: target.id,
                    topicTitle: target.title,
                    customPrompt,
                    model: settings.modelSubtopic
                });
                queuedCount++;
            } catch (e: any) {
                console.error(e);
            }
        }

        if (queuedCount > 0) toast.success(`Queued subtopics for ${queuedCount} topic(s)`);
        else toast.error("Failed to queue generation");
    }

    const handleGenerateContent = async (templateId: string) => {
        if (!settings.openRouterKey) return toast.error("Please configure API Key (OpenRouter) first");
        
        const template = templates.find(t => t.id === templateId);
        if (!template) return;

        setShowContentMenu(false);
        const targets = getTargetTopics();

        let queuedCount = 0;
        for (const target of targets) {
            try {
                const prompt = await interpolatePrompt(template.prompt, target);
                
                addJob('content', {
                    topicId: target.id,
                    label: template.name,
                    prompt,
                    model: settings.modelContent
                });
                queuedCount++;
            } catch (e: any) {
                 console.error(e);
            }
        }
        
        if (queuedCount > 0) toast.success(`Content generation queued for ${queuedCount} topic(s)`);
        else toast.error("Failed to queue generation");
    }

    const handleDeleteBlock = async (id: string) => {
        if (confirm("Delete this section?")) {
            await deleteContentBlock(id);
            await refreshContentBlocks();
        }
    }

    const handleGenerateAudio = async (blockId?: string) => {
        const key = settings.deepInfraKey || settings.openRouterKey;
        if (!key) return toast.error("Please configure an API Key first");
        
        // Single block narration
        if (blockId) {
            const block = selectedContentBlocks.find(b => b.id === blockId);
            if (!block) return;
            
            addJob('audio', {
                targetId: blockId,
                isBlock: true,
                text: block.content
            });
            toast.success("Audio synthesis queued");
            return;
        }

        // Topic narration (potentially bulk)
        const targets = getTargetTopics();
        let queuedCount = 0;

        for (const target of targets) {
            let textToNarrate = '';
            
            if (target.id === selectedTopic.id) {
                textToNarrate = selectedContentBlocks.map(b => b.content).join('\n\n') || target.content || '';
            }
            // Logic for other topics omitted for MVP simplicity as content is not loaded.
            
            if (textToNarrate) {
                addJob('audio', {
                    targetId: target.id,
                    isBlock: false,
                    text: textToNarrate
                });
                queuedCount++;
            }
        }
        
        if (queuedCount > 0) toast.success(`Audio synthesis queued for ${queuedCount} topic(s)`);
        else toast.error("No content to narrate (Select topic to load content)");
    }

    // Filter templates
    const contentTemplates = templates.filter(t => t.type === 'content');
    const subtopicTemplates = templates.filter(t => t.type === 'subtopics');

    return (
        <div key={selectedTopic.id} className="flex-1 h-full overflow-y-auto bg-white custom-scrollbar pb-20">
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
                     <div className="flex flex-wrap gap-3 items-center">
                        <div className="relative">
                            <button 
                                onClick={() => setShowSubtopicMenu(!showSubtopicMenu)} 
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:text-blue-600 rounded-lg transition-all shadow-sm disabled:opacity-50"
                            >
                                <Wand2 size={16} />
                                {isBulk ? `Expand Subtopics (${targetCount})` : 'Expand Subtopics'}
                                <ChevronDown size={14} className="text-gray-400" />
                            </button>

                            {showSubtopicMenu && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setShowSubtopicMenu(false)}></div>
                                    <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                        <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-50 mb-1">Select Strategy</div>
                                        
                                        <button 
                                            onClick={() => handleGenerateSubtopics()}
                                            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-2"
                                        >
                                            <Wand2 size={14} />
                                            Default (Standard)
                                        </button>

                                        {subtopicTemplates.map(t => (
                                            <button 
                                                key={t.id}
                                                onClick={() => handleGenerateSubtopics(t.id)}
                                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-2"
                                            >
                                                <FileIcon size={14} />
                                                {t.name}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                        
                        <div className="relative">
                             <button 
                                onClick={() => setShowContentMenu(!showContentMenu)} 
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:text-green-600 rounded-lg transition-all shadow-sm disabled:opacity-50"
                            >
                                <Plus size={16} />
                                {isBulk ? `Generate Content (${targetCount})` : 'Generate Content'}
                                <ChevronDown size={14} className="text-gray-400" />
                            </button>
                            
                            {showContentMenu && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setShowContentMenu(false)}></div>
                                    <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                        <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-50 mb-1">Select Template</div>
                                        {contentTemplates.length === 0 ? (
                                            <div className="px-4 py-2 text-sm text-gray-500">No content templates</div>
                                        ) : (
                                            contentTemplates.map(t => (
                                                <button 
                                                    key={t.id}
                                                    onClick={() => handleGenerateContent(t.id)}
                                                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-2"
                                                >
                                                    <FileIcon size={14} />
                                                    {t.name}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                         <button 
                            onClick={() => handleGenerateAudio()} 
                             className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:text-purple-600 rounded-lg transition-all shadow-sm disabled:opacity-50"
                        >
                            <Volume2 size={16} />
                            {isBulk ? `Narrate Topic (${targetCount})` : 'Narrate Topic'}
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

                {/* Content Blocks */}
                <div className="space-y-8 flex-1">
                    {/* Fallback for legacy content */}
                    {selectedTopic.content && selectedContentBlocks.length === 0 && (
                         <div className="prose prose-lg prose-slate max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{selectedTopic.content}</ReactMarkdown>
                         </div>
                    )}
                    
                    {selectedContentBlocks.length === 0 && !selectedTopic.content ? (
                        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400">
                                <FileIcon size={32} />
                            </div>
                            <p className="text-gray-500 font-medium">No content yet.</p>
                            <p className="text-gray-400 text-sm mt-1">Select a template to generate content.</p>
                        </div>
                    ) : (
                        selectedContentBlocks.map(block => (
                            <div key={block.id} className="group relative">
                                <div className="flex justify-between items-center mb-3 border-b border-gray-100 pb-2">
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{block.label}</span>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => handleGenerateAudio(block.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-all"
                                            title="Narrate Section"
                                        >
                                            <Volume2 size={14} />
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteBlock(block.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                                            title="Delete Section"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div className="prose prose-lg prose-slate max-w-none">
                                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{block.content}</ReactMarkdown>
                                </div>
                                {block.has_audio && (
                                    <BlockAudioPlayer blockId={block.id} />
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
