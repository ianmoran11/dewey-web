// Utilities for generating and combining audio blobs in the browser.
//
// This app currently uses DeepInfra Kokoro which returns WAV.
// When we generate long narration, we split text into smaller chunks,
// call TTS for each chunk, then concatenate the WAV PCM data into a
// single valid WAV file.

export type WavFormat = {
  audioFormat: number;
  numChannels: number;
  sampleRate: number;
  byteRate: number;
  blockAlign: number;
  bitsPerSample: number;
  fmtChunkBytes: Uint8Array; // includes the full "fmt " chunk (8-byte header + payload)
};

const ascii = (s: string): Uint8Array => new TextEncoder().encode(s);

const u32le = (n: number) => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
};

/**
 * Split text into chunks with approximate max length.
 *
 * Assumes `text` is already cleaned (no markdown).
 * Tries to split on sentence boundaries first.
 */
export const splitTextForTTS = (text: string, maxChars: number): string[] => {
  const t = text.trim();
  if (!t) return [];

  // Split on sentence boundaries (keep punctuation with the sentence).
  // This is intentionally simple and language-agnostic.
  const sentences = t.split(/(?<=[.!?])\s+/g);

  const chunks: string[] = [];
  let current = '';

  const pushCurrent = () => {
    const c = current.trim();
    if (c) chunks.push(c);
    current = '';
  };

  for (const s of sentences) {
    const sentence = s.trim();
    if (!sentence) continue;

    // If a single sentence is too large, hard-split it.
    if (sentence.length > maxChars) {
      pushCurrent();
      for (let i = 0; i < sentence.length; i += maxChars) {
        const part = sentence.slice(i, i + maxChars).trim();
        if (part) chunks.push(part);
      }
      continue;
    }

    // If adding this sentence would exceed max, flush.
    if ((current.length ? current.length + 1 : 0) + sentence.length > maxChars) {
      pushCurrent();
    }

    current = current ? `${current} ${sentence}` : sentence;
  }

  pushCurrent();
  return chunks;
};

const readFourCC = (bytes: Uint8Array, offset: number): string => {
  return String.fromCharCode(
    bytes[offset],
    bytes[offset + 1],
    bytes[offset + 2],
    bytes[offset + 3]
  );
};

/**
 * Extract WAV format + PCM data payload.
 * Supports extra chunks by scanning chunk headers until it finds fmt/data.
 */
export const parseWav = (buffer: ArrayBuffer): { format: WavFormat; pcmData: Uint8Array } => {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  if (readFourCC(bytes, 0) !== 'RIFF' || readFourCC(bytes, 8) !== 'WAVE') {
    throw new Error('Not a WAV (missing RIFF/WAVE header)');
  }

  let offset = 12; // start of first chunk

  let fmtChunkOffset = -1;
  let fmtChunkSize = -1;
  let dataChunkOffset = -1;
  let dataChunkSize = -1;

  while (offset + 8 <= bytes.length) {
    const id = readFourCC(bytes, offset);
    const size = view.getUint32(offset + 4, true);
    const payloadOffset = offset + 8;

    if (id === 'fmt ') {
      fmtChunkOffset = offset;
      fmtChunkSize = size;
    } else if (id === 'data') {
      dataChunkOffset = offset;
      dataChunkSize = size;
      break; // data is usually last chunk we care about
    }

    // chunks are word-aligned
    offset = payloadOffset + size + (size % 2);
  }

  if (fmtChunkOffset === -1 || dataChunkOffset === -1) {
    throw new Error('Invalid WAV (missing fmt or data chunk)');
  }

  const fmtPayloadOffset = fmtChunkOffset + 8;
  const audioFormat = view.getUint16(fmtPayloadOffset + 0, true);
  const numChannels = view.getUint16(fmtPayloadOffset + 2, true);
  const sampleRate = view.getUint32(fmtPayloadOffset + 4, true);
  const byteRate = view.getUint32(fmtPayloadOffset + 8, true);
  const blockAlign = view.getUint16(fmtPayloadOffset + 12, true);
  const bitsPerSample = view.getUint16(fmtPayloadOffset + 14, true);

  const fmtChunkBytes = bytes.slice(fmtChunkOffset, fmtChunkOffset + 8 + fmtChunkSize);

  const dataPayloadOffset = dataChunkOffset + 8;
  const pcmData = bytes.slice(dataPayloadOffset, dataPayloadOffset + dataChunkSize);

  return {
    format: {
      audioFormat,
      numChannels,
      sampleRate,
      byteRate,
      blockAlign,
      bitsPerSample,
      fmtChunkBytes,
    },
    pcmData,
  };
};

const formatsMatch = (a: WavFormat, b: WavFormat): boolean => {
  return (
    a.audioFormat === b.audioFormat &&
    a.numChannels === b.numChannels &&
    a.sampleRate === b.sampleRate &&
    a.byteRate === b.byteRate &&
    a.blockAlign === b.blockAlign &&
    a.bitsPerSample === b.bitsPerSample &&
    // Also require identical fmt chunk bytes to be safe with extensions.
    a.fmtChunkBytes.length === b.fmtChunkBytes.length &&
    a.fmtChunkBytes.every((v, i) => v === b.fmtChunkBytes[i])
  );
};

/**
 * Concatenate multiple WAV blobs into a single valid WAV blob.
 *
 * Requirements:
 * - All WAVs must have the same format (channels/sample rate/bits).
 * - Output WAV will include only: RIFF + WAVE + fmt + data.
 */
export const concatWavBlobs = async (blobs: Blob[]): Promise<Blob> => {
  if (blobs.length === 0) throw new Error('No audio chunks to concatenate');
  if (blobs.length === 1) return blobs[0];

  const parsed = await Promise.all(blobs.map(async (b) => parseWav(await b.arrayBuffer())));
  const baseFormat = parsed[0].format;

  for (let i = 1; i < parsed.length; i++) {
    if (!formatsMatch(baseFormat, parsed[i].format)) {
      throw new Error('Cannot concatenate WAV chunks: formats do not match');
    }
  }

  const totalDataSize = parsed.reduce((sum, p) => sum + p.pcmData.byteLength, 0);

  // RIFF chunk size = 4 ("WAVE") + fmt chunk + data chunk
  const riffChunkSize = 4 + baseFormat.fmtChunkBytes.byteLength + 8 + totalDataSize;

  const headerParts: Uint8Array[] = [
    ascii('RIFF'),
    u32le(riffChunkSize),
    ascii('WAVE'),
    baseFormat.fmtChunkBytes,
    ascii('data'),
    u32le(totalDataSize),
  ];

  const pcmParts = parsed.map((p) => p.pcmData);

  // Some TS DOM lib configurations treat Uint8Array.buffer as ArrayBufferLike.
  // Convert to concrete ArrayBuffer slices for BlobPart compatibility.
  const toArrayBufferSlice = (u8: Uint8Array): ArrayBuffer =>
    u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;

  const parts: BlobPart[] = [
    ...headerParts.map(toArrayBufferSlice),
    ...pcmParts.map(toArrayBufferSlice),
  ];

  return new Blob(parts, { type: 'audio/wav' });
};
