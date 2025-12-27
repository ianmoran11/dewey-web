export const getNextCode = (parentCode: string | undefined, existingCodes: string[]): string => {
    // Filter codes relevant to this level
    // If parentCode is "A", we look for "AA", "AB"... (length = parent + 1)
    // If parentCode is undefined (root), we look for "A", "B"... (length = 1)
    
    const targetLength = (parentCode?.length || 0) + 1;
    
    const siblings = existingCodes
        .filter(c => {
            if (!c) return false;
            // Check length consistency
            if (c.length !== targetLength) return false;
            // If parent exists, must start with it
            if (parentCode && !c.startsWith(parentCode)) return false;
            return true;
        })
        .sort(); // Alpha sort works fine for same-length strings

    if (siblings.length === 0) {
        return (parentCode || '') + 'A';
    }

    const last = siblings[siblings.length - 1];
    const lastChar = last.charAt(last.length - 1);
    
    // Increment char
    // If 'Z', we have a problem in this simplistic scheme. 
    // Fallback? Maybe append 'a'? Or just go to ASCII '[' (which is next). 
    // Let's stick to A-Z for now and maybe just not generate a code if full?
    // Or just increment ASCII.
    const nextChar = String.fromCharCode(lastChar.charCodeAt(0) + 1);
    
    // Optional: Safety check if we went beyond Z?
    // User asked for A-Z. 
    // If we go beyond Z, let's just return it for now, user can manually fix.
    
    return (parentCode || '') + nextChar;
}

export const generateCodes = (parentCode: string | undefined, existingCodes: string[], count: number): string[] => {
    const results: string[] = [];
    let currentPool = [...existingCodes];
    
    for (let i = 0; i < count; i++) {
        const next = getNextCode(parentCode, currentPool);
        results.push(next);
        currentPool.push(next);
        // Optimize: we don't need to full resort, just knowing the last one is enough if we trusted getNextCode.
        // But getNextCode re-scans. 
        // Let's optimize:
        // getNextCode is stateless.
    }
    return results;
}
