import { useState } from 'react';
import { useStore } from '../lib/store';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { FlashcardModal } from './FlashcardModal';
import { Flashcard } from '../types';

export const FlashcardList = () => {
    const { flashcards, removeFlashcard, selectedTopicId } = useStore();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCard, setEditingCard] = useState<Flashcard | null>(null);

    const handleEdit = (card: Flashcard) => {
        setEditingCard(card);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingCard(null);
        setIsModalOpen(true);
    };

    if (!selectedTopicId) return null;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                    Flashcards ({flashcards.length})
                </h3>
                <button 
                    onClick={handleCreate}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                    <Plus size={14} /> Add Card
                </button>
            </div>

            {flashcards.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <p className="text-gray-500 text-sm">No flashcards yet.</p>
                    <p className="text-gray-400 text-xs mt-1">Create one manually or use AI generation.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {flashcards.map(card => (
                        <div key={card.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow group flex flex-col">
                            <div className="flex-1 space-y-4">
                                <div>
                                    <div className="text-xs font-semibold text-gray-400 uppercase mb-1">Front</div>
                                    <div className="text-sm text-gray-800 prose prose-sm max-w-none">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeKatex]}>{card.front}</ReactMarkdown>
                                    </div>
                                </div>
                                <div className="border-t border-gray-100 pt-3">
                                    <div className="text-xs font-semibold text-gray-400 uppercase mb-1">Back</div>
                                    <div className="text-sm text-gray-600 prose prose-sm max-w-none">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeKatex]}>{card.back}</ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-gray-50 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-[10px] text-gray-300 flex-1 flex items-center">
                                    Next review: {card.next_review ? new Date(card.next_review).toLocaleDateString() : 'New'}
                                </span>
                                <button 
                                    onClick={() => handleEdit(card)}
                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                >
                                    <Edit2 size={14} />
                                </button>
                                <button 
                                    onClick={() => {
                                        if(confirm('Delete this card?')) removeFlashcard(card.id);
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <FlashcardModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)}
                mode={editingCard ? 'edit' : 'create'}
                initialData={editingCard || undefined}
            />
        </div>
    );
};
