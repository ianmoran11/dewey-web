import { useMemo, useState, useEffect } from 'react';
import { useStore } from '../lib/store';
import { buildTree, getAllDescendantIds } from '../utils/tree';
import { ChevronRight, ChevronDown, Folder, FileText, Search, Settings, ChevronsLeft, Loader2, X, MoreHorizontal, Plus, Trash2, Edit2, ArrowRight, AlignLeft, Headphones, Wand2, ChevronUp, Library, ArrowDownAZ } from 'lucide-react';
import { TopicNode } from '../types';
import { TopicModal } from './TopicModal';
import { MoveTopicModal } from './MoveTopicModal';
import { BulkCodeEditorModal } from './BulkCodeEditorModal';
import { interpolatePrompt } from '../utils/prompts';
import toast from 'react-hot-toast';

const QueueStatus = () => {
    const jobs = useStore(s => s.jobs);
    const cancelQueue = useStore(s => s.cancelQueue);
    
    // Only count pending or processing
    const activeJobs = jobs.filter(j => j.status === 'processing');
    const pendingJobs = jobs.filter(j => j.status === 'pending');
    
    if (activeJobs.length === 0 && pendingJobs.length === 0) return null;
    
    return (
        <div className="p-3 border-t border-gray-200 bg-blue-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
             <div className="flex items-center justify-between mb-1">
                 <span className="text-xs font-bold text-blue-900 uppercase tracking-widest flex items-center gap-2">
                    <Loader2 size={12} className="animate-spin text-blue-600" />
                    Background Tasks
                 </span>
                 {pendingJobs.length > 0 && (
                     <button 
                        onClick={cancelQueue}
                        className="text-xs text-red-600 hover:text-red-800 hover:bg-red-100 px-2 py-0.5 rounded transition-colors flex items-center gap-1"
                        title="Cancel pending jobs"
                     >
                         <X size={12} />
                         Cancel
                     </button>
                 )}
             </div>
             <div className="flex gap-4 text-xs font-medium text-blue-700 mt-2">
                 <span>Running: {activeJobs.length}</span>
                 <span className="text-blue-400">|</span>
                 <span>Pending: {pendingJobs.length}</span>
             </div>
        </div>
    )
}

const TreeNode = ({ node, level, onSelect, onAction }: { node: TopicNode, level: number, onSelect: (id: string) => void, onAction: (action: string, node: TopicNode) => void }) => {
    const expandedTopicIds = useStore(s => s.expandedTopicIds);
    const toggleTopicExpansion = useStore(s => s.toggleTopicExpansion);
    const selectedTopicId = useStore(s => s.selectedTopicId);
    const checkedTopicIds = useStore(s => s.checkedTopicIds);
    const setCheckedTopicIds = useStore(s => s.setCheckedTopicIds);
    
    const expanded = expandedTopicIds.has(node.id);
    const jobs = useStore(s => s.jobs);
    const unreadTopics = useStore(s => s.unreadTopics);
    
    const hasChildren = node.children.length > 0;
    const isSelected = selectedTopicId === node.id;
    const isChecked = checkedTopicIds.has(node.id);

    const handleCheck = (e: React.MouseEvent) => {
        e.stopPropagation();
        const newChecked = new Set(checkedTopicIds);
        
        // If has children, toggle all descendants
        // Even if no children, logic holds (descendants=[node.id])
        // But wait, getAllDescendantIds includes the node itself.
        const descendants = getAllDescendantIds(node);
        
        if (isChecked) {
            descendants.forEach(id => newChecked.delete(id));
        } else {
            descendants.forEach(id => newChecked.add(id));
        }
        
        setCheckedTopicIds(newChecked);
    };

    // Check if this topic is involved in any active/pending jobs
    const isQueued = jobs.some(j => 
        (j.status === 'processing' || j.status === 'pending') && (
            (j.type === 'subtopics' && j.payload.parentId === node.id) ||
            (j.type === 'content' && j.payload.topicId === node.id) ||
            (j.type === 'audio' && j.payload.targetId === node.id)
        )
    );

    const isUnread = unreadTopics.has(node.id);
    
    // Determine background classes based on state
    let bgClasses = 'hover:bg-gray-200 text-gray-700';
    if (isSelected) {
        bgClasses = 'bg-blue-100 text-blue-800 font-medium';
    } else if (isUnread) {
        bgClasses = 'bg-green-50 text-green-800 border-l-4 border-green-500 pl-[calc(0.5rem-4px)]';
    } else if (isQueued) {
        bgClasses = 'bg-yellow-50 text-yellow-800 border-l-4 border-yellow-400 pl-[calc(0.5rem-4px)] animate-pulse';
    }

    return (
        <div className="relative group">
            <div 
                className={`flex items-center py-1 px-2 cursor-pointer transition-colors select-none group/item ${bgClasses}`}
                style={{ paddingLeft: isUnread || isQueued ? `${level * 16 + 8 - 4}px` : `${level * 16 + 8}px` }}
                onClick={() => onSelect(node.id)}
            >
                <div 
                    className="mr-2 flex items-center justify-center p-0.5"
                    onClick={handleCheck}
                >
                    <input 
                        type="checkbox" 
                        checked={isChecked} 
                        readOnly 
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-3.5 h-3.5"
                    />
                </div>
                <div 
                    className="mr-1 p-1 hover:bg-black/5 rounded cursor-pointer"
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleTopicExpansion(node.id);
                    }}
                >
                    {hasChildren ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span className="w-3.5 h-3.5 inline-block"/>}
                </div>
                {hasChildren ? <Folder size={16} className="mr-2 text-yellow-500 fill-current" /> : <FileText size={16} className="mr-2 text-gray-400" />}
                <span className="truncate text-sm flex-1">{node.code ? `${node.code} ` : ''}{node.title}</span>
                
                {/* Icons for status */}
                {!!node.has_content && <AlignLeft size={12} className="text-gray-600 ml-2" />}
                {!!(node.has_audio || node.has_block_audio) && <Headphones size={12} className="text-gray-600 ml-2" />}
                {isQueued && <Loader2 size={12} className="animate-spin text-yellow-600 ml-2" />}
                {isUnread && <div className="w-2 h-2 rounded-full bg-green-500 ml-2" />}

                {/* Actions Menu Trigger */}
                <div className="ml-2 opacity-0 group-hover/item:opacity-100 transition-opacity">
                    <div className="relative">
                        <button 
                            className="p-1 hover:bg-gray-300 rounded text-gray-500"
                            onClick={(e) => {
                                e.stopPropagation();
                                // We are using hover state to show menu content but click to trigger simple actions or just use menu component
                                // For simplicity: separate buttons
                            }}
                        >
                            <MoreHorizontal size={14} />
                        </button>
                        
                        {/* Dropdown Menu */}
                        <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-xl border border-gray-100 py-1 z-50 hidden group-hover/item:block">
                            <button 
                                onClick={(e) => { e.stopPropagation(); onAction('add', node); }}
                                className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
                            >
                                <Plus size={12} /> Add Child
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onAction('edit', node); }}
                                className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                                <Edit2 size={12} /> Rename
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onAction('move', node); }}
                                className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                                <ArrowRight size={12} /> Move
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onAction('manage_codes', node); }}
                                className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                                <ArrowDownAZ size={12} /> Manage Codes
                            </button>
                            <div className="my-1 border-t border-gray-100"></div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onAction('delete', node); }}
                                className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                                <Trash2 size={12} /> Delete
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            {expanded && hasChildren && node.children.map(child => (
                <TreeNode key={child.id} node={child} level={level + 1} onSelect={onSelect} onAction={onAction} />
            ))}
        </div>
    )
}

interface SidebarProps {
    onOpenSettings: () => void;
    onOpenAudioLibrary: () => void;
    width: number;
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    onResizeStart: () => void;
}

export const Sidebar = ({ onOpenSettings, onOpenAudioLibrary, width, isOpen, setIsOpen, onResizeStart }: SidebarProps) => {
    const topics = useStore(s => s.topics);
    const templates = useStore(s => s.templates);
    const settings = useStore(s => s.settings);
    const addJob = useStore(s => s.addJob);
    const selectedTopic = useStore(s => s.selectedTopic);

    const selectTopic = useStore(s => s.selectTopic);
    const deleteTopic = useStore(s => s.deleteTopic);

    const [search, setSearch] = useState('');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // Generation menus (in footer)
    const [showSubtopicMenu, setShowSubtopicMenu] = useState(false);
    const [showContentMenu, setShowContentMenu] = useState(false);
    
    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [targetNode, setTargetNode] = useState<TopicNode | null>(null);
    const [moveTargets, setMoveTargets] = useState<TopicNode[]>([]);
    const [moveModalOpen, setMoveModalOpen] = useState(false);
    const [bulkCodeModalOpen, setBulkCodeModalOpen] = useState(false);
    const [bulkCodeParentId, setBulkCodeParentId] = useState<string | null>(null);
    const checkedTopicIds = useStore(s => s.checkedTopicIds);
    const clearCheckedTopicIds = useStore(s => s.clearCheckedTopicIds);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleSelectTopic = (id: string) => {
        selectTopic(id);
        if (isMobile) setIsOpen(false);
    };

    const getTargetTopics = () => {
        if (checkedTopicIds.size > 0) {
            return topics.filter(t => checkedTopicIds.has(t.id));
        }
        return selectedTopic ? [selectedTopic] : [];
    };

    const handleGenerateSubtopics = async (templateId?: string) => {
        if (!settings.openRouterKey) return toast.error('Please configure API Key (OpenRouter) first');

        setShowSubtopicMenu(false);
        const targets = getTargetTopics();
        if (targets.length === 0) return toast.error('Select a topic first');

        let queuedCount = 0;
        for (const target of targets) {
            try {
                let customPrompt: string | undefined = undefined;

                if (templateId) {
                    const subtopicTemplate = templates.find(t => t.id === templateId);
                    if (subtopicTemplate) {
                        const t = await interpolatePrompt(subtopicTemplate.prompt, target);
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
    };

    const handleGenerateContent = async (templateId: string) => {
        if (!settings.openRouterKey) return toast.error('Please configure API Key (OpenRouter) first');

        const template = templates.find(t => t.id === templateId);
        if (!template) return;

        setShowContentMenu(false);
        const targets = getTargetTopics();
        if (targets.length === 0) return toast.error('Select a topic first');

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
    };

    const handleAction = async (action: string, node: TopicNode) => {
        const isChecked = checkedTopicIds.has(node.id);
        const targets = isChecked 
            ? topics.filter(t => checkedTopicIds.has(t.id)) 
            : [node];
        
        // Safety: Recursive check to ensure we found the nodes in the flat list
        // Note: 'topics' from store is flat list. 'node' is from tree.
        // We need robust list of target nodes for move (because move needs children checks).
        // For delete, IDs are enough.
        
        if (action === 'delete') {
            const count = targets.length;
            const message = count > 1 
                ? `Delete ${count} topics and all their contents?` 
                : `Delete "${node.title}" and all its contents?`;
                
            if (confirm(message)) {
                for (const t of targets) {
                    await deleteTopic(t.id);
                }
            }
        } else if (action === 'add') {
            setModalMode('create');
            setTargetNode(node);
            setModalOpen(true);
        } else if (action === 'edit') {
            setModalMode('edit');
            setTargetNode(node);
            setModalOpen(true);
        } else if (action === 'move') {
            // For move, we need the actual node objects with hierarchy for calculations?
            // Actually, MoveTopicModal just takes TopicNode root list to build tree, 
            // and topicsToMove list to calculate disabled IDs.
            // We can pass the flat topics we found.
            // However, MoveTopicModal expects TopicNode[] (recursive structure) or Topic[]?
            // Let's check MoveTopicModal props definition. It imports TopicNode.
            // But we are passing flat topics from 'topics.filter'.
            // They need to be converted to TopicNode if the modal expects full trees, 
            // OR the modal should accept Topic[] and build what it needs.
            // MoveTopicModal prop is `topicsToMove: TopicNode[]`.
            // But checking disable logic: `getAllDescendantIds(t)`. This requires the node to have `children` populated.
            // Basic `Topic` from store doesn't have `children`.
            // We need to find the Corresponding TreeNodes in the `tree`.
            
            // Helper to match IDs to tree nodes
            const findNodes = (nodes: TopicNode[], ids: Set<string>): TopicNode[] => {
                let found: TopicNode[] = [];
                for (const n of nodes) {
                    if (ids.has(n.id)) found.push(n);
                    if (n.children) found = found.concat(findNodes(n.children, ids));
                }
                return found;
            };
            
            const fullTree = buildTree(topics);
            const targetNodes = findNodes(fullTree, new Set(targets.map(t => t.id)));
            
            setMoveTargets(targetNodes);
            setMoveModalOpen(true);
        } else if (action === 'manage_codes') {
            setBulkCodeParentId(node.id);
            setBulkCodeModalOpen(true);
        }
    };

    const handleCreateRoot = () => {
        setModalMode('create');
        setTargetNode(null);
        setModalOpen(true);
    }
    
    const filteredTopics = useMemo(() => {
        if (!search) return topics;
        // Simple filter: include if matches, but this breaks hierarchy display if parent is filtered out.
        // For a robust tree search, we usually need to scan filtered items and include their parents recursively.
        // For this MVP, we will rely on orphan logic (topics whose parents are missing become roots).
        return topics.filter(t => 
            t.title.toLowerCase().includes(search.toLowerCase()) || 
            (t.code && t.code.toLowerCase().includes(search.toLowerCase()))
        );
    }, [topics, search]);

    const tree = useMemo(() => buildTree(filteredTopics), [filteredTopics]);

    const contentTemplates = templates.filter(t => t.type === 'content');
    const subtopicTemplates = templates.filter(t => t.type === 'subtopics');
    const canGenerate = checkedTopicIds.size > 0 || !!selectedTopic;

    if (!isOpen) return null;
    
    return (
        <div 
            className={`h-full bg-gray-50 border-r border-gray-200 flex flex-col flex-shrink-0 transition-all z-40 ${isMobile ? 'fixed inset-0 w-full' : 'relative'}`}
            style={isMobile ? undefined : { width }}
        >
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white shadow-sm z-10">
                <div className="flex items-center">
                    <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center mr-3">
                        <span className="text-white font-bold text-xl">D</span>
                    </span>
                    <h2 className="font-bold text-lg text-gray-800 tracking-tight">Dewey</h2>
                </div>
            </div>
            
            <div className="p-3 border-b border-gray-200 bg-gray-50/50 flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input 
                        type="text" 
                        placeholder="Search..." 
                        className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                {checkedTopicIds.size > 0 && (
                    <button
                        onClick={clearCheckedTopicIds}
                        className="px-2.5 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-md hover:bg-gray-50 text-gray-600 shadow-sm"
                        title="Clear all checked topics"
                    >
                        Clear ({checkedTopicIds.size})
                    </button>
                )}

                <button 
                    onClick={() => {
                        setBulkCodeParentId(null);
                        setBulkCodeModalOpen(true);
                    }}
                    className="p-1.5 bg-white border border-gray-300 rounded-md hover:bg-gray-50 text-gray-600 shadow-sm ml-1"
                    title="Manage Root Codes"
                >
                    <ArrowDownAZ size={18} />
                </button>
                <button 
                    onClick={handleCreateRoot}
                    className="p-1.5 bg-white border border-gray-300 rounded-md hover:bg-gray-50 text-gray-600 shadow-sm"
                    title="Add Root Topic"
                >
                    <Plus size={18} />
                </button>
            </div>
            
            <div className="flex-1 overflow-auto py-2 custom-scrollbar pb-44">
                {tree.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">No topics found</div>
                ) : (
                    tree.map(node => (
                        <TreeNode key={node.id} node={node} level={0} onSelect={handleSelectTopic} onAction={handleAction} />
                    ))
                )}
            </div>

            <TopicModal 
                isOpen={modalOpen} 
                onClose={() => setModalOpen(false)} 
                mode={modalMode} 
                parentId={targetNode?.id || null} 
                initialData={modalMode === 'edit' && targetNode ? { id: targetNode.id, title: targetNode.title, code: targetNode.code } : undefined}
            />

            <MoveTopicModal
                isOpen={moveModalOpen}
                onClose={() => setMoveModalOpen(false)}
                topicsToMove={moveTargets}
            />

            <BulkCodeEditorModal 
                isOpen={bulkCodeModalOpen}
                onClose={() => setBulkCodeModalOpen(false)}
                parentId={bulkCodeParentId}
            />

            <QueueStatus />

            {/* Footer Actions */}
            <div className="p-3 border-t border-gray-200 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
                <div className="flex items-center gap-2">
                    {/* Expand Subtopics */}
                    <div className="relative flex-1">
                        <button
                            disabled={!canGenerate}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                                setShowContentMenu(false);
                                setShowSubtopicMenu(v => !v);
                            }}
                            className="w-full flex items-center justify-center gap-2 px-2 py-2 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-md transition-colors disabled:opacity-50"
                            title="Expand Subtopics"
                        >
                            <Wand2 size={14} />
                            <span className="truncate">Expand</span>
                            <ChevronUp size={12} className="text-gray-400" />
                        </button>

                        {showSubtopicMenu && (
                            <>
                                <div className="fixed inset-0 z-30" onClick={() => setShowSubtopicMenu(false)}></div>
                                <div className="absolute bottom-full left-0 mb-2 w-56 bg-white rounded-lg shadow-xl border border-gray-100 py-1 z-40 overflow-hidden">
                                    <button
                                        onClick={() => handleGenerateSubtopics()}
                                        className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
                                    >
                                        <Wand2 size={12} />
                                        Default
                                    </button>

                                    {subtopicTemplates.map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => handleGenerateSubtopics(t.id)}
                                            className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
                                        >
                                            <FileText size={12} />
                                            {t.name}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Generate Content */}
                    <div className="relative flex-1">
                        <button
                            disabled={!canGenerate}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                                setShowSubtopicMenu(false);
                                setShowContentMenu(v => !v);
                            }}
                            className="w-full flex items-center justify-center gap-2 px-2 py-2 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-md transition-colors disabled:opacity-50"
                            title="Generate Content"
                        >
                            <Plus size={14} />
                            <span className="truncate">Content</span>
                            <ChevronUp size={12} className="text-gray-400" />
                        </button>

                        {showContentMenu && (
                            <>
                                <div className="fixed inset-0 z-30" onClick={() => setShowContentMenu(false)}></div>
                                <div className="absolute bottom-full right-0 mb-2 w-56 bg-white rounded-lg shadow-xl border border-gray-100 py-1 z-40 overflow-hidden">
                                    {contentTemplates.length === 0 ? (
                                        <div className="px-3 py-2 text-xs text-gray-500">No content templates</div>
                                    ) : (
                                        contentTemplates.map(t => (
                                            <button
                                                key={t.id}
                                                onClick={() => handleGenerateContent(t.id)}
                                                className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
                                            >
                                                <FileText size={12} />
                                                {t.name}
                                            </button>
                                        ))
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Audio + Settings + Minimize */}
                    <button
                        onClick={onOpenAudioLibrary}
                        className="p-2 bg-white border border-gray-200 rounded-md hover:bg-gray-50 text-gray-600"
                        title="Audio Library"
                    >
                        <Library size={16} />
                    </button>
                    <button
                        onClick={onOpenSettings}
                        className="p-2 bg-white border border-gray-200 rounded-md hover:bg-gray-50 text-gray-600"
                        title="Settings"
                    >
                        <Settings size={16} />
                    </button>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-2 bg-white border border-gray-200 rounded-md hover:bg-gray-50 text-gray-600"
                        title="Collapse Sidebar"
                    >
                        <ChevronsLeft size={16} />
                    </button>
                </div>
            </div>

            
            {/* Resize Handle */}
            <div 
                className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-blue-400 z-50 transition-colors opacity-0 hover:opacity-100 delay-75 md:block hidden"
                onMouseDown={(e) => {
                    e.preventDefault();
                    onResizeStart();
                }}
                onTouchStart={() => {
                    onResizeStart();
                }}
            />
        </div>
    )
}
