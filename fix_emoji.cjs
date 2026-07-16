/**
 * fix_emoji.cjs
 * Fixes double-encoded emoji in admin.js.
 * The file was saved as Windows-1252 when it contained UTF-8 emoji,
 * then re-read and re-saved as UTF-8 — causing each emoji byte to be
 * double-encoded (e.g. 0xF0 → 0xC3 0xB0, 0x9F → 0xC5 0xB8 for W1252 Ÿ, etc.)
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public', 'admin.js');
const backupPath = filePath + '.bak_emoji';

// Read raw bytes
const buf = fs.readFileSync(filePath);

// Windows-1252 → Unicode mapping for codepoints 0x80-0x9F
// (the rest are 1:1)
const w1252Map = {
  0x80: 0x20AC, 0x82: 0x201A, 0x83: 0x0192, 0x84: 0x201E, 0x85: 0x2026,
  0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02C6, 0x89: 0x2030, 0x8A: 0x0160,
  0x8B: 0x2039, 0x8C: 0x0152, 0x8E: 0x017D, 0x91: 0x2018, 0x92: 0x2019,
  0x93: 0x201C, 0x94: 0x201D, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02DC, 0x99: 0x2122, 0x9A: 0x0161, 0x9B: 0x203A, 0x9C: 0x0153,
  0x9E: 0x017E, 0x9F: 0x0178,
};

/**
 * Decode a single UTF-8-encoded W1252 byte sequence back to its original byte value.
 * When a W1252 byte (0x00-0xFF) was re-encoded as UTF-8:
 *   bytes 0x00-0x7F → 1 byte (unchanged)
 *   bytes 0x80-0xFF → 2-3 bytes (their W1252 unicode equivalent encoded in UTF-8)
 * This function reads from buf at offset i and returns { byte, advance }.
 */
function decodeW1252Byte(buf, i) {
  const b = buf[i];
  if (b < 0x80) return { byte: b, advance: 1 };

  // Multi-byte UTF-8 sequence — decode the codepoint
  let codepoint;
  let advance;
  if ((b & 0xE0) === 0xC0 && i + 1 < buf.length) {
    codepoint = ((b & 0x1F) << 6) | (buf[i + 1] & 0x3F);
    advance = 2;
  } else if ((b & 0xF0) === 0xE0 && i + 2 < buf.length) {
    codepoint = ((b & 0x0F) << 12) | ((buf[i + 1] & 0x3F) << 6) | (buf[i + 2] & 0x3F);
    advance = 3;
  } else if ((b & 0xF8) === 0xF0 && i + 3 < buf.length) {
    // This is already a real 4-byte emoji — don't touch it
    return { byte: null, advance: 4, passthrough: 4 };
  } else {
    return { byte: b, advance: 1 };
  }

  // Now reverse: find which W1252 byte maps to this codepoint
  // Check special W1252 range
  for (const [wByte, uCode] of Object.entries(w1252Map)) {
    if (uCode === codepoint) return { byte: parseInt(wByte), advance };
  }
  // For codepoints 0x00-0xFF that are NOT in the special map (i.e. direct 1:1)
  if (codepoint <= 0xFF) return { byte: codepoint, advance };

  // Codepoint is outside 0xFF range — not a W1252 byte, leave as-is
  return { byte: null, advance, passthrough: advance };
}

// Process: decode the double-encoded UTF-8 back to original bytes
const originalBytes = [];
let i = 0;
let changed = 0;
while (i < buf.length) {
  const b = buf[i];

  // Already a proper 4-byte emoji (F0 9F ...) — pass through untouched
  if ((b & 0xF8) === 0xF0 && i + 3 < buf.length) {
    originalBytes.push(buf[i], buf[i+1], buf[i+2], buf[i+3]);
    i += 4;
    continue;
  }

  const result = decodeW1252Byte(buf, i);
  if (result.passthrough) {
    // Not reversible — copy bytes as-is
    for (let k = 0; k < result.passthrough; k++) originalBytes.push(buf[i + k]);
    i += result.passthrough;
  } else if (result.byte !== null && result.byte !== b) {
    originalBytes.push(result.byte);
    i += result.advance;
    changed++;
  } else {
    originalBytes.push(buf[i]);
    i += 1;
  }
}

const fixed = Buffer.from(originalBytes);

// Verify it's valid UTF-8
try {
  const text = fixed.toString('utf8');
  // Check some expected emoji
  const hasScroll  = text.includes('\u{1F4DC}'); // 📜
  const hasIdCard  = text.includes('\u{1FA96}'); // 🪪
  const hasCheck   = text.includes('\u2714') || text.includes('\u2713');
  console.log(`📜 scroll emoji present: ${hasScroll}`);
  console.log(`🪪 ID card emoji present: ${hasIdCard}`);
  console.log(`Changed byte sequences: ${changed}`);
  console.log(`Original size: ${buf.length}, Fixed size: ${fixed.length}`);

  if (changed === 0) {
    console.log('⚠️  No changes detected — file may not be double-encoded or already fixed.');
    process.exit(0);
  }

  // Backup original
  fs.writeFileSync(backupPath, buf);
  console.log(`Backup saved to ${backupPath}`);

  // Write fixed file
  fs.writeFileSync(filePath, fixed);
  console.log(`✅ Fixed admin.js written successfully.`);
} catch (e) {
  console.error('Resulting file is not valid UTF-8:', e.message);
  process.exit(1);
}
