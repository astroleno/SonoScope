const table = Uint32Array.from({ length: 256 }, (_, value) => { for (let i = 0; i < 8; i++) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1; return value >>> 0; });
export function crcUpdate(crc: number, data: Uint8Array) { for (const byte of data) crc = table[(crc ^ byte) & 255] ^ crc >>> 8; return crc; }
export const crcResult = (crc: number) => (crc ^ -1) >>> 0;
