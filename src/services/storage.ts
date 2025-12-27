
export const getAudioRoot = async () => {
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle('audio', { create: true });
};

export const saveAudioFile = async (filename: string, blob: Blob): Promise<void> => {
    try {
        const dir = await getAudioRoot();
        const handle = await dir.getFileHandle(filename, { create: true });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
    } catch (e) {
        console.error(`Failed to save audio file ${filename}`, e);
        throw e;
    }
};

export const getAudioFile = async (filename: string): Promise<Blob | null> => {
    try {
        const dir = await getAudioRoot();
        const handle = await dir.getFileHandle(filename, { create: false });
        const file = await handle.getFile();
        return file;
    } catch (e) {
        // NotFoundError is expected if file doesn't exist
        if ((e as Error).name === 'NotFoundError') return null;
        console.error(`Failed to read audio file ${filename}`, e);
        return null; // Return null on error to handle gracefully
    }
};

export const deleteAudioFile = async (filename: string): Promise<void> => {
    try {
        const dir = await getAudioRoot();
        await dir.removeEntry(filename);
    } catch (e) {
        if ((e as Error).name === 'NotFoundError') return;
        console.warn(`Failed to delete audio file ${filename}`, e);
    }
};

// Helper to determine filename from ID
export const getAudioFilename = (id: string) => `${id}.wav`;
