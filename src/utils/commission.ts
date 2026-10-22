// src/utils/commission.ts
// Comisión del mesero: monto fijo por unidad vendida (tabla del dueño). Se le cobra al
// cliente encima del precio de la carta y se le paga al mesero en efectivo al cierre.
import { useEffect, useState } from 'react';
import type { OrderItem } from './types';
import { getProducts } from '../services/firestoreService';

/** productId -> comisión por unidad (null = pendiente de definir) */
export type CommissionCatalog = Map<string, number | null>;

/** Comisión por unidad: la copiada al item al pedirlo o, si no la trae, la del catálogo actual. */
export const itemCommissionPerUnit = (i: OrderItem, catalog: CommissionCatalog): number | null =>
  typeof i.tipPerUnit === 'number' ? i.tipPerUnit : (catalog.get(i.productId) ?? null);

/** Comisión total de una lista de items (ignora eliminados y pendientes). */
export const getItemsCommission = (items: OrderItem[], catalog: CommissionCatalog): number =>
  items.reduce((s, i) => {
    if (i.isDeleted) return s;
    const cpu = itemCommissionPerUnit(i, catalog);
    return cpu === null ? s : s + cpu * (i.quantity ?? 1);
  }, 0);

/** Carga el catálogo de comisiones (para items pedidos antes de definir su comisión). */
export const useCommissionCatalog = (): CommissionCatalog => {
  const [catalog, setCatalog] = useState<CommissionCatalog>(new Map());
  useEffect(() => {
    let mounted = true;
    getProducts().then(res => {
      if (!mounted || !res.success || !res.data) return;
      setCatalog(new Map(res.data.map(p => [p.id, typeof p.tipPerUnit === 'number' ? p.tipPerUnit : null])));
    });
    return () => { mounted = false; };
  }, []);
  return catalog;
};
