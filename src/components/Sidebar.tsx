import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { buildTree, getAllDescendantIds } from '../utils/tree';
import { ChevronRight, ChevronDown, Folder, FileText, Search, Settings, ChevronsLeft, Loader2, X } from 'lucide-react';
import { TopicNode } from '../types';

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

const TreeNode = ({ node, level, onSelect }: { node: TopicNode, level: number, onSelect: (id: string) => void }) => {
    const [expanded, setExpanded] = useState(false);
    const selectedTopicId = useStore(s => s.selectedTopicId);
    const checkedTopicIds = useStore(s => s.checkedTopicIds);
    const setCheckedTopicIds = useStore(s => s.setCheckedTopicIds);
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
        <div>
            <div 
                className={`flex items-center py-1 px-2 cursor-pointer transition-colors select-none ${bgClasses}`}
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
                        setExpanded(!expanded);
                    }}
                >
                    {hasChildren ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span className="w-3.5 h-3.5 inline-block"/>}
                </div>
                {hasChildren ? <Folder size={16} className="mr-2 text-yellow-500 fill-current" /> : <FileText size={16} className="mr-2 text-gray-400" />}
                <span className="truncate text-sm flex-1">{node.code ? `${node.code} ` : ''}{node.title}</span>
                
                {/* Icons for status */}
                {isQueued && <Loader2 size={12} className="animate-spin text-yellow-600 ml-2" />}
                {isUnread && <div className="w-2 h-2 rounded-full bg-green-500 ml-2" />}
            </div>
            {expanded && hasChildren && node.children.map(child => (
                <TreeNode key={child.id} node={child} level={level + 1} onSelect={onSelect} />
            ))}
        </div>
    )
}

interface SidebarProps {
    onOpenSettings: () => void;
    width: number;
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    onResizeStart: () => void;
}

export const Sidebar = ({ onOpenSettings, width, isOpen, setIsOpen, onResizeStart }: SidebarProps) => {
    const topics = useStore(s => s.topics);
    const selectTopic = useStore(s => s.selectTopic);
    const [search, setSearch] = useState('');
    
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

    if (!isOpen) return null;
    
    return (
        <div 
            className="h-full bg-gray-50 border-r border-gray-200 flex flex-col flex-shrink-0 relative"
            style={{ width }}
        >
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white shadow-sm z-10">
                <div className="flex items-center">
                    <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center mr-3">
                        <span className="text-white font-bold text-xl">D</span>
                    </span>
                    <h2 className="font-bold text-lg text-gray-800 tracking-tight">Dewey</h2>
                </div>
                <div className="flex gap-1">
                    <button onClick={onOpenSettings} className="p-2 hover:bg-gray-100 rounded-full text-gray-500" title="Settings">
                        <Settings size={18} />
                    </button>
                    <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500" title="Collapse Sidebar">
                        <ChevronsLeft size={18} />
                    </button>
                </div>
            </div>
            
            <div className="p-3 border-b border-gray-200 bg-gray-50/50">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input 
                        type="text" 
                        placeholder="Search topics..." 
                        className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>
            
            <div className="flex-1 overflow-auto py-2 custom-scrollbar">
                {tree.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">No topics found</div>
                ) : (
                    tree.map(node => (
                        <TreeNode key={node.id} node={node} level={0} onSelect={selectTopic} />
                    ))
                )}
            </div>

            <QueueStatus />
            
            {/* Resize Handle */}
            <div 
                className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-blue-400 z-50 transition-colors opacity-0 hover:opacity-100 delay-75"
                onMouseDown={(e) => {
                    e.preventDefault();
                    onResizeStart();
                }}
            />
        </div>
    )
}
