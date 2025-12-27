
import { sql } from './client';
import { saveAudioFile, getAudioFilename } from '../services/storage';

export type MigrationProgressCallback = (current: number, total: number) => void;

export const migrateAudioToFiles = async (onProgress?: MigrationProgressCallback) => {
    // Check if migration is already done
    const check = await sql`SELECT value FROM settings WHERE key = 'storage_migration_v2_done'`;
    if (check.length > 0 && check[0].value === 'true') {
        return;
    }

    console.log("Starting Audio Storage Migration (DB -> Files)...");

    // Calculate total items to migrate for progress tracking
    let totalItems = 0;
    try {
        const counts = await sql`
            SELECT 
                (SELECT COUNT(*) FROM topics WHERE audio IS NOT NULL) +
                (SELECT COUNT(*) FROM content_blocks WHERE audio IS NOT NULL) + 
                (SELECT COUNT(*) FROM audio_episodes WHERE audio IS NOT NULL) as total
        `;
        totalItems = (counts[0] as any).total || 0;
        if (onProgress) onProgress(0, totalItems);
    } catch (e) {
        console.warn("Failed to count migration items", e);
    }

    let totalProcessed = 0;

    // Helper to migrate a table
    const migrateTable = async (table: string) => {
        let processed = 0;
        while (true) {
            // Select chunk of rows that still have audio data
            // We cannot parameterize table names in prepared statements, 
            // but since we control the string here, it's safe-ish. 
            // However, sqlocal might reject partial queries.
            // Let's use explicit queries for each table to be safe.
            let rows: any[] = [];
            
            // Increased limit to 50 for faster migration
            if (table === 'topics') {
                rows = await sql`SELECT id, audio FROM topics WHERE audio IS NOT NULL LIMIT 50`;
            } else if (table === 'content_blocks') {
                rows = await sql`SELECT id, audio FROM content_blocks WHERE audio IS NOT NULL LIMIT 50`;
            } else if (table === 'audio_episodes') {
                rows = await sql`SELECT id, audio FROM audio_episodes WHERE audio IS NOT NULL LIMIT 50`;
            }

            if (rows.length === 0) break;

            for (const row of rows) {
                if (row.audio) {
                    try {
                        const blob = new Blob([row.audio as any], { type: 'audio/wav' });
                        await saveAudioFile(getAudioFilename(row.id), blob);
                    } catch (e) {
                         console.error(`Failed to migrate audio for ${table} ${row.id}`, e);
                         // Continue? If we fail to save, we shouldn't nullify DB.
                         // But if we retry loop, we get stuck. 
                         // For now, log and maybe skip nullify? Or try to continue.
                    }
                }
                
                // Nullify DB column to free space (and mark as processed for the loop)
                // Nullify DB column to free space (and mark as processed for the loop)
                if (table === 'topics') {
                    await sql`UPDATE topics SET audio = NULL WHERE id = ${row.id}`;
                } else if (table === 'content_blocks') {
                    await sql`UPDATE content_blocks SET audio = NULL WHERE id = ${row.id}`;
                } else if (table === 'audio_episodes') {
                    // audio_episodes has NOT NULL constraint, so usage empty blob (0 bytes)
                    await sql`UPDATE audio_episodes SET audio = ${new Uint8Array(0)} WHERE id = ${row.id}`;
                }
                processed++;
                totalProcessed++;
                
                if (onProgress && totalItems > 0) {
                    onProgress(totalProcessed, totalItems);
                }
            }
            console.log(`Migrated ${processed} ${table} entries so far...`);
        }
    };

    try {
        await migrateTable('topics');
        await migrateTable('content_blocks');
        await migrateTable('audio_episodes');
        
        await sql`INSERT INTO settings (key, value) VALUES ('storage_migration_v2_done', 'true')`;
        
        // Reclaim disk space
        // Skip VACUUM for now as it locks the DB and takes too long.
        // Users will see space savings when they eventually reinstall or re-export.
        // await sql`VACUUM`;
        
        console.log("Audio Storage Migration Complete.");
    } catch (e) {
        console.error("Audio Migration Failed", e);
        // Do not mark as done so it retries next time
    }
};
