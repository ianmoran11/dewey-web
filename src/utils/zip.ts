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
 * Resolve the full folder path for a topic by traversing its ancestors.
 */
export const getTopicPath = (topicId: string, topicsMap: Map<string, Topic>): string[] => {
  const path: string[] = [];
  let currentId: string | null = topicId;

  while (currentId) {
    const topic = topicsMap.get(currentId);
    if (!topic) break;
    
    // Prefix with code if available for better sorting in filesystems
    const folderName = topic.code 
      ? `${topic.code} ${topic.title}` 
      : topic.title;
      
    path.unshift(sanitizeFilename(folderName));
    currentId = topic.parent_id;
  }

  return path;
};

export interface ExportProgress {
  current: number;
  total: number;
  status: string;
}

/**
 * Generates a ZIP blob containing audio episodes organized by topic folders.
 */
export const exportAudioLibraryToZip = async (
  episodes: AudioEpisode[],
  topics: Topic[],
  onProgress?: (progress: ExportProgress) => void
): Promise<Blob> => {
  const zip = new JSZip();
  const topicsMap = new Map(topics.map((t) => [t.id, t]));
  const total = episodes.length;

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

      // Determine path
      const pathParts = getTopicPath(ep.topic_id, topicsMap);
      
      // Determine filename
      // Prefix with a timestamp to ensure uniqueness and correct sorting in the player
      const datePrefix = new Date(ep.created_at).toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = sanitizeFilename(`${datePrefix} - ${ep.title}.wav`);
      
      // Navigate/create folders in ZIP
      let currentFolder = zip;
      for (const part of pathParts) {
        currentFolder = currentFolder.folder(part)!;
      }

      const audioData = await audioBlob.arrayBuffer();
      currentFolder.file(filename, audioData);
    } catch (err) {
      console.error(`Failed to export episode ${ep.title}`, err);
    }
  }

  if (onProgress) {
    onProgress({
      current: total,
      total,
      status: 'Generating ZIP file...',
    });
  }

  return await zip.generateAsync({ type: 'blob' });
};
