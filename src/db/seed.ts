import { v4 as uuidv4 } from 'uuid';
import { sql } from './client';
import { initialTaxonomyRaw, defaultFlashcardTemplate } from '../data/initialData';

export const seedDatabase = async () => {
  console.log('Checking database state...');

  // 1. Deduplication (Safety Clean)
  // Remove duplicate topics by (parent_id, code) pair - keeping one per unique combination
  // This prevents deleting user-created subtopics that happen to use the same codes as root topics
  await sql`
    DELETE FROM topics 
    WHERE code IS NOT NULL 
    AND id NOT IN (
      SELECT MIN(id) FROM topics 
      WHERE code IS NOT NULL 
      GROUP BY COALESCE(parent_id, 'ROOT'), code
    )
  `;

  // Remove duplicate templates by name
  await sql`
    DELETE FROM templates 
    WHERE id NOT IN (
      SELECT id FROM templates GROUP BY name
    )
  `;

  // 2. Seed Topics
  // Check if root 'A' exists as a proxy for "is seeded"
  const rootCheck = await sql`SELECT id FROM topics WHERE code = 'A' LIMIT 1`;

  if (rootCheck.length === 0) {
    console.log('Seeding topics...');

    const lines = initialTaxonomyRaw.split('\n')
      .filter((l: string) => l.trim().startsWith('|') && !l.includes('---') && !l.includes('| Code |'));

    // Map to store parent IDs by code (e.g., 'A' -> 'uuid-123')
    const parentMap = new Map<string, string>();
    const clean = (s: string) => s.replace(/\*\*/g, '').trim();

    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length < 4) continue;

      const code = clean(parts[1]);
      const field = clean(parts[2]);
      const subfield = clean(parts[3]);

      const id = uuidv4();
      const now = Date.now();

      if (code.length === 1) {
        await sql`
          INSERT INTO topics (id, code, title, created_at)
          VALUES (${id}, ${code}, ${field}, ${now})
        `;
        parentMap.set(code, id);
      } else if (code.length === 2) {
        let parentId = parentMap.get(code[0]);
        if (!parentId) {
          const pParams = await sql`SELECT id FROM topics WHERE code = ${code[0]}`;
          if (pParams.length > 0) {
            parentId = pParams[0].id as string;
            parentMap.set(code[0], parentId);
          }
        }

        if (parentId) {
          await sql`
            INSERT INTO topics (id, parent_id, code, title, created_at)
            VALUES (${id}, ${parentId}, ${code}, ${subfield}, ${now})
          `;
        }
      }
    }
    console.log('Topics seeded.');
  } else {
    console.log('Topics already seeded.');
  }

  // 3. Seed Templates
  // Keep previous defaults, but ensure we have a flashcard template available.
  // If a user already has one (customized), we do not overwrite.
  const flashTemplateCheck = await sql`SELECT id FROM templates WHERE type = 'flashcards' LIMIT 1`;
  if (flashTemplateCheck.length === 0) {
    console.log('Seeding flashcard template...');
    await sql`
      INSERT INTO templates (id, name, prompt, type, is_default)
      VALUES (${defaultFlashcardTemplate.id}, ${defaultFlashcardTemplate.name}, ${defaultFlashcardTemplate.prompt}, ${defaultFlashcardTemplate.type}, 1)
    `;
    console.log('Flashcard template seeded.');
  }
};
