// src/components/ui/Modal.tsx
import React from 'react';
import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, footer, className }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={cn("relative z-10 w-full max-w-lg mx-4 rounded-xl bg-gray-800 border border-gray-700 shadow-xl", className)}>
        {title && (
          <div className="px-6 py-4 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
          </div>
        )}
        <div className="px-6 py-4 text-gray-200">
          {children}
        </div>
        {footer && (
          <div className="px-6 py-4 border-t border-gray-700 bg-gray-850 rounded-b-xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
