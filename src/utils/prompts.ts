import { Topic } from '../types';
import { getSiblings, getAncestors } from '../db/queries';

export const cleanTitle = (text: string) => {
    // Remove leading topic codes (e.g. "A. ", "1. ", "1.1 ") including uppercase/digits/punctuation at start
    // Pattern: Start of line, followed by some combination of uppercase, digits, punctuation, then space
    return text.replace(/^[\w\d\.\-\)]+\s+/, '').trim();
}

export const interpolatePrompt = async (promptTemplate: string, targetTopic: Topic) => {
    const cleanedTitle = cleanTitle(targetTopic.title);
    let text = promptTemplate.replace(/{{topic}}/g, cleanedTitle);
    
    // Note: window.getSelection() works when executed in browser
    const currentSelection = window.getSelection()?.toString() || '';
    text = text.replace(/{{selection}}/g, currentSelection);
    
    if (text.includes('{{neighbors}}')) {
        const siblings = await getSiblings(targetTopic.parent_id, targetTopic.id);
        text = text.replace(/{{neighbors}}/g, siblings.map(s => cleanTitle(s.title)).join(', '));
    }
    
    if (text.includes('{{ancestors}}')) {
        const ancestors = await getAncestors(targetTopic.id);
        text = text.replace(/{{ancestors}}/g, ancestors.map(a => cleanTitle(a.title)).join(' > '));
    }
    
    return text;
}
