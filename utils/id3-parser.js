/**
 * ID3 Parser - Lightweight native ID3v1/ID3v2 tag reader
 * 
 * Extracts metadata from MP3 files without external dependencies.
 * Supports: title, artist, album, year, genre, cover art (APIC).
 */

/**
 * Parse ID3 tags from an ArrayBuffer
 * @param {ArrayBuffer} buffer - The audio file as ArrayBuffer
 * @returns {object} { title, artist, album, year, genre, coverArt }
 */
export async function parseID3(buffer) {
  const result = {
    title: null,
    artist: null,
    album: null,
    year: null,
    genre: null,
    coverArt: null  // data URL string
  };

  const view = new DataView(buffer);

  // Try ID3v2 first (at beginning of file)
  if (buffer.byteLength > 10) {
    const id3Header = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2));
    if (id3Header === 'ID3') {
      parseID3v2(view, buffer, result);
      if (result.title || result.artist) return result;
    }
  }

  // Fallback to ID3v1 (last 128 bytes)
  if (buffer.byteLength > 128) {
    const offset = buffer.byteLength - 128;
    const tag = String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2));
    if (tag === 'TAG') {
      result.title = readFixedString(view, offset + 3, 30);
      result.artist = readFixedString(view, offset + 33, 30);
      result.album = readFixedString(view, offset + 63, 30);
      result.year = readFixedString(view, offset + 93, 4);
      const genreIndex = view.getUint8(offset + 127);
      result.genre = ID3_GENRES[genreIndex] || null;
    }
  }

  return result;
}

/**
 * Parse ID3v2 tags
 */
function parseID3v2(view, buffer, result) {
  const version = view.getUint8(3);
  const flags = view.getUint8(5);
  const size = readSynchsafeInt(view, 6);

  let offset = 10;

  // Skip extended header if present
  if (flags & 0x40) {
    const extSize = version === 4 ? readSynchsafeInt(view, offset) : view.getUint32(offset);
    offset += extSize;
  }

  const endOffset = Math.min(10 + size, buffer.byteLength);

  while (offset < endOffset - 10) {
    // Read frame header
    const frameId = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );

    // Check for padding
    if (frameId === '\0\0\0\0' || frameId.charCodeAt(0) === 0) break;

    const frameSize = version === 4
      ? readSynchsafeInt(view, offset + 4)
      : view.getUint32(offset + 4);

    if (frameSize <= 0 || offset + 10 + frameSize > endOffset) break;

    const frameData = offset + 10;

    switch (frameId) {
      case 'TIT2': // Title
        result.title = readTextFrame(view, buffer, frameData, frameSize);
        break;
      case 'TPE1': // Artist
        result.artist = readTextFrame(view, buffer, frameData, frameSize);
        break;
      case 'TALB': // Album
        result.album = readTextFrame(view, buffer, frameData, frameSize);
        break;
      case 'TDRC': // Recording date (ID3v2.4)
      case 'TYER': // Year (ID3v2.3)
        result.year = readTextFrame(view, buffer, frameData, frameSize);
        break;
      case 'TCON': // Genre
        result.genre = readTextFrame(view, buffer, frameData, frameSize);
        // Clean genre format like "(13)" or "(13)Pop"
        if (result.genre) {
          const genreMatch = result.genre.match(/^\((\d+)\)/);
          if (genreMatch) {
            const idx = parseInt(genreMatch[1]);
            result.genre = ID3_GENRES[idx] || result.genre.replace(/^\(\d+\)/, '');
          }
        }
        break;
      case 'APIC': // Attached picture (cover art)
        result.coverArt = readAPICFrame(view, buffer, frameData, frameSize);
        break;
    }

    offset += 10 + frameSize;
  }
}

/**
 * Read a text frame (TIT2, TPE1, etc.)
 */
function readTextFrame(view, buffer, offset, size) {
  if (size <= 1) return null;

  const encoding = view.getUint8(offset);
  const textStart = offset + 1;
  const textLength = size - 1;

  switch (encoding) {
    case 0: // ISO-8859-1
      return readLatin1String(view, textStart, textLength);
    case 1: // UTF-16 with BOM
      return readUTF16String(view, textStart, textLength);
    case 2: // UTF-16BE
      return readUTF16BEString(view, textStart, textLength);
    case 3: // UTF-8
      return readUTF8String(buffer, textStart, textLength);
    default:
      return readLatin1String(view, textStart, textLength);
  }
}

/**
 * Read APIC (picture) frame and return as data URL
 */
function readAPICFrame(view, buffer, offset, size) {
  try {
    const encoding = view.getUint8(offset);
    let pos = offset + 1;

    // Read MIME type (null-terminated ASCII)
    let mimeType = '';
    while (pos < offset + size && view.getUint8(pos) !== 0) {
      mimeType += String.fromCharCode(view.getUint8(pos));
      pos++;
    }
    pos++; // skip null

    // Picture type (1 byte) — 0x03 = front cover
    pos++;

    // Description (null-terminated, encoding-dependent)
    if (encoding === 0 || encoding === 3) {
      while (pos < offset + size && view.getUint8(pos) !== 0) pos++;
      pos++;
    } else {
      // UTF-16: skip until double null
      while (pos < offset + size - 1) {
        if (view.getUint8(pos) === 0 && view.getUint8(pos + 1) === 0) { pos += 2; break; }
        pos += 2;
      }
    }

    // Remaining bytes are the image data
    const imageData = new Uint8Array(buffer, pos, offset + size - pos);
    if (imageData.length < 10) return null;

    // Convert to base64 data URL
    if (!mimeType || mimeType === 'image/') mimeType = 'image/jpeg';
    const base64 = uint8ToBase64(imageData);
    return `data:${mimeType};base64,${base64}`;
  } catch (e) {
    return null;
  }
}

// ==================== HELPERS ====================

function readSynchsafeInt(view, offset) {
  return (
    ((view.getUint8(offset) & 0x7F) << 21) |
    ((view.getUint8(offset + 1) & 0x7F) << 14) |
    ((view.getUint8(offset + 2) & 0x7F) << 7) |
    (view.getUint8(offset + 3) & 0x7F)
  );
}

function readFixedString(view, offset, length) {
  let str = '';
  for (let i = 0; i < length; i++) {
    const c = view.getUint8(offset + i);
    if (c === 0) break;
    str += String.fromCharCode(c);
  }
  return str.trim() || null;
}

function readLatin1String(view, offset, length) {
  let str = '';
  for (let i = 0; i < length; i++) {
    const c = view.getUint8(offset + i);
    if (c === 0) break;
    str += String.fromCharCode(c);
  }
  return str.trim() || null;
}

function readUTF8String(buffer, offset, length) {
  const decoder = new TextDecoder('utf-8');
  const bytes = new Uint8Array(buffer, offset, length);
  // Find null terminator
  let end = bytes.indexOf(0);
  if (end === -1) end = length;
  return decoder.decode(bytes.subarray(0, end)).trim() || null;
}

function readUTF16String(view, offset, length) {
  // Check BOM
  const bom = view.getUint16(offset);
  const isLE = bom === 0xFFFE;
  const start = offset + 2;
  const charCount = (length - 2) / 2;
  let str = '';
  for (let i = 0; i < charCount; i++) {
    const code = isLE
      ? view.getUint16(start + i * 2, true)
      : view.getUint16(start + i * 2, false);
    if (code === 0) break;
    str += String.fromCharCode(code);
  }
  return str.trim() || null;
}

function readUTF16BEString(view, offset, length) {
  const charCount = length / 2;
  let str = '';
  for (let i = 0; i < charCount; i++) {
    const code = view.getUint16(offset + i * 2, false);
    if (code === 0) break;
    str += String.fromCharCode(code);
  }
  return str.trim() || null;
}

function uint8ToBase64(uint8Array) {
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

// ID3v1 Genre lookup table
const ID3_GENRES = [
  'Blues', 'Classic Rock', 'Country', 'Dance', 'Disco', 'Funk', 'Grunge', 'Hip-Hop',
  'Jazz', 'Metal', 'New Age', 'Oldies', 'Other', 'Pop', 'R&B', 'Rap',
  'Reggae', 'Rock', 'Techno', 'Industrial', 'Alternative', 'Ska', 'Death Metal', 'Pranks',
  'Soundtrack', 'Euro-Techno', 'Ambient', 'Trip-Hop', 'Vocal', 'Jazz+Funk', 'Fusion', 'Trance',
  'Classical', 'Instrumental', 'Acid', 'House', 'Game', 'Sound Clip', 'Gospel', 'Noise',
  'Alt. Rock', 'Bass', 'Soul', 'Punk', 'Space', 'Meditative', 'Instrumental Pop', 'Instrumental Rock',
  'Ethnic', 'Gothic', 'Darkwave', 'Techno-Industrial', 'Electronic', 'Pop-Folk', 'Eurodance', 'Dream',
  'Southern Rock', 'Comedy', 'Cult', 'Gangsta Rap', 'Top 40', 'Christian Rap', 'Pop/Funk', 'Jungle',
  'Native American', 'Cabaret', 'New Wave', 'Psychedelic', 'Rave', 'Showtunes', 'Trailer', 'Lo-Fi',
  'Tribal', 'Acid Punk', 'Acid Jazz', 'Polka', 'Retro', 'Musical', 'Rock & Roll', 'Hard Rock'
];

/**
 * Parse ID3 tags from a File object
 * @param {File} file - Audio file
 * @returns {Promise<object>} Metadata
 */
export async function parseID3FromFile(file) {
  // Read first 256KB (tags are at the start) + last 128 bytes (ID3v1)
  const headerSize = Math.min(file.size, 256 * 1024);

  const headerSlice = file.slice(0, headerSize);
  const headerBuffer = await headerSlice.arrayBuffer();

  const result = await parseID3(headerBuffer);

  // If no ID3v2 tags found, try ID3v1 from end of file
  if (!result.title && !result.artist && file.size > 128) {
    const tailSlice = file.slice(file.size - 128);
    const tailBuffer = await tailSlice.arrayBuffer();
    const tailView = new DataView(tailBuffer);
    const tag = String.fromCharCode(tailView.getUint8(0), tailView.getUint8(1), tailView.getUint8(2));
    if (tag === 'TAG') {
      result.title = readFixedString(tailView, 3, 30);
      result.artist = readFixedString(tailView, 33, 30);
      result.album = readFixedString(tailView, 63, 30);
      result.year = readFixedString(tailView, 93, 4);
    }
  }

  return result;
}

export default { parseID3, parseID3FromFile };
