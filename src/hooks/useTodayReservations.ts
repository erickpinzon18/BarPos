// src/hooks/useTodayReservations.ts
import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { Reservation } from '../utils/types';

/**
 * Returns reservations with status 'aceptada' that fall on TODAY's date.
 * Only those with a tableId assigned are practically useful for the map/grid.
 */
export const useTodayReservations = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Build today's date range [00:00:00, 23:59:59]
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const q = query(
      collection(db, 'reservations'),
      where('reservationDate', '>=', Timestamp.fromDate(startOfDay)),
      where('reservationDate', '<=', Timestamp.fromDate(endOfDay))
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data: Reservation[] = [];
        snapshot.forEach((doc) => {
          const d = doc.data();
          // Filter accepted reservations client-side to avoid composite index
          if (d.status !== 'aceptada') return;
          data.push({
            id: doc.id,
            ...d,
            reservationDate: d.reservationDate?.toDate() || new Date(),
            createdAt: d.createdAt?.toDate() || new Date(),
            updatedAt: d.updatedAt?.toDate() || new Date(),
          } as Reservation);
        });
        setReservations(data);
        setLoading(false);
      },
      (error) => {
        console.error('Error loading today reservations:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { reservations, loading };
};
