// src/components/common/OrderTicket.tsx
import React from 'react';
import type { Order } from '../../utils/types';
import { Card, CardContent, CardHeader } from '../ui/Card';

export const OrderTicket: React.FC<{ order: Order }> = ({ order }) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <span className="font-semibold">Mesa {order.tableNumber}</span>
          <span className="text-sm text-gray-400">Mesero: {order.waiterName}</span>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {order.items.map(item => (
            <li key={item.id} className="flex items-center justify-between">
              <span>{item.quantity}x {item.productName}</span>
              <span className="text-gray-400">{item.status}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

export default OrderTicket;
