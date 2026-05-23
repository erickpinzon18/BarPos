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
const TW = 8.6;   // table width  %
const TH = 13.1;  // table height %
const VW = 6.3;   // VIP/extra column width %
const VCW = 4.0;  // third extra column width %
const CW = 5.0;   // circle width %
const CH = 9.0;   // circle height%

// Main grid columns (left edge %)
const CA = 30, CB = 42, CC = 53, CD = 65, CE = 76;
// Right side column
const CR = 89;

// Main grid rows (top edge %)
const R1 = 18, R2 = 34, R3 = 50, R4 = 66;

// Left side columns
const VA = 2, VB = 10, VC = 18;
// VIP rows
const VR1 = 4, VR2 = 21;

// P-circle column & y (vertically centered within each row)
const PX  = 23;
const pcy = (row: number) => row + (TH - CH) / 2;

// Bottom row y
const BOTTOM_Y = 80;

// Bar tables (B1–B5) positioned in the top strip
const BAR_Y = 2;
const BAR_W = 10.5;
const BAR_GAP = 0.4;
const barX = (i: number) => CA + i * (BAR_W + BAR_GAP);

const TABLE_LAYOUT: TablePos[] = [
  // ── Barra (B1–B5) ─────────────────────────────────────
  { number: 'B1', x: barX(0), y: BAR_Y, w: BAR_W, h: TH },
  { number: 'B2', x: barX(1), y: BAR_Y, w: BAR_W, h: TH },
  { number: 'B3', x: barX(2), y: BAR_Y, w: BAR_W, h: TH },
  { number: 'B4', x: barX(3), y: BAR_Y, w: BAR_W, h: TH },
  { number: 'B5', x: barX(4), y: BAR_Y, w: BAR_W, h: TH },

  // ── Right column (1, 2, 3 + Salas) ───────────────────
  { number: 1,         x: CR,  y: R1,      w: TW, h: TH },
  { number: 2,         x: CR,  y: R2,      w: TW, h: TH },
  { number: 3,         x: CR,  y: R3,      w: TW, h: TH },
  { number: 'Sala 1',  x: CR,  y: R4,      w: TW, h: TH },
  { number: 'Sala 2',  x: CR,  y: BOTTOM_Y, w: TW, h: TH },

  // ── Row 1 (10–13) ─────────────────────────────────────
  { number: 10,        x: CA,  y: R1,      w: TW, h: TH },
  { number: 11,        x: CB,  y: R1,      w: TW, h: TH },
  { number: 12,        x: CC,  y: R1,      w: TW, h: TH },
  { number: 13,        x: CD,  y: R1,      w: TW, h: TH },

  // ── Row 2 (20–24) ─────────────────────────────────────
  { number: 20,        x: CA,  y: R2,      w: TW, h: TH },
  { number: 21,        x: CB,  y: R2,      w: TW, h: TH },
  { number: 22,        x: CC,  y: R2,      w: TW, h: TH },
  { number: 23,        x: CD,  y: R2,      w: TW, h: TH },
  { number: 24,        x: CE,  y: R2,      w: TW, h: TH },

  // ── Row 3 (30–34) ─────────────────────────────────────
  { number: 30,        x: CA,  y: R3,      w: TW, h: TH },
  { number: 31,        x: CB,  y: R3,      w: TW, h: TH },
  { number: 32,        x: CC,  y: R3,      w: TW, h: TH },
  { number: 33,        x: CD,  y: R3,      w: TW, h: TH },
  { number: 34,        x: CE,  y: R3,      w: TW, h: TH },

  // ── Row 4 (40–42, offset one col) ─────────────────────
  { number: 40,        x: CB,  y: R4,      w: TW, h: TH },
  { number: 41,        x: CC,  y: R4,      w: TW, h: TH },
  { number: 42,        x: CD,  y: R4,      w: TW, h: TH },

  // ── VIP 2×2 block ─────────────────────────────────────
  { number: 'V3',      x: VA,  y: VR1,     w: VW, h: TH },
  { number: 'V4',      x: VB,  y: VR1,     w: VW, h: TH },
  { number: 'V1',      x: VA,  y: VR2,     w: VW, h: TH },
  { number: 'V2',      x: VB,  y: VR2,     w: VW, h: TH },

  // ── Extras — 3 cols × 3 rows ──────────────────────────
  { number: 'Extra 1', x: VA,  y: 38,      w: VW,  h: TH },
  { number: 'Extra 2', x: VB,  y: 38,      w: VW,  h: TH },
  { number: 'Extra 3', x: VA,  y: 55,      w: VW,  h: TH },
  { number: 'Extra 4', x: VB,  y: 55,      w: VW,  h: TH },
  { number: 'Extra 5', x: VA,  y: 70,      w: VW,  h: TH },
  { number: 'Extra 6', x: VB,  y: 70,      w: VW,  h: TH },
  { number: 'Extra 7', x: VC,  y: 38,      w: VCW, h: TH },
  { number: 'Extra 8', x: VC,  y: 55,      w: VCW, h: TH },
  { number: 'Extra 9', x: VC,  y: 70,      w: VCW, h: TH },

  // ── P circles — vertical column, aligned with rows ────
  { number: 'P1',      x: PX,  y: pcy(R1), w: CW, h: CH, shape: 'circle' },
  { number: 'P2',      x: PX,  y: pcy(R2), w: CW, h: CH, shape: 'circle' },
  { number: 'P3',      x: PX,  y: pcy(R3), w: CW, h: CH, shape: 'circle' },
  { number: 'P4',      x: PX,  y: pcy(R4), w: CW, h: CH, shape: 'circle' },

  // ── P5–P7 — horizontal row at bottom ──────────────────
  { number: 'P5',      x: CB,  y: BOTTOM_Y + (TH - CH) / 2, w: CW, h: CH, shape: 'circle' },
  { number: 'P6',      x: CC,  y: BOTTOM_Y + (TH - CH) / 2, w: CW, h: CH, shape: 'circle' },
  { number: 'P7',      x: CD,  y: BOTTOM_Y + (TH - CH) / 2, w: CW, h: CH, shape: 'circle' },
];

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
          <p className="text-xs text-gray-600 mb-3">Disponible</p>
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
