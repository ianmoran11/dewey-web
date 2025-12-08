import { Topic, TopicNode } from '../types';

export const buildTree = (topics: Topic[]): TopicNode[] => {
  const map = new Map<string, TopicNode>();
  const roots: TopicNode[] = [];
  
  // First pass: create nodes
  topics.forEach(t => {
    map.set(t.id, { ...t, children: [] });
  });
  
  // Second pass: link children
  topics.forEach(t => {
    const node = map.get(t.id);
    if (!node) return;

    if (t.parent_id) {
      const parent = map.get(t.parent_id);
      if (parent) {
        parent.children.push(node);
      } else {
        // Parent not found (maybe loaded partially?), treat as root for now
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  });
  
  // Optional: Sort children by code
  const sortFn = (a: TopicNode, b: TopicNode) => {
      // If code exists, sort by length then alpha
      if (a.code && b.code) {
          if (a.code.length !== b.code.length) return a.code.length - b.code.length;
          return a.code.localeCompare(b.code);
      }
      return a.title.localeCompare(b.title);
  };

  const sortRecursive = (node: TopicNode) => {
      node.children.sort(sortFn);
      node.children.forEach(sortRecursive);
  };

  roots.sort(sortFn);
  roots.forEach(sortRecursive);

  return roots;
};
