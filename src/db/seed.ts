import { v4 as uuidv4 } from 'uuid';
import { sql } from './client';
import { initialTaxonomyRaw } from '../data/initialData';

export const seedDatabase = async () => {
  // Check if empty
  const result = await sql`SELECT count(*) as count FROM topics`;
  if (result.length > 0 && (result[0].count as number) > 0) {
    console.log('Database already seeded.');
    return;
  }

  console.log('Seeding database...');
  
  const lines = initialTaxonomyRaw.split('\n')
    .filter(l => l.trim().startsWith('|') && !l.includes('---') && !l.includes('| Code |'));
  
  // Map to store parent IDs by code (e.g., 'A' -> 'uuid-123')
  const parentMap = new Map<string, string>();
  
  // Clean string helper
  const clean = (s: string) => s.replace(/\*\*/g, '').trim();

  // Process sequentially to ensure parents exist before children
  // (Though purely sync loop + async await helps)
  
  // We can execute inside a transaction for speed (if supported by sqlocal usually yes)
  // But doing row by row IS safer to avoid huge query limits. SQLocal via OPFS is fast enough.
  
  for (const line of lines) {
    const parts = line.split('|');
    // | Code | Field | Subfield |
    // indices: 0 (empty), 1 (Code), 2 (Field), 3 (Subfield)
    
    if (parts.length < 4) continue;

    const code = clean(parts[1]);
    const field = clean(parts[2]);
    const subfield = clean(parts[3]);
    
    const id = uuidv4();
    const now = Date.now();
    
    if (code.length === 1) {
      // Level 1: Root Topic
      // Title comes from 'Field'
      await sql`
        INSERT INTO topics (id, code, title, created_at)
        VALUES (${id}, ${code}, ${field}, ${now})
      `;
      parentMap.set(code, id);
    } else if (code.length === 2 && parentMap.has(code[0])) {
      // Level 2: Subtopic
      // Title comes from 'Subfield'
      const parentId = parentMap.get(code[0]);
      await sql`
        INSERT INTO topics (id, parent_id, code, title, created_at)
        VALUES (${id}, ${parentId}, ${code}, ${subfield}, ${now})
      `;
      // We don't need to map L2 codes unless we have L3
    }
  }
  
  console.log('Seeding complete.');
};
