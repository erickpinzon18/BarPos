// src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./routes/ProtectedRoute";

// Layouts
import AdminLayout from "./layouts/AdminLayout";
import WaiterLayout from "./layouts/WaiterLayout";
import KitchenLayout from "./layouts/KitchenLayout";

// Unified Login
import Login from "./pages/Login";

// Admin Pages
import AdminHome from "./pages/admin/Home";
import AdminKanban from "./pages/admin/Kanban";
import AdminCheckout from "./pages/admin/Checkout";
import AdminOrderDetails from "./pages/admin/OrderDetails";
import AdminKitchenControl from "./pages/admin/KitchenControl";
import Settings from "./pages/admin/Settings";
import AdminTickets from "./pages/admin/Tickets";
import ManageProducts from "./pages/admin/ManageProducts";
import Promotions from "./pages/admin/Promotions";
import DailySummary from "./pages/admin/DailySummary";
import Analytics from "./pages/admin/Analytics";
import Inventory from "./pages/admin/Inventory";
import InventoryStats from "./pages/admin/InventoryStats";
import AdminPrices from "./pages/admin/AdminPrices";
import BottleSearch from "./pages/admin/BottleSearch";

// Waiter Pages
import WaiterHome from "./pages/waiter/Home";
import WaiterOrderDetails from "./pages/waiter/OrderDetails";
import WaiterCheckout from "./pages/waiter/Checkout";
import WaiterKanban from "./pages/waiter/Kanban";
import WaiterMisVentas from "./pages/waiter/MisVentas";

// Kitchen Pages
import KitchenKanban from "./pages/kitchen/Kanban";
import KitchenHome from "./pages/kitchen/Home";
import KitchenOrderDetails from "./pages/kitchen/OrderDetails";
import KitchenCheckout from "./pages/kitchen/Checkout";
import KitchenVentas from "./pages/kitchen/Ventas";
import Reservations from "./pages/admin/Reservations";

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
      <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="home" element={<AdminHome />} />
          <Route path="kanban" element={<AdminKanban />} />
          <Route path="kanban/cocina" element={<AdminKanban />} />
          <Route path="kanban/barra" element={<AdminKanban />} />
          <Route path="reservations" element={<Reservations />} />
          <Route path="tickets" element={<AdminTickets />} />
          <Route path="manage-products" element={<ManageProducts />} />
          <Route path="promotions" element={<Promotions />} />
          <Route path="checkout/:orderId" element={<AdminCheckout />} />
          <Route path="order/:tableId" element={<AdminOrderDetails />} />
          <Route path="panel" element={<AdminKitchenControl />} />
          <Route path="cierre" element={<DailySummary />} />
          <Route path="ventas" element={<KitchenVentas />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="inventory-stats" element={<InventoryStats />} />
          <Route path="bottle-search" element={<BottleSearch />} />
          <Route path="prices" element={<AdminPrices />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Route>

      {/* Waiter Routes */}
      <Route element={<ProtectedRoute allowedRoles={["waiter", "capitan"]} />}>
        <Route path="/waiter" element={<WaiterLayout />}>
          <Route path="home" element={<WaiterHome />} />
          <Route path="kanban" element={<WaiterKanban />} />
          <Route path="mis-ventas" element={<WaiterMisVentas />} />
          <Route path="reservations" element={<Reservations />} />
          <Route path="order/:tableId" element={<WaiterOrderDetails />} />
          <Route path="checkout/:orderId" element={<WaiterCheckout />} />
        </Route>
      </Route>

      {/* Kitchen Routes */}
      <Route element={<ProtectedRoute allowedRoles={["kitchen", "barra"]} />}>
        <Route path="/kitchen" element={<KitchenLayout />}>
          <Route path="cocina" element={<KitchenKanban />} />
          <Route path="barra" element={<KitchenKanban />} />
          <Route path="mesas" element={<KitchenHome />} />
          <Route path="ventas" element={<KitchenVentas />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="order/:tableId" element={<KitchenOrderDetails />} />
          <Route path="checkout/:orderId" element={<KitchenCheckout />} />
        </Route>
      </Route>

      {/* Catch all - redirect to unified login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
