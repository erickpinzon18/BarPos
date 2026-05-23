// src/services/printQueueService.ts
import { collection, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { PaperSize } from '../utils/printTicket';

export interface PrintJob {
  id?: string;
  station: 'barra' | 'cocina';
  content: string;
  paperSize: PaperSize;
  fontSize: string;
  title: string;
  status: 'pending' | 'done';
  createdAt: Timestamp;
}

export const addPrintJob = async (
  station: 'barra' | 'cocina',
  content: string,
  paperSize: PaperSize,
  title: string,
  fontSize: string
): Promise<void> => {
  await addDoc(collection(db, 'printJobs'), {
    station,
    content,
    paperSize,
    fontSize,
    title,
    status: 'pending',
    createdAt: Timestamp.now(),
  } satisfies Omit<PrintJob, 'id'>);
};

export const markJobDone = async (jobId: string): Promise<void> => {
  await updateDoc(doc(db, 'printJobs', jobId), { status: 'done' });
};
