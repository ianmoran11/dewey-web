import React, { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { buildTree } from '../utils/tree';
import { ChevronRight, ChevronDown, Folder, FileText, Search, Settings } from 'lucide-react';
import { TopicNode } from '../types';

const TreeNode = ({ node, level, onSelect }: { node: TopicNode, level: number, onSelect: (id: string) => void }) => {
    const [expanded, setExpanded] = useState(false);
    const selectedTopicId = useStore(s => s.selectedTopicId);
    
    const hasChildren = node.children.length > 0;
    const isSelected = selectedTopicId === node.id;
    
    return (
        <div>
            <div 
                className={`flex items-center py-1 px-2 cursor-pointer hover:bg-gray-200 transition-colors select-none ${isSelected ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-700'}`}
                style={{ paddingLeft: `${level * 16 + 8}px` }}
                onClick={() => onSelect(node.id)}
            >
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
                <span className="truncate text-sm">{node.code ? `${node.code} ` : ''}{node.title}</span>
            </div>
            {expanded && hasChildren && node.children.map(child => (
                <TreeNode key={child.id} node={child} level={level + 1} onSelect={onSelect} />
            ))}
        </div>
    )
}

export const Sidebar = ({ onOpenSettings }: { onOpenSettings: () => void }) => {
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
    
    return (
        <div className="w-80 h-full bg-gray-50 border-r border-gray-200 flex flex-col flex-shrink-0">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white shadow-sm z-10">
                <div className="flex items-center">
                    <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center mr-3">
                        <span className="text-white font-bold text-xl">D</span>
                    </span>
                    <h2 className="font-bold text-lg text-gray-800 tracking-tight">Dewey</h2>
                </div>
                <button onClick={onOpenSettings} className="p-2 hover:bg-gray-100 rounded-full text-gray-500" title="Settings">
                    <Settings size={18} />
                </button>
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
        </div>
    )
}
