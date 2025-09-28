// src/components/ui/Card.tsx
import React from 'react';
import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface CardProps {
  className?: string;
  children: ReactNode;
}

export const Card: React.FC<CardProps> = ({ className, children }) => (
  <div className={cn('rounded-xl border border-gray-700 bg-gray-800 text-gray-200 shadow-sm', className)}>
    {children}
  </div>
);

export const CardHeader: React.FC<{ className?: string; children: ReactNode }>= ({ className, children }) => (
  <div className={cn('p-4 border-b border-gray-700', className)}>{children}</div>
);

export const CardContent: React.FC<{ className?: string; children: ReactNode }>= ({ className, children }) => (
  <div className={cn('p-4', className)}>{children}</div>
);

export const CardFooter: React.FC<{ className?: string; children: ReactNode }>= ({ className, children }) => (
  <div className={cn('p-4 border-t border-gray-700', className)}>{children}</div>
);
