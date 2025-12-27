import { useState, useEffect } from 'react';
import { X, Trash2, Save, ArrowDownAZ } from 'lucide-react';
import { useStore } from '../lib/store';
import { generateCodes } from '../utils/code';
import { Topic } from '../types';

interface BulkCodeEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    parentId: string | null; // The parent whose children we are editing
}

export const BulkCodeEditorModal = ({ isOpen, onClose, parentId }: BulkCodeEditorModalProps) => {
    const allTopics = useStore(s => s.topics);
    const updateTopicsBulk = useStore(s => s.updateTopicsBulk);
    
    const [items, setItems] = useState<Topic[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Initialize items when opening
    useEffect(() => {
        if (isOpen) {
            // Find children
            const children = allTopics.filter(t => t.parent_id === parentId);
            // Sort by code, then title
            const sorted = [...children].sort((a, b) => {
                if (a.code && b.code) return a.code.localeCompare(b.code);
                if (a.code) return -1;
                if (b.code) return 1;
                return a.created_at - b.created_at;
            });
            setItems(sorted);
        }
    }, [isOpen, parentId, allTopics]); // allTopics dependency ensures we have latest data, but might cause resets if store updates.
    // If we want to persist edits while store updates, we should only set on open.
    // But store updates only happen on save.

    const handleCodeChange = (id: string, newCode: string) => {
        setItems(prev => prev.map(item => item.id === id ? { ...item, code: newCode } : item));
    };

    const handleAutoGenerate = () => {
        // Generate codes from scratch based on Parent Code
        // If parentId is null, parentCode is undefined.
        // If parentId is set, get parent code.
        const parentCode = parentId ? allTopics.find(t => t.id === parentId)?.code : undefined;
        
        // Use util to generate sequence. We pass empty existingCodes so it starts from A.
        const newCodes = generateCodes(parentCode, [], items.length);
        
        setItems(prev => prev.map((item, index) => ({
            ...item,
            code: newCodes[index]
        })));
    };

    const handleClearAll = () => {
        if (confirm("Clear all codes for these topics?")) {
            setItems(prev => prev.map(item => ({ ...item, code: '' })));
        }
    };

    const handleSave = async () => {
        setIsLoading(true);
        try {
            await updateTopicsBulk(items.map(t => ({
                id: t.id,
                title: t.title,
                code: t.code || undefined // Assuming store handles empty string as undefined or handles it
            })));
            onClose();
        } catch (e) {
            console.error("Failed to update codes", e);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    const parentTitle = parentId ? allTopics.find(t => t.id === parentId)?.title : "Root Topics";

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 flex-shrink-0">
                    <div>
                        <h2 className="font-semibold text-gray-900">Manage Subtopic Codes</h2>
                        <p className="text-sm text-gray-500">Editing children of: <span className="font-medium">{parentTitle}</span></p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="p-2 border-b border-gray-100 flex gap-2 bg-white flex-shrink-0 sticky top-0 z-10">
                    <button 
                        onClick={handleAutoGenerate}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                        title="Generate sequential codes (A, B, C...)"
                    >
                        <ArrowDownAZ size={16} />
                        Auto-Code
                    </button>
                    <button 
                        onClick={handleClearAll}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                        <Trash2 size={16} />
                        Clear All
                    </button>
                    <div className="flex-1" />
                    <button 
                        onClick={handleSave}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {isLoading ? 'Saving...' : 'Save Changes'}
                        <Save size={16} />
                    </button>
                </div>
                
                {/* List */}
                <div className="overflow-y-auto p-4 space-y-2 flex-1 custom-scrollbar">
                    {items.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">No subtopics found.</div>
                    ) : (
                        items.map((item, index) => (
                            <div key={item.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-200 transition-colors">
                                <span className="text-xs text-gray-400 w-6 text-right tabular-nums">
                                    {index + 1}
                                </span>
                                <div className="w-32 flex-shrink-0">
                                    <input 
                                        type="text" 
                                        value={item.code || ''} 
                                        onChange={(e) => handleCodeChange(item.id, e.target.value)}
                                        placeholder="Code..."
                                        className="w-full px-2 py-1 text-sm font-mono border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="flex-1 truncate font-medium text-gray-700">
                                    {item.title}
                                </div>
                            </div>
                        ))
                    )}
                </div>
                
                {/* Footer Hint */}
                <div className="p-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 flex-shrink-0">
                    Changes are applied to all listed topics immediately upon saving.
                </div>
            </div>
        </div>
    );
};
