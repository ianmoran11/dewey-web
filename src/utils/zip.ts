import JSZip from 'jszip';
import { AudioEpisode, Topic } from '../types';
import { getAudioEpisodeAudio } from '../db/queries';

/**
 * Sanitize a string for use as a filename or folder name on Android/Windows/macOS.
 */
export const sanitizeFilename = (name: string): string => {
  return name
    .replace(/[<>:"/\\|?*]/g, '-') // Replace illegal characters with hyphens
    .replace(/[ \t\n\r]+/g, ' ')  // Collapse whitespace
    .trim()
    .slice(0, 250);                // Limit length
};

/**
 * Resolves the full folder path for a topic by traversing its ancestors.
 */
export const getTopicPath = (topicId: string, topicsMap: Map<string, Topic>): string[] => {
  const path: string[] = [];
  let currentId: string | null = topicId;
  const visited = new Set<string>();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const topic = topicsMap.get(currentId);
    if (!topic) break;
    
    // Prefix with code if available for better sorting in filesystems
    const folderName = topic.code 
      ? `${topic.code} ${topic.title}` 
      : topic.title;
      
    path.unshift(sanitizeFilename(folderName));
    currentId = topic.parent_id || null;
  }

  return path;
};

export interface ExportProgress {
  current: number;
  total: number;
  status: string;
}

export type ExportFormat = 'mp3' | 'wav';

/**
 * Generates a ZIP blob containing audio episodes organized by topic folders.
 * @param format - 'mp3' to convert to MP3 (smaller), 'wav' to keep original format (larger but more reliable)
 */
export const exportAudioLibraryToZip = async (
  episodes: AudioEpisode[],
  topics: Topic[],
  onProgress?: (progress: ExportProgress) => void,
  format: ExportFormat = 'mp3'
): Promise<Blob> => {
  const zip = new JSZip();
  const topicsMap = new Map(topics.map((t) => [t.id, t]));
  const total = episodes.length;

  // Try to load the MP3 converter if needed
  let mp3Converter: ((wavBlob: Blob) => Promise<Blob>) | null = null;
  if (format === 'mp3') {
    try {
      const mp3Module = await import('./mp3');
      mp3Converter = mp3Module.convertWavToMp3;
      console.log('[ZIP] MP3 converter loaded successfully');
    } catch (err) {
      console.error('[ZIP] Failed to load MP3 converter, falling back to WAV:', err);
      // Fall back to WAV if MP3 converter fails to load
      format = 'wav';
    }
  }

  for (let i = 0; i < total; i++) {
    const ep = episodes[i];
    
    if (onProgress) {
      onProgress({
        current: i + 1,
        total,
        status: `Processing: ${ep.title}`,
      });
    }

    try {
      const audioBlob = await getAudioEpisodeAudio(ep.id);
      if (!audioBlob) {
        console.warn(`Audio not found for episode: ${ep.title} (${ep.id})`);
        continue;
      }

      let finalBlob: Blob;
      let fileExtension: string;

      if (format === 'mp3' && mp3Converter) {
        if (onProgress) {
          onProgress({
            current: i + 1,
            total,
            status: `Converting to MP3: ${ep.title}`,
          });
        }
        finalBlob = await mp3Converter(audioBlob);
        fileExtension = 'mp3';
      } else {
        // Use WAV directly
        finalBlob = audioBlob;
        fileExtension = 'wav';
      }

      // Determine path
      const pathParts = getTopicPath(ep.topic_id, topicsMap);
      
      // Determine filename
      // Prefix with a timestamp to ensure uniqueness and correct sorting in the player
      const datePrefix = new Date(ep.created_at).toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = sanitizeFilename(`${datePrefix} - ${ep.title}.${fileExtension}`);
      
      // Navigate/create folders in ZIP
      let currentFolder: JSZip = zip;
      for (const part of pathParts) {
        if (!part) continue;
        const nextFolder = currentFolder.folder(part);
        if (nextFolder) {
          currentFolder = nextFolder;
        }
      }

      // JSZip can take a Blob directly, which is more memory efficient
      console.log(`Adding to ZIP: ${filename} (${finalBlob.size} bytes)`);
      currentFolder.file(filename, finalBlob);
    } catch (err) {
      console.error(`Failed to export episode ${ep.title}`, err);
      // Re-throw to stop the process and inform the user
      throw new Error(`Failed to process "${ep.title}": ${(err as Error).message}`);
    }
  }

  if (onProgress) {
    onProgress({
      current: total,
      total,
      status: 'Generating ZIP file...',
    });
  }

  return await zip.generateAsync({ 
    type: 'blob',
    // For WAV files, STORE is best. For MP3, STORE is also fine since they're already compressed.
    compression: 'STORE'
  });
};
