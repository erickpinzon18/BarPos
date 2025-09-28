import React, { useState } from 'react';
import { useOrders } from '../../hooks/useOrders';
import printTicket80mm from '../../utils/printTicket';
import type { Order } from '../../utils/types';

const AdminTickets: React.FC = () => {
  // Show historical tickets: use status 'pagado'
  const { orders, loading } = useOrders('pagado');
  const [selected, setSelected] = useState<Order | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const openModal = (order: Order) => setSelected(order);
  const closeModal = () => setSelected(null);

  const handlePrint = (order: Order) => {
    // compute totals similar to Checkout
    const activeItems = (order.items || []).filter(i => !i.isDeleted);
    const subtotal = activeItems.reduce((s, it) => s + ( (it.productPrice ?? 0) * (it.quantity ?? 1) ), 0);
    const tax = subtotal * 0.16;
    const tip = 0; // tickets history: no tip stored here by default
    const total = subtotal + tax + tip;
    const perPerson = order.peopleCount ? total / order.peopleCount : undefined;

    printTicket80mm({ order, subtotal, tax, tipAmount: tip, total, perPerson });
  };

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-3xl font-bold mb-2">Historial de Tickets</h1>
      <p className="text-gray-400 mb-6">Consulta, revisa y reimprime tickets pagados.</p>

      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por ticket, id de pago, mesa, mesero..."
          className="w-full md:w-1/2 bg-gray-800 text-white rounded-lg p-3 border border-gray-700"
        />
      </div>

      {loading ? (
        <div className="text-center py-8">Cargando tickets...</div>
      ) : (
        // Group orders by local date (YYYY-MM-DD, local timezone)
        (() => {
          const makeLocalDateKey = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
          };

          const parseLocalDateKey = (key: string) => {
            const [y, m, day] = key.split('-').map(Number);
            return new Date(y, m - 1, day);
          };

          const groups: Record<string, Order[]> = {};
          const q = (searchQuery || '').trim().toLowerCase();

          const filtered = orders.filter(o => {
            if (!q) return true;
            // match order id (full or first 6 chars)
            if (o.id && o.id.toLowerCase().includes(q)) return true;
            if (o.id && o.id.slice(0, 6).toLowerCase().includes(q)) return true;
            // match table number
            if (o.tableNumber && String(o.tableNumber).includes(q)) return true;
            // match waiter
            if (o.waiterName && o.waiterName.toLowerCase().includes(q)) return true;
            // match payment ids
            if (Array.isArray(o.payments) && o.payments.some(p => p.id && p.id.toLowerCase().includes(q))) return true;
            return false;
          });

          filtered.forEach(o => {
            const d = new Date(o.createdAt || Date.now());
            const key = makeLocalDateKey(d);
            if (!groups[key]) groups[key] = [];
            groups[key].push(o);
          });

          // sort dates descending (most recent first)
          const dateKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

          const todayKey = makeLocalDateKey(new Date());

          return (
            <div className="space-y-8">
              {dateKeys.map(dateKey => {
                const date = parseLocalDateKey(dateKey);
                const isToday = dateKey === todayKey;
                const headerLabel = isToday
                  ? `Hoy, ${date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`
                  : date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

                return (
                  <div key={dateKey}>
                    <h2 className="text-xl font-bold text-amber-400 border-b-2 border-amber-400/30 pb-2 mb-4">{headerLabel}</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {groups[dateKey].map(order => (
                        <div key={order.id} className="bg-gray-800 rounded-2xl border border-gray-700 p-5 flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <h3 className="text-lg font-bold text-white">Ticket #{order.id?.slice(0, 6).toUpperCase()}</h3>
                                {/* <div className="text-xs text-gray-400">ID: { (order.payments && order.payments.length > 0 && order.payments[0].id) ? order.payments[0].id : order.id }</div> */}
                              <div className="text-sm text-gray-400 text-right">
                                <div>{new Date(order.completedAt || Date.now()).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
                                <div className="text-xs">{new Date(order.completedAt || Date.now()).toLocaleDateString('es-ES')}</div>
                              </div>
                            </div>
                            <p className="text-sm text-gray-300"><span className="font-semibold">Mesa:</span> {order.tableNumber ?? '-'}</p>
                            <p className="text-sm text-gray-300"><span className="font-semibold">Mesero:</span> {order.waiterName ?? '-'}</p>
                          </div>
                            <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between items-center">
                            <p className="text-xl font-bold text-amber-400">${(() => {
                              const subtotal = (order.items || []).filter(i => !i.isDeleted).reduce((s, it) => s + ((it.productPrice ?? 0) * (it.quantity ?? 1)), 0);
                              const tax = subtotal * 0.16;
                              const total = subtotal + tax;
                              return total.toFixed(2);
                            })()}</p>
                            <div className="flex gap-2">
                              <button onClick={() => openModal(order)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Ver / Reimprimir</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()
      )}

      {/* Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-gray-800 rounded-2xl shadow-xl w-full max-w-md m-4 border border-gray-700 relative">
            <button onClick={closeModal} className="absolute top-4 right-4 text-gray-400 hover:text-white text-3xl">&times;</button>
            <div className="p-8">
                <div className="text-center mb-6 border-b border-gray-600 pb-6">
                <h2 className="text-2xl font-bold text-amber-400 tracking-widest">PASE DE SALIDA</h2>
                <p className="text-lg font-semibold text-white mt-1">ChepeChupes — Ticket de salida</p>
                <p className="text-sm text-gray-400">Fecha: {new Date(selected.createdAt || Date.now()).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}, {new Date(selected.createdAt || Date.now()).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
                <p className="text-xs text-gray-400 mt-1">ID ticket: {selected.id}</p>
                {selected.payments && selected.payments.length > 0 && (
                  <div className="text-xs text-gray-400 mt-1">Pago: {selected.payments[0].id} — {selected.payments[0].method} ${selected.payments[0].receivedAmount ?? selected.payments[0].change ?? ''}</div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4 mb-6 text-center">
                <div><p className="text-sm text-gray-400">Mesa</p><p className="font-bold text-white text-lg">{selected.tableNumber ?? '-'}</p></div>
                <div><p className="text-sm text-gray-400">Mesero</p><p className="font-bold text-white text-lg">{selected.waiterName ?? '-'}</p></div>
                <div><p className="text-sm text-gray-400">Personas</p><p className="font-bold text-white text-lg">{selected.peopleCount ?? 1}</p></div>
              </div>
              <div className="border-t border-b border-dashed border-gray-600 py-4 space-y-3">
                <div className="flex justify-between text-sm"><span className="font-semibold text-white">CANT. PRODUCTO</span><span className="font-semibold text-white">SUBTOTAL</span></div>
                {(selected.items || []).filter(i => !i.isDeleted).map((it) => (
                  <div key={it.id} className="flex justify-between"><span className="text-gray-300">{it.quantity}x {it.productName}</span><span className="text-gray-300">${((it.productPrice ?? 0) * (it.quantity ?? 1)).toFixed(2)}</span></div>
                ))}
              </div>
              <div className="py-6 space-y-2">
                <div className="flex justify-between items-center text-md"><span className="text-gray-300">Subtotal:</span><span className="font-semibold text-white">${(() => { const s = (selected.items || []).filter(i => !i.isDeleted).reduce((sum, it) => sum + ((it.productPrice ?? 0) * (it.quantity ?? 1)), 0); return s.toFixed(2); })()}</span></div>
                <div className="flex justify-between items-center text-md"><span className="text-gray-300">IVA (16%):</span><span className="font-semibold text-white">${(() => { const s = (selected.items || []).filter(i => !i.isDeleted).reduce((sum, it) => sum + ((it.productPrice ?? 0) * (it.quantity ?? 1)), 0); return (s * 0.16).toFixed(2); })()}</span></div>
                <div className="flex justify-between items-center text-2xl mt-2"><span className="font-bold text-amber-400">TOTAL:</span><span className="font-bold text-amber-400">${(() => { const s = (selected.items || []).filter(i => !i.isDeleted).reduce((sum, it) => sum + ((it.productPrice ?? 0) * (it.quantity ?? 1)), 0); return (s + s * 0.16).toFixed(2); })()}</span></div>
              </div>
              <div className="text-center pt-6 border-t border-gray-600">
                <p className="text-gray-400">Gracias por su preferencia.</p>
                <p className="text-xs text-gray-500 mt-2">Prof. Mercedes Camacho 82, Praderas del Sol, 76808 San Juan del Río, Qro.<br/>Tel: 427-123-4567</p>
              </div>
            </div>
            <div className="p-6 bg-gray-900/50 rounded-b-2xl flex gap-4">
              <button onClick={() => handlePrint(selected)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-5 rounded-lg">Imprimir</button>
              <button onClick={closeModal} className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-5 rounded-lg">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTickets;
