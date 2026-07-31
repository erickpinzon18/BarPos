// src/pages/kitchen/Ventas.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Printer, Package, ChevronDown, ChevronUp, Calendar, Clock } from 'lucide-react';
import { getOrdersByShift } from '../../services/firestoreService';
import { sendToPrinter } from '../../utils/printTicket';
import { usePaperSize } from '../../hooks/usePaperSize';
import { useAuth } from '../../contexts/AuthContext';
import type { Order } from '../../utils/types';
import { CATEGORIES } from '../../utils/categories';
import type { CategoryKey } from '../../utils/categories';

interface ProductLine {
  name: string;
  quantity: number;
}

interface CategoryGroup {
  category: CategoryKey;
  label: string;
  icon: string;
  color: string;
  items: ProductLine[];
  total: number;
}

interface ServiceLine {
  label: string;
  quantity: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDefaultShiftDate(): Date {
  const now = new Date();
  const h = now.getHours();
  // Before 8 AM → previous day's shift is still the relevant one
  if (h < 8) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d;
  }
  return now;
}

function getShiftRange(date: Date): { shiftStart: Date; shiftEnd: Date } {
  const shiftStart = new Date(date);
  shiftStart.setHours(8, 0, 0, 0);
  const shiftEnd = new Date(date);
  shiftEnd.setDate(shiftEnd.getDate() + 1);
  shiftEnd.setHours(1, 0, 0, 0);
  return { shiftStart, shiftEnd };
}

function buildGroups(orders: Order[]): CategoryGroup[] {
  const byCategory = new Map<CategoryKey, Map<string, number>>();
  for (const order of orders) {
    for (const item of order.items ?? []) {
      if (item.isDeleted) continue;
      const cat = item.category as CategoryKey;
      if (!byCategory.has(cat)) byCategory.set(cat, new Map());
      const prod = byCategory.get(cat)!;
      prod.set(item.productName, (prod.get(item.productName) ?? 0) + item.quantity);
    }
  }
  return CATEGORIES
    .filter(c => byCategory.has(c.key))
    .map(c => {
      const prodMap = byCategory.get(c.key)!;
      const items: ProductLine[] = Array.from(prodMap.entries())
        .map(([name, quantity]) => ({ name, quantity }))
        .sort((a, b) => b.quantity - a.quantity);
      return {
        category: c.key,
        label: c.label,
        icon: c.icon ?? '',
        color: c.color ?? 'bg-gray-500',
        items,
        total: items.reduce((s, i) => s + i.quantity, 0),
      };
    });
}

function buildServices(orders: Order[]): ServiceLine[] {
  const totals = new Map<string, number>();
  for (const order of orders) {
    for (const item of order.items ?? []) {
      if (item.isDeleted || !item.notes) continue;
      const m = item.notes.match(/^Servicios:\s*(.+)$/s);
      if (!m) continue;
      m[1].split(',').forEach(part => {
        const pm = part.trim().match(/^(\d+)x\s+(.+)$/);
        if (!pm) return;
        const qty = parseInt(pm[1], 10);
        const label = pm[2].trim();
        totals.set(label, (totals.get(label) ?? 0) + qty);
      });
    }
  }
  return Array.from(totals.entries())
    .map(([label, quantity]) => ({ label, quantity }))
    .sort((a, b) => b.quantity - a.quantity);
}

// ── Print ─────────────────────────────────────────────────────────────────────

function printInventoryTicket(
  groups: CategoryGroup[],
  services: ServiceLine[],
  shiftDate: Date,
  paperSize: '58mm' | '80mm'
) {
  const W = paperSize === '58mm' ? 24 : 30;
  const sep = (c: string) => c.repeat(W);
  const center = (t: string) => {
    const pad = Math.max(0, Math.floor((W - t.length) / 2));
    return ' '.repeat(pad) + t;
  };
  const wrap = (text: string, w: number): string[] => {
    const words = text.trim().split(/\s+/);
    const lines: string[] = [];
    let cur = '';
    for (const word of words) {
      if (!cur) { cur = word; continue; }
      const next = `${cur} ${word}`;
      if (next.length <= w) cur = next;
      else { lines.push(cur); cur = word; }
    }
    if (cur) lines.push(cur);
    return lines;
  };

  const { shiftStart, shiftEnd } = getShiftRange(shiftDate);
  const fmt = (d: Date) => d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' });
  const timeStr = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });

  const lines: string[] = [];
  lines.push(sep('='));
  lines.push(center('CORTE DE VENTAS'));
  lines.push(sep('='));
  lines.push(`Turno: ${fmt(shiftStart)} 08:00 - ${fmt(shiftEnd)} 01:00`);
  lines.push(`Impreso: ${timeStr}`);
  lines.push(sep('-'));

  let grandTotal = 0;
  for (const group of groups) {
    if (group.items.length === 0) continue;
    lines.push('');
    lines.push(`[${group.label.toUpperCase()}]`);
    for (const item of group.items) {
      const qtyStr = `${item.quantity}x`;
      const maxName = W - qtyStr.length - 1;
      wrap(item.name, maxName).forEach((l, i) => {
        lines.push(i === 0 ? `${qtyStr} ${l}` : `   ${l}`);
      });
    }
    lines.push(`Total: ${group.total} und`);
    grandTotal += group.total;
  }

  if (services.length > 0) {
    lines.push('');
    lines.push('[SERVICIOS / MEZCLADORES]');
    for (const svc of services) {
      const qtyStr = `${svc.quantity}x`;
      wrap(svc.label, W - qtyStr.length - 1).forEach((l, i) => {
        lines.push(i === 0 ? `${qtyStr} ${l}` : `   ${l}`);
      });
    }
    lines.push(`Total: ${services.reduce((s, sv) => s + sv.quantity, 0)} und`);
  }

  lines.push('');
  lines.push(sep('='));
  lines.push(`TOTAL ITEMS: ${grandTotal}`);
  lines.push(sep('='));
  lines.push('');

  sendToPrinter(lines.join('\n'), paperSize, 'CORTE DE VENTAS');
}

// ── Component ─────────────────────────────────────────────────────────────────

const Ventas: React.FC = () => {
  const { currentUser } = useAuth();
  const [paperSize, setPaperSize] = usePaperSize(currentUser?.id);

  const [selectedDate, setSelectedDate] = useState<Date>(getDefaultShiftDate());
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [services, setServices] = useState<ServiceLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [collapsed, setCollapsed] = useState<Set<CategoryKey>>(new Set());

  const { shiftStart, shiftEnd } = getShiftRange(selectedDate);

  const load = useCallback(async (date: Date) => {
    setLoading(true);
    setError('');
    try {
      const res = await getOrdersByShift(date);
      if (!res.success || !res.data) throw new Error(res.error ?? 'Error');
      setGroups(buildGroups(res.data));
      setServices(buildServices(res.data));
      setLastRefresh(new Date());
    } catch (e: any) {
      setError(e.message ?? 'Error al cargar ventas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(selectedDate); }, [load, selectedDate]);

  const toggleCollapse = (cat: CategoryKey) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const grandTotal = groups.reduce((s, g) => s + g.total, 0);
  const dateInputValue = selectedDate.toISOString().split('T')[0];

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Corte de Ventas</h1>
          {lastRefresh && (
            <p className="text-gray-600 text-xs mt-0.5">
              Actualizado a las {lastRefresh.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => load(selectedDate)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>

          <div className="hidden sm:flex bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
            {(['58mm', '80mm'] as const).map(size => (
              <button
                key={size}
                onClick={() => setPaperSize(size)}
                className={`px-3 py-2 text-xs font-semibold transition-colors ${
                  paperSize === size
                    ? 'bg-orange-600 text-white'
                    : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
              >
                {size}
              </button>
            ))}
          </div>

          <button
            onClick={() => printInventoryTicket(groups, services, selectedDate, paperSize)}
            disabled={groups.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors disabled:opacity-50 text-sm font-medium"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
        </div>
      </div>

      {/* Shift selector */}
      <div className="bg-gray-800 rounded-xl p-4 mb-4 border border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-orange-400 flex-shrink-0" />
            <label className="text-sm font-semibold text-white whitespace-nowrap">Turno:</label>
          </div>
          <input
            type="date"
            value={dateInputValue}
            onChange={(e) => setSelectedDate(new Date(e.target.value + 'T12:00:00'))}
            className="bg-gray-700 text-white rounded-lg px-3 py-1.5 border border-gray-600 focus:border-orange-500 focus:outline-none text-sm [color-scheme:dark]"
          />
          <div className="flex items-center gap-1.5 text-sm text-gray-400">
            <Clock size={14} className="flex-shrink-0" />
            <span>
              {shiftStart.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' })} 8:00 AM
              {' → '}
              {shiftEnd.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' })} 1:00 AM
            </span>
          </div>
        </div>
      </div>

      {/* Summary pill */}
      {grandTotal > 0 && (
        <div className="mb-4 px-4 py-3 bg-gray-800 rounded-xl flex items-center justify-between">
          <span className="text-gray-400 text-sm">Total de artículos en el turno</span>
          <span className="text-2xl font-bold text-white">{grandTotal}</span>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {loading && groups.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
        </div>
      )}

      {!loading && groups.length === 0 && !error && (
        <div className="text-center py-16">
          <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No hay ventas en este turno</p>
          <p className="text-gray-600 text-sm mt-1">
            {shiftStart.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })} 8:00 AM
            {' → '}
            {shiftEnd.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })} 1:00 AM
          </p>
        </div>
      )}

      {/* Services section */}
      {services.length > 0 && (
        <div className="mb-3 bg-gray-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-xl">🧃</span>
              <span className="font-semibold text-white">Servicios / Mezcladores</span>
              <span className="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded-full">
                {services.reduce((s, sv) => s + sv.quantity, 0)} und
              </span>
            </div>
          </div>
          <div className="border-t border-gray-700">
            {services.map((svc, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700/50 last:border-b-0"
              >
                <span className="text-gray-200 text-sm">{svc.label}</span>
                <span className="text-white font-bold text-sm bg-gray-700 px-2.5 py-0.5 rounded-full min-w-[2.5rem] text-center">
                  {svc.quantity}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category groups */}
      <div className="space-y-3">
        {groups.map(group => {
          const isCollapsed = collapsed.has(group.category);
          return (
            <div key={group.category} className="bg-gray-800 rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-750 transition-colors"
                onClick={() => toggleCollapse(group.category)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{group.icon}</span>
                  <span className="font-semibold text-white">{group.label}</span>
                  <span className="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded-full">
                    {group.total} und
                  </span>
                </div>
                {isCollapsed
                  ? <ChevronDown className="w-4 h-4 text-gray-400" />
                  : <ChevronUp className="w-4 h-4 text-gray-400" />
                }
              </button>
              {!isCollapsed && (
                <div className="border-t border-gray-700">
                  {group.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700/50 last:border-b-0"
                    >
                      <span className="text-gray-200 text-sm">{item.name}</span>
                      <span className="text-white font-bold text-sm bg-gray-700 px-2.5 py-0.5 rounded-full min-w-[2.5rem] text-center">
                        {item.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Ventas;
