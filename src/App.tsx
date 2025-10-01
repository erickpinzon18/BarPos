// src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';

// Layouts
import AdminLayout from './layouts/AdminLayout';
import WaiterLayout from './layouts/WaiterLayout';
import KitchenLayout from './layouts/KitchenLayout';

// Admin Pages
import AdminLogin from './pages/admin/Login';
import AdminHome from './pages/admin/Home';
import AdminKanban from './pages/admin/Kanban';
import AdminCheckout from './pages/admin/Checkout';
import AdminOrderDetails from './pages/admin/OrderDetails';
import AdminKitchenControl from './pages/admin/KitchenControl';
import AdminTickets from './pages/admin/Tickets';
import ManageProducts from './pages/admin/ManageProducts';

// Waiter Pages
import WaiterLogin from './pages/waiter/Login';
import WaiterHome from './pages/waiter/Home';
import WaiterCheckout from './pages/waiter/Checkout';

// Kitchen Pages
import KitchenLogin from './pages/kitchen/Login';
import KitchenKanban from './pages/kitchen/Kanban';

function App() {
  return (
    <Routes>
      {/* Default redirect to admin login */}
      <Route path="/" element={<Navigate to="/admin/login" replace />} />
      
      {/* Admin Routes */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="home" element={<AdminHome />} />
          <Route path="kanban" element={<AdminKanban />} />
          <Route path="kanban/cocina" element={<AdminKanban />} />
          <Route path="kanban/barra" element={<AdminKanban />} />
          <Route path="tickets" element={<AdminTickets />} />
          <Route path="manage-products" element={<ManageProducts />} />
          {/* <Route path="checkout" element={<AdminCheckout />} /> */}
          <Route path="checkout/:orderId" element={<AdminCheckout />} />
          <Route path="order/:tableId" element={<AdminOrderDetails />} />
          <Route path="kitchen" element={<AdminKitchenControl />} />
        </Route>
      </Route>

      {/* Waiter Routes */}
      <Route path="/waiter/login" element={<WaiterLogin />} />
      <Route element={<ProtectedRoute allowedRoles={['waiter']} />}>
        <Route path="/waiter" element={<WaiterLayout />}>
          <Route path="home" element={<WaiterHome />} />
          <Route path="checkout" element={<WaiterCheckout />} />
        </Route>
      </Route>

      {/* Kitchen Routes */}
      <Route path="/kitchen/login" element={<KitchenLogin />} />
      <Route element={<ProtectedRoute allowedRoles={['kitchen']} />}>
        <Route path="/kitchen" element={<KitchenLayout />}>
          <Route path="kanban" element={<KitchenKanban />} />
        </Route>
      </Route>

      {/* Catch all - redirect to admin login */}
      <Route path="*" element={<Navigate to="/admin/login" replace />} />
    </Routes>
  );
}

export default App;
