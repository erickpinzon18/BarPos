/**
 * Print Delivery Ticket Utility — BarPos
 * Ticket "PARA LLEVAR" combinado (cocina + barra) para pedidos a domicilio.
 * Se imprime una sola vez, al cerrar el pedido y enviarlo a cocina.
 */
import type { DeliveryOrder } from './types';
import { centerText, separator, formatLine, wrapText, pushLabeledValue, formatMoney, sendToPrinter } from './printTicket';
import type { PaperSize } from './printTicket';

const CHARS_80MM = 30;
const CHARS_58MM = 24;

type PrintDeliveryOptions = {
  order: DeliveryOrder;
  subtotal: number;
  total: number;
  paperSize?: PaperSize;
  businessName?: string;
};

export const generateDeliveryTicketContent = (opts: PrintDeliveryOptions): string => {
  const { order, subtotal, total, paperSize = '80mm', businessName } = opts;
  const W = paperSize === '58mm' ? CHARS_58MM : CHARS_80MM;
  const lines: string[] = [];
  const s = (char = '-') => separator(char, W);
  const c = (text: string) => centerText(text, W);

  lines.push(s('='));
  lines.push(c('PARA LLEVAR'));
  lines.push(c((businessName || 'La Fogata').toUpperCase()));
  lines.push(s('='));
  lines.push('');

  if (order.folio) pushLabeledValue(lines, 'Folio:', order.folio, W);
  pushLabeledValue(lines, 'Hora entrega:', order.deliveryTime, W);
  pushLabeledValue(lines, 'Mesero:', order.waiterName, W);
  lines.push('');

  if (order.contactPhone) {
    lines.push(formatLine(order.customerName, order.contactPhone, W));
  } else {
    wrapText(order.customerName, W).forEach((line) => lines.push(line));
  }
  wrapText(order.address, W).forEach((line) => lines.push(line));

  lines.push(s());
  lines.push('');

  const activeItems = (order.items || []).filter((i) => !i.isDeleted);
  activeItems.forEach((item) => {
    const qty = item.quantity;
    const lineTotal = item.productPrice * qty;
    wrapText(`${qty}x ${item.productName}`, W).forEach((line) => lines.push(line));
    pushLabeledValue(lines, '  Importe:', formatMoney(lineTotal), W);

    const serviceMatch = (item.notes || '').match(/^Servicios:\s*(.+)$/s);
    if (serviceMatch) {
      serviceMatch[1].split(',').map((s2) => s2.trim()).filter(Boolean).forEach((svc) => {
        wrapText(`  > ${svc}`, W).forEach((l) => lines.push(l));
      });
    } else if (item.notes) {
      wrapText(`  Nota: ${item.notes}`, W).forEach((l) => lines.push(l));
    }
  });

  lines.push(s());
  pushLabeledValue(lines, 'Subtotal:', formatMoney(subtotal), W);
  lines.push(s('='));
  pushLabeledValue(lines, 'TOTAL A COBRAR:', formatMoney(total), W);
  lines.push(s('='));

  lines.push('');
  lines.push(c('Gracias por su preferencia'));
  lines.push('');

  return lines.join('\n');
};

export const printDeliveryTicket = (opts: PrintDeliveryOptions): void => {
  const paperSize = opts.paperSize || '58mm';
  const content = generateDeliveryTicketContent({ ...opts, paperSize });
  sendToPrinter(content, paperSize, 'Para Llevar', paperSize === '58mm' ? '15px' : '17px');
};
