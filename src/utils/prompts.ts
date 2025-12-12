import { Topic } from '../types';
import { getSiblings, getAncestors } from '../db/queries';

export const cleanTitle = (text: string) => {
    // Only strip *code-like* prefixes; never strip real words.
    // Examples (strip):
    // - "AA Data governance" -> "Data governance"
    // - "AA-C Data governance" -> "Data governance"
    // - "AH C Data governance" -> "Data governance"
    // Examples (keep):
    // - "Data governance" -> "Data governance"
    //
    // Matches:
    // - 1-4 uppercase letters (e.g. AA)
    // - optionally "-" + 1-4 uppercase letters (e.g. AA-C)
    // - OR uppercase block + space + uppercase block (e.g. "AH C")
    // - optional trailing dot before whitespace
    const CODE_PREFIX = /^(?:[A-Z]{1,4}(?:-[A-Z]{1,4})?|[A-Z]{1,4}\s[A-Z]{1,4})\.?\s+/;
    return text.replace(CODE_PREFIX, '').trim();
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
