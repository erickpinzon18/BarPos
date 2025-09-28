// src/pages/waiter/Home.tsx
import React from 'react';
import { useTables } from '../../hooks/useTables';
import TableCard from '../../components/common/TableCard';

const WaiterHome: React.FC = () => {
  const { tables, loading } = useTables();

  if (loading) {
    return <div className="text-center py-8">Cargando mesas...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Panel de Mesero - Mesas</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {tables.map((table) => (
          <TableCard
            key={table.id}
            table={table}
            onClick={() => console.log('Table clicked:', table.id)}
          />
        ))}
      </div>
    </div>
  );
};

export default WaiterHome;
