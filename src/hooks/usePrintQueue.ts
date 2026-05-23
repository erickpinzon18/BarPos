// src/hooks/usePrintQueue.ts
import { useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { markJobDone } from '../services/printQueueService';
import { sendToPrinter } from '../utils/printTicket';
import type { PaperSize } from '../utils/printTicket';

export const usePrintQueue = (station: 'barra' | 'cocina'): void => {
  // Record the timestamp when the hook mounts so we ignore older jobs
  const mountedAtRef = useRef<number>(Date.now());
  const processingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const mountedAt = mountedAtRef.current;

    const q = query(
      collection(db, 'printJobs'),
      where('station', '==', station),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'asc')
    );

    const unsub = onSnapshot(q, snapshot => {
      snapshot.docs.forEach(async docSnap => {
        const jobId = docSnap.id;
        if (processingRef.current.has(jobId)) return;

        const data = docSnap.data();
        const createdMs: number =
          typeof data.createdAt?.toMillis === 'function'
            ? data.createdAt.toMillis()
            : Date.now();

        // Skip jobs that existed before this device opened the Kanban
        if (createdMs <= mountedAt) {
          processingRef.current.add(jobId);
          await markJobDone(jobId).catch(() => {});
          return;
        }

        processingRef.current.add(jobId);
        try {
          sendToPrinter(
            data.content as string,
            data.paperSize as PaperSize,
            data.title as string,
            data.fontSize as string
          );
        } catch (err) {
          console.error('Error printing job:', err);
        }
        await markJobDone(jobId).catch(() => {});
      });
    });

    return () => unsub();
  }, [station]);
};
