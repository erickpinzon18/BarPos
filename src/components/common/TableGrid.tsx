import React from 'react';
import type { Table, Order, Reservation } from '../../utils/types';

interface TableGridProps {
  tables: Table[];
  orders: Order[];
  reservations?: Reservation[];
  onTableClick: (table: Table) => void;
  onViewOrder: (tableId: string) => void;
  onCheckout: (orderId: string) => void;
  accentColor: 'red' | 'orange';
}

interface SectionDef {
  title: string;
  filter: (n: string) => boolean;
  cols: string;
  wide?: boolean;
}

const SECTIONS: SectionDef[] = [
  { title: 'Barra',           filter: n => n === '0',                          cols: 'grid-cols-1',               wide: true },
  { title: 'VIP',             filter: n => n.startsWith('V'),                  cols: 'grid-cols-2 sm:grid-cols-4' },
  { title: 'Pista Principal', filter: n => /^\d+$/.test(n) && Number(n) >= 1,  cols: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5' },
  { title: 'Spots',           filter: n => n.startsWith('P'),                  cols: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-7' },
  { title: 'Salas',           filter: n => n.startsWith('Sala'),               cols: 'grid-cols-1 sm:grid-cols-2' },
];

function sortTables(a: Table, b: Table): number {
  const na = String(a.number);
  const nb = String(b.number);
  const ia = parseInt(na, 10);
  const ib = parseInt(nb, 10);
  if (!isNaN(ia) && !isNaN(ib)) return ia - ib;
  return na.localeCompare(nb);
}

interface CardProps {
  table: Table;
  order: Order | undefined;
  reservation?: Reservation;
  accentColor: 'red' | 'orange';
  onTableClick: () => void;
  onViewOrder: (e: React.MouseEvent) => void;
  onCheckout: (e: React.MouseEvent) => void;
  wide?: boolean;
}

const TableCard: React.FC<CardProps> = ({
  table, order, reservation, accentColor, onTableClick, onViewOrder, onCheckout, wide,
}) => {
  const isActive = table.status === 'ocupada' && !!order;
  const accent = accentColor;
  const isBar = table.number === 0;
  const label = isBar
    ? '🍹 Barra'
    : typeof table.number === 'string'
    ? table.number
    : `Mesa ${table.number}`;

  const activeItems = order?.items.filter(i => !i.isDeleted) ?? [];
  const itemCount = activeItems.reduce((s, i) => s + i.quantity, 0);
  const total = activeItems.reduce((s, i) => s + i.productPrice * i.quantity, 0).toFixed(2);
  const timeMin = order
    ? Math.floor((Date.now() - order.createdAt.getTime()) / 60000)
    : 0;
  const hasUndelivered = activeItems.some(i => i.status !== 'entregado');

  const accentBorder  = accent === 'red' ? '#dc2626' : '#ea580c';
  const accentBadgeBg = accent === 'red' ? 'bg-red-600'    : 'bg-orange-600';
  const accentText    = accent === 'red' ? 'text-red-400'  : 'text-orange-400';
  const accentBtn     = accent === 'red'
    ? 'bg-red-600 hover:bg-red-700'
    : 'bg-orange-500 hover:bg-orange-600';

  if (isActive && order) {
    return (
      <div
        className={`relative bg-gray-800 rounded-2xl p-4 cursor-pointer transition-all duration-200 hover:scale-[1.02] ${wide ? 'flex gap-6 items-center' : ''}`}
        style={{ border: `2px solid ${accentBorder}`, boxShadow: `0 0 20px ${accentBorder}22` }}
        onClick={onTableClick}
      >
        {/* Header */}
          <div className={`flex justify-between items-start ${wide ? 'flex-shrink-0 w-32' : 'mb-3'}`}>
            <div>
              <p className="font-bold text-white text-base leading-tight">{label}</p>
              {order.tableName && (
                <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[100px]">🏷️ {order.tableName}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`text-xs font-bold text-white ${accentBadgeBg} px-2 py-0.5 rounded-full ml-2 flex-shrink-0`}>
                Activa
              </span>
              {reservation && (
                <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full flex-shrink-0">
                  📌 Resv.
                </span>
              )}
            </div>
          </div>

        {/* Info */}
        <div className={`${wide ? 'flex-1 flex items-center gap-8' : ''}`}>
          <div className={`${wide ? '' : 'mb-3'} space-y-0.5`}>
            <p className="text-sm text-gray-300 font-medium">{order.waiterName || 'Sin asignar'}</p>
            <p className="text-xs text-gray-500">{itemCount} items · {timeMin} min</p>
          </div>

          <p className={`text-2xl font-bold ${accentText} ${wide ? '' : 'mb-3'}`}>${total} MXN</p>

          <div className={`flex gap-2 ${wide ? 'ml-auto' : ''}`}>
            <button
              onClick={onViewOrder}
              className={`flex-1 ${accentBtn} text-white text-xs font-semibold py-2 px-3 rounded-lg transition-colors`}
            >
              Ver Pedido
            </button>
            <button
              onClick={onCheckout}
              disabled={hasUndelivered}
              className={`flex-1 text-xs font-semibold py-2 px-3 rounded-lg transition-colors ${
                hasUndelivered
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              Cobrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Libre (or reserved but free)
  return (
    <div
      className={`rounded-2xl p-4 cursor-pointer transition-all duration-200 hover:scale-[1.02] group flex flex-col ${
        reservation
          ? 'bg-amber-900/20 border-2 border-amber-500/60 hover:border-amber-400'
          : 'bg-gray-800/50 border border-gray-700 hover:bg-gray-700/60 hover:border-gray-500'
      }`}
      onClick={onTableClick}
    >
      <div className="flex justify-between items-center mb-4">
        <p className="font-bold text-white text-base">{label}</p>
        <div className="flex items-center gap-1">
          {reservation && (
            <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
              📌 Reservada
            </span>
          )}
          <span className="text-xs font-medium text-gray-500 bg-gray-700 px-2 py-0.5 rounded-full">
            Libre
          </span>
        </div>
      </div>
      {reservation && (
        <div className="mb-3 bg-amber-500/5 border border-amber-500/20 rounded-lg p-2">
          <p className="text-xs text-amber-300 font-semibold truncate">{reservation.customerName}</p>
          <p className="text-xs text-gray-500">
            {reservation.pax} personas • {reservation.reservationDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </p>
          {reservation.notes && (
            <p className="text-xs text-gray-600 truncate mt-1">{reservation.notes}</p>
          )}
        </div>
      )}
      <div className="flex-1 flex flex-col items-center justify-center py-4 text-gray-600 group-hover:text-gray-400 transition-colors">
        <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        <span className="text-xs">Abrir</span>
      </div>
    </div>
  );
};

const TableGrid: React.FC<TableGridProps> = ({
  tables, orders, reservations = [], onTableClick, onViewOrder, onCheckout, accentColor,
}) => {
  return (
    <div className="space-y-8">
      {SECTIONS.map(section => {
        const sectionTables = tables
          .filter(t => section.filter(String(t.number)))
          .sort(sortTables);

        if (sectionTables.length === 0) return null;

        return (
          <div key={section.title}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
              {section.title}
            </p>
            <div className={`grid ${section.cols} gap-4`}>
              {sectionTables.map(table => {
                const order = orders.find(o => o.tableId === table.id);
                const reservation = reservations.find(r => r.tableId === table.id);
                return (
                  <TableCard
                    key={table.id}
                    table={table}
                    order={order}
                    reservation={reservation}
                    accentColor={accentColor}
                    wide={section.wide}
                    onTableClick={() => onTableClick(table)}
                    onViewOrder={e => { e.stopPropagation(); onViewOrder(table.id); }}
                    onCheckout={e => {
                      e.stopPropagation();
                      if (order) onCheckout(order.id);
                    }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TableGrid;
