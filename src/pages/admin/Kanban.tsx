// src/pages/admin/Kanban.tsx
import React from 'react';
import { useKitchenOrders } from '../../hooks/useKitchenOrders';
import KanbanColumn from '../../components/common/KanbanColumn';
import OrderTicket from '../../components/common/OrderTicket';

const AdminKanban: React.FC = () => {
  const { orders, loading } = useKitchenOrders();

  if (loading) {
    return <div className="text-center py-8">Cargando pedidos...</div>;
  }

  const pendingOrders = orders.filter(order => 
    order.items.some(item => item.status === 'pendiente' && item.category === 'Comida')
  );
  
  const inProgressOrders = orders.filter(order => 
    order.items.some(item => item.status === 'en_preparacion' && item.category === 'Comida')
  );
  
  const readyOrders = orders.filter(order => 
    order.items.some(item => item.status === 'listo' && item.category === 'Comida')
  );

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Kanban de Cocina</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KanbanColumn title="Pendientes">
          {pendingOrders.map(order => (
            <OrderTicket key={order.id} order={order} />
          ))}
        </KanbanColumn>
        
        <KanbanColumn title="En Preparación">
          {inProgressOrders.map(order => (
            <OrderTicket key={order.id} order={order} />
          ))}
        </KanbanColumn>
        
        <KanbanColumn title="Listos">
          {readyOrders.map(order => (
            <OrderTicket key={order.id} order={order} />
          ))}
        </KanbanColumn>
      </div>
    </div>
  );
};

export default AdminKanban;
