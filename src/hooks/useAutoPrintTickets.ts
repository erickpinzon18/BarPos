import { useState, useEffect, useRef, useCallback } from 'react';
import type { Order } from '../utils/types';
import { getKitchenOrdersRealtime, markItemsAsPrinted } from '../services/firestoreService';
import { printStationTicket } from '../utils/printStationTicket';
import { getCategoryInfo } from '../utils/categories';
import type { PaperSize } from '../utils/printTicket';

type Station = 'cocina' | 'barra';

const STORAGE_ENABLED = 'barpos_autoPrint_enabled';
const STORAGE_STATIONS = 'barpos_autoPrint_stations';

const readBool = (key: string, fallback: boolean): boolean => {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return v === 'true';
  } catch { return fallback; }
};

const readStations = (fallback: Station[]): Station[] => {
  try {
    const v = localStorage.getItem(STORAGE_STATIONS);
    if (!v) return fallback;
    const parsed = JSON.parse(v) as unknown;
    if (Array.isArray(parsed) && parsed.every(s => s === 'cocina' || s === 'barra')) return parsed;
  } catch { /* ignore */ }
  return fallback;
};

export interface AutoPrintControls {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  stations: Station[];
  setStations: (v: Station[]) => void;
}

export const useAutoPrintTickets = (
  defaultStation: Station,
  paperSize: PaperSize = '58mm'
): AutoPrintControls => {
  const [enabled, setEnabledState] = useState<boolean>(() => readBool(STORAGE_ENABLED, false));
  const [stations, setStationsState] = useState<Station[]>(() => readStations([defaultStation]));

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    try { localStorage.setItem(STORAGE_ENABLED, String(v)); } catch { /* ignore */ }
  }, []);

  const setStations = useCallback((v: Station[]) => {
    setStationsState(v);
    try { localStorage.setItem(STORAGE_STATIONS, JSON.stringify(v)); } catch { /* ignore */ }
  }, []);

  // Refs to keep stable inside the listener callback
  const enabledRef = useRef(enabled);
  const stationsRef = useRef(stations);
  const paperSizeRef = useRef(paperSize);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { stationsRef.current = stations; }, [stations]);
  useEffect(() => { paperSizeRef.current = paperSize; }, [paperSize]);

  // Set of item IDs currently being processed (in-flight lock)
  const inFlightRef = useRef<Set<string>>(new Set());

  // Debounce timer per orderId
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // True while processing the very first snapshot (to silently mark backlog)
  const isFirstSnapshotRef = useRef(true);

  useEffect(() => {
    isFirstSnapshotRef.current = true;

    const unsubscribe = getKitchenOrdersRealtime((orders: Order[]) => {
      const currentStations = stationsRef.current;

      // Collect all items that are pendiente, not deleted, not yet printed,
      // and belong to one of the selected stations.
      type Candidate = { orderId: string; order: Order; itemId: string; productName: string; quantity: number; notes?: string; station: Station };
      const candidates: Candidate[] = [];

      for (const order of orders) {
        for (const item of order.items ?? []) {
          if (item.status !== 'pendiente') continue;
          if (item.isDeleted) continue;
          if (item.printedAt) continue;
          if (inFlightRef.current.has(item.id)) continue;

          const ws = getCategoryInfo(item.category)?.workstation;
          if (!ws || !currentStations.includes(ws)) continue;

          candidates.push({
            orderId: order.id!,
            order,
            itemId: item.id,
            productName: item.productName,
            quantity: item.quantity,
            notes: item.notes,
            station: ws,
          });
        }
      }

      if (isFirstSnapshotRef.current) {
        isFirstSnapshotRef.current = false;
        // Silently mark the existing backlog as printed so they don't spam on activation.
        const byOrder = new Map<string, string[]>();
        for (const c of candidates) {
          inFlightRef.current.add(c.itemId);
          if (!byOrder.has(c.orderId)) byOrder.set(c.orderId, []);
          byOrder.get(c.orderId)!.push(c.itemId);
        }
        for (const [orderId, itemIds] of byOrder) {
          markItemsAsPrinted(orderId, itemIds).finally(() => {
            for (const id of itemIds) inFlightRef.current.delete(id);
          });
        }
        return;
      }

      if (!enabledRef.current) return;
      if (candidates.length === 0) return;

      // Lock candidates so parallel snapshots don't re-process them.
      for (const c of candidates) inFlightRef.current.add(c.itemId);

      // Group by orderId + station with a short debounce to batch rapid additions.
      type GroupKey = string; // `${orderId}::${station}`
      const groups = new Map<GroupKey, { order: Order; station: Station; itemIds: string[]; items: { productName: string; quantity: number; notes?: string }[] }>();

      for (const c of candidates) {
        const key: GroupKey = `${c.orderId}::${c.station}`;
        if (!groups.has(key)) {
          groups.set(key, { order: c.order, station: c.station, itemIds: [], items: [] });
        }
        const g = groups.get(key)!;
        g.itemIds.push(c.itemId);
        g.items.push({ productName: c.productName, quantity: c.quantity, notes: c.notes });
      }

      for (const [key, group] of groups) {
        // Cancel any pending timer for this group and restart it.
        if (timersRef.current.has(key)) clearTimeout(timersRef.current.get(key)!);

        const timer = setTimeout(async () => {
          timersRef.current.delete(key);
          try {
            printStationTicket({
              station: group.station,
              tableNumber: group.order.tableNumber,
              tableName: group.order.tableName,
              waiterName: group.order.waiterName,
              items: group.items,
              paperSize: paperSizeRef.current,
            });
            await markItemsAsPrinted(group.order.id!, group.itemIds);
          } catch (err) {
            console.error('Auto-print error:', err);
          } finally {
            for (const id of group.itemIds) inFlightRef.current.delete(id);
          }
        }, 150);

        timersRef.current.set(key, timer);
      }
    });

    return () => {
      unsubscribe();
      for (const t of timersRef.current.values()) clearTimeout(t);
      timersRef.current.clear();
    };
  // Re-subscribe only when enabled state changes (stations changes are read via ref).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { enabled, setEnabled, stations, setStations };
};
