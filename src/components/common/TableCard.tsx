// src/components/common/TableCard.tsx
import React, { memo } from 'react';
import type { Table } from '../../utils/types';
import { Card, CardContent, CardHeader } from '../ui/Card';

interface TableCardProps {
  table: Table;
  onClick?: () => void;
}

const getStatusStyles = (status: Table['status']) => {
  switch (status) {
    case 'libre':
      return 'bg-green-600/20 text-green-400';
    case 'ocupada':
      return 'bg-red-600/20 text-red-400';
    case 'reservada':
      return 'bg-yellow-600/20 text-yellow-400';
    case 'limpieza':
      return 'bg-blue-600/20 text-blue-400';
    default:
      return 'bg-gray-600/20 text-gray-400';
  }
};

export const TableCard: React.FC<TableCardProps> = memo(({ table, onClick }) => {
  return (
    <button 
      onClick={onClick} 
      className="text-left w-full table-card"
      disabled={!onClick}
    >
      <Card className="hover:border-amber-500 transition-colors h-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold">Mesa {table.number}</span>
            <span className={`text-xs px-2 py-1 rounded-full capitalize ${getStatusStyles(table.status)}`}>
              {table.status}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-300">
            Capacidad: {table.capacity} persona{table.capacity !== 1 ? 's' : ''}
          </div>
          {table.waiterName && (
            <div className="text-sm text-gray-400 mt-1">
              Mesero: {table.waiterName}
            </div>
          )}
          {table.status === 'ocupada' && table.currentOrderId && (
            <div className="text-xs text-amber-400 mt-1">
              Orden activa
            </div>
          )}
        </CardContent>
      </Card>
    </button>
  );
});

TableCard.displayName = 'TableCard';

export default TableCard;
