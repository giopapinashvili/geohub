/** Read dimensions from the actual JPEG SOF header, without resizing the image. */
export function jpegDimensions(bytes) {
 if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Not a JPEG');
 let offset = 2;
 const frames = new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
 while (offset + 8 < bytes.length) {
  if (bytes[offset++] !== 0xff) continue;
  while (bytes[offset] === 0xff) offset++;
  const marker = bytes[offset++];
  if (marker === 0xd9 || marker === 0xda) break;
  if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
  const length = bytes.readUInt16BE(offset);
  if (length < 2 || offset + length > bytes.length) break;
  if (frames.has(marker)) return { width: bytes.readUInt16BE(offset + 5), height: bytes.readUInt16BE(offset + 3) };
  offset += length;
 }
 throw new Error('JPEG dimensions missing');
}
