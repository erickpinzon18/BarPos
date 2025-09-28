// src/hooks/useTables.ts
import { useEffect, useState } from 'react';
import type { Table } from '../utils/types';
import { getTablesRealtime } from '../services/firestoreService';
import { showErrorToast } from '../utils/errorHandler';

export const useTables = () => {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const unsubscribe = getTablesRealtime((data) => {
        setTables(data);
        setLoading(false);
        setError(null);
      });
      
      return () => {
        try {
          unsubscribe();
        } catch (err) {
          console.error('Error unsubscribing from tables:', err);
        }
      };
    } catch (err) {
      console.error('Error setting up tables listener:', err);
      setError('Error al cargar las mesas');
      setLoading(false);
      showErrorToast('Error al cargar las mesas');
    }
  }, []);

  return { tables, loading, error };
};
