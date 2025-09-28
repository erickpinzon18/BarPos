// src/components/common/KanbanColumn.tsx
import React from 'react';

interface KanbanColumnProps {
  title: string;
  children?: React.ReactNode;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({ title, children }) => {
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
      <h3 className="text-white font-semibold mb-4">{title}</h3>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  );
};

export default KanbanColumn;
