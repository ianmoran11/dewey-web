import React, { useState, useEffect } from 'react';
import { useStore } from '../lib/store';
import { X, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import { Grade, calculateReview } from '../utils/sm2';
import { updateFlashcard, getDueFlashcards } from '../db/queries';
import { Flashcard } from '../types';
import toast from 'react-hot-toast';

interface ReviewSessionProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ReviewSession = ({ isOpen, onClose }: ReviewSessionProps) => {
    const { selectedTopicId, refreshFlashcards } = useStore();
    const [dueCards, setDueCards] = useState<Flashcard[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [sessionComplete, setSessionComplete] = useState(false);

    useEffect(() => {
        if (isOpen && selectedTopicId) {
            setIsLoading(true);
            setSessionComplete(false);
            getDueFlashcards(selectedTopicId)
                .then(cards => {
                    setDueCards(cards);
                    setCurrentIndex(0);
                    setIsFlipped(false);
                })
                .finally(() => setIsLoading(false));
        }
    }, [isOpen, selectedTopicId]);

    const handleGrade = async (grade: Grade) => {
        const card = dueCards[currentIndex];
        
        // Calculate new schedule
        const currentInterval = card.interval;
        const currentRepetitions = card.repetitions;
        const currentEaseFactor = card.ease_factor;
        
        const result = calculateReview(
            grade,
            currentInterval,
            currentRepetitions,
            currentEaseFactor
        );

        // Optimistic update
        await updateFlashcard({
            id: card.id,
            next_review: result.nextReviewDate,
            interval: result.interval,
            ease_factor: result.easeFactor,
            repetitions: result.repetitions
        });

        // Move to next card
        if (currentIndex < dueCards.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setIsFlipped(false);
        } else {
            setSessionComplete(true);
            await refreshFlashcards();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 animate-in fade-in duration-200">
            <div className="w-full max-w-3xl h-full md:h-[80vh] flex flex-col p-4 md:p-8">
                <div className="flex justify-end mb-4">
                    <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex-1 flex items-center justify-center text-white/50">Loading cards...</div>
                ) : sessionComplete ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-white bg-gray-900 rounded-3xl border border-white/10 p-8 shadow-2xl">
                        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-500/30">
                            <Check size={40} />
                        </div>
                        <h2 className="text-3xl font-bold mb-2">Session Complete!</h2>
                        <p className="text-white/60 mb-8">You've reviewed all due cards for now.</p>
                        <button 
                            onClick={onClose}
                            className="bg-white text-gray-900 px-8 py-3 rounded-xl font-bold hover:bg-gray-100 transition-colors"
                        >
                            Finish
                        </button>
                    </div>
                ) : dueCards.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-white">
                        <h2 className="text-2xl font-bold mb-2">All Caught Up!</h2>
                        <p className="text-white/60">No cards are due for review right now.</p>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full">
                        {/* Progress */}
                        <div className="flex justify-between items-center text-white/40 text-sm mb-4 px-1">
                            <span>Card {currentIndex + 1} of {dueCards.length}</span>
                            <span>{Math.round(((currentIndex) / dueCards.length) * 100)}% Complete</span>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="h-1 bg-white/10 rounded-full mb-8 overflow-hidden">
                            <div 
                                className="h-full bg-blue-500 transition-all duration-300 ease-out"
                                style={{ width: `${((currentIndex) / dueCards.length) * 100}%` }}
                            />
                        </div>

                        {/* Card */}
                        <div className="flex-1 perspective-1000 relative">
                            <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 h-full flex flex-col overflow-hidden relative">
                                <div className="flex-1 p-8 md:p-12 overflow-y-auto flex flex-col justify-center items-center text-center">
                                    <div className="prose prose-lg md:prose-xl max-w-none prose-p:leading-relaxed">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeKatex]}>
                                            {dueCards[currentIndex].front}
                                        </ReactMarkdown>
                                    </div>
                                    
                                    {isFlipped && (
                                        <div className="mt-12 pt-12 border-t border-gray-100 w-full animate-in slide-in-from-bottom-4 fade-in duration-300">
                                            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Answer</div>
                                            <div className="prose prose-lg md:prose-xl max-w-none prose-p:leading-relaxed text-gray-800">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeKatex]}>
                                                    {dueCards[currentIndex].back}
                                                </ReactMarkdown>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="h-24 mt-8 flex items-center justify-center">
                            {!isFlipped ? (
                                <button 
                                    onClick={() => setIsFlipped(true)}
                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold h-14 rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98]"
                                >
                                    Show Answer
                                </button>
                            ) : (
                                <div className="grid grid-cols-4 gap-3 w-full">
                                    <button onClick={() => handleGrade(1)} className="flex flex-col items-center justify-center bg-red-100 hover:bg-red-200 text-red-700 h-16 rounded-xl border border-red-200 transition-colors">
                                        <span className="font-bold text-sm">Again</span>
                                        <span className="text-[10px] opacity-70">1m</span>
                                    </button>
                                    <button onClick={() => handleGrade(2)} className="flex flex-col items-center justify-center bg-orange-100 hover:bg-orange-200 text-orange-700 h-16 rounded-xl border border-orange-200 transition-colors">
                                        <span className="font-bold text-sm">Hard</span>
                                        <span className="text-[10px] opacity-70">2d</span>
                                    </button>
                                    <button onClick={() => handleGrade(4)} className="flex flex-col items-center justify-center bg-green-100 hover:bg-green-200 text-green-700 h-16 rounded-xl border border-green-200 transition-colors">
                                        <span className="font-bold text-sm">Good</span>
                                        <span className="text-[10px] opacity-70">4d</span>
                                    </button>
                                    <button onClick={() => handleGrade(5)} className="flex flex-col items-center justify-center bg-blue-100 hover:bg-blue-200 text-blue-700 h-16 rounded-xl border border-blue-200 transition-colors">
                                        <span className="font-bold text-sm">Easy</span>
                                        <span className="text-[10px] opacity-70">7d</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
