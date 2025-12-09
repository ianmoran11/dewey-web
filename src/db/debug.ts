import { sql } from './client';

export const debugAudio = async (id?: string) => {
    let targetId = id;
    if (!targetId) {
        // Find one with audio
        const has = await sql`SELECT id FROM topics WHERE has_audio = 1 OR has_audio = true LIMIT 1`;
        if (has.length > 0) {
            targetId = has[0].id as string;
        }
    }
    
    if (!targetId) {
        console.log("DEBUG: No topics with audio found.");
        return;
    }
    
    console.log("DEBUG: Inspecting topic:", targetId);
    
    const rows = await sql`SELECT audio, has_audio FROM topics WHERE id = ${targetId}`;
    if (rows.length === 0) {
        console.log("DEBUG: Topic not found");
        return;
    }
    
    console.log("DEBUG: has_audio flag:", rows[0].has_audio);
    
    const audio = rows[0].audio;
    if (!audio) {
        console.log("DEBUG: audio field is null/undefined");
        return;
    }
    
    console.log("DEBUG: audio field type:", typeof audio);
    console.log("DEBUG: audio constructor:", (audio as any).constructor?.name);
    
    if (audio instanceof Uint8Array) {
        console.log("DEBUG: It is a Uint8Array. Byte length:", audio.byteLength);
        console.log("DEBUG: First 10 bytes:", audio.subarray(0, 10));
        
        // Try to detect magic numbers
        // WAV starts with RIFF (0x52, 0x49, 0x46, 0x46)
        // MP3 starts with ID3 (0x49, 0x44, 0x33) or sync FF Fsomething
        const header = Array.from(audio.subarray(0, 4)).map(b => b.toString(16)).join(' ');
        console.log("DEBUG: Header Hex:", header);
        const headerStr = String.fromCharCode(...audio.subarray(0, 4));
        console.log("DEBUG: Header Str:", headerStr);
    } else {
        console.log("DEBUG: It is NOT a Uint8Array. Value:", audio);
    }
}
