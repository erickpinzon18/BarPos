import { useState, useCallback } from 'react';
import type { PaperSize } from '../utils/printTicket';

const STORAGE_KEY_PREFIX = 'barpos_paperSize_';

/**
 * Hook to manage paper size preference per user.
 * Persists the choice to localStorage keyed by userId.
 * Defaults to '58mm' if no preference is saved.
 */
export const usePaperSize = (userId?: string): [PaperSize, (size: PaperSize) => void] => {
  const storageKey = userId ? `${STORAGE_KEY_PREFIX}${userId}` : null;

  const [paperSize, setPaperSizeState] = useState<PaperSize>(() => {
    if (!storageKey) return '58mm';
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === '58mm' || saved === '80mm') return saved;
    } catch (_) { /* ignore */ }
    return '58mm';
  });

  const setPaperSize = useCallback((size: PaperSize) => {
    setPaperSizeState(size);
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, size);
      } catch (_) { /* ignore */ }
    }
  }, [storageKey]);

  return [paperSize, setPaperSize];
};

export default usePaperSize;
