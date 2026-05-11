/**
 * Print Ticket Utility — BarPos
 * Generates thermal-printer-friendly receipts using monospaced text layout.
 * Supports 58mm and 80mm paper widths.
 */
import type { Order } from './types';

// ─── Character widths per paper size ────────────────────────────────────────
// Calculated for bold Courier New at print resolution:
//   58mm usable ~54mm (~204px) ÷ (13px × 0.6) ≈ 26 chars → use 24 (safe)
//   80mm usable ~74mm (~280px) ÷ (15px × 0.6) ≈ 31 chars → use 30 (safe)
const CHARS_80MM = 30;
const CHARS_58MM = 24;

export type PaperSize = '58mm' | '80mm';

// ─── Text formatting helpers ────────────────────────────────────────────────

/** Center text within the given character width */
const centerText = (text: string, width: number): string => {
  const padding = Math.floor((width - text.length) / 2);
  return ' '.repeat(Math.max(0, padding)) + text;
};

/** Create a horizontal separator line */
const separator = (char = '-', width: number): string => char.repeat(width);

/** Format a line with left-aligned and right-aligned text */
const formatLine = (left: string, right: string, width: number): string => {
  const spaces = width - left.length - right.length;
  return left + ' '.repeat(Math.max(1, spaces)) + right;
};

/** Word-wrap text to avoid breaking mid-word on narrow tickets */
const wrapText = (text = '', width: number): string[] => {
  const normalized = String(text || '').trim();
  if (!normalized) return [];

  const words = normalized.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    if (!current) {
      if (word.length <= width) {
        current = word;
      } else {
        for (let i = 0; i < word.length; i += width) {
          lines.push(word.slice(i, i + width));
        }
      }
      return;
    }

    const next = `${current} ${word}`;
    if (next.length <= width) {
      current = next;
    } else {
      lines.push(current);
      if (word.length <= width) {
        current = word;
      } else {
        for (let i = 0; i < word.length; i += width) {
          const chunk = word.slice(i, i + width);
          if (chunk.length === width) {
            lines.push(chunk);
            current = '';
          } else {
            current = chunk;
          }
        }
      }
    }
  });

  if (current) lines.push(current);
  return lines;
};

/** Push a label + value pair; if value fits inline use formatLine, otherwise wrap below */
const pushLabeledValue = (lines: string[], label: string, value: string, width: number): void => {
  const safeLabel = `${label}`;
  const safeValue = `${value ?? ''}`.trim();

  const inlineMinSpace = 8;
  const inlineWidth = width - safeLabel.length - 1;
  if (safeValue && inlineWidth >= inlineMinSpace && safeValue.length <= inlineWidth) {
    lines.push(formatLine(safeLabel, safeValue, width));
    return;
  }

  lines.push(safeLabel);
  const wrapped = wrapText(safeValue || '-', Math.max(10, width - 2));
  wrapped.forEach((line) => lines.push(`  ${line}`));
};

/** Format a money amount */
const formatMoney = (amount: number): string => `$${amount.toFixed(2)}`;

/** Escape HTML entities for safe injection into print document */
const escapeHtml = (text = ''): string =>
  String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// ─── Ticket generation ─────────────────────────────────────────────────────

type PrintOptions = {
  order: Order;
  subtotal: number;
  tipAmount: number;
  tipPercent?: number; // Decimal e.g. 0.15 for 15%
  total: number;
  perPerson?: number;
  paperSize?: PaperSize;
  businessName?: string;
  businessAddress?: string;
  businessPhone?: string;
};

/**
 * Generate the text content for a "Pase de Salida" ticket.
 * Works for both 58mm and 80mm by switching the character width.
 */
export const generateTicketContent = (opts: PrintOptions): string => {
  const {
    order,
    subtotal,
    tipAmount,
    tipPercent,
    total,
    perPerson,
    paperSize = '80mm',
    businessName,
    businessAddress,
    businessPhone,
  } = opts;

  const W = paperSize === '58mm' ? CHARS_58MM : CHARS_80MM;
  const lines: string[] = [];
  const s = (char = '-') => separator(char, W);
  const c = (text: string) => centerText(text, W);

  // ── Header ────────────────────────────────────────────────────────────────
  lines.push(s('='));
  lines.push(c('PASE DE SALIDA'));
  lines.push(c((businessName || 'ChepeChupes').toUpperCase()));
  lines.push(s('='));
  lines.push('');

  // ── Order info ────────────────────────────────────────────────────────────
  pushLabeledValue(lines, 'Fecha:', new Date().toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }), W);

  const statusLabel = order.status === 'pagado' ? 'PAGADO' : order.status === 'cancelado' ? 'CANCELADO' : 'PENDIENTE';
  pushLabeledValue(lines, 'Estado:', statusLabel, W);

  // For 80mm show full ID, for 58mm truncate
  const ticketId = paperSize === '58mm' ? (order.id?.substring(0, 8) || 'N/A') : (order.id || 'N/A');
  pushLabeledValue(lines, 'Ticket ID:', ticketId, W);

  if (Array.isArray(order.payments) && order.payments.length > 0) {
    if (order.payments.length === 1) {
      const p = order.payments[0];
      const paymentInfo = `${p.method}${p.receivedAmount ? ' $' + Number(p.receivedAmount).toFixed(2) : ''}`;
      pushLabeledValue(lines, 'Pago:', paymentInfo, W);
    } else {
      pushLabeledValue(lines, 'Pago:', 'Mixto', W);
      order.payments.forEach(p => {
        lines.push(`  ${p.method}: ${p.amount ? '$' + p.amount.toFixed(2) : ''}`);
      });
    }
  }

  lines.push('');
  lines.push(s());

  // ── Table / Waiter / People ───────────────────────────────────────────────
  const mesaLabel = order.tableNumber === 0 ? 'Barra' : 'Mesa';
  const mesaValue = order.tableNumber === 0 ? 'Principal' : String(order.tableNumber);
  pushLabeledValue(lines, `${mesaLabel}:`, mesaValue, W);
  pushLabeledValue(lines, 'Mesero:', order.waiterName, W);
  pushLabeledValue(lines, 'Personas:', String(order.peopleCount ?? 1), W);

  lines.push(s());
  lines.push('');

  // ── Items header ────────────────────────────────────────────
  lines.push('ARTICULOS');
  lines.push(s());

  // ── Items ───────────────────────────────────────────────────
  const activeItems = order.items.filter(i => !i.isDeleted);
  activeItems.forEach(item => {
    const qty = item.quantity;
    const lineTotal = item.productPrice * qty;
    const name = item.productName;

    // Same layout for both paper sizes: wrap name then show importe inline
    wrapText(`${qty}x ${name}`, W).forEach(line => lines.push(line));
    pushLabeledValue(lines, '  Importe:', formatMoney(lineTotal), W);
  });

  lines.push(s());
  lines.push('');

  // ── Totals ────────────────────────────────────────────────────────────────
  pushLabeledValue(lines, 'Subtotal:', formatMoney(subtotal), W);

  const tipLabel = typeof tipPercent === 'number' && tipPercent > 0
    ? `Propina (${(tipPercent * 100).toFixed(0)}%):`
    : 'Propina:';
  pushLabeledValue(lines, tipLabel, formatMoney(tipAmount), W);

  lines.push(s('='));
  pushLabeledValue(lines, 'TOTAL:', formatMoney(total), W);
  lines.push(s('='));

  // ── Per-person ────────────────────────────────────────────────────────────
  if (typeof perPerson === 'number') {
    lines.push('');
    pushLabeledValue(lines, 'Por persona:', formatMoney(perPerson), W);
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  lines.push('');
  lines.push(s());
  lines.push(c('Gracias por su preferencia'));
  lines.push(s());

  if (businessAddress) {
    lines.push('');
    wrapText(businessAddress, W).forEach(line => lines.push(c(line)));
  }
  if (businessPhone) {
    lines.push(c(`Tel: ${businessPhone}`));
  }

  // Fallback defaults
  if (!businessAddress && !businessPhone) {
    lines.push('');
    wrapText('Prof. Mercedes Camacho 82, Praderas del Sol', W).forEach(line => lines.push(c(line)));
    lines.push(c('Tel: 427-123-4567'));
  }

  lines.push('');

  return lines.join('\n');
};

// ─── Print dispatch ─────────────────────────────────────────────────────────

/**
 * Send pre-formatted monospaced text content to the printer via a hidden iframe.
 * The iframe approach avoids popup-blocker issues on mobile browsers.
 */
const sendToPrinter = (ticketContent: string, paperSize: PaperSize = '80mm', title = 'Pase de Salida'): void => {
  const sizeMm = paperSize === '58mm' ? '58mm' : '80mm';
  const fontSize = paperSize === '58mm' ? '13px' : '15px';
  const lineHeight = '1.4';
  const padding = paperSize === '58mm' ? '2mm' : '3mm';

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page {
        margin: 0;
        size: ${sizeMm} auto;
      }
      body {
        width: ${sizeMm};
        box-sizing: border-box;
        font-family: 'Courier New', 'Courier', monospace;
        font-size: ${fontSize};
        font-weight: bold;
        line-height: ${lineHeight};
        margin: 0;
        padding: ${padding};
        white-space: pre-wrap;
        word-wrap: break-word;
        color: #000;
        -webkit-print-color-adjust: exact;
      }
      @media print {
        body {
          margin: 0;
          padding: ${padding};
        }
      }
    </style>
  </head>
  <body>${escapeHtml(ticketContent)}</body>
</html>`;

  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    iframe.srcdoc = html;

    document.body.appendChild(iframe);

    iframe.onload = () => {
      try {
        const win = iframe.contentWindow;
        if (!win) throw new Error('No iframe window');
        win.focus();
        setTimeout(() => {
          try {
            win.print();
          } catch (e) {
            console.warn('Error printing from iframe', e);
          }
          setTimeout(() => {
            try { document.body.removeChild(iframe); } catch (_) { /* ignore */ }
          }, 1000);
        }, 300);
      } catch (e) {
        console.error('Iframe print failed', e);
        try { document.body.removeChild(iframe); } catch (_) { /* ignore */ }
      }
    };
  } catch (err) {
    alert('No se pudo iniciar la impresión. Revisa el bloqueador de ventanas emergentes o prueba guardar como PDF.');
  }
};

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate and print a ticket. Defaults to 58mm but accepts paperSize option.
 * This is the primary function that all Checkout pages should call.
 */
export const printTicket = (opts: PrintOptions): void => {
  const paperSize = opts.paperSize || '58mm';
  const ticketContent = generateTicketContent({ ...opts, paperSize });
  sendToPrinter(ticketContent, paperSize);
};

/** Alias for printTicket with 80mm default — keeps backward compatibility with existing imports */
export const printTicket80mm = (opts: Omit<PrintOptions, 'paperSize'>): void => {
  printTicket({ ...opts, paperSize: '80mm' });
};

/** Alias for printTicket with 58mm */
export const printTicket58mm = (opts: Omit<PrintOptions, 'paperSize'>): void => {
  printTicket({ ...opts, paperSize: '58mm' });
};

export default printTicket80mm;
