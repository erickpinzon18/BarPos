// src/pages/admin/Delivery.tsx
import React from 'react';
import DeliveryOrderList from '../../components/common/DeliveryOrderList';

const AdminDelivery: React.FC = () => <DeliveryOrderList basePath="/admin" accentColor="red" showAllStatuses />;

export default AdminDelivery;
