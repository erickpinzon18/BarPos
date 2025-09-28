// src/components/common/KitchenStatusControl.tsx
import React, { useState } from 'react';
import { ChefHat, Clock, CheckCircle, Truck } from 'lucide-react';
import type { OrderItemStatus } from '../../utils/types';

interface KitchenStatusControlProps {
  currentStatus: OrderItemStatus;
  onStatusChange: (newStatus: OrderItemStatus) => Promise<void>;
  itemName: string;
  category: string;
  disabled?: boolean;
}

const KitchenStatusControl: React.FC<KitchenStatusControlProps> = ({
  currentStatus,
  onStatusChange,
  itemName,
  category,
  disabled = false
}) => {
  const [loading, setLoading] = useState(false);

  const handleStatusChange = async (newStatus: OrderItemStatus) => {
    if (loading || disabled || newStatus === currentStatus) return;

    setLoading(true);
    try {
      await onStatusChange(newStatus);
    } catch (error) {
      console.error('Error changing status:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status: OrderItemStatus) => {
    switch (status) {
      case 'pendiente':
        return {
          icon: Clock,
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-900/20',
          borderColor: 'border-yellow-600',
          label: 'Pendiente'
        };
      case 'en_preparacion':
        return {
          icon: ChefHat,
          color: 'text-orange-400',
          bgColor: 'bg-orange-900/20',
          borderColor: 'border-orange-600',
          label: 'Preparando'
        };
      case 'listo':
        return {
          icon: CheckCircle,
          color: 'text-green-400',
          bgColor: 'bg-green-900/20',
          borderColor: 'border-green-600',
          label: 'Listo'
        };
      case 'entregado':
        return {
          icon: Truck,
          color: 'text-blue-400',
          bgColor: 'bg-blue-900/20',
          borderColor: 'border-blue-600',
          label: 'Entregado'
        };
      default:
        return {
          icon: Clock,
          color: 'text-gray-400',
          bgColor: 'bg-gray-900/20',
          borderColor: 'border-gray-600',
          label: 'Desconocido'
        };
    }
  };

  const statuses: OrderItemStatus[] = ['pendiente', 'en_preparacion', 'listo', 'entregado'];

  // Determinar si es item de cocina o barra
  const isKitchenItem = category === 'Comida' || category === 'Entrada';
  const workstation = isKitchenItem ? '🍳 Cocina' : '🍹 Barra';

  return (
    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-white">{itemName}</h4>
          <p className="text-xs text-gray-400">{workstation} • {category}</p>
        </div>
        {loading && (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-400"></div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {statuses.map((status) => {
          const config = getStatusConfig(status);
          const Icon = config.icon;
          const isActive = currentStatus === status;
          const isClickable = !disabled && !loading && status !== currentStatus;

          return (
            <button
              key={status}
              onClick={() => handleStatusChange(status)}
              disabled={!isClickable}
              className={`
                flex items-center justify-center p-2 rounded-lg text-xs font-medium transition-all
                ${isActive 
                  ? `${config.bgColor} ${config.color} border ${config.borderColor}` 
                  : 'bg-gray-700 text-gray-400 border border-gray-600 hover:bg-gray-600'
                }
                ${isClickable ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed opacity-60'}
              `}
            >
              <Icon className="w-3 h-3 mr-1" />
              {config.label}
            </button>
          );
        })}
      </div>

      {/* Progress indicator */}
      <div className="mt-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Progreso</span>
          <span>{Math.round((statuses.indexOf(currentStatus) + 1) / statuses.length * 100)}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-1">
          <div 
            className="bg-amber-400 h-1 rounded-full transition-all duration-300"
            style={{ width: `${(statuses.indexOf(currentStatus) + 1) / statuses.length * 100}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default KitchenStatusControl;
