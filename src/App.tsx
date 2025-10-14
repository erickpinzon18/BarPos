// src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';

// Layouts
import AdminLayout from './layouts/AdminLayout';
import WaiterLayout from './layouts/WaiterLayout';
import KitchenLayout from './layouts/KitchenLayout';

// Unified Login
import Login from './pages/Login';

// Admin Pages
import AdminHome from './pages/admin/Home';
import AdminKanban from './pages/admin/Kanban';
import AdminCheckout from './pages/admin/Checkout';
import AdminOrderDetails from './pages/admin/OrderDetails';
import AdminKitchenControl from './pages/admin/KitchenControl';
import Settings from './pages/admin/Settings';
import AdminTickets from './pages/admin/Tickets';
import ManageProducts from './pages/admin/ManageProducts';
import DailySummary from './pages/admin/DailySummary';
import TerminalPayments from './pages/admin/TerminalPayments';

// Waiter Pages
import WaiterHome from './pages/waiter/Home';
import WaiterOrderDetails from './pages/waiter/OrderDetails';
import WaiterCheckout from './pages/waiter/Checkout';

// Kitchen Pages
import KitchenKanban from './pages/kitchen/Kanban';

function App() {
  return (
    <Routes>
      {/* Unified Login - Default route */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      
      {/* Legacy login routes - redirect to unified login */}
      <Route path="/admin/login" element={<Navigate to="/login" replace />} />
      <Route path="/waiter/login" element={<Navigate to="/login" replace />} />
      <Route path="/kitchen/login" element={<Navigate to="/login" replace />} />
      
      {/* Admin Routes */}
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="home" element={<AdminHome />} />
          <Route path="kanban" element={<AdminKanban />} />
          <Route path="kanban/cocina" element={<AdminKanban />} />
          <Route path="kanban/barra" element={<AdminKanban />} />
          <Route path="tickets" element={<AdminTickets />} />
          <Route path="pagos-terminal" element={<TerminalPayments />} />
          <Route path="manage-products" element={<ManageProducts />} />
          <Route path="checkout/:orderId" element={<AdminCheckout />} />
          <Route path="order/:tableId" element={<AdminOrderDetails />} />
          <Route path="panel" element={<AdminKitchenControl />} />
          <Route path="cierre" element={<DailySummary />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Route>

      {/* Waiter Routes */}
      <Route element={<ProtectedRoute allowedRoles={['waiter']} />}>
        <Route path="/waiter" element={<WaiterLayout />}>
          <Route path="home" element={<WaiterHome />} />
          <Route path="order/:tableId" element={<WaiterOrderDetails />} />
          <Route path="checkout/:orderId" element={<WaiterCheckout />} />
        </Route>
      </Route>

      {/* Kitchen Routes */}
      <Route element={<ProtectedRoute allowedRoles={['kitchen', 'barra']} />}>
        <Route path="/kitchen" element={<KitchenLayout />}>
          <Route path="cocina" element={<KitchenKanban />} />
          <Route path="barra" element={<KitchenKanban />} />
        </Route>
      </Route>

      {/* Catch all - redirect to unified login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
