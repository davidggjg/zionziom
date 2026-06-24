// ============================================================
// WATCH BLE PROTOCOL CONSTANTS
// Based on common Chinese ODM smartwatch (LIGE / Heylink stack)
// Chipsets: Jieli AC7012/AC6956, Realtek RTL8762x
// ============================================================

// --- Known Proprietary Service UUIDs (common in ODM watches) ---
export const KNOWN_SERVICE_UUIDS = [
  // ✅ Confirmed via nRF Connect on this exact watch (chhfegkj / Heylink)
  '0000AE00-0000-1000-8000-00805F9B34FB',
  '00003802-0000-1000-8000-00805F9B34FB',
  // Jieli / generic ODM primary service
  '0000FEE7-0000-1000-8000-00805F9B34FB',
  '0000FEE0-0000-1000-8000-00805F9B34FB',
  '0000FFE0-0000-1000-8000-00805F9B34FB',
  '0000FF00-0000-1000-8000-00805F9B34FB',
  // Heylink / Da Fit style
  '6E400001-B5A3-F393-E0A9-E50E24DCCA9E',
  // Generic device info
  '0000180A-0000-1000-8000-00805F9B34FB',
  '0000180F-0000-1000-8000-00805F9B34FB',
];

// --- Standard BLE Services ---
export const STANDARD_SERVICES = {
  DEVICE_INFO: '0000180A-0000-1000-8000-00805F9B34FB',
  BATTERY:     '0000180F-0000-1000-8000-00805F9B34FB',
  HEART_RATE:  '0000180D-0000-1000-8000-00805F9B34FB',
};

// --- Write Characteristic UUIDs (common candidates) ---
export const WRITE_CHAR_UUIDS = [
  // ✅ Confirmed via nRF Connect (chhfegkj watch) — under service 0xAE00
  '0000AE01-0000-1000-8000-00805F9B34FB',
  '0000FEE9-0000-1000-8000-00805F9B34FB',
  '0000FFE1-0000-1000-8000-00805F9B34FB',
  '0000FF01-0000-1000-8000-00805F9B34FB',
  '6E400002-B5A3-F393-E0A9-E50E24DCCA9E',
];

// --- Notify Characteristic UUIDs (common candidates) ---
export const NOTIFY_CHAR_UUIDS = [
  // ✅ Confirmed via nRF Connect (chhfegkj watch) — under service 0xAE00
  '0000AE02-0000-1000-8000-00805F9B34FB',
  '0000FEE8-0000-1000-8000-00805F9B34FB',
  '0000FFE4-0000-1000-8000-00805F9B34FB',
  '0000FF02-0000-1000-8000-00805F9B34FB',
  '6E400003-B5A3-F393-E0A9-E50E24DCCA9E',
];

// ============================================================
// RESET / FACTORY RESET COMMAND PACKETS
// Format: [Header1, Header2, CMD, Length, ...Payload, Checksum]
// Multiple candidates — app will try all of them sequentially
// ============================================================
export const RESET_COMMANDS = [
  // Candidate 1: Common ODM factory reset (0xAB header, CMD=0x08)
  {
    name: 'ODM Factory Reset (AB header)',
    bytes: new Uint8Array([0xAB, 0x00, 0x04, 0xFF, 0x08, 0x00, 0x00, 0xFF]),
  },
  // Candidate 2: 55 AA style (Jieli protocol)
  {
    name: 'Jieli Reset (55 AA header)',
    bytes: new Uint8Array([0x55, 0xAA, 0x04, 0xFF, 0x01, 0x00, 0x00, 0x04]),
  },
  // Candidate 3: Da Fit / Heylink style reset
  {
    name: 'Da Fit Reset',
    bytes: new Uint8Array([0x01, 0x08, 0x00, 0x00]),
  },
  // Candidate 4: Short factory reset command
  {
    name: 'Short CMD Reset',
    bytes: new Uint8Array([0xFF, 0xFF, 0x01, 0x00]),
  },
  // Candidate 5: Reboot command (soft reset)
  {
    name: 'Soft Reboot',
    bytes: new Uint8Array([0xAB, 0x00, 0x04, 0xFF, 0x09, 0x00, 0x00, 0xFF]),
  },
];

// --- Sync Time Command Builder ---
export function buildTimeSyncPacket() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const h = now.getHours();
  const min = now.getMinutes();
  const s = now.getSeconds();
  // Common format: AB 00 0A FF 0B YH YL M D H Min S CRC
  const yH = (y >> 8) & 0xFF;
  const yL = y & 0xFF;
  const payload = [yH, yL, m, d, h, min, s];
  const checksum = payload.reduce((a, b) => a + b, 0) & 0xFF;
  return new Uint8Array([0xAB, 0x00, 0x09, 0xFF, 0x0B, ...payload, checksum]);
}

// --- Utility: bytes to hex string ---
export function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

// --- Utility: compute simple checksum ---
export function simpleChecksum(bytes) {
  return bytes.reduce((a, b) => (a + b) & 0xFF, 0);
}
