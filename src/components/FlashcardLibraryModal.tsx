import { useEffect, useMemo, useState } from 'react';
import { X, Trash2, ExternalLink, Layers, Search, Calendar, Play, Check, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import { FlashcardWithTopic } from '../types';
import { getAllFlashcards, deleteFlashcard, updateFlashcard } from '../db/queries';
import { useStore } from '../lib/store';
import { Grade, calculateReview } from '../utils/sm2';

const formatDate = (ts: number | null | undefined) => {
  if (!ts) return 'New';
  try {
    return new Date(ts).toLocaleDateString();
  } catch {
    return String(ts);
  }
};

const getReviewStatus = (nextReview: number | null | undefined): 'new' | 'due' | 'upcoming' => {
  if (!nextReview) return 'new';
  const now = Date.now();
  if (nextReview <= now) return 'due';
  return 'upcoming';
};

type SortOption = 'topic' | 'status' | 'created_newest' | 'created_oldest';

export const FlashcardLibraryModal = ({ onClose }: { onClose: () => void }) => {
  const selectTopic = useStore(s => s.selectTopic);
  const refreshFlashcards = useStore(s => s.refreshFlashcards);

  const [cards, setCards] = useState<FlashcardWithTopic[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'new' | 'due' | 'upcoming'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('topic');
  
  // Review mode state
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewCards, setReviewCards] = useState<FlashcardWithTopic[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const rows = await getAllFlashcards();
      setCards(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  // Filter cards
  const filteredCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cards.filter(c => {
      const status = getReviewStatus(c.next_review);
      if (filter !== 'all' && status !== filter) return false;
      if (!q) return true;
      return (
        (c.front || '').toLowerCase().includes(q) ||
        (c.back || '').toLowerCase().includes(q) ||
        (c.topic_title || '').toLowerCase().includes(q) ||
        (c.topic_code || '').toLowerCase().includes(q)
      );
    });
  }, [cards, search, filter]);

  // Sort cards  
  const sortedCards = useMemo(() => {
    const sorted = [...filteredCards];
    
    switch (sortBy) {
      case 'topic':
        sorted.sort((a, b) => {
          const codeA = a.topic_code || '';
          const codeB = b.topic_code || '';
          if (codeA !== codeB) return codeA.localeCompare(codeB);
          const titleA = a.topic_title || '';
          const titleB = b.topic_title || '';
          return titleA.localeCompare(titleB);
        });
        break;
      case 'status':
        sorted.sort((a, b) => {
          const statusOrder = { 'due': 0, 'new': 1, 'upcoming': 2 };
          const statusA = getReviewStatus(a.next_review);
          const statusB = getReviewStatus(b.next_review);
          return statusOrder[statusA] - statusOrder[statusB];
        });
        break;
      case 'created_newest':
        sorted.sort((a, b) => b.created_at - a.created_at);
        break;
      case 'created_oldest':
        sorted.sort((a, b) => a.created_at - b.created_at);
        break;
    }
    
    return sorted;
  }, [filteredCards, sortBy]);

  // Stats
  const stats = useMemo(() => {
    const now = Date.now();
    const newCards = cards.filter(c => !c.next_review);
    const dueCards = cards.filter(c => c.next_review && c.next_review <= now);
    const upcomingCards = cards.filter(c => c.next_review && c.next_review > now);
    return { 
      total: cards.length, 
      new: newCards.length, 
      due: dueCards.length, 
      upcoming: upcomingCards.length 
    };
  }, [cards]);

  // Reviewable cards (due + new)
  const reviewableCount = stats.due + stats.new;

  const remove = async (id: string) => {
    if (!confirm('Delete this flashcard?')) return;
    try {
      await deleteFlashcard(id);
      setCards(prev => prev.filter(c => c.id !== id));
      await refreshFlashcards();
      toast.success('Deleted');
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete');
    }
  };

  const goTo = async (c: FlashcardWithTopic) => {
    await selectTopic(c.topic_id);
    onClose();
  };

  // Start review with due and new cards
  const startReview = () => {
    const now = Date.now();
    const toReview = cards.filter(c => !c.next_review || c.next_review <= now);
    if (toReview.length === 0) {
      toast.error('No cards to review');
      return;
    }
    // Shuffle for variety
    const shuffled = [...toReview].sort(() => Math.random() - 0.5);
    setReviewCards(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionComplete(false);
    setReviewMode(true);
  };

  const handleGrade = async (grade: Grade) => {
    const card = reviewCards[currentIndex];
    
    const result = calculateReview(
      grade,
      card.interval,
      card.repetitions,
      card.ease_factor
    );

    await updateFlashcard({
      id: card.id,
      next_review: result.nextReviewDate,
      interval: result.interval,
      ease_factor: result.easeFactor,
      repetitions: result.repetitions
    });

    // Update local state
    setCards(prev => prev.map(c => 
      c.id === card.id 
        ? { ...c, next_review: result.nextReviewDate, interval: result.interval, ease_factor: result.easeFactor, repetitions: result.repetitions }
        : c
    ));

    if (currentIndex < reviewCards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
    } else {
      setSessionComplete(true);
      await refreshFlashcards();
    }
  };

  const exitReview = () => {
    setReviewMode(false);
    setReviewCards([]);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionComplete(false);
  };

  // Render review mode
  if (reviewMode) {
    const currentCard = reviewCards[currentIndex];
    
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 animate-in fade-in duration-200">
        <div className="w-full max-w-3xl h-full md:h-[80vh] flex flex-col p-4 md:p-8">
          <div className="flex justify-between items-center mb-4">
            <button onClick={exitReview} className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors">
              <ChevronLeft size={18} />
              Back to Library
            </button>
            <button onClick={exitReview} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors">
              <X size={24} />
            </button>
          </div>

          {sessionComplete ? (
            <div className="flex-1 flex flex-col items-center justify-center text-white bg-gray-900 rounded-3xl border border-white/10 p-8 shadow-2xl">
              <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-500/30">
                <Check size={40} />
              </div>
              <h2 className="text-3xl font-bold mb-2">Session Complete!</h2>
              <p className="text-white/60 mb-8">You've reviewed all {reviewCards.length} cards.</p>
              <button 
                onClick={exitReview}
                className="bg-white text-gray-900 px-8 py-3 rounded-xl font-bold hover:bg-gray-100 transition-colors"
              >
                Back to Library
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full">
              {/* Progress */}
              <div className="flex justify-between items-center text-white/40 text-sm mb-4 px-1">
                <span>Card {currentIndex + 1} of {reviewCards.length}</span>
                <span>{Math.round((currentIndex / reviewCards.length) * 100)}% Complete</span>
              </div>
              
              {/* Progress Bar */}
              <div className="h-1 bg-white/10 rounded-full mb-4 overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-300 ease-out"
                  style={{ width: `${(currentIndex / reviewCards.length) * 100}%` }}
                />
              </div>

              {/* Topic indicator */}
              <div className="text-center text-white/50 text-sm mb-4">
                {currentCard.topic_code ? `${currentCard.topic_code} ` : ''}{currentCard.topic_title}
              </div>

              {/* Card */}
              <div className="flex-1 perspective-1000 relative min-h-0">
                <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 h-full flex flex-col overflow-hidden relative">
                  <div className="flex-1 p-8 md:p-12 overflow-y-auto flex flex-col justify-center items-center text-center">
                    <div className="prose prose-lg md:prose-xl max-w-none prose-p:leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeKatex]}>
                        {currentCard.front}
                      </ReactMarkdown>
                    </div>
                    
                    {isFlipped && (
                      <div className="mt-12 pt-12 border-t border-gray-100 w-full animate-in slide-in-from-bottom-4 fade-in duration-300">
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Answer</div>
                        <div className="prose prose-lg md:prose-xl max-w-none prose-p:leading-relaxed text-gray-800">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeKatex]}>
                            {currentCard.back}
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
                    </button>
                    <button onClick={() => handleGrade(2)} className="flex flex-col items-center justify-center bg-orange-100 hover:bg-orange-200 text-orange-700 h-16 rounded-xl border border-orange-200 transition-colors">
                      <span className="font-bold text-sm">Hard</span>
                    </button>
                    <button onClick={() => handleGrade(4)} className="flex flex-col items-center justify-center bg-green-100 hover:bg-green-200 text-green-700 h-16 rounded-xl border border-green-200 transition-colors">
                      <span className="font-bold text-sm">Good</span>
                    </button>
                    <button onClick={() => handleGrade(5)} className="flex flex-col items-center justify-center bg-blue-100 hover:bg-blue-200 text-blue-700 h-16 rounded-xl border border-blue-200 transition-colors">
                      <span className="font-bold text-sm">Easy</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render library view
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-blue-600" />
            <h2 className="text-xl font-bold text-gray-800">Card Library</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Stats Bar with Review Button */}
        <div className="px-6 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-gray-700">Total:</span>
              <span className="text-gray-900">{stats.total}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
              <span className="text-gray-600">New:</span>
              <span className="text-gray-900">{stats.new}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400"></span>
              <span className="text-gray-600">Due:</span>
              <span className="text-gray-900">{stats.due}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400"></span>
              <span className="text-gray-600">Upcoming:</span>
              <span className="text-gray-900">{stats.upcoming}</span>
            </div>
          </div>
          
          {reviewableCount > 0 && (
            <button
              onClick={startReview}
              className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Play size={14} />
              Review ({reviewableCount})
            </button>
          )}
        </div>

        {/* Controls */}
        <div className="px-6 py-3 border-b border-gray-100 flex gap-3 flex-col md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              placeholder="Search front, back, or topic…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            value={filter}
            onChange={e => setFilter(e.target.value as any)}
          >
            <option value="all">All Cards</option>
            <option value="new">New ({stats.new})</option>
            <option value="due">Due ({stats.due})</option>
            <option value="upcoming">Upcoming ({stats.upcoming})</option>
          </select>
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortOption)}
          >
            <option value="topic">Sort: By Topic</option>
            <option value="status">Sort: By Status</option>
            <option value="created_newest">Sort: Newest First</option>
            <option value="created_oldest">Sort: Oldest First</option>
          </select>
          <button
            onClick={refresh}
            className="px-3 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : sortedCards.length === 0 ? (
            <div className="text-sm text-gray-500">No flashcards found.</div>
          ) : (
            <div className="space-y-3">
              {sortedCards.map(c => {
                const status = getReviewStatus(c.next_review);
                return (
                  <div key={c.id} className="border border-gray-200 rounded-xl p-4 bg-white hover:shadow-sm">
                    <div className="flex gap-3 items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            status === 'new' ? 'bg-yellow-100 text-yellow-700' :
                            status === 'due' ? 'bg-red-100 text-red-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {status}
                          </span>
                          <span className="text-[11px] text-gray-400 flex items-center gap-1">
                            <Calendar size={10} />
                            {status === 'new' ? 'Never reviewed' : `Review: ${formatDate(c.next_review)}`}
                          </span>
                          {c.repetitions > 0 && (
                            <span className="text-[11px] text-gray-400">
                              · {c.repetitions} reviews
                            </span>
                          )}
                        </div>

                        <div className="mt-2 grid grid-cols-2 gap-3">
                          <div className="bg-gray-50 rounded-lg p-2">
                            <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Front</div>
                            <div className="text-sm text-gray-800 line-clamp-2">{c.front}</div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2">
                            <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Back</div>
                            <div className="text-sm text-gray-800 line-clamp-2">{c.back}</div>
                          </div>
                        </div>

                        <div className="mt-2 text-sm text-gray-600 truncate">
                          <span className="font-medium">{c.topic_code ? `${c.topic_code} ` : ''}{c.topic_title}</span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            onClick={() => goTo(c)}
                            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1"
                            title="Go to topic"
                          >
                            <ExternalLink size={14} /> Go to Topic
                          </button>
                          <button
                            onClick={() => remove(c.id)}
                            className="px-3 py-1.5 text-sm bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 flex items-center gap-1"
                            title="Delete"
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
