Here is the updated AGENT.md file, now containing a dedicated section for native and web-based ESC/POS thermal printer access logic. It covers direct USB raw printing via Node.js (for Electron) and the WebUSB API (for browser-based PWAs) without requiring external drivers.
------------------------------

# Engineering Specification: Minimalist List POS Terminal
This document serves as the architecture blueprint and development specification for building a custom, offline-first, high-density retail POS application optimized for Windows/Web deployment and physical USB barcode inputs.
## 1. System Architecture
The application operates on an offline-first paradigm, prioritizing immediate local data mutations and UI rendering before syncing state to the cloud asynchronously.
### Target Platforms*   **Desktop (Windows Primary):** Electron shell wrapping a modern web frontend.*   **Web (Universal Fallback):** Progressive Web App (PWA) operating via Service Workers.
### Data Storage Strategy*   **Electron Environment:** Embedded **SQLite** database file stored locally on the client machine. This eliminates browser storage limitations and guarantees indefinite data retention.*   **PWA Environment:** Browser-based **IndexedDB** utilizing the Dexie.js wrapper for structured transaction logging and high-speed catalog caching.


+-----------------------------------------------------------------------+

|                         MINIMALIST USER INTERFACE                     |
|                   (React, Vue, or Vanilla HTML/JS CSS)                 |
+-----------------------------------------------------------------------+
                                   |
                                   v
+-----------------------------------------------------------------------+

|                    LOCAL DATA LAYER (100% OFFLINE)                    |
|       Windows App: Electron + SQLite  |  Web PWA: Browser + IndexedDB  |
+-----------------------------------------------------------------------+
                                   |
                                   v (When internet is available)
+-----------------------------------------------------------------------+

|                    CLOUD SYNC (Background Workers)                    |
+-----------------------------------------------------------------------+

------------------------------
## 2. Minimalist UI Wireframe & Layout Grid
The interface enforces a maximum text-density layout. Graphical assets, product photos, and promotional banners are strictly omitted to guarantee rendering times under 10ms.
## Terminal Grid Structure

[ Active Search/Scan Input Field (Autofocused) ]
-------------------------------------------------------------------------
[QTY] | [ITEM DESCRIPTION / SKU]               | [UNIT]   | [TOTAL]
-------------------------------------------------------------------------
 1    | Mens Crewneck Sweatshirt - Black (M)    | $45.00   | $45.00

      | SKU: 8472910-BLK-M                     |          |
 2    | Athletic Crew Socks - White (Pack of 3) | $12.00   | $24.00

      | SKU: 1029384-WHT-O                     |          |
-------------------------------------------------------------------------
[Subtotal: $69.00]  [Tax: $5.52]  [TOTAL: $74.52] -> (Shortcut: F2 to Pay)

## Layout Constraints

   1. Dual-Row Item Layout: The main text row holds quantities, descriptions, and dynamic price evaluations. The sub-row retains the strict identifier details (SKU/Barcode) in a low-contrast #666666 or #888888 small font.
   2. Sticky Totals Block: Fixed to the bottom-right viewport. It must never move out of sight, ensuring visual tracking of balances throughout rapid checkout sequences.
   3. Active Focus: The global document structure must default to a centralized search engine or an omni-channel scan parser.

------------------------------
## 3. High-Speed USB Barcode Scanner Event Loop
Most USB barcode scanners operate in HID Keyboard Emulation Mode, inputting alphanumeric characters rapidly, followed by an instruction carriage return (Enter / \n). [1] 
The listener script handles background capturing globally. It profiles key timings to isolate hardware-based input from manually entered keyboard strokes.
## Global Scanner Input Listener

/**
 * Global Barcode Hardware Scanner Capture Script
 * Prevents the need to focus a specific input field during checkout.
 */let scanBuffer = '';let lastKeyTime = Date.now();const SCAN_TIMEOUT = 50; // Threshold (ms) to differentiate hardware from human typing

window.addEventListener('keydown', (e) => {
  const currentTime = Date.now();
  
  // Reset buffer if delay indicates manual human input
  if (currentTime - lastKeyTime > SCAN_TIMEOUT) {
    scanBuffer = '';
  }
  
  lastKeyTime = currentTime;

  // Process completed barcode block
  if (e.key === 'Enter') {
    if (scanBuffer.length > 2) {
      processBarcodeScan(scanBuffer);
      scanBuffer = ''; // Flush buffer for subsequent scanning sequences
      e.preventDefault();
      e.stopPropagation();
    }
    return;
  }

  // Intercept string values, discarding Control/Function/Shift elements
  if (e.key.length === 1) {
    scanBuffer += e.key;
  }
});
function processBarcodeScan(sku) {
  console.log(`[Hardware Scan Detected]: ${sku}`);
  // Dispatch Event to Local Database Router
  window.dispatchEvent(new CustomEvent('barcode-scanned', { detail: { sku } }));
}

------------------------------
## 4. Local Printer Access Logic (ESC/POS Thermal Printing)
To ensure zero external dependencies and fast printing speeds, the application generates raw ESC/POS byte commands locally and transmits them straight to the USB thermal receipt printer via its raw endpoint.
## Common ESC/POS Command Constants (Buffer Sequences)

const ESC_POS = {
  INIT:          Uint8Array.from([0x1B, 0x40]),               // Initialize printer
  ALIGN_LEFT:    Uint8Array.from([0x1B, 0x61, 0x00]),         // Left alignment
  ALIGN_CENTER:  Uint8Array.from([0x1B, 0x61, 0x01]),         // Center alignment
  TXT_NORMAL:    Uint8Array.from([0x1D, 0x21, 0x00]),         // Normal font size
  TXT_DOUBLE:    Uint8Array.from([0x1D, 0x21, 0x11]),         // Double height + width font
  DRAWER_KICK:   Uint8Array.from([0x1B, 0x70, 0x00, 0x19, 0xFA]), // Kick cash drawer 1
  PAPER_CUT:     Uint8Array.from([0x1D, 0x56, 0x41, 0x03]),   // Partial cut with feed
  FEED_3_LINES:  Uint8Array.from([0x1B, 0x64, 0x03])          // Feed 3 lines
};

## Option A: Electron (Node-USB Backend Implementation)
In an Electron backend, use the native usb npm library to target the printer's interface endpoint directly, avoiding the slow Windows print spooler.

const { usb } = require('usb');
function printReceiptElectron(rawBufferData) {
  // Find thermal printer (Replace with target VendorID and ProductID)
  const printer = usb.findByIds(0x04b8, 0x0202); // Typical Epson constants
  
  if (!printer) {
    console.error('Physical receipt printer not found.');
    return;
  }

  printer.open();
  const iface = printer.interfaces[0];
  
  // Detach OS driver if bound
  if (iface.isKernelDriverActive()) {
    iface.detachKernelDriver();
  }
  
  iface.claim();
  
  // Track down the OUT bulk endpoint
  const outEndpoint = iface.endpoints.find(e => e.direction === 'out');
  
  outEndpoint.transfer(rawBufferData, (err) => {
    if (err) console.error('Print buffer transfer failed:', err);
    iface.release((releaseErr) => {
      if (releaseErr) console.error(releaseErr);
      printer.close();
    });
  });
}

## Option B: Web PWA (WebUSB Browser Frontend Implementation)
For a pure web app execution context, request access to the direct raw USB channel via Chrome/Edge WebUSB APIs.

async function printReceiptWebUSB(rawBufferData) {
  try {
    // Prompts user to select device if not previously granted
    const device = await navigator.usb.requestDevice({ 
      filters: [{ classCode: 7 }] // Class 7 strictly targets printers
    });

    await device.open();
    await device.selectConfiguration(1);
    await device.claimInterface(0);

    // Endpoint 1 or 2 is typically allocated for bulk data transfer out
    await device.transferOut(1, rawBufferData);
    
    await device.releaseInterface(0);
    await device.close();
  } catch (error) {
    console.error('WebUSB hardware stream aborted:', error);
  }
}

## Helper: Compiling Receipt Text Streams to Raw Bytes

function compileReceiptPayload(cartItems, totalText) {
  const encoder = new TextEncoder();
  const chunks = [];

  // 1. Kick cash drawer and clear printer state
  chunks.push(ESC_POS.DRAWER_KICK, ESC_POS.INIT, ESC_POS.ALIGN_CENTER);
  
  // 2. Main Header
  chunks.push(ESC_POS.TXT_DOUBLE, encoder.encode("RETAIL STORE\n"), ESC_POS.TXT_NORMAL);
  chunks.push(encoder.encode("Offline Terminal #01\n"), encoder.encode("-".repeat(32) + "\n"), ESC_POS.ALIGN_LEFT);

  // 3. Dynamic Dense Item Matrix Rows
  cartItems.forEach(item => {
    const qtyPriceStr = `${item.qty} x $${(item.unit_price / 100).toFixed(2)}`;
    const lineTotalStr = `$${(item.total_cents / 100).toFixed(2)}`;
    
    // Space pad rows dynamically to match typical 32/42 column parameters
    const totalSpacesNeeded = 32 - qtyPriceStr.length - lineTotalStr.length;
    const padding = " ".repeat(Math.max(1, totalSpacesNeeded));
    
    chunks.push(encoder.encode(`${item.title}\n`));
    chunks.push(encoder.encode(`${qtyPriceStr}${padding}${lineTotalStr}\n`));
  });

  // 4. Totals Footer, Paper Feed, and Clean Mechanical Cut
  chunks.push(ESC_POS.ALIGN_CENTER, encoder.encode("-".repeat(32) + "\n"));
  chunks.push(ESC_POS.TXT_DOUBLE, encoder.encode(`TOTAL: ${totalText}\n`), ESC_POS.TXT_NORMAL);
  chunks.push(ESC_POS.FEED_3_LINES, ESC_POS.PAPER_CUT);

  // Merge segments into one unified flat ArrayBuffer
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const resultBuffer = new Uint8Array(totalLength);
  let offset = 0;
  chunks.forEach(chunk => {
    resultBuffer.set(chunk, offset);
    offset += chunk.length;
  });

  return resultBuffer;
}

------------------------------
## 5. Offline Database Schema (SQLite / IndexedDB)
To prevent rounding and floating-point errors common to monetary operations, all pricing elements must be formatted and stored strictly as integers representing cents ($10.00 becomes 1000).

-- Local Inventory Cache: Optimized for instant SKU indexesCREATE TABLE local_inventory (
    sku TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    unit_price INTEGER NOT NULL,   -- Evaluated in cents (e.g., $19.99 = 1999)
    tax_rate REAL DEFAULT 0.08     -- Local contextual tax computation
);
-- Offline Transaction Queue: Staged for background uploadingCREATE TABLE offline_sales (
    id TEXT PRIMARY KEY,           -- Universally Unique Identifier (UUIDv4) generated offline
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    cart_json TEXT NOT NULL,       -- Serialized snapshot array of checkout items
    total_cents INTEGER NOT NULL,  -- Calculated order total value in cents
    synced INTEGER DEFAULT 0       -- Sync Flag: 0 = Local Only, 1 = Pushed to Cloud Server
);
-- Indexes for performance fine-tuningCREATE INDEX idx_inventory_sku ON local_inventory(sku);CREATE INDEX idx_sales_sync_status ON offline_sales(synced);

------------------------------
## 6. Global Keyboard Shortcuts Matrix
To avoid latency induced by mouse operations, terminal execution relies on a dedicated functional hotkey architecture:

| Physical Key | Interface Action Mapping | Operational Execution Scope |
|---|---|---|
| F1 | Reset Checkout State | Clears out-of-bounds line arrays and resets cart payload to zero. |
| F2 | Trigger Settlement | Launches payment dialog/tender processing overlay. |
| F3 | Modify Selected Target | Activates discount window or adjustments for active highlighted line row. |
| + | Increment Unit Count | Multiplies the active row quantity element by +1. |
| - | Decrement Unit Count | Multiplies the active row quantity element by -1. Drops item if count reaches 0. |


***