import React, { useState, useMemo } from 'react';
import { X, ChevronRight, ChevronDown, Folder, FileText } from 'lucide-react';
import { useStore } from '../lib/store';
import { TopicNode, Topic } from '../types';
import { buildTree, getAllDescendantIds } from '../utils/tree';

interface MoveTopicModalProps {
    isOpen: boolean;
    onClose: () => void;
    topicsToMove: TopicNode[];
}

const TreeNode = ({ node, level, onSelect, selectedId, disabledIds }: { 
    node: TopicNode, 
    level: number, 
    onSelect: (id: string) => void, 
    selectedId: string | null,
    disabledIds: Set<string>
}) => {
    const [expanded, setExpanded] = useState(false);
    const hasChildren = node.children.length > 0;
    const isDisabled = disabledIds.has(node.id);
    const isSelected = selectedId === node.id;

    return (
        <div>
            <div 
                className={`flex items-center py-1.5 px-2 cursor-pointer transition-colors select-none ${
                    isSelected ? 'bg-blue-100 text-blue-800' : isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'
                }`}
                style={{ paddingLeft: `${level * 16 + 8}px` }}
                onClick={() => !isDisabled && onSelect(node.id)}
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
                <span className="truncate text-sm flex-1">{node.title}</span>
            </div>
            {expanded && hasChildren && node.children.map(child => (
                <TreeNode 
                    key={child.id} 
                    node={child} 
                    level={level + 1} 
                    onSelect={onSelect} 
                    selectedId={selectedId}
                    disabledIds={disabledIds}
                />
            ))}
        </div>
    )
}

export const MoveTopicModal = ({ isOpen, onClose, topicsToMove }: MoveTopicModalProps) => {
    const topics = useStore(s => s.topics);
    const moveTopic = useStore(s => s.moveTopic);
    const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

    const tree = useMemo(() => buildTree(topics), [topics]);

    // IDs that cannot be selected (the topics themselves and their descendants)
    const disabledIds = useMemo(() => {
        if (topicsToMove.length === 0) return new Set<string>();
        const ids = new Set<string>();
        topicsToMove.forEach(t => {
            const descendants = getAllDescendantIds(t);
            descendants.forEach(id => ids.add(id));
        });
        return ids;
    }, [topicsToMove]);

    if (!isOpen || topicsToMove.length === 0) return null;

    const handleMove = async () => {
        try {
            // If selectedTargetId is "root", then parent_id is null
            const parentId = selectedTargetId === 'root' ? null : selectedTargetId;
            
            // Prevent moving to self or children (already disabled in UI, but safe check)
            if (parentId && disabledIds.has(parentId)) return;

            for (const topic of topicsToMove) {
                // Skip if moving into itself (though UI prevents this)
                if (parentId === topic.id) continue;
                await moveTopic(topic.id, parentId);
            }
            onClose();
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 flex-shrink-0">
                    <div>
                        <h2 className="font-semibold text-gray-900">Move Topic</h2>
                        <p className="text-xs text-gray-500 truncate max-w-[200px]">
                            Moving: {topicsToMove.length === 1 ? topicsToMove[0].title : `${topicsToMove.length} topics`}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-auto p-2 custom-scrollbar">
                    <div 
                        className={`flex items-center py-2 px-3 mb-1 rounded cursor-pointer transition-colors ${
                            selectedTargetId === 'root' ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100 text-gray-600'
                        }`}
                        onClick={() => setSelectedTargetId('root')}
                    >
                        <Folder size={16} className="mr-2 text-gray-400" />
                        <span className="text-sm font-medium">Root (Top Level)</span>
                    </div>
                    
                    {tree.map(node => (
                        <TreeNode 
                            key={node.id} 
                            node={node} 
                            level={0} 
                            onSelect={setSelectedTargetId} 
                            selectedId={selectedTargetId}
                            disabledIds={disabledIds}
                        />
                    ))}
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex gap-3 flex-shrink-0">
                    <button 
                        onClick={onClose}
                        className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleMove}
                        disabled={!selectedTargetId}
                        className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Move Here
                    </button>
                </div>
            </div>
        </div>
    );
};
