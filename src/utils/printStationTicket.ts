import { sendToPrinter, type PaperSize } from './printTicket';

export interface StationTicketItem {
  productName: string;
  quantity: number;
  notes?: string;
}

export interface StationTicketOptions {
  station: 'cocina' | 'barra';
  tableNumber: number | string;
  tableName?: string;
  waiterName: string;
  items: StationTicketItem[];
  paperSize?: PaperSize;
  isCancellation?: boolean;
  swapFrom?: string; // nombre del producto que se reemplaza
}

const CHARS_80MM = 22;
const CHARS_58MM = 20;
const FONT_80MM = '20px';
const FONT_58MM = '16px';

const center = (text: string, W: number): string => {
  const pad = Math.max(0, Math.floor((W - text.length) / 2));
  return ' '.repeat(pad) + text;
};

const sep = (char: string, W: number): string => char.repeat(W);

const wrap = (text: string, W: number): string[] => {
  const words = String(text || '').trim().split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    if (!cur) { cur = word; continue; }
    const next = `${cur} ${word}`;
    if (next.length <= W) { cur = next; } else { lines.push(cur); cur = word; }
  }
  if (cur) lines.push(cur);
  return lines;
};

export const printStationTicket = (opts: StationTicketOptions): void => {
  const { station, tableNumber, tableName, waiterName, items, paperSize = '58mm', isCancellation = false } = opts;
  const W = paperSize === '58mm' ? CHARS_58MM : CHARS_80MM;
  const stationLabel = station === 'cocina' ? 'COCINA' : 'BARRA';
  const lines: string[] = [];

  lines.push(sep('=', W));
  if (isCancellation) {
    lines.push(center('*** CANCELACIÓN ***', W));
    lines.push(center(stationLabel, W));
  } else if (opts.swapFrom) {
    lines.push(center(stationLabel, W));
    lines.push(center('CAMBIO SERVICIO', W));
  } else {
    lines.push(center(stationLabel, W));
  }
  lines.push(sep('=', W));

  const mesaLabel = tableNumber === 0
    ? 'Barra Principal'
    : tableName && tableName !== `Mesa ${tableNumber}`
      ? `Mesa ${tableNumber} - ${tableName}`
      : `Mesa ${tableNumber}`;
  lines.push(mesaLabel);
  lines.push(`Mesero: ${waiterName}`);

  const now = new Date();
  const time = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
  const date = now.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' });
  lines.push(`${date}  ${time}`);

  lines.push(sep('-', W));

  if (opts.swapFrom) {
    for (const item of items) {
      wrap(`${item.quantity}x ${item.productName}`, W).forEach(l => lines.push(l));
      wrap(`(cambio de: ${opts.swapFrom})`, W).forEach(l => lines.push(`   ${l}`));
    }
    lines.push(sep('-', W));
    const fontSize = paperSize === '58mm' ? FONT_58MM : FONT_80MM;
    sendToPrinter(lines.join('\n'), paperSize, stationLabel, fontSize);
    return;
  }

  for (const item of items) {
    const prefix = isCancellation ? `- CANCELADO: ${item.quantity}x` : `${item.quantity}x`;
    wrap(`${prefix} ${item.productName}`, W).forEach(l => lines.push(l));
    if (item.notes?.trim()) {
      const notes = item.notes.trim();
      const serviciosMatch = notes.match(/^Servicios:\s*(.+)$/s);
      if (serviciosMatch) {
        lines.push(`   -> Servicios:`);
        serviciosMatch[1].split(',').forEach(svc => {
          const s = svc.trim();
          if (s) wrap(s, W - 6).forEach(l => lines.push(`      ${l}`));
        });
      } else {
        wrap(`-> ${notes}`, W - 3).forEach(l => lines.push(`   ${l}`));
      }
    }
  }

  lines.push(sep('-', W));

  const fontSize = paperSize === '58mm' ? FONT_58MM : FONT_80MM;
  sendToPrinter(lines.join('\n'), paperSize, stationLabel, fontSize);
};
