import { Mp3Encoder } from '@breezystack/lamejs';
import { parseWav } from './audio';

/**
 * Converts a WAV Blob to an MP3 Blob using lamejs.
 * This runs in the browser. 
 */
export const convertWavToMp3 = async (wavBlob: Blob): Promise<Blob> => {
  const arrayBuffer = await wavBlob.arrayBuffer();
  const { format, pcmData } = parseWav(arrayBuffer);
  
  console.log(`[MP3] Converting WAV: ${format.sampleRate}Hz, ${format.numChannels}ch, ${format.bitsPerSample}bit, ${pcmData.byteLength} bytes`);

  // lamejs expects Int16Array for 16-bit PCM
  if (format.bitsPerSample !== 16) {
    throw new Error(`Unsupported bits per sample: ${format.bitsPerSample}. Expected 16.`);
  }

  const sampleRate = format.sampleRate;
  const numChannels = format.numChannels;
  
  // Create encoder
  const mp3encoder = new Mp3Encoder(numChannels, sampleRate, 128); // 128kbps
  
  const mp3Data: Uint8Array[] = [];
  
  // pcmData is Uint8Array (bytes). We need to view it as Int16Array for lamejs.
  // We use pcmData.slice().buffer to ensure the buffer is correctly aligned for Int16Array.
  const samples = new Int16Array(pcmData.slice().buffer);
  
  const sampleBlockSize = 1152; // multiple of 576
  
  if (numChannels === 1) {
    for (let i = 0; i < samples.length; i += sampleBlockSize) {
      const chunk = samples.subarray(i, i + sampleBlockSize);
      const mp3buf = mp3encoder.encodeBuffer(chunk);
      if (mp3buf.length > 0) {
        mp3Data.push(new Uint8Array(mp3buf));
      }
    }
  } else if (numChannels === 2) {
    // Split interleaved samples into left and right
    const left = new Int16Array(samples.length / 2);
    const right = new Int16Array(samples.length / 2);
    for (let i = 0, j = 0; i < samples.length; i += 2, j++) {
      left[j] = samples[i];
      right[j] = samples[i + 1];
    }
    
    for (let i = 0; i < left.length; i += sampleBlockSize) {
      const leftChunk = left.subarray(i, i + sampleBlockSize);
      const rightChunk = right.subarray(i, i + sampleBlockSize);
      const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
      if (mp3buf.length > 0) {
        mp3Data.push(new Uint8Array(mp3buf));
      }
    }
  } else {
    throw new Error(`Unsupported number of channels: ${numChannels}`);
  }
  
  const endBuf = mp3encoder.flush();
  if (endBuf.length > 0) {
    mp3Data.push(new Uint8Array(endBuf));
  }
  
  console.log(`[MP3] Encoded ${mp3Data.length} chunks`);
  
  // Some TS configurations require explicit ArrayBuffer slices for BlobPart compatibility
  const parts: BlobPart[] = mp3Data.map(u8 => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer);
  
  const result = new Blob(parts, { type: 'audio/mp3' });
  console.log(`[MP3] Final MP3 size: ${result.size} bytes`);
  
  return result;
};
