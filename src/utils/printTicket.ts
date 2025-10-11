// Helper to render a simple 80mm ticket HTML and open it in a new tab for printing
import type { Order } from '../utils/types';

type PrintOptions = {
  order: Order;
  subtotal: number;
  tipAmount: number;
  tipPercent?: number; // Optional percentage as decimal (e.g., 0.15 for 15%)
  total: number;
  perPerson?: number;
};

export const printTicket80mm = (opts: PrintOptions) => {
  const { order, subtotal, tipAmount, tipPercent, total, perPerson } = opts;

  // Build minimal, print-focused HTML. Use inline CSS sized for 80mm (~3.15 inches).
  const html = `
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>Pase de Salida</title>
      <style>
        @page { size: 80mm auto; margin: 4mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; width: 80mm; margin:0; padding:0; color: #111; }
        .ticket { padding: 6px; }
        .center { text-align:center; }
        h1 { margin: 6px 0; font-size: 24px; }
        .muted { color: #666; font-size: 19px; }
        .small { font-size: 20px; }
        .row { display:flex; justify-content:space-between; margin:6px 0; }
        .divider { border-top:1px dashed #ccc; margin:6px 0; }
        .total { font-weight:700; font-size:24px; }
      </style>
    </head>
    <body>
      <div class="ticket">
        <div class="center">
          <h1>PASE DE SALIDA</h1>
          <div class="muted small">ChepeChupes</div>
            <div class="muted small">Fecha: ${new Date().toLocaleString()}</div>
            <div class="muted small">Estado: ${order.status === 'pagado' ? 'PAGADO' : order.status === 'cancelado' ? 'CANCELADO' : 'PENDIENTE'}</div>
            <div class="muted small">Ticket ID: ${order.id}</div>
            ${Array.isArray(order.payments) && order.payments.length > 0 ? `<div class="muted small">Pago: ${order.payments[0].id} — ${order.payments[0].method} ${order.payments[0].receivedAmount ? '$' + Number(order.payments[0].receivedAmount).toFixed(2) : ''}</div>` : ''}
        </div>

        <div class="divider"></div>

        <div class="row"><div>${order.tableNumber === 0 ? 'Barra' : 'Mesa'}</div><div>${order.tableNumber === 0 ? 'Principal' : order.tableNumber}</div></div>
        <div class="row"><div>Mesero</div><div>${order.waiterName}</div></div>
        <div class="row"><div>Personas</div><div>${order.peopleCount ?? 1}</div></div>

        <div class="divider"></div>

        <div class="small muted">Items</div>
        ${order.items.filter(i => !i.isDeleted).map(i => `<div class="row"><div>${i.quantity}x ${i.productName}</div><div>$${(i.productPrice * i.quantity).toFixed(2)}</div></div>`).join('')}

        <div class="divider"></div>

        <div class="row"><div>Subtotal</div><div>$${subtotal.toFixed(2)}</div></div>
        <div class="row"><div>Propina${typeof tipPercent === 'number' && tipPercent > 0 ? ` (${(tipPercent * 100).toFixed(0)}%)` : ''}</div><div>$${tipAmount.toFixed(2)}</div></div>
        <div class="row total"><div>TOTAL</div><div>$${total.toFixed(2)}</div></div>

        ${typeof perPerson === 'number' ? `<div class="divider"></div><div class="row"><div>Total por persona</div><div>$${perPerson.toFixed(2)}</div></div>` : ''}

        <div class="divider"></div>
    <div class="center muted small">Prof. Mercedes Camacho 82, Praderas del Sol</div>
        <div class="center muted small">Tel: 427-123-4567</div>
      </div>
    </body>
  </html>
  `;

//   // Try to open a new tab/window. If blocked by popup blocker, fall back to printing from an invisible iframe.
//   const newWindow = window.open('', '_blank', 'noopener');
//   if (newWindow) {
//     try {
//       newWindow.document.open();
//       newWindow.document.write(html);
//       newWindow.document.close();
//       // Try to focus and print (may still be subject to browser policies)
//       newWindow.focus();
//       // Some browsers require a short delay before calling print
//       setTimeout(() => {
//         try {
//           newWindow.print();
//         } catch (e) {
//           // ignore
//         }
//       }, 300);
//       return;
//     } catch (err) {
//       // fall through to iframe approach
//       console.warn('Fallo imprimiendo desde nueva ventana, intentando iframe fallback', err);
//     }
//   }

  // Fallback: inject a hidden iframe into the current document and print from it.
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
        // Delay slightly to ensure resources/rendering ready
        setTimeout(() => {
          try {
            win.print();
          } catch (e) {
            console.warn('Error printing from iframe', e);
          }
          // Remove iframe after printing attempt
          setTimeout(() => {
            try { document.body.removeChild(iframe); } catch (e) { /* ignore */ }
          }, 1000);
        }, 300);
      } catch (e) {
        console.error('Fallback iframe print failed', e);
        try { document.body.removeChild(iframe); } catch (e) { /* ignore */ }
      }
    };
  } catch (err) {
    alert('No se pudo iniciar la impresión. Revisa el bloqueador de ventanas emergentes o prueba guardar como PDF.');
  }
};

// Helper to render a 58mm ticket HTML and open it in a new tab for printing
export const printTicket58mm = (opts: PrintOptions) => {
  const { order, subtotal, tipAmount, tipPercent, total, perPerson } = opts;

  // Build minimal, print-focused HTML. Use inline CSS sized for 58mm (~2.28 inches).
  const html = `
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>Pase de Salida</title>
      <style>
        @page { size: 58mm auto; margin: 2mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; width: 58mm; margin:0; padding:0; color: #111; font-size: 10px; }
        .ticket { padding: 4px; }
        .center { text-align:center; }
        h1 { margin: 4px 0; font-size: 13px; font-weight: 700; }
        .muted { color: #666; font-size: 9px; }
        .small { font-size: 9px; }
        .row { display:flex; justify-content:space-between; margin:4px 0; font-size: 10px; }
        .divider { border-top:1px dashed #ccc; margin:4px 0; }
        .total { font-weight:700; font-size:13px; }
        .item-row { display:flex; justify-content:space-between; margin:2px 0; font-size: 9px; }
      </style>
    </head>
    <body>
      <div class="ticket">
        <div class="center">
          <h1>PASE DE SALIDA</h1>
          <div class="muted small">ChepeChupes</div>
          <div class="muted small">${new Date().toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</div>
          <div class="muted small">Estado: ${order.status === 'pagado' ? 'PAGADO' : order.status === 'cancelado' ? 'CANCELADO' : 'PENDIENTE'}</div>
          <div class="muted small">ID: ${order.id?.substring(0, 8) || 'N/A'}</div>
          ${Array.isArray(order.payments) && order.payments.length > 0 ? `<div class="muted small">${order.payments[0].method} ${order.payments[0].receivedAmount ? '$' + Number(order.payments[0].receivedAmount).toFixed(2) : ''}</div>` : ''}
        </div>

        <div class="divider"></div>

        <div class="row"><div>${order.tableNumber === 0 ? 'Barra' : 'Mesa'}</div><div>${order.tableNumber === 0 ? 'Principal' : order.tableNumber}</div></div>
        <div class="row"><div>Mesero</div><div>${order.waiterName}</div></div>
        <div class="row"><div>Personas</div><div>${order.peopleCount ?? 1}</div></div>

        <div class="divider"></div>

        <div class="small muted">Items</div>
        ${order.items.filter(i => !i.isDeleted).map(i => `<div class="item-row"><div>${i.quantity}x ${i.productName.length > 18 ? i.productName.substring(0, 18) + '...' : i.productName}</div><div>$${(i.productPrice * i.quantity).toFixed(2)}</div></div>`).join('')}

        <div class="divider"></div>

        <div class="row"><div>Subtotal</div><div>$${subtotal.toFixed(2)}</div></div>
        <div class="row"><div>Propina${typeof tipPercent === 'number' && tipPercent > 0 ? ` (${(tipPercent * 100).toFixed(0)}%)` : ''}</div><div>$${tipAmount.toFixed(2)}</div></div>
        <div class="row total"><div>TOTAL</div><div>$${total.toFixed(2)}</div></div>

        ${typeof perPerson === 'number' ? `<div class="divider"></div><div class="row"><div>Por persona</div><div>$${perPerson.toFixed(2)}</div></div>` : ''}

        <div class="divider"></div>
        <div class="center muted small">Prof. Mercedes Camacho 82</div>
        <div class="center muted small">Praderas del Sol</div>
        <div class="center muted small">Tel: 427-123-4567</div>
      </div>
    </body>
  </html>
  `;

  // Fallback: inject a hidden iframe into the current document and print from it.
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
        // Delay slightly to ensure resources/rendering ready
        setTimeout(() => {
          try {
            win.print();
          } catch (e) {
            console.warn('Error printing from iframe', e);
          }
          // Remove iframe after printing attempt
          setTimeout(() => {
            try { document.body.removeChild(iframe); } catch (e) { /* ignore */ }
          }, 1000);
        }, 300);
      } catch (e) {
        console.error('Fallback iframe print failed', e);
        try { document.body.removeChild(iframe); } catch (e) { /* ignore */ }
      }
    };
  } catch (err) {
    alert('No se pudo iniciar la impresión. Revisa el bloqueador de ventanas emergentes o prueba guardar como PDF.');
  }
};

export default printTicket80mm;
