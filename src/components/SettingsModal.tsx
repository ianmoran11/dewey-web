import React, { useState } from 'react';
import { useStore } from '../lib/store';
import { X, Key } from 'lucide-react';

export const SettingsModal = ({ onClose }: { onClose: () => void }) => {
    const { settings, updateSetting } = useStore();
    const [openRouterKey, setOpenRouterKey] = useState(settings.openRouterKey || '');
    const [deepInfraKey, setDeepInfraKey] = useState(settings.deepInfraKey || '');
    
    const handleSave = async () => {
        await updateSetting('openRouterKey', openRouterKey);
        await updateSetting('deepInfraKey', deepInfraKey);
        onClose();
    }
    
    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 transform transition-all scale-100">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                        <Key className="text-blue-600" size={20} />
                        <h2 className="text-xl font-bold text-gray-800">API Configuration</h2>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>
                
                <div className="space-y-6">
                    <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
                        <p>API keys are stored locally in your browser and are never sent to our servers.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">OpenRouter API Key</label>
                        <input 
                            type="password" 
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="sk-or-..."
                            value={openRouterKey}
                            onChange={e => setOpenRouterKey(e.target.value)}
                        />
                         <p className="text-xs text-gray-500 mt-1">Required for generating text content and subtopics.</p>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">DeepInfra API Key</label>
                        <input 
                            type="password" 
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="DeepInfra Token..."
                            value={deepInfraKey}
                            onChange={e => setDeepInfraKey(e.target.value)}
                        />
                         <p className="text-xs text-gray-500 mt-1">Optional. Used for high-quality audio generation.</p>
                    </div>
                </div>
                
                <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                    <button onClick={handleSave} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-sm transition-colors">Save Settings</button>
                </div>
            </div>
        </div>
    )
}
