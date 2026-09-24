import { randomBytes } from "node:crypto";

let lastTimestamp = 0;
let sequence = 0;

/**
 * Generates an RFC 9562 compliant, monotonically ordered UUID v7.
 *
 * Structure (128 bits):
 * - [0..47] 48 bits: Unix timestamp in milliseconds (Date.now())
 * - [48..51] 4 bits: Version 7 (0b0111)
 * - [52..63] 12 bits: Sub-millisecond sequence counter
 * - [64..65] 2 bits: Variant 1 (0b10)
 * - [66..127] 62 bits: Cryptographically secure random data
 *
 * Monotonicity:
 * When generated within the same millisecond, the 12-bit sequence counter increments,
 * guaranteeing strict lexicographical sort order for database B-Tree index efficiency.
 */
export function uuidv7(): string {
  let now = Date.now();

  if (now > lastTimestamp) {
    lastTimestamp = now;
    // Reseed the 12-bit counter with random bits on a new millisecond
    sequence = randomBytes(2).readUInt16BE(0) & 0x0fff;
  } else {
    // Same millisecond or clock skew: increment sequence counter
    sequence = (sequence + 1) & 0x0fff;
    if (sequence === 0) {
      // Counter rollover within the same millisecond: advance timestamp to keep monotonicity
      lastTimestamp += 1;
      now = lastTimestamp;
    }
  }

  const buf = Buffer.alloc(16);
  buf.writeUIntBE(lastTimestamp, 0, 6);

  // Bytes 6-7: 4-bit version 7 + 12-bit sequence counter
  buf[6] = 0x70 | ((sequence >> 8) & 0x0f);
  buf[7] = sequence & 0xff;

  // Bytes 8-15: 2-bit variant + 62 bits cryptographic randomness
  randomBytes(8).copy(buf, 8);
  buf[8] = ((buf[8] ?? 0) & 0x3f) | 0x80;

  const hex = buf.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Extracts the embedded Unix timestamp from a UUID v7.
 */
export function getUuidv7Timestamp(uuid: string): Date {
  const cleanHex = uuid.replace(/-/g, "");
  const timeHex = cleanHex.slice(0, 12);
  const ms = parseInt(timeHex, 16);
  return new Date(ms);
}
