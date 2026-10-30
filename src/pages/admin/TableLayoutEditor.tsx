// src/pages/admin/TableLayoutEditor.tsx
// Editor del plano de mesas: arrastrar, cambiar tamaño, agregar/quitar mesas y decoración.
// Nada se guarda hasta presionar "Guardar plano" (un solo batch, ver venueLayoutService).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Plus, Save, Undo2, Trash2, Copy, Square, Circle, LayoutGrid, Loader2, Type, ArrowRightToLine, ArrowDownToLine, ArrowLeftToLine, ArrowUpToLine, Shrink } from 'lucide-react';
import { db } from '../../services/firebase';
import { getTablesRealtime } from '../../services/firestoreService';
import { parseVenueConfig, saveVenueLayout, type LayoutTableDraft } from '../../services/venueLayoutService';
import { useAuth } from '../../contexts/AuthContext';
import { DEFAULT_CANVAS, boxStyle, canvasBoxStyle, isTakeoutNumber, resolveLayout } from '../../utils/venueLayout';
import { tableLabel } from '../../utils/tableLabel';
import type { Table, TableLayout, VenueCanvas, VenueDecor } from '../../utils/types';

/** Cuánto crece el plano por clic al ampliarlo (unidades; 100 = área original) y su máximo */
const GROW_STEP = 25;
const MAX_CANVAS = 400;
const SNAP = 0.5;
const MIN_SIZE = 3;
const DEFAULT_SIZE = { w: 6, h: 9.5 };
/** Tamaños rápidos para mesas nuevas (unidades del plano) */
const SIZE_PRESETS = [
  { id: 'chica', label: 'Chica', w: 6, h: 9.5 },
  { id: 'mediana', label: 'Mediana', w: 8, h: 13 },
  { id: 'grande', label: 'Grande / Sala', w: 12, h: 22 },
] as const;

type Selection = { kind: 'table' | 'decor'; key: string } | null;
type Box = { x: number; y: number; w: number; h: number };

const snap = (n: number) => Math.round(n / SNAP) * SNAP;
const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);
const newKey = () => `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const normName = (v: number | string) => String(v).trim().toLowerCase();
/** "12" → 12 (número), "B3" → "B3" (texto), igual que las mesas existentes */
const parseNumber = (s: string): number | string => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : s.trim());

const displayName = (n: number | string) => (isTakeoutNumber(n) ? tableLabel(n) : String(n));

const TableLayoutEditor: React.FC = () => {
  const { currentUser } = useAuth();
  const [allTables, setAllTables] = useState<Table[]>([]);
  const [drafts, setDrafts] = useState<LayoutTableDraft[]>([]);
  const [decor, setDecor] = useState<VenueDecor[]>([]);
  const [canvas, setCanvas] = useState<VenueCanvas>(DEFAULT_CANVAS);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Selection>(null);
  const [nameInput, setNameInput] = useState('');
  const [newTable, setNewTable] = useState<{ name: string; size: (typeof SIZE_PRESETS)[number]['id']; shape: 'rect' | 'round' } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const drag = useRef<{ kind: 'table' | 'decor'; key: string; mode: 'move' | 'resize'; sx: number; sy: number; start: Box } | null>(null);

  // ─── Carga ────────────────────────────────────────────────────────────────
  const loadDecor = useCallback(async () => {
    const snap = await getDoc(doc(db, 'config', 'venueLayout'));
    const cfg = parseVenueConfig(snap.data());
    setDecor(cfg.decor);
    setCanvas(cfg.canvas);
  }, []);

  const resetFrom = useCallback((tables: Table[]) => {
    setDrafts(resolveLayout(tables).map(({ table, pos }) => ({ key: table.id, tableId: table.id, number: table.number, layout: { ...pos } })));
    setSelected(null);
    setDirty(false);
  }, []);

  useEffect(() => {
    const unsub = getTablesRealtime((tables) => {
      setAllTables(tables);
      if (!initialized.current) {
        initialized.current = true;
        resetFrom(tables);
        void loadDecor().finally(() => setLoaded(true));
      }
    });
    return () => unsub();
  }, [resetFrom, loadDecor]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const tableById = useMemo(() => new Map(allTables.map((t) => [t.id, t])), [allTables]);
  const offPlan = useMemo(() => {
    const used = new Set(drafts.map((d) => d.tableId).filter(Boolean));
    return allTables
      .filter((t) => !used.has(t.id))
      .sort((a, b) => String(a.number).localeCompare(String(b.number), 'es', { numeric: true }));
  }, [allTables, drafts]);

  const selTable = selected?.kind === 'table' ? drafts.find((d) => d.key === selected.key) : undefined;
  const selDecor = selected?.kind === 'decor' ? decor.find((d) => d.id === selected.key) : undefined;

  useEffect(() => {
    setNameInput(selTable ? String(selTable.number) : selDecor ? selDecor.label : '');
    // Solo al cambiar de selección
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.key]);

  // ─── Edición ──────────────────────────────────────────────────────────────
  const patchTable = (key: string, patch: Partial<Omit<LayoutTableDraft, 'layout'>> & { layout?: Partial<TableLayout> }) => {
    setDrafts((p) => p.map((d) => (d.key === key ? { ...d, ...patch, layout: { ...d.layout, ...(patch.layout ?? {}) } } : d)));
    setDirty(true);
  };
  const patchDecor = (id: string, patch: Partial<VenueDecor>) => {
    setDecor((p) => p.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    setDirty(true);
  };
  const setBox = (kind: 'table' | 'decor', key: string, box: Partial<Box>) =>
    kind === 'table' ? patchTable(key, { layout: box }) : patchDecor(key, box);
  const getBox = (kind: 'table' | 'decor', key: string): Box | undefined =>
    kind === 'table' ? drafts.find((d) => d.key === key)?.layout : decor.find((d) => d.id === key);

  /** Lugar libre cerca del centro para un elemento nuevo */
  const freeSpot = (w: number, h: number): { x: number; y: number } => {
    const boxes: Box[] = [...drafts.map((d) => d.layout), ...decor];
    const overlaps = (x: number, y: number) => boxes.some((b) => x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y);
    for (let r = 0; r < 60; r += 2) {
      for (const [dx, dy] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]]) {
        const x = clamp(snap(canvas.w / 2 - 3 + dx), 0, canvas.w - w);
        const y = clamp(snap(canvas.h / 2 - 5 + dy), 0, canvas.h - h);
        if (!overlaps(x, y)) return { x, y };
      }
    }
    return { x: clamp(snap(canvas.w / 2 - 3), 0, canvas.w - w), y: clamp(snap(canvas.h / 2 - 5), 0, canvas.h - h) };
  };

  const nextNumber = (): number => {
    const nums = [...allTables.map((t) => t.number), ...drafts.map((d) => d.number)]
      .map((n) => (typeof n === 'number' ? n : /^\d+$/.test(String(n)) ? Number(n) : 0));
    return Math.max(0, ...nums) + 1;
  };

  const addTable = (fromTable?: Table, base?: LayoutTableDraft) => {
    const size = base ? { w: base.layout.w, h: base.layout.h } : DEFAULT_SIZE;
    const spot = freeSpot(size.w, size.h);
    const d: LayoutTableDraft = {
      key: fromTable?.id ?? newKey(),
      tableId: fromTable?.id,
      number: fromTable ? fromTable.number : nextNumber(),
      layout: { ...spot, ...size, shape: base?.layout.shape ?? 'rect' },
    };
    setDrafts((p) => [...p, d]);
    setSelected({ kind: 'table', key: d.key });
    setDirty(true);
  };

  /** Valida el nombre de la ventana "Agregar mesa nueva" y la coloca en el plano */
  const confirmNewTable = () => {
    if (!newTable) return;
    const raw = newTable.name.trim();
    if (!raw) { toast.error('Escribe el número o nombre de la mesa'); return; }
    const value = parseNumber(raw);
    if (drafts.some((d) => normName(d.number) === normName(value))) { toast.error(`Ya hay una mesa "${raw}" en el plano`); return; }
    const existing = allTables.find((t) => normName(t.number) === normName(value));
    const preset = SIZE_PRESETS.find((p) => p.id === newTable.size)!;
    const spot = freeSpot(preset.w, preset.h);
    const d: LayoutTableDraft = {
      key: existing?.id ?? newKey(),
      tableId: existing?.id,
      number: existing ? existing.number : value,
      layout: { ...spot, w: preset.w, h: preset.h, shape: newTable.shape },
    };
    setDrafts((p) => [...p, d]);
    setSelected({ kind: 'table', key: d.key });
    setDirty(true);
    setNewTable(null);
    if (existing) toast.success(`La mesa "${raw}" ya existía; se agregó al plano`);
  };

  const addDecor = () => {
    const spot = freeSpot(14, 10);
    const d: VenueDecor = { id: newKey(), label: 'Barra', ...spot, w: 14, h: 10 };
    setDecor((p) => [...p, d]);
    setSelected({ kind: 'decor', key: d.id });
    setDirty(true);
  };

  const removeSelected = () => {
    if (!selected) return;
    if (selected.kind === 'table') setDrafts((p) => p.filter((d) => d.key !== selected.key));
    else setDecor((p) => p.filter((d) => d.id !== selected.key));
    setSelected(null);
    setDirty(true);
  };

  // ─── Tamaño del plano ─────────────────────────────────────────────────────
  /** Recorre todo el contenido (mesas y decoración) dx/dy unidades */
  const shiftAll = (dx: number, dy: number) => {
    if (!dx && !dy) return;
    setDrafts((p) => p.map((d) => ({ ...d, layout: { ...d.layout, x: d.layout.x + dx, y: d.layout.y + dy } })));
    setDecor((p) => p.map((d) => ({ ...d, x: d.x + dx, y: d.y + dy })));
  };
  type GrowSide = 'right' | 'down' | 'left' | 'up';
  const canGrow = (side: GrowSide) => (side === 'right' || side === 'left' ? canvas.w : canvas.h) + GROW_STEP <= MAX_CANVAS;
  const growCanvas = (side: GrowSide) => {
    if (!canGrow(side)) return;
    const horizontal = side === 'right' || side === 'left';
    // Hacia la izquierda / arriba: el espacio nuevo queda al inicio, así que todo se recorre
    if (side === 'left') shiftAll(GROW_STEP, 0);
    if (side === 'up') shiftAll(0, GROW_STEP);
    setCanvas((c) => ({
      ...c,
      w: horizontal ? c.w + GROW_STEP : c.w,
      h: horizontal ? c.h : c.h + GROW_STEP,
      ox: (c.ox ?? 0) + (side === 'left' ? GROW_STEP : 0),
      oy: (c.oy ?? 0) + (side === 'up' ? GROW_STEP : 0),
    }));
    setDirty(true);
  };
  /** Recorta el espacio vacío por los 4 lados, sin cortar contenido ni el área original */
  const shrinkCanvas = () => {
    const ox = canvas.ox ?? 0;
    const oy = canvas.oy ?? 0;
    const boxes: Box[] = [...drafts.map((d) => d.layout), ...decor, { x: ox, y: oy, ...DEFAULT_CANVAS }];
    const minX = Math.max(0, Math.floor(Math.min(...boxes.map((b) => b.x))));
    const minY = Math.max(0, Math.floor(Math.min(...boxes.map((b) => b.y))));
    const maxX = Math.ceil(Math.max(...boxes.map((b) => b.x + b.w)));
    const maxY = Math.ceil(Math.max(...boxes.map((b) => b.y + b.h)));
    const fit = { w: maxX - minX, h: maxY - minY, ox: ox - minX, oy: oy - minY };
    if (fit.w === canvas.w && fit.h === canvas.h && !minX && !minY) { toast('El plano ya está al mínimo'); return; }
    shiftAll(-minX, -minY);
    setCanvas(fit);
    setDirty(true);
  };

  /** Valida y aplica el nombre/número de la mesa seleccionada */
  const commitName = () => {
    if (selDecor) {
      const label = nameInput.trim();
      if (label && label !== selDecor.label) patchDecor(selDecor.id, { label });
      else setNameInput(selDecor.label);
      return;
    }
    if (!selTable) return;
    const raw = nameInput.trim();
    if (!raw || normName(raw) === normName(selTable.number)) { setNameInput(String(selTable.number)); return; }
    const value = parseNumber(raw);
    if (drafts.some((d) => d.key !== selTable.key && normName(d.number) === normName(value))) {
      toast.error(`Ya hay una mesa "${raw}" en el plano`);
      setNameInput(String(selTable.number));
      return;
    }
    const existing = allTables.find((t) => t.id !== selTable.tableId && normName(t.number) === normName(value));
    if (existing) {
      if (selTable.tableId) {
        toast.error(`Ya existe la mesa "${raw}". Agrégala desde "Mesas fuera del plano".`);
        setNameInput(String(selTable.number));
        return;
      }
      // Mesa nueva con el nombre de una que ya existe fuera del plano: se reutiliza esa mesa
      patchTable(selTable.key, { tableId: existing.id, number: existing.number });
      toast.success(`Se usará la mesa "${raw}" que ya existía`);
      return;
    }
    const current = selTable.tableId ? tableById.get(selTable.tableId) : undefined;
    if (current && current.status === 'ocupada') {
      toast.error('No se puede renombrar una mesa con cuenta abierta');
      setNameInput(String(selTable.number));
      return;
    }
    patchTable(selTable.key, { number: value });
  };

  // ─── Arrastre / tamaño ────────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent, kind: 'table' | 'decor', key: string, mode: 'move' | 'resize') => {
    e.stopPropagation();
    e.preventDefault();
    const start = getBox(kind, key);
    if (!start) return;
    setSelected({ kind, key });
    drag.current = { kind, key, mode, sx: e.clientX, sy: e.clientY, start: { ...start } };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!d || !rect) return;
    const dx = ((e.clientX - d.sx) / rect.width) * canvas.w;
    const dy = ((e.clientY - d.sy) / rect.height) * canvas.h;
    if (d.mode === 'move') {
      setBox(d.kind, d.key, {
        x: clamp(snap(d.start.x + dx), 0, canvas.w - d.start.w),
        y: clamp(snap(d.start.y + dy), 0, canvas.h - d.start.h),
      });
    } else {
      setBox(d.kind, d.key, {
        w: clamp(snap(d.start.w + dx), MIN_SIZE, canvas.w - d.start.x),
        h: clamp(snap(d.start.h + dy), MIN_SIZE, canvas.h - d.start.y),
      });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!drag.current) return;
    drag.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  // Flechas mueven, Supr quita (cuando no se está escribiendo)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selected) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const step = e.shiftKey ? 2 : SNAP;
      const box = getBox(selected.kind, selected.key);
      if (!box) return;
      const moves: Record<string, Partial<Box>> = {
        ArrowLeft: { x: clamp(box.x - step, 0, canvas.w - box.w) },
        ArrowRight: { x: clamp(box.x + step, 0, canvas.w - box.w) },
        ArrowUp: { y: clamp(box.y - step, 0, canvas.h - box.h) },
        ArrowDown: { y: clamp(box.y + step, 0, canvas.h - box.h) },
      };
      if (moves[e.key]) { e.preventDefault(); setBox(selected.kind, selected.key, moves[e.key]); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSelected(); }
      else if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ─── Guardar ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const names = drafts.map((d) => normName(d.number));
    if (names.some((n) => !n)) { toast.error('Hay una mesa sin nombre'); return; }
    const dup = names.find((n, i) => names.indexOf(n) !== i);
    if (dup) { toast.error(`La mesa "${dup}" está repetida`); return; }
    if (decor.some((d) => !d.label.trim())) { toast.error('Hay una decoración sin texto'); return; }

    const keptIds = new Set(drafts.map((d) => d.tableId).filter(Boolean));
    const stored = allTables.some((t) => !!t.layout);
    const prevOnPlan = stored
      ? allTables.filter((t) => t.layout)
      : resolveLayout(allTables).map((r) => r.table);
    const leaving = prevOnPlan.filter((t) => !keptIds.has(t.id));
    const leavingBusy = leaving.filter((t) => t.status === 'ocupada');
    const msg = [
      `Se guardará el plano con ${drafts.length} mesas.`,
      leaving.length ? `\nSe quitan del plano: ${leaving.map((t) => displayName(t.number)).join(', ')} (no se borran, se pueden volver a agregar).` : '',
      leavingBusy.length ? `\n⚠️ Con cuenta abierta: ${leavingBusy.map((t) => displayName(t.number)).join(', ')}. Seguirán en "Otras mesas abiertas" hasta cobrarse.` : '',
      '\n\n¿Continuar?',
    ].join('');
    if (!window.confirm(msg)) return;

    setSaving(true);
    try {
      const r = await saveVenueLayout(drafts, decor, canvas, allTables, currentUser?.displayName || currentUser?.email || 'Admin');
      toast.success(`Plano guardado${r.created ? ` · ${r.created} mesa(s) nueva(s)` : ''}`);
      setDirty(false);
      // Re-sincroniza con lo guardado (ids de mesas nuevas)
      initialized.current = false;
    } catch (err) {
      console.error(err);
      toast.error((err as Error)?.message ?? 'Error al guardar el plano');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (dirty && !window.confirm('¿Descartar los cambios sin guardar?')) return;
    resetFrom(allTables);
    void loadDecor();
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 className="animate-spin mr-2" size={20} /> Cargando plano…
      </div>
    );
  }

  const inputCls = 'w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500';
  const selBox = selected ? getBox(selected.kind, selected.key) : undefined;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><LayoutGrid size={24} /> Plano de mesas</h1>
          <p className="text-sm text-gray-400">Arrastra para mover, jala la esquina para cambiar el tamaño. Los cambios se aplican al presionar Guardar.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setNewTable({ name: String(nextNumber()), size: 'chica', shape: 'rect' })}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
          >
            <Plus size={16} /> Agregar mesa nueva
          </button>
          <button onClick={addDecor} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold">
            <Type size={16} /> Decoración
          </button>
          <button onClick={handleDiscard} disabled={!dirty || saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white text-sm">
            <Undo2 size={16} /> Descartar
          </button>
          <button onClick={handleSave} disabled={!dirty || saving} className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-sm font-semibold">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar plano
          </button>
        </div>
      </div>

      {dirty && <p className="text-xs text-amber-400">Hay cambios sin guardar.</p>}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4">
        {/* Lienzo */}
        <div className="w-full overflow-x-auto rounded-2xl" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
          <div
            ref={canvasRef}
            className="relative select-none"
            style={{
              ...canvasBoxStyle(canvas),
              backgroundColor: '#0d1117',
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
              backgroundSize: `${500 / canvas.w}% ${500 / canvas.h}%`,
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
            }}
            onPointerDown={() => setSelected(null)}
          >
            {(canvas.w > DEFAULT_CANVAS.w || canvas.h > DEFAULT_CANVAS.h) && (
              <div
                className="absolute pointer-events-none"
                style={{ ...boxStyle({ x: canvas.ox ?? 0, y: canvas.oy ?? 0, ...DEFAULT_CANVAS }, canvas), border: '1px dashed rgba(239,68,68,0.35)', borderRadius: '16px' }}
              >
                <span className="absolute right-2 bottom-1 text-[10px] text-red-400/70">Área original</span>
              </div>
            )}
            {decor.map((d) => {
              const isSel = selected?.kind === 'decor' && selected.key === d.id;
              return (
                <div
                  key={d.id}
                  onPointerDown={(e) => onPointerDown(e, 'decor', d.id, 'move')}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  className="absolute flex items-center justify-center cursor-move"
                  style={{
                    ...boxStyle(d, canvas),
                    borderRadius: '12px', touchAction: 'none',
                    background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.03) 0 8px, rgba(255,255,255,0.06) 8px 16px)',
                    border: isSel ? '2px solid #ef4444' : '1px dashed rgba(156,163,175,0.45)',
                  }}
                >
                  <span className="text-gray-400 font-semibold tracking-widest uppercase pointer-events-none" style={{ fontSize: '12px' }}>{d.label}</span>
                  {isSel && <ResizeHandle onPointerDown={(e) => onPointerDown(e, 'decor', d.id, 'resize')} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />}
                </div>
              );
            })}

            {drafts.map((d) => {
              const isSel = selected?.kind === 'table' && selected.key === d.key;
              const t = d.tableId ? tableById.get(d.tableId) : undefined;
              const busy = t?.status === 'ocupada';
              return (
                <div
                  key={d.key}
                  onPointerDown={(e) => onPointerDown(e, 'table', d.key, 'move')}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  className="absolute flex flex-col items-center justify-center cursor-move"
                  style={{
                    ...boxStyle(d.layout, canvas),
                    borderRadius: d.layout.shape === 'round' ? '50%' : '8px',
                    touchAction: 'none',
                    backgroundColor: isSel ? 'rgba(185,28,28,0.45)' : 'rgba(31,41,55,0.95)',
                    border: isSel ? '2px solid #ef4444' : busy ? '2px solid rgba(239,68,68,0.6)' : '1px solid rgba(75,85,99,0.7)',
                  }}
                  title={busy ? 'Cuenta abierta' : undefined}
                >
                  <span className="font-bold text-white leading-none pointer-events-none" style={{ fontSize: '12px' }}>{displayName(d.number)}</span>
                  {!d.tableId && <span className="text-[9px] text-emerald-400 leading-none mt-0.5 pointer-events-none">nueva</span>}
                  {isSel && <ResizeHandle onPointerDown={(e) => onPointerDown(e, 'table', d.key, 'resize')} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Panel */}
        <div className="space-y-4">
          <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
            {!selected || !selBox ? (
              <p className="text-sm text-gray-400">Selecciona una mesa o decoración para editarla. Usa las flechas para moverla (Shift = más rápido) y Supr para quitarla.</p>
            ) : (
              <div className="space-y-3">
                <h3 className="text-white font-semibold">{selected.kind === 'table' ? 'Mesa' : 'Decoración'}</h3>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{selected.kind === 'table' ? 'Número o nombre (ej. 12, B3, Sala 1)' : 'Texto'}</label>
                  <input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onBlur={commitName}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    className={inputCls}
                  />
                  {selTable && isTakeoutNumber(selTable.number) && <p className="text-xs text-gray-500 mt-1">Se muestra como “{displayName(selTable.number)}”.</p>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(['w', 'h'] as const).map((k) => (
                    <div key={k}>
                      <label className="block text-xs text-gray-400 mb-1">{k === 'w' ? 'Ancho %' : 'Alto %'}</label>
                      <input
                        type="number" min={MIN_SIZE} max={k === 'w' ? canvas.w : canvas.h} step={SNAP}
                        value={selBox[k]}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (isNaN(v)) return;
                          const max = (k === 'w' ? canvas.w - selBox.x : canvas.h - selBox.y);
                          setBox(selected.kind, selected.key, { [k]: clamp(v, MIN_SIZE, max) });
                        }}
                        className={inputCls}
                      />
                    </div>
                  ))}
                </div>
                {selTable && (
                  <div className="flex gap-2">
                    {(['rect', 'round'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => patchTable(selTable.key, { layout: { shape: s } })}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm ${
                          (selTable.layout.shape ?? 'rect') === s ? 'bg-red-600 text-white' : 'bg-gray-900 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        {s === 'rect' ? <Square size={14} /> : <Circle size={14} />} {s === 'rect' ? 'Cuadrada' : 'Redonda'}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  {selTable && (
                    <button onClick={() => addTable(undefined, selTable)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-gray-900 hover:bg-gray-700 text-gray-200 text-sm">
                      <Copy size={14} /> Duplicar
                    </button>
                  )}
                  <button onClick={removeSelected} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-gray-900 hover:bg-red-900/50 text-red-400 text-sm">
                    <Trash2 size={14} /> Quitar
                  </button>
                </div>
                {selTable?.tableId && tableById.get(selTable.tableId)?.status === 'ocupada' && (
                  <p className="text-xs text-red-400">Esta mesa tiene una cuenta abierta.</p>
                )}
              </div>
            )}
          </div>

          <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
            <h3 className="text-white font-semibold mb-1">Tamaño del plano</h3>
            <p className="text-xs text-gray-400 mb-3">
              Amplíalo para agregar el patio u otra área; las mesas actuales no se mueven. Agrega una decoración “Patio” para marcarlo.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {([
                ['up', 'Hacia arriba', ArrowUpToLine],
                ['down', 'Hacia abajo', ArrowDownToLine],
                ['left', 'A la izquierda', ArrowLeftToLine],
                ['right', 'A la derecha', ArrowRightToLine],
              ] as const).map(([side, label, Icon]) => (
                <button
                  key={side}
                  onClick={() => growCanvas(side)}
                  disabled={!canGrow(side)}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-gray-200 text-sm"
                >
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
            <button onClick={shrinkCanvas} className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-gray-900 hover:bg-gray-700 text-gray-300 text-sm">
              <Shrink size={14} /> Ajustar al contenido
            </button>
            <p className="text-xs text-gray-500 mt-2">
              Tamaño: {Math.round(canvas.w)}% × {Math.round(canvas.h)}% del área original
            </p>
          </div>

          <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
            <h3 className="text-white font-semibold mb-1">Mesas fuera del plano</h3>
            <p className="text-xs text-gray-400 mb-3">Ya existen en el sistema pero no están en el mapa. Toca una para agregarla.</p>
            {offPlan.length === 0 ? (
              <p className="text-xs text-gray-500">Todas las mesas están en el plano.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto">
                {offPlan.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => addTable(t)}
                    className="px-2.5 py-1 rounded-lg bg-gray-900 hover:bg-gray-700 border border-gray-700 text-gray-200 text-xs"
                  >
                    + {displayName(t.number)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {newTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setNewTable(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white">Agregar mesa nueva</h2>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Número o nombre (ej. 25, P8, Patio 1)</label>
              <input
                autoFocus
                value={newTable.name}
                onChange={(e) => setNewTable({ ...newTable, name: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') confirmNewTable(); if (e.key === 'Escape') setNewTable(null); }}
                onFocus={(e) => e.target.select()}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Tamaño</label>
              <div className="grid grid-cols-3 gap-2">
                {SIZE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setNewTable({ ...newTable, size: p.id })}
                    className={`py-2 rounded-lg text-sm ${newTable.size === p.id ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Forma</label>
              <div className="grid grid-cols-2 gap-2">
                {(['rect', 'round'] as const).map((sh) => (
                  <button
                    key={sh}
                    onClick={() => setNewTable({ ...newTable, shape: sh })}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm ${newTable.shape === sh ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                  >
                    {sh === 'rect' ? <Square size={14} /> : <Circle size={14} />} {sh === 'rect' ? 'Cuadrada' : 'Redonda'}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-500">Aparece en un lugar libre del plano; luego arrástrala a su lugar y presiona “Guardar plano”.</p>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setNewTable(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancelar</button>
              <button onClick={confirmNewTable} className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold">
                <Plus size={16} /> Agregar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ResizeHandle: React.FC<{
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}> = (p) => (
  <div
    {...p}
    className="absolute -right-1.5 -bottom-1.5 w-4 h-4 rounded-full bg-red-500 border-2 border-white cursor-nwse-resize"
    style={{ touchAction: 'none' }}
    title="Cambiar tamaño"
  />
);

export default TableLayoutEditor;
