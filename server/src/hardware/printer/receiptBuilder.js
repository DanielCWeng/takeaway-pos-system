/**
 * hardware/printer/receiptBuilder.js
 *
 * Pure receipt formatting logic. No hardware I/O here.
 */

// ESC/POS command constants
const ESC = 0x1b;
const GS = 0x1d;

// Receipt formatting
const LINE_WIDTH = 42;
const LEGACY_COMMAND_TRANSLATIONS = Object.freeze({
  REMOVE: '\u8d70',
  LESS: '\u5c11',
  MORE: '\u52a0',
  WANT: '\u8981',
  ONLY: '\u53ea\u8981',
});

function rightAlign(left, right) {
  const r = typeof right === 'number' ? right.toFixed(2) : String(right);

  // Leave space for at least one blank character between text and price
  const maxLeft = Math.max(1, LINE_WIDTH - r.length - 1);
  
  if (left.length <= maxLeft) {
    const spaces = Math.max(0, LINE_WIDTH - left.length - r.length);
    return left + ' '.repeat(spaces) + r + '\n';
  }

  // Wrap text if it's too long
  let lines = [];
  let remaining = left;

  while (remaining.length > 0) {
    if (remaining.length <= maxLeft) {
      lines.push(remaining);
      break;
    }
    let breakIndex = remaining.lastIndexOf(' ', maxLeft);
    if (breakIndex <= 0) breakIndex = maxLeft; // hard break if no space
    lines.push(remaining.substring(0, breakIndex));
    remaining = remaining.substring(breakIndex).trimStart();
  }

  let result = '';
  for (let i = 0; i < lines.length; i++) {
    if (i === 0) {
      const spaces = Math.max(0, LINE_WIDTH - lines[i].length - r.length);
      result += lines[i] + ' '.repeat(spaces) + r + '\n';
    } else {
      // Indent subsequent lines slightly
      result += '  ' + lines[i] + '\n';
    }
  }
  return result;
}

function formatOrderType(raw) {
  if (!raw) return 'ORDER';
  const v = String(raw).toLowerCase();
  if (v === 'delivery') return 'DELIVERY';
  if (v === 'collection') return 'COLLECTION';
  return raw;
}

function containsNonAscii(text) {
  if (!text) return false;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) > 127) return true;
  }
  return false;
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toQuantity(value) {
  const num = Math.floor(Number(value));
  return Number.isFinite(num) && num > 0 ? num : 1;
}

function toText(value, fallback = '') {
  if (value == null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function formatMoney(value) {
  return toNumber(value, 0).toFixed(2);
}

function normalizeModifiers(rawModifiers) {
  const source = Array.isArray(rawModifiers) ? rawModifiers : [];
  const english = [];
  const chinese = [];

  for (const mod of source) {
    if (typeof mod === 'string') {
      const text = toText(mod);
      if (text) english.push(`(${text})`);
      continue;
    }
    if (!mod || typeof mod !== 'object') continue;

    const command = toText(mod.command);
    const ingredientEn = toText(mod.ingredient?.name ?? mod.name);
    const ingredientZh = toText(mod.ingredient?.zh ?? mod.zh);

    const englishParts = [command, ingredientEn].filter(Boolean);
    if (englishParts.length > 0) english.push(`(${englishParts.join(' ')})`);

    const translatedCommand = LEGACY_COMMAND_TRANSLATIONS[command.toUpperCase()] ?? command;
    const chineseParts = [translatedCommand, ingredientZh].filter(Boolean);
    if (chineseParts.length > 0) chinese.push(`(${chineseParts.join(' ')})`);
  }

  return { english, chinese };
}

/**
 * Convert text to a monochrome bitmap for printing (supports non-ASCII when a font is available).
 *
 * @param {{ createCanvas: Function }} canvasApi
 * @param {string} text
 * @param {{ fontSize?: number, align?: 'left'|'center'|'right', bold?: boolean }} opts
 * @returns {{ width: number, height: number, data: number[], bytesPerLine: number }}
 */
function textToBitmap(canvasApi, text, opts = {}) {
  const fontSize = opts.fontSize ?? 24;
  const align = opts.align ?? 'left';
  const bold = opts.bold ?? false;

  const width = 384; // common 58mm printer width in dots
  const canvas = canvasApi.createCanvas(width, fontSize * 2);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'black';
  const weight = bold ? '500 ' : '';
  ctx.font = `${weight}${fontSize}px "Noto Sans SC", "WenQuanYi Micro Hei", sans-serif`;
  ctx.textBaseline = 'top';

  let xPos = 0;
  const textWidth = ctx.measureText(text).width;
  if (align === 'center') xPos = (canvas.width - textWidth) / 2;
  if (align === 'right') xPos = canvas.width - textWidth;

  ctx.fillText(text, Math.max(0, xPos), 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let maxY = 0;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const idx = (y * canvas.width + x) * 4;
      const brightness =
        (imageData.data[idx] + imageData.data[idx + 1] + imageData.data[idx + 2]) / 3;
      if (brightness < 128) maxY = y;
    }
  }

  const actualHeight = Math.max(maxY + 1, fontSize);
  const bytesPerLine = Math.ceil(width / 8);
  const bitmapData = [];

  for (let y = 0; y < actualHeight; y++) {
    for (let byteIndex = 0; byteIndex < bytesPerLine; byteIndex++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = byteIndex * 8 + bit;
        if (x < width) {
          const idx = (y * canvas.width + x) * 4;
          const brightness =
            (imageData.data[idx] + imageData.data[idx + 1] + imageData.data[idx + 2]) / 3;
          if (brightness < 128) byte |= 1 << (7 - bit);
        }
      }
      bitmapData.push(byte);
    }
  }

  return { width, height: actualHeight, data: bitmapData, bytesPerLine };
}

/**
 * Convert a bitmap to ESC/POS raster image command bytes.
 *
 * @param {{ height: number, data: number[], bytesPerLine: number }} bitmap
 * @returns {Buffer}
 */
function bitmapToESCPOS(bitmap) {
  const height = bitmap.height;
  const bytesPerLine = bitmap.bytesPerLine;
  const xL = bytesPerLine & 0xff;
  const xH = (bytesPerLine >> 8) & 0xff;
  const yL = height & 0xff;
  const yH = (height >> 8) & 0xff;
  return Buffer.from([GS, 0x76, 0x30, 0x00, xL, xH, yL, yH, ...bitmap.data]);
}

function appendSolidLine(receiptParts, deps) {
  if (deps.canvasApi) {
    const width = 384;
    const height = 3; // 3px solid line
    const bytesPerLine = Math.ceil(width / 8);
    const data = new Array(bytesPerLine * height).fill(0xff);
    receiptParts.push(bitmapToESCPOS({ width, height, data, bytesPerLine }));
  } else {
    receiptParts.push(Buffer.from('-'.repeat(LINE_WIDTH) + '\n'));
  }
}

function appendBitmapOrText(receiptParts, deps, text, opts = {}) {
  const line = toText(text);
  if (!line) return;
  if (deps.canvasApi) {
    const bitmap = textToBitmap(deps.canvasApi, line, opts);
    receiptParts.push(bitmapToESCPOS(bitmap), Buffer.from('\n'));
    return;
  }
  receiptParts.push(Buffer.from(line + '\n'));
}

function computeSubtotal(items) {
  return items.reduce((sum, item) => {
    const qty = toQuantity(item?.quantity);
    const unitPrice =
      Number.isFinite(item?.finalPrice) && Number(item?.finalPrice) >= 0
        ? Number(item.finalPrice)
        : toNumber(item?.price, 0);
    return sum + qty * unitPrice;
  }, 0);
}

function computeDeliveryCharge(order, subtotal, total) {
  if (Number.isFinite(order?.deliveryCharge)) return Math.max(0, Number(order.deliveryCharge));
  if (String(order?.orderType ?? '').toLowerCase() !== 'delivery') return 0;
  const derived = total - subtotal;
  return derived > 0 ? derived : 0;
}

function getPaymentStatusLine(order) {
  const method = toText(order?.payment?.method).toLowerCase();
  if (method === 'cash') return '[X] Cash   [ ] Card';
  if (method === 'card') return '[ ] Cash   [X] Card';
  if (order?.paymentDetails) return '[X] Cash   [ ] Unpaid';
  return '[ ] Cash   [X] Unpaid';
}

/**
 * Build a receipt buffer for an archived order.
 *
 * @param {{ id?: number, data?: any, archivedAt?: string } | any} archivedOrder
 * @param {{ canvasApi: null | { createCanvas: Function } }} deps
 * @returns {Buffer}
 */
export function buildReceiptBuffer(archivedOrder, deps) {
  const order = archivedOrder?.data ?? archivedOrder;
  const items = Array.isArray(order?.items) ? order.items : [];
  const info = order?.customerInfo ?? {};

  // Use archivedAt so reprints show the original order time, not the reprint time.
  const now = archivedOrder?.archivedAt ? new Date(archivedOrder.archivedAt) : new Date();
  const dateStr = now.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
  const timeStr = now.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const subtotal = Number.isFinite(order?.subtotal)
    ? Number(order.subtotal)
    : computeSubtotal(items);
  const total = Number.isFinite(order?.total) ? Number(order.total) : subtotal;
  const deliveryCharge = computeDeliveryCharge(order, subtotal, total);
  const itemCount = items.reduce((sum, item) => sum + toQuantity(item?.quantity), 0);
  const orderTypeLabel = formatOrderType(order?.orderType);
  const orderId = archivedOrder?.id;

  const receiptParts = [];
  receiptParts.push(
    Buffer.from('\n\n\n'),
    Buffer.from([ESC, 0x40, ESC, 0x61, 0x01, ESC, 0x45, 0x01]),
    Buffer.from(`${dateStr}  ${timeStr}\n`),
    Buffer.from([ESC, 0x45, 0x00]),
  );
  appendSolidLine(receiptParts, deps);
  receiptParts.push(Buffer.from([ESC, 0x61, 0x00]));

  receiptParts.push(
    Buffer.from([ESC, 0x61, 0x01, ESC, 0x45, 0x01]),
    Buffer.from(orderId ? `${orderTypeLabel}  #${orderId}\n` : `${orderTypeLabel}\n`),
    Buffer.from([ESC, 0x61, 0x00, ESC, 0x45, 0x00]),
  );

  for (const item of items) {
    const qty = toQuantity(item?.quantity);
    const itemId = toText(item?.id);
    const englishName = toText(item?.name, 'Item');
    const zhName = toText(item?.zhName);
    const unitPrice =
      Number.isFinite(item?.finalPrice) && Number(item?.finalPrice) >= 0
        ? Number(item.finalPrice)
        : toNumber(item?.price, 0);
    const lineTotal = unitPrice * qty;
    const hidePrice = item?.hidePrice === true;
    const hideQuantity = item?.hideQuantity === true;
    const modifiers = normalizeModifiers(item?.modifiers);

    let englishLine = itemId ? `(${itemId}) ${englishName}` : englishName;
    if (item?.isSwapped === true) englishLine += ' (SWAP)';
    if (modifiers.english.length > 0) englishLine += ` ${modifiers.english.join(' ')}`;

    receiptParts.push(
      Buffer.from([ESC, 0x45, 0x01]),
      Buffer.from(rightAlign(englishLine, hidePrice ? '' : lineTotal)),
      Buffer.from([ESC, 0x45, 0x00]),
    );

    const quantityPrefix = hideQuantity ? '  ' : `${qty} `;
    if (zhName) {
      const chineseLine =
        modifiers.chinese.length > 0
          ? `${quantityPrefix}${zhName} ${modifiers.chinese.join(' ')}`
          : `${quantityPrefix}${zhName}`;
      appendBitmapOrText(receiptParts, deps, chineseLine, {
        fontSize: 48,
        align: 'left',
        bold: true,
      });
      continue;
    }

    if (containsNonAscii(englishName)) {
      appendBitmapOrText(receiptParts, deps, `${quantityPrefix}${englishName}`, {
        fontSize: 40,
        align: 'left',
        bold: true,
      });
    }
  }

  appendSolidLine(receiptParts, deps);

  receiptParts.push(
    Buffer.from([ESC, 0x61, 0x01, GS, 0x21, 0x11, ESC, 0x45, 0x01]),
    Buffer.from(`${itemCount} Items\n`),
    Buffer.from([ESC, 0x61, 0x00, GS, 0x21, 0x00, ESC, 0x45, 0x00]),
  );

  receiptParts.push(Buffer.from(rightAlign('Sub-total', subtotal)));
  if (String(order?.orderType ?? '').toLowerCase() === 'delivery') {
    receiptParts.push(Buffer.from(rightAlign('+Delivery', deliveryCharge)));
  }
  appendSolidLine(receiptParts, deps);

  receiptParts.push(
    Buffer.from([ESC, 0x61, 0x01, GS, 0x21, 0x22, ESC, 0x45, 0x01]),
    Buffer.from(`Total ${formatMoney(total)}\n`),
    Buffer.from([ESC, 0x61, 0x00, GS, 0x21, 0x00, ESC, 0x45, 0x00]),
  );

  appendSolidLine(receiptParts, deps);
  receiptParts.push(Buffer.from([ESC, 0x61, 0x00, GS, 0x21, 0x11]));

  if (toText(info?.mapRef)) receiptParts.push(Buffer.from(`Map ref: ${toText(info.mapRef)}\n`));

  if (Number.isFinite(info?.distance)) {
    receiptParts.push(Buffer.from(`Mileage: ${Number(info.distance).toFixed(2)} miles\n`));
  }

  if (toText(info?.name)) receiptParts.push(Buffer.from(`${toText(info.name)}\n`));
  if (toText(info?.houseNumber) && toText(info?.street)) {
    receiptParts.push(Buffer.from(`${toText(info.houseNumber)}, ${toText(info.street)}\n`));
  } else if (toText(info?.address)) {
    receiptParts.push(Buffer.from(`${toText(info.address)}\n`));
  }
  if (toText(info?.town)) receiptParts.push(Buffer.from(`${toText(info.town)}\n`));
  if (toText(info?.postcode))
    receiptParts.push(Buffer.from(`${toText(info.postcode).toUpperCase()}\n`));
  if (toText(info?.phone)) receiptParts.push(Buffer.from(`${toText(info.phone)}\n`));

  if (toText(info?.deliveryInstructions)) {
    receiptParts.push(Buffer.from(`Instructions: ${toText(info.deliveryInstructions)}\n`));
  }
  if (toText(order?.notes)) receiptParts.push(Buffer.from(`Notes: ${toText(order.notes)}\n`));

  if (toText(info?.deliveryTime)) {
    receiptParts.push(Buffer.from('\n'));
    receiptParts.push(
      Buffer.from([ESC, 0x61, 0x01, GS, 0x21, 0x11, ESC, 0x45, 0x01]),
      Buffer.from(`Time: ${toText(info.deliveryTime)}\n`),
      Buffer.from([ESC, 0x61, 0x00, GS, 0x21, 0x00, ESC, 0x45, 0x00]),
    );
  }

  receiptParts.push(Buffer.from([ESC, 0x64, 3]), Buffer.from([GS, 0x56, 0x00]));
  return Buffer.concat(receiptParts);
}
