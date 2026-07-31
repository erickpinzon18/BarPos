import React, { useState } from 'react';
import type { Table, Order, Reservation } from '../../utils/types';

interface VenueMapProps {
  tables: Table[];
  orders: Order[];
  reservations?: Reservation[];
  onTableClick: (table: Table) => void;
  onCheckout: (orderId: string) => void;
  accentColor: 'red' | 'orange' | 'green';
  /** Waiter view: tables occupied by another waiter are dimmed & non-interactive */
  currentUserId?: string;
}

interface TablePos {
  number: number | string;
  x: number;
  y: number;
  w: number;
  h: number;
  shape?: 'circle';
}

// ─── Grid constants ──────────────────────────────────────────────────────────
const TW = 16;   // table width  %
const TH = 18;   // table height %

// Columns (left edge %) & rows (top edge %)
const CA = 30, CB = 52, CC = 74;
const R1 = 20, R2 = 46, R3 = 70;

// Bottom row (2 tables, centered)
const CBOTA = 41, CBOTB = 63;

const TABLE_LAYOUT: TablePos[] = [
  // ── Fila 1 ──────────────────────────────────────────
  { number: 1, x: CA, y: R1, w: TW, h: TH },
  { number: 2, x: CB, y: R1, w: TW, h: TH },
  { number: 3, x: CC, y: R1, w: TW, h: TH },

  // ── Fila 2 ──────────────────────────────────────────
  { number: 4, x: CA, y: R2, w: TW, h: TH },
  { number: 5, x: CB, y: R2, w: TW, h: TH },
  { number: 6, x: CC, y: R2, w: TW, h: TH },

  // ── Fila 3 (centrada) ─────────────────────────────────
  { number: 7, x: CBOTA, y: R3, w: TW, h: TH },
  { number: 8, x: CBOTB, y: R3, w: TW, h: TH },
];

// Zona de cocina — esquina superior izquierda, solo decorativa
const KITCHEN_ZONE = { x: 2, y: 2, w: 20, h: 14 };

// Detecta si una mesa es de barra (número 0 legacy o B1–B9)
const isBarNumber = (n: number | string): boolean =>
  n === 0 || /^B\d+$/i.test(String(n));

// ─── Popup ────────────────────────────────────────────────────────────────────

interface PopupProps {
  table: Table;
  order?: Order;
  reservation?: Reservation;
  accentColor: 'red' | 'orange' | 'green';
  flipLeft: boolean;
  flipUp: boolean;
  isOtherWaiter?: boolean;
  onOpen: () => void;
  onViewOrder: () => void;
  onCheckout: () => void;
}

const Popup: React.FC<PopupProps> = ({
  table, order, reservation, accentColor, flipLeft, flipUp, isOtherWaiter, onOpen, onViewOrder, onCheckout,
}) => {
  const isActive = table.status === 'ocupada' && !!order;
  const isBar    = isBarNumber(table.number);
  const label    = isBar
    ? (table.number === 0 ? '🍹 Barra' : `🍹 ${table.number}`)
    : typeof table.number === 'string' ? table.number
    : `Mesa ${table.number}`;

  const accentBtn = accentColor === 'red'   ? 'bg-red-600 hover:bg-red-700'
    : accentColor === 'orange' ? 'bg-orange-500 hover:bg-orange-600'
    : 'bg-green-600 hover:bg-green-700';
  const accentTxt = accentColor === 'red'   ? 'text-red-400'
    : accentColor === 'orange' ? 'text-orange-400'
    : 'text-green-400';

  const activeItems    = order?.items.filter(i => !i.isDeleted) ?? [];
  const itemCount      = activeItems.reduce((s, i) => s + i.quantity, 0);
  const total          = activeItems.reduce((s, i) => s + i.productPrice * i.quantity, 0).toFixed(2);
  const timeMin        = order ? Math.floor((Date.now() - order.createdAt.getTime()) / 60000) : 0;
  const hasUndelivered = activeItems.some(i => i.status !== 'entregado');

  return (
    <div
      className="absolute z-50 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-4 w-48"
      style={{
        ...(flipLeft ? { right: '110%', left: 'auto' } : { left: '110%' }),
        ...(flipUp   ? { bottom: 0, top: 'auto' }      : { top: 0 }),
      }}
      onClick={e => e.stopPropagation()}
    >
      <p className="text-white font-bold text-sm mb-1">{label}</p>

      {/* Another waiter's table — info only */}
      {isOtherWaiter ? (
        <div className="space-y-1">
          <p className="text-xs text-gray-500">Ocupada por:</p>
          <p className="text-xs text-gray-300 font-medium">{order?.waiterName || 'Otro mesero'}</p>
          {order && (
            <p className="text-xs text-gray-600 mt-1">
              {order.items.filter(i => !i.isDeleted).reduce((s, i) => s + i.quantity, 0)} items
            </p>
          )}
        </div>
      ) : isActive && order ? (
        <>
          {order.tableName && (
            <p className="text-xs text-gray-500 mb-2 truncate">🏷️ {order.tableName}</p>
          )}
          {/* Reservation notice inside active popup */}
          {reservation && (
            <div className="mb-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-1.5">
              <p className="text-xs text-amber-400 font-semibold">📌 Reservada</p>
              <p className="text-xs text-amber-300">{reservation.customerName}</p>
              <p className="text-xs text-gray-500">{reservation.reservationDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          )}
          <div className="space-y-0.5 mb-3">
            <p className="text-xs text-gray-400">{order.waiterName || 'Sin asignar'}</p>
            <p className="text-xs text-gray-500">{itemCount} items · {timeMin} min</p>
          </div>
          <p className={`text-lg font-bold ${accentTxt} mb-3`}>${total} MXN</p>
          <div className="space-y-1.5">
            <button
              onClick={onViewOrder}
              className={`w-full ${accentBtn} text-white text-xs font-semibold py-2 rounded-xl transition-colors`}
            >
              Ver Pedido
            </button>
            <button
              onClick={onCheckout}
              disabled={hasUndelivered}
              className={`w-full text-xs font-semibold py-2 rounded-xl transition-colors ${
                hasUndelivered
                  ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              Cobrar
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Reservation notice on free table */}
          {reservation && (
            <div className="mb-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-1.5">
              <p className="text-xs text-amber-400 font-semibold">📌 Reservada hoy</p>
              <p className="text-xs text-amber-300">{reservation.customerName} • {reservation.pax} personas</p>
              <p className="text-xs text-gray-500">{reservation.reservationDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          )}
          <p className="text-xs text-gray-600 mb-3">Libre</p>
          <button
            onClick={onOpen}
            className={`w-full ${accentBtn} text-white text-xs font-semibold py-2 rounded-xl transition-colors`}
          >
            Abrir
          </button>
        </>
      )}
    </div>
  );
};

// ─── VenueMap ─────────────────────────────────────────────────────────────────

const MAP_MIN_W = 680; // px — keeps tables readable on mobile (≈59px per table)

export const VenueMap: React.FC<VenueMapProps> = ({
  tables, orders, reservations = [], onTableClick, onCheckout, accentColor, currentUserId,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const ac = accentColor === 'red'
    ? { bg: 'rgba(185,28,28,0.65)',  border: '#ef4444', glow: '0 0 14px rgba(239,68,68,0.45)',  hi: '#fca5a5' }
    : accentColor === 'orange'
    ? { bg: 'rgba(194,65,12,0.65)',  border: '#f97316', glow: '0 0 14px rgba(249,115,22,0.45)', hi: '#fdba74' }
    : { bg: 'rgba(21,128,61,0.65)',  border: '#22c55e', glow: '0 0 14px rgba(34,197,94,0.45)',  hi: '#86efac' };

  return (
    <div
      className="w-full overflow-x-auto rounded-2xl"
      style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
    >
      <div
        className="relative select-none"
        style={{
          minWidth: `${MAP_MIN_W}px`,
          // AR=1.89 is derived so content fills ~96% of both axes with no dead space
          aspectRatio: '1.55',
          background: 'linear-gradient(145deg, #0d1117 0%, #111827 55%, #0d1117 100%)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '16px',
        }}
        onClick={() => setSelectedId(null)}
      >
        {/* Zona de cocina — referencia visual, no interactiva */}
        <div
          className="absolute flex items-center justify-center pointer-events-none"
          style={{
            left: `${KITCHEN_ZONE.x}%`,
            top: `${KITCHEN_ZONE.y}%`,
            width: `${KITCHEN_ZONE.w}%`,
            height: `${KITCHEN_ZONE.h}%`,
            borderRadius: '10px',
            border: '1px dashed rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.03)',
          }}
        >
          <span className="text-xs font-semibold text-gray-500 tracking-widest uppercase">Cocina</span>
        </div>

        {TABLE_LAYOUT.map(pos => {
          const table = tables.find(t => String(t.number) === String(pos.number));
          if (!table) return null;

          const order    = orders.find(o => o.tableId === table.id);
          const isActive = table.status === 'ocupada' && !!order;
          const isOtherWaiter = !!currentUserId && isActive && !!order && order.waiterId !== currentUserId;
          const reservation = reservations.find(r => r.tableId === table.id);
          const isReserved = !!reservation && !isActive; // Show reservation color only when not occupied
          const isSel    = selectedId === table.id;
          const isCircle = pos.shape === 'circle';
          const isBar    = isBarNumber(pos.number);

          const label = isBar
            ? (pos.number === 0 ? 'Barra' : String(pos.number))
            : typeof pos.number === 'string' ? pos.number
            : String(pos.number);

          const totalStr = (() => {
            if (!order || isOtherWaiter) return null;
            const t = order.items.filter(i => !i.isDeleted)
              .reduce((s, i) => s + i.productPrice * i.quantity, 0);
            return `$${t.toFixed(0)}`;
          })();

          const bgColor = isOtherWaiter ? 'rgba(31,41,55,0.55)'
            : isActive  ? ac.bg
            : isReserved ? 'rgba(120,83,0,0.55)'
            : isSel ? 'rgba(255,255,255,0.08)'
            : 'rgba(31,41,55,0.95)';
          const border  = isOtherWaiter ? '1px solid rgba(75,85,99,0.3)'
            : isActive  ? `2px solid ${ac.border}`
            : isReserved ? '2px solid #f59e0b'
            : isSel ? '1.5px solid rgba(255,255,255,0.35)'
            : '1px solid rgba(75,85,99,0.55)';

          return (
            <div
              key={String(pos.number)}
              onClick={e => {
                e.stopPropagation();
                if (!isOtherWaiter) setSelectedId(p => p === table.id ? null : table.id);
              }}
              className="absolute transition-all duration-200 group flex flex-col items-center justify-center gap-0.5"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                width: `${pos.w}%`,
                height: `${pos.h}%`,
                borderRadius: isCircle ? '50%' : isBar ? '10px' : '8px',
                backgroundColor: bgColor,
                border,
                boxShadow: isActive && !isOtherWaiter ? ac.glow
                  : isReserved ? '0 0 12px rgba(245,158,11,0.4)' : undefined,
                opacity: isOtherWaiter ? 0.4 : 1,
                cursor: isOtherWaiter ? 'default' : 'pointer',
              }}
            >
              {/* Hover shimmer */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
                style={{ borderRadius: 'inherit', background: 'rgba(255,255,255,0.05)' }}
              />

              {/* Label — px so it stays readable at min-width */}
              <span
                className="font-bold text-white leading-none pointer-events-none drop-shadow-sm"
                style={{ fontSize: isBar ? '14px' : isCircle ? '9px' : '12px' }}
              >
                {label}
              </span>

              {/* Total on active non-bar tables */}
              {isActive && totalStr && !isBar && (
                <span
                  className="font-semibold leading-none pointer-events-none"
                  style={{ fontSize: '9px', color: ac.hi }}
                >
                  {totalStr}
                </span>
              )}

              {/* Reservation label on reserved free tables */}
              {isReserved && !isBar && (
                <span
                  className="font-semibold leading-none pointer-events-none"
                  style={{ fontSize: '8px', color: '#fbbf24' }}
                >
                  📌 Resv
                </span>
              )}

              {/* Popup */}
              {isSel && !isOtherWaiter && (
                <Popup
                  table={table}
                  order={order}
                  reservation={reservation}
                  accentColor={accentColor}
                  flipLeft={pos.x > 62}
                  flipUp={pos.y > 55}
                  isOtherWaiter={false}
                  onOpen={() => { setSelectedId(null); onTableClick(table); }}
                  onViewOrder={() => { setSelectedId(null); onTableClick(table); }}
                  onCheckout={() => { if (order) { setSelectedId(null); onCheckout(order.id); } }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
