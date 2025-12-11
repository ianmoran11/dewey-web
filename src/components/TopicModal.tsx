import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useStore } from '../lib/store';

interface TopicModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'create' | 'edit';
    parentId?: string | null;
    initialData?: { id: string, title: string, code?: string };
}

export const TopicModal = ({ isOpen, onClose, mode, parentId, initialData }: TopicModalProps) => {
    const [title, setTitle] = useState('');
    const [code, setCode] = useState('');
    const createManualTopic = useStore(s => s.createManualTopic);
    const updateTopicDetails = useStore(s => s.updateTopicDetails);

    useEffect(() => {
        if (isOpen) {
            if (mode === 'edit' && initialData) {
                setTitle(initialData.title);
                setCode(initialData.code || '');
            } else {
                setTitle('');
                setCode('');
            }
        }
    }, [isOpen, mode, initialData]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (mode === 'create') {
                await createManualTopic(parentId || null, title, code || undefined);
            } else if (mode === 'edit' && initialData) {
                await updateTopicDetails(initialData.id, title, code || undefined);
            }
            onClose();
        } catch (error) {
            console.error('Failed to save topic:', error);
            // You might want to show a toast error here
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <h2 className="font-semibold text-gray-900">
                        {mode === 'create' ? 'Create Topic' : 'Edit Topic'}
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Topic Title <span className="text-red-500">*</span>
                        </label>
                        <input 
                            type="text" 
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                            placeholder="e.g. Quantum Mechanics"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Code (Optional)
                        </label>
                        <input 
                            type="text" 
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow font-mono text-sm"
                            placeholder="e.g. PHYS-101"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            A short code or ID to organize your topics (e.g. 1.0, A-1)
                        </p>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button 
                            type="button" 
                            onClick={onClose}
                            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                        >
                            {mode === 'create' ? 'Create' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
