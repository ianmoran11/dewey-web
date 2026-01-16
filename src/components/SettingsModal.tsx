import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../lib/store';
import { X, Key, List, Trash2, Plus, BrainCircuit, Database, Download, Upload, AlertTriangle, Volume2, Edit2 } from 'lucide-react';
import { getModels, OpenRouterModel } from '../services/ai';
import { saveTemplate, deleteTemplate, exportDatabase, importDatabase, clearDatabase, getPromptHistory, clearPromptHistory, PromptHistoryEntry } from '../db/queries';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import { Template } from '../types';

export const SettingsModal = ({ onClose }: { onClose: () => void }) => {
    const { settings, updateSetting, templates, refreshTemplates, refreshTopics } = useStore();
    const [activeTab, setActiveTab] = useState<'general' | 'templates' | 'history' | 'data'>('general');
    
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
    const [newTemplateType, setNewTemplateType] = useState<'content' | 'subtopics' | 'flashcards'>('content');
    const [newTemplateAutoAudio, setNewTemplateAutoAudio] = useState(false);
    const [isAddingTemplate, setIsAddingTemplate] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

    // Prompt History
    const [promptHistory, setPromptHistory] = useState<PromptHistoryEntry[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [selectedHistory, setSelectedHistory] = useState<PromptHistoryEntry | null>(null);

    // Data Management
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isImporting, setIsImporting] = useState(false);
    const importToastIdRef = useRef<string | null>(null);

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

    useEffect(() => {
        if (activeTab !== 'history') return;
        setHistoryLoading(true);
        getPromptHistory(200)
            .then(rows => setPromptHistory(rows))
            .finally(() => setHistoryLoading(false));
    }, [activeTab]);

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
            id: editingTemplate ? editingTemplate.id : uuidv4(),
            name: newTemplateName,
            prompt: newTemplatePrompt,
            type: newTemplateType,
            auto_generate_audio: newTemplateAutoAudio
        });
        
        setNewTemplateName('');
        setNewTemplatePrompt('');
        setNewTemplateAutoAudio(false);
        setIsAddingTemplate(false);
        setEditingTemplate(null);
        await refreshTemplates();
        toast.success(editingTemplate ? "Template updated" : "Template added");
    }

    const handleEditTemplate = (t: Template) => {
        setNewTemplateName(t.name);
        setNewTemplatePrompt(t.prompt);
        setNewTemplateType(t.type);
        setNewTemplateAutoAudio(!!t.auto_generate_audio);
        setEditingTemplate(t);
        setIsAddingTemplate(true);
    };

    const handleDeleteTemplate = async (id: string) => {
        if (confirm("Delete this template?")) {
            await deleteTemplate(id);
            await refreshTemplates();
        }
    }

    const handleExport = async () => {
        try {
            // Exclude audio to prevent memory crashes on mobile
            const data = await exportDatabase({ includeAudio: false });
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `dewey-backup-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success("Database exported");
        } catch (e) {
            console.error(e);
            toast.error("Export failed");
        }
    }

    const handleImportClick = () => {
        console.log('[Import] Import click');
        // Important: if user selects the same file twice, <input type="file"> may not fire onChange.
        // Reset value before opening the picker.
        if (fileInputRef.current) fileInputRef.current.value = '';
        fileInputRef.current?.click();
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        console.log('[Import] file input onChange fired');
        const file = e.target.files?.[0];
        if (!file) {
            console.log('[Import] no file selected');
            return;
        }

        console.log(`[Import] selected file: ${file.name} (${file.size} bytes)`);

        if (!confirm("This will OVERWRITE your current database. Continue?")) {
            e.target.value = ''; // reset
            return;
        }

        setIsImporting(true);
        importToastIdRef.current = toast.loading('Import started…');

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                toast.loading('Reading file…', { id: importToastIdRef.current || undefined });
                const text = event.target?.result as string;
                toast.loading('Parsing JSON…', { id: importToastIdRef.current || undefined });
                const data = JSON.parse(text);

                toast.loading('Importing into database…', { id: importToastIdRef.current || undefined });
                await importDatabase(data);
                
                // Refresh everything
                await refreshTemplates();
                await refreshTopics();
                
                toast.success('Database imported successfully', { id: importToastIdRef.current || undefined });
                window.location.reload(); // safest way to update full state
            } catch (err: any) {
                console.error(err);
                toast.error(`Import failed: ${err.message || 'Invalid file'}`, { id: importToastIdRef.current || undefined });
            } finally {
                setIsImporting(false);
                // Allow importing the same file again
                e.target.value = '';
                importToastIdRef.current = null;
            }
        };
        reader.onerror = (ev) => {
            console.error('[Import] FileReader error', ev);
            toast.error('Import failed: could not read file', { id: importToastIdRef.current || undefined });
            setIsImporting(false);
            e.target.value = '';
            importToastIdRef.current = null;
        };
        reader.readAsText(file);
    }

    const handleReset = async () => {
        if (confirm("Are you sure? This will DELETE ALL DATA irreversibly.") && confirm("Really sure? This cannot be undone.")) {
            try {
                await clearDatabase();
                toast.success("Database reset");
                window.location.reload();
            } catch (e) {
                console.error(e);
                toast.error("Reset failed");
            }
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
                    <button 
                        onClick={() => setActiveTab('history')}
                        className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        Prompt History
                    </button>
                    <button 
                        onClick={() => setActiveTab('data')}
                        className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'data' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        Data Management
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
                                        onClick={() => {
                                            setEditingTemplate(null);
                                            setNewTemplateName('');
                                            setNewTemplatePrompt('');
                                            setNewTemplateAutoAudio(false);
                                            setIsAddingTemplate(true);
                                        }}
                                        className="text-xs flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 font-medium"
                                    >
                                        <Plus size={14} /> New Template
                                    </button>
                                )}
                            </div>

                            {isAddingTemplate && (
                                <div className="bg-gray-50 p-4 rounded-lg border border-blue-100 mb-4 animate-in slide-in-from-top-2">
                                    <h4 className="text-xs font-bold text-blue-800 mb-3">{editingTemplate ? 'Edit Template' : 'New Template'}</h4>
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
                                                    <option value="flashcards">Flashcards</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="checkbox" 
                                                id="newTemplateAutoAudio"
                                                checked={newTemplateAutoAudio}
                                                onChange={e => setNewTemplateAutoAudio(e.target.checked)}
                                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                            />
                                            <label htmlFor="newTemplateAutoAudio" className="text-xs text-gray-700">Auto-generate Audio after content generation</label>
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
                                            <button onClick={() => { setIsAddingTemplate(false); setEditingTemplate(null); }} className="text-xs px-3 py-1 text-gray-500 hover:text-gray-700">Cancel</button>
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
                                                    {t.auto_generate_audio && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider bg-blue-100 text-blue-700 flex items-center gap-1">
                                                            <Volume2 size={10} /> Auto-Audio
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-500 mt-1 line-clamp-2 font-mono bg-gray-50 p-1 rounded inline-block">
                                                    {t.prompt}
                                                </p>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                <button 
                                                    onClick={() => handleEditTemplate(t)}
                                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteTemplate(t.id)}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                                    <List size={16} /> Prompt History
                                </h3>
                                <button
                                    onClick={async () => {
                                        if (!confirm('Clear all prompt history?')) return;
                                        await clearPromptHistory();
                                        setPromptHistory([]);
                                        setSelectedHistory(null);
                                        toast.success('Prompt history cleared');
                                    }}
                                    className="text-xs flex items-center gap-1 bg-red-50 text-red-600 px-2 py-1 rounded hover:bg-red-100 font-medium"
                                >
                                    <Trash2 size={14} /> Clear
                                </button>
                            </div>

                            {historyLoading ? (
                                <div className="text-sm text-gray-500">Loading…</div>
                            ) : promptHistory.length === 0 ? (
                                <div className="text-sm text-gray-500">No prompts logged yet.</div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        {promptHistory.map(h => {
                                            const preview = (() => {
                                                try {
                                                    const obj = JSON.parse(h.payload);
                                                    const msg = obj?.messages?.[0]?.content || obj?.messages?.[1]?.content || '';
                                                    return String(msg).replace(/\s+/g, ' ').slice(0, 120);
                                                } catch {
                                                    return h.payload.slice(0, 120);
                                                }
                                            })();

                                            return (
                                                <button
                                                    key={h.id}
                                                    onClick={() => setSelectedHistory(h)}
                                                    className={`w-full text-left border rounded-lg p-3 hover:border-gray-300 hover:shadow-sm transition-all ${selectedHistory?.id === h.id ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'}`}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{h.type}</span>
                                                        <span className="text-[10px] text-gray-400">{new Date(h.created_at).toLocaleString()}</span>
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-1">{h.model || 'default model'}</div>
                                                    {h.topic_title && (
                                                        <div className="text-xs text-gray-700 mt-1 truncate">{h.topic_title}</div>
                                                    )}
                                                    <div className="text-xs text-gray-500 mt-2 line-clamp-3 font-mono">
                                                        {preview}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="border border-gray-200 rounded-lg bg-white p-3">
                                        {!selectedHistory ? (
                                            <div className="text-sm text-gray-500">Select a prompt to view details.</div>
                                        ) : (
                                            <>
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Details</div>
                                                    <button
                                                        onClick={async () => {
                                                            await navigator.clipboard.writeText(selectedHistory.payload);
                                                            toast.success('Copied payload');
                                                        }}
                                                        className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded font-medium"
                                                    >
                                                        Copy
                                                    </button>
                                                </div>
                                                <pre className="text-[11px] whitespace-pre-wrap break-words font-mono text-gray-700 bg-gray-50 border border-gray-200 rounded p-2 max-h-[45vh] overflow-auto">
                                                    {selectedHistory.payload}
                                                </pre>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'data' && (
                        <div className="space-y-8">
                            <section className="space-y-4">
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                                    <Database size={16} /> Backup & Restore
                                </h3>
                                <p className="text-sm text-gray-500">
                                    Export your entire knowledge base, including topics, content, and templates, to a JSON file. 
                                    Importing will <strong>overwrite</strong> your current data.
                                </p>
                                
                                <div className="flex gap-4">
                                    <button 
                                        onClick={handleExport}
                                        disabled={isImporting}
                                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors shadow-sm"
                                    >
                                        <Download size={16} /> Export Data
                                    </button>
                                    
                                    <button 
                                        onClick={handleImportClick}
                                        disabled={isImporting}
                                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-green-600 transition-colors shadow-sm"
                                    >
                                        <Upload size={16} /> {isImporting ? 'Importing…' : 'Import Data'}
                                    </button>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        onChange={handleFileChange} 
                                        className="hidden" 
                                        accept=".json"
                                    />
                                </div>
                            </section>

                            <section className="pt-8 border-t border-gray-100 space-y-4">
                                <h3 className="text-sm font-bold text-red-600 uppercase tracking-wide flex items-center gap-2">
                                    <AlertTriangle size={16} /> Danger Zone
                                </h3>
                                <div className="bg-red-50 border border-red-100 rounded-lg p-4 flex items-center justify-between">
                                    <div>
                                        <h4 className="text-sm font-medium text-red-900">Factory Reset</h4>
                                        <p className="text-xs text-red-700 mt-1">Permanently delete all topics, content, and settings.</p>
                                    </div>
                                    <button 
                                        onClick={handleReset}
                                        className="px-4 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-600 hover:text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                                    >
                                        Reset All
                                    </button>
                                </div>
                            </section>
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
