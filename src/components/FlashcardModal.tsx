import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useStore } from '../lib/store';
import { Flashcard } from '../types';
import toast from 'react-hot-toast';

interface FlashcardModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'create' | 'edit';
    initialData?: Partial<Flashcard>;
}

export const FlashcardModal = ({ isOpen, onClose, mode, initialData }: FlashcardModalProps) => {
    const { addFlashcard, editFlashcard, selectedTopicId } = useStore();
    const [front, setFront] = useState('');
    const [back, setBack] = useState('');

    useEffect(() => {
        if (isOpen) {
            setFront(initialData?.front || '');
            setBack(initialData?.back || '');
        }
    }, [isOpen, initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!front.trim() || !back.trim()) return toast.error("Both sides are required");

        if (mode === 'create') {
            if (!selectedTopicId) return toast.error("No topic selected");
            await addFlashcard(selectedTopicId, front, back);
            toast.success("Card added");
        } else {
            if (!initialData?.id) return;
            await editFlashcard(initialData.id, front, back);
            toast.success("Card updated");
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col p-6 m-4">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800">
                        {mode === 'create' ? 'New Flashcard' : 'Edit Flashcard'}
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Front</label>
                        <textarea 
                            className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-24"
                            placeholder="Question or term..."
                            value={front}
                            onChange={e => setFront(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Back</label>
                        <textarea 
                            className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-24"
                            placeholder="Answer or definition..."
                            value={back}
                            onChange={e => setBack(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex justify-end gap-3 pt-2">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-sm"
                        >
                            {mode === 'create' ? 'Add Card' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
