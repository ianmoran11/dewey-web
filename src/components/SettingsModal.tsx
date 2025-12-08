import React, { useState, useEffect } from 'react';
import { useStore } from '../lib/store';
import { X, Key, List, FileType, Trash2, Plus, BrainCircuit } from 'lucide-react';
import { getModels, OpenRouterModel } from '../services/ai';
import { saveTemplate, deleteTemplate } from '../db/queries';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';

export const SettingsModal = ({ onClose }: { onClose: () => void }) => {
    const { settings, updateSetting, templates, refreshTemplates } = useStore();
    const [activeTab, setActiveTab] = useState<'general' | 'templates'>('general');
    
    // API Keys
    const [openRouterKey, setOpenRouterKey] = useState(settings.openRouterKey || '');
    const [deepInfraKey, setDeepInfraKey] = useState(settings.deepInfraKey || '');
    
    // Models
    const [models, setModels] = useState<OpenRouterModel[]>([]);
    const [selectedSubtopicModel, setSelectedSubtopicModel] = useState(settings.modelSubtopic || '');
    const [selectedContentModel, setSelectedContentModel] = useState(settings.modelContent || '');
    const [loadingModels, setLoadingModels] = useState(false);

    // New Template
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newTemplatePrompt, setNewTemplatePrompt] = useState('');
    const [newTemplateType, setNewTemplateType] = useState<'content' | 'subtopics'>('content');
    const [isAddingTemplate, setIsAddingTemplate] = useState(false);

    useEffect(() => {
        if (openRouterKey) {
            setLoadingModels(true);
            getModels(openRouterKey)
                .then(ms => {
                    setModels(ms.sort((a,b) => a.name.localeCompare(b.name)));
                    setLoadingModels(false);
                })
                .catch(() => setLoadingModels(false));
        }
    }, [openRouterKey]);

    const handleSaveGeneral = async () => {
        await updateSetting('openRouterKey', openRouterKey);
        await updateSetting('deepInfraKey', deepInfraKey);
        await updateSetting('modelSubtopic', selectedSubtopicModel);
        await updateSetting('modelContent', selectedContentModel);
        onClose();
        toast.success("Settings saved");
    }

    const handleSaveTemplate = async () => {
        if (!newTemplateName || !newTemplatePrompt) return toast.error("Fill in all fields");
        
        await saveTemplate({
            id: uuidv4(),
            name: newTemplateName,
            prompt: newTemplatePrompt,
            type: newTemplateType
        });
        
        setNewTemplateName('');
        setNewTemplatePrompt('');
        setIsAddingTemplate(false);
        await refreshTemplates();
        toast.success("Template added");
    }

    const handleDeleteTemplate = async (id: string) => {
        if (confirm("Delete this template?")) {
            await deleteTemplate(id);
            await refreshTemplates();
        }
    }
    
    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl h-[85vh] flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800">Configuration</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100 px-6">
                    <button 
                        onClick={() => setActiveTab('general')}
                        className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'general' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        General & Models
                    </button>
                    <button 
                        onClick={() => setActiveTab('templates')}
                        className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'templates' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        Prompt Templates
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                    {activeTab === 'general' && (
                        <div className="space-y-8">
                            {/* Keys */}
                            <section className="space-y-4">
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                                    <Key size={16} /> API Keys
                                </h3>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">OpenRouter Key</label>
                                    <input 
                                        type="password" 
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="sk-or-..."
                                        value={openRouterKey}
                                        onChange={e => setOpenRouterKey(e.target.value)}
                                        onBlur={() => {
                                            // Trigger model fetch if needed
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">DeepInfra Key (Optional)</label>
                                    <input 
                                        type="password" 
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="DeepInfra Token..."
                                        value={deepInfraKey}
                                        onChange={e => setDeepInfraKey(e.target.value)}
                                    />
                                </div>
                            </section>

                            {/* Models */}
                            <section className="space-y-4">
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                                    <BrainCircuit size={16} /> Model Selection
                                </h3>
                                {models.length === 0 && !loadingModels && openRouterKey && (
                                    <p className="text-xs text-red-500">Could not load models. Check your API Key.</p>
                                )}
                                {loadingModels && <p className="text-xs text-gray-500">Loading models...</p>}
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Subtopic Generation</label>
                                        <select 
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                            value={selectedSubtopicModel}
                                            onChange={e => setSelectedSubtopicModel(e.target.value)}
                                        >
                                            <option value="">Default (GPT-3.5 Turbo)</option>
                                            {models.map(m => (
                                                <option key={m.id} value={m.id}>{m.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Content Generation</label>
                                        <select 
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                            value={selectedContentModel}
                                            onChange={e => setSelectedContentModel(e.target.value)}
                                        >
                                            <option value="">Default (GPT-3.5 Turbo)</option>
                                            {models.map(m => (
                                                <option key={m.id} value={m.id}>{m.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'templates' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                                    <List size={16} /> Custom Templates
                                </h3>
                                {!isAddingTemplate && (
                                    <button 
                                        onClick={() => setIsAddingTemplate(true)}
                                        className="text-xs flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 font-medium"
                                    >
                                        <Plus size={14} /> New Template
                                    </button>
                                )}
                            </div>

                            {isAddingTemplate && (
                                <div className="bg-gray-50 p-4 rounded-lg border border-blue-100 mb-4 animate-in slide-in-from-top-2">
                                    <div className="space-y-3">
                                        <div className="flex gap-4">
                                            <div className="flex-1">
                                                <label className="text-xs font-semibold text-gray-600">Name</label>
                                                <input 
                                                    type="text" 
                                                    className="w-full border p-1.5 text-sm rounded" 
                                                    placeholder="e.g. Detailed Summary"
                                                    value={newTemplateName}
                                                    onChange={e => setNewTemplateName(e.target.value)}
                                                />
                                            </div>
                                            <div className="w-1/3">
                                                <label className="text-xs font-semibold text-gray-600">Type</label>
                                                <select 
                                                    className="w-full border p-1.5 text-sm rounded"
                                                    value={newTemplateType}
                                                    onChange={e => setNewTemplateType(e.target.value as any)}
                                                >
                                                    <option value="content">Content</option>
                                                    <option value="subtopics">Subtopics</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-600">Prompt Template</label>
                                            <p className="text-[10px] text-gray-500 mb-1">Variables: <code className="bg-gray-200 px-1 rounded">{'{topic}'}</code>, <code className="bg-gray-200 px-1 rounded">{'{neighbors}'}</code></p>
                                            <textarea 
                                                className="w-full border p-2 text-sm rounded h-24"
                                                placeholder="Write a summary for {{topic}}..."
                                                value={newTemplatePrompt}
                                                onChange={e => setNewTemplatePrompt(e.target.value)}
                                            ></textarea>
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => setIsAddingTemplate(false)} className="text-xs px-3 py-1 text-gray-500 hover:text-gray-700">Cancel</button>
                                            <button onClick={handleSaveTemplate} className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3">
                                {templates.map(t => (
                                    <div key={t.id} className="border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors bg-white group hover:shadow-sm">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-semibold text-gray-800 text-sm">{t.name}</h4>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider ${t.type === 'content' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                                                        {t.type}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-1 line-clamp-2 font-mono bg-gray-50 p-1 rounded inline-block">
                                                    {t.prompt}
                                                </p>
                                            </div>
                                            <button 
                                                onClick={() => handleDeleteTemplate(t.id)}
                                                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                
                {/* Footer */}
                {activeTab === 'general' && (
                    <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-2xl">
                        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                        <button onClick={handleSaveGeneral} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-sm">Save Configuration</button>
                    </div>
                )}
            </div>
        </div>
    )
}
