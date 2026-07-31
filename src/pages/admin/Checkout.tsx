// src/pages/admin/Checkout.tsx
import React, { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useOrderById, useOrderByTableId } from "../../hooks/useOrders";
import type { Order, CardType } from "../../utils/types";
import { closeTable, closeTableAsCourtesy, getConfig, checkOperationNumberUnique, updateOrderCashNotes } from "../../services/firestoreService";
import { verifyUserPin } from "../../services/orderService";
import PinModal from "../../components/common/PinModal";
import { printTicket } from "../../utils/printTicket";
import { useAuth } from "../../contexts/AuthContext";
import { usePaperSize } from "../../hooks/usePaperSize";
import {
  useActivePromotions,
  isPromotionWithinSchedule,
} from "../../hooks/usePromotions";
import { Tag, Clock, Gift } from "lucide-react";
import toast from "react-hot-toast";

// Comisión que se traslada al cliente cuando paga (total o parcialmente) con tarjeta.
const CARD_COMMISSION_RATE = 0.04;

const AdminCheckout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams<{ orderId?: string }>();
  const state = (location.state || {}) as {
    orderId?: string;
    tableId?: string;
    tableNumber?: number;
  };
  const { currentUser } = useAuth();
  const [paperSize, setPaperSize] = usePaperSize(currentUser?.id);

  // Prefer orderId from URL params, then fallback to location.state
  const paramOrderId = params.orderId;
  const propOrderId = paramOrderId ?? state.orderId;
  const propTableId = state.tableId;

  // Prefer subscribing by orderId when available
  const {
    order: orderById,
    loading: loadingById,
    error: errorById,
  } = useOrderById(propOrderId ?? null);
  const {
    order: orderByTable,
    loading: loadingByTable,
    error: errorByTable,
  } = useOrderByTableId(propTableId ?? undefined);

  const loading = loadingById || loadingByTable;
  const error = errorById || errorByTable;

  // Choose which order we got
  const order: Order | null = useMemo(() => {
    return orderById ?? orderByTable ?? null;
  }, [orderById, orderByTable]);

  // Debug: log the order object to confirm peopleCount is present (remove in production)
  React.useEffect(() => {
    if (order) console.debug("Checkout loaded order:", order);
  }, [order]);

  // No manejamos propinas: el negocio no las cobra.
  const tipAmount = 0;
  const tipPercent = 0;
  const [closing, setClosing] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<
    "efectivo" | "tarjeta" | "transferencia" | "mixto"
  >("efectivo");
  const [mixedEfectivo, setMixedEfectivo] = useState<string>("");
  const [mixedTransferencia, setMixedTransferencia] = useState<string>("");
  // Cargos de tarjeta: soporta varios pagos con tarjeta (distintos tipos/terminales)
  type CardCharge = { id: string; amount: string; cardType: CardType; cardDetail: string; cardOperationNumber: string };
  const makeEmptyCharge = (): CardCharge => ({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    amount: "",
    cardType: "Visa",
    cardDetail: "",
    cardOperationNumber: "",
  });
  const [cardCharges, setCardCharges] = useState<CardCharge[]>([makeEmptyCharge()]);
  const cardChargesTotal = useMemo(
    () => cardCharges.reduce((s, c) => s + (Number(c.amount) || 0), 0),
    [cardCharges]
  );
  const addCardCharge = () => setCardCharges(prev => [...prev, makeEmptyCharge()]);
  const removeCardCharge = (id: string) =>
    setCardCharges(prev => (prev.length > 1 ? prev.filter(c => c.id !== id) : prev));
  const updateCardCharge = (id: string, field: keyof Omit<CardCharge, "id">, value: string) =>
    setCardCharges(prev => prev.map(c => (c.id === id ? { ...c, [field]: value } : c)));
  const [isReadOnly, setIsReadOnly] = useState<boolean>(false);
  const [config, setConfig] = useState<any | null>(null);
  const [pinMode, setPinMode] = useState<"payment" | "courtesy">("payment");

  // Notas de cajero (faltantes, notas finales) — no salen en el ticket del cliente,
  // sólo en el corte de caja. Se guardan automáticamente al dejar de escribir.
  const [cashNotes, setCashNotes] = useState<string>("");
  const [savingCashNotes, setSavingCashNotes] = useState(false);
  const cashNotesLoadedRef = React.useRef<string | null>(null);

  // Fetch active promotions
  const { promotions: activePromotions } = useActivePromotions();
  // Load business config (name, address, phone) from Firestore to show on tickets
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cfg = await getConfig();
        if (mounted) setConfig(cfg?.success ? cfg.data : null);
      } catch (e) {
        console.debug("Could not load config/general:", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  // peopleCount is saved on the order by OrderDetails; prefer order.peopleCount
  const peopleCount = order?.peopleCount ?? 1;

  const activeItems = order?.items?.filter((i) => !i.isDeleted) ?? [];

  const subtotal = useMemo(
    () => activeItems.reduce((s, it) => s + it.productPrice * it.quantity, 0),
    [activeItems]
  );

  // Map each item to its applicable promo (checked against item's createdAt, supports multiple simultaneous promos)
  const itemPromoMap = useMemo(() => {
    const map: Record<string, (typeof activePromotions)[0] | null> = {};
    for (const item of activeItems) {
      map[item.id] = activePromotions.find(p => {
        const catOk = p.categories.length === 0 || p.categories.includes(item.category);
        const prodOk = !p.productIds || p.productIds.length === 0 || p.productIds.includes(item.productId);
        return catOk && prodOk && isPromotionWithinSchedule(p.cutoffTime, item.createdAt, p.activeDays);
      }) ?? null;
    }
    return map;
  }, [activePromotions, activeItems]);

  // Per-item discount amounts (each item uses its own matched promo)
  const itemDiscountMap = useMemo(() => {
    const promoGroups: Record<string, (typeof activeItems)[0][]> = {};
    for (const item of activeItems) {
      const promo = itemPromoMap[item.id];
      if (!promo) continue;
      if (!promoGroups[promo.id]) promoGroups[promo.id] = [];
      promoGroups[promo.id].push(item);
    }
    const map: Record<string, number> = {};
    for (const item of activeItems) {
      const promo = itemPromoMap[item.id];
      if (!promo) continue;
      switch (promo.discountType) {
        case 'percentage': map[item.id] = item.productPrice * item.quantity * (promo.discountValue / 100); break;
        case '2x1': map[item.id] = Math.floor(item.quantity / 2) * item.productPrice; break;
        case 'fixedprice': map[item.id] = Math.max(0, item.productPrice - promo.discountValue) * item.quantity; break;
        case 'fixed': {
          const groupItems = promoGroups[promo.id] ?? [];
          const groupSubtotal = groupItems.reduce((s, i) => s + i.productPrice * i.quantity, 0);
          if (groupSubtotal > 0) map[item.id] = (item.productPrice * item.quantity / groupSubtotal) * Math.min(promo.discountValue, groupSubtotal);
          break;
        }
      }
    }
    return map;
  }, [activeItems, itemPromoMap]);

  const discountAmount = useMemo(
    () => Object.values(itemDiscountMap).reduce((s, d) => s + d, 0),
    [itemDiscountMap]
  );

  const total = useMemo(
    () => subtotal - discountAmount,
    [subtotal, discountAmount]
  );

  // Comisión del 4% sobre lo que se cobra con tarjeta (pago completo o parcial en mixto).
  const cardCommissionAmount = useMemo(
    () => cardChargesTotal * CARD_COMMISSION_RATE,
    [cardChargesTotal]
  );

  // Total final que paga el cliente, incluyendo la comisión de tarjeta.
  const finalTotal = useMemo(
    () => total + cardCommissionAmount,
    [total, cardCommissionAmount]
  );

  // Unique promos active on this order (for display in UI)
  const activePromos = useMemo(() => {
    const seen = new Set<string>();
    const promos: (typeof activePromotions)[0][] = [];
    for (const item of activeItems) {
      const promo = itemPromoMap[item.id];
      if (promo && !seen.has(promo.id)) {
        seen.add(promo.id);
        promos.push(promo);
      }
    }
    return promos;
  }, [activeItems, itemPromoMap]);

  const handlePrint = (customOrder?: Order) => {
    if (!order && !customOrder) return;
    const orderToPrint = customOrder || order;
    const perPerson = finalTotal / Math.max(1, orderToPrint!.peopleCount ?? 1);
    const itemDiscounts: Record<string, { amount: number; promoName: string }> = {};
    for (const item of activeItems) {
      const disc = itemDiscountMap[item.id];
      const promo = itemPromoMap[item.id];
      if (disc > 0 && promo) itemDiscounts[item.id] = { amount: disc, promoName: promo.name };
    }
    printTicket({
      order: orderToPrint as Order,
      subtotal,
      tipAmount,
      tipPercent,
      discountAmount,
      cardCommission: orderToPrint?.cardCommission ?? cardCommissionAmount,
      itemDiscounts,
      total: finalTotal,
      perPerson,
      paperSize,
      businessName: config?.name,
      businessAddress: config?.address,
      businessPhone: config?.phone,
    });
  };

  const handleFinalize = async () => {
    // Instead of immediately finalizing, open PIN modal to verify cashier
    if (!order) return;
    if (paymentMethod === "mixto") {
      const efe = Number(mixedEfectivo || 0);
      const tra = Number(mixedTransferencia || 0);
      const sum = efe + cardChargesTotal + tra;
      if (Math.abs(sum - total) > 0.01) {
        alert(
          `En el pago mixto, la suma de los montos ($${sum.toFixed(
            2
          )}) debe ser igual al total ($${total.toFixed(2)}).`
        );
        return;
      }
    }

    if (paymentMethod === "tarjeta" && Math.abs(cardChargesTotal - total) > 0.01) {
      alert(
        `La suma de los cargos de tarjeta ($${cardChargesTotal.toFixed(
          2
        )}) debe ser igual al total ($${total.toFixed(2)}).`
      );
      return;
    }

    const activeCharges = cardCharges.filter((c) => (Number(c.amount) || 0) > 0);
    if ((paymentMethod === "tarjeta" || (paymentMethod === "mixto" && cardChargesTotal > 0)) && activeCharges.length > 0) {
      const seen = new Set<string>();
      for (const charge of activeCharges) {
        const op = charge.cardOperationNumber.trim();
        if (!op) {
          alert("Debes ingresar los dígitos de la operación (Verifone) para cada cargo con tarjeta.");
          return;
        }
        if (seen.has(op)) {
          alert(`El número de operación "${op}" está repetido entre los cargos.`);
          return;
        }
        seen.add(op);
        const isUnique = await checkOperationNumberUnique(op);
        if (!isUnique) {
          alert(`El número de operación "${op}" ya fue utilizado en otra cuenta.`);
          return;
        }
      }
    }

    setPinMode("payment");
    setShowPinModal(true);
  };

  // Finalize after successful PIN verification
  const finalizeWithAuthorizedUser = async (authorizedUser: any) => {
    if (!order) return;
    setClosing(true);
    try {
      const tableId = order.tableId;
      const orderId = order.id;

      const activeCharges = cardCharges.filter((c) => (Number(c.amount) || 0) > 0);
      // El monto registrado por cargo incluye la comisión del 4% (lo que realmente se cobra en la terminal).
      const cardSplits = activeCharges.map((c) => ({
        method: "tarjeta" as const,
        amount: (Number(c.amount) || 0) * (1 + CARD_COMMISSION_RATE),
        cardOperationNumber: c.cardOperationNumber.trim(),
        cardType: c.cardType,
        cardDetail: c.cardDetail.trim() || undefined,
      }));

      // Prepare payment details when paying with cash
      let paymentDetails: any;
      if (paymentMethod === "efectivo") {
        paymentDetails = {
          receivedAmount: total,
          change: 0,
          tipAmount: tipAmount,
          tipPercent: tipPercent,
          discountAmount: discountAmount,
          cardCommission: cardCommissionAmount,
          cashierId: authorizedUser?.id,
          cashierName: authorizedUser?.displayName || authorizedUser?.email,
        };
      } else if (paymentMethod === "mixto") {
        const efe = Number(mixedEfectivo || 0);
        const tra = Number(mixedTransferencia || 0);
        const splitPayments: any[] = [];
        if (efe > 0)
          splitPayments.push({
            method: "efectivo",
            amount: efe,
            receivedAmount: efe,
            change: 0,
          });
        splitPayments.push(...cardSplits);
        if (tra > 0)
          splitPayments.push({ method: "transferencia", amount: tra });
        paymentDetails = {
          tipAmount: tipAmount,
          tipPercent: tipPercent,
          discountAmount: discountAmount,
          cardCommission: cardCommissionAmount,
          cashierId: authorizedUser?.id,
          cashierName: authorizedUser?.displayName || authorizedUser?.email,
          splitPayments,
        };
      } else if (paymentMethod === "tarjeta") {
        paymentDetails = {
          tipAmount: tipAmount,
          tipPercent: tipPercent,
          discountAmount: discountAmount,
          cardCommission: cardCommissionAmount,
          cashierId: authorizedUser?.id,
          cashierName: authorizedUser?.displayName || authorizedUser?.email,
          splitPayments: cardSplits,
        };
      } else {
        paymentDetails = {
          tipAmount: tipAmount,
          tipPercent: tipPercent,
          discountAmount: discountAmount,
          cardCommission: cardCommissionAmount,
          cashierId: authorizedUser?.id,
          cashierName: authorizedUser?.displayName || authorizedUser?.email,
        };
      }

      const res = await closeTable(
        tableId,
        orderId,
        paymentMethod,
        peopleCount,
        paymentDetails
      );
      if (!res.success) throw new Error(res.error || "Error al cerrar mesa");
      // Mark UI as read-only so the user can view/print the ticket but not change anything
      setIsReadOnly(true);

      const finalPayments = (paymentMethod === 'mixto' || paymentMethod === 'tarjeta')
        ? paymentDetails.splitPayments
        : [{
            method: paymentMethod,
            amount: total,
            receivedAmount: paymentMethod === 'efectivo' ? paymentDetails.receivedAmount : undefined,
            change: paymentMethod === 'efectivo' ? paymentDetails.change : undefined
          }];

      const updatedOrder = {
        ...order,
        status: "pagado",
        paymentMethod,
        payments: finalPayments,
        folio: res.data?.folio,
        folioSeq: res.data?.folioSeq,
        completedAt: new Date(),
      } as Order;

      // Auto-print the exit pass immediately after closing
      handlePrint(updatedOrder);
    } catch (err: any) {
      console.error("Error closing table:", err);
      // show a basic alert; project may have a toast util
      alert(err.message || "Error al cerrar la mesa");
    } finally {
      setClosing(false);
      setShowPinModal(false);
      setPinLoading(false);
    }
  };

  const finalizeAsCourtesy = async (authorizedUser: any) => {
    if (!order) return;
    setClosing(true);
    try {
      const res = await closeTableAsCourtesy(
        order.tableId,
        order.id,
        authorizedUser.id,
        authorizedUser.displayName ?? authorizedUser.email
      );
      if (!res.success) throw new Error(res.error || "Error al registrar cortesía");
      setIsReadOnly(true);
      toast.success(`Cortesía registrada por ${authorizedUser.displayName ?? authorizedUser.email}`);
      // Imprimir ticket con $0
      handlePrint({
        ...order,
        status: "cortesia",
        subtotal: 0,
        total: 0,
        courtesyByName: authorizedUser.displayName ?? authorizedUser.email,
        folio: res.data?.folio,
        folioSeq: res.data?.folioSeq,
        completedAt: new Date(),
      } as Order);
    } catch (err: any) {
      console.error("Error registering courtesy:", err);
      alert(err.message || "Error al registrar cortesía");
    } finally {
      setClosing(false);
      setShowPinModal(false);
      setPinLoading(false);
    }
  };

  const handleCourtesy = () => {
    if (!order || !currentUser?.superAdmin) return;
    setPinMode("courtesy");
    setShowPinModal(true);
  };

  const handleConfirmPin = async (pin: string) => {
    setPinLoading(true);
    try {
      const authorizedUser = await verifyUserPin(pin);
      if (pinMode === "courtesy") {
        await finalizeAsCourtesy(authorizedUser);
      } else {
        await finalizeWithAuthorizedUser(authorizedUser);
      }
    } catch (err: any) {
      console.error("PIN verification failed:", err);
      setPinLoading(false);
      throw err; // PinModal will display the error
    }
  };

  // Sync local paymentMethod and read-only state from the live order
  React.useEffect(() => {
    if (!order) return;
    if (order.paymentMethod) {
      // Ensure we only set known values
      if (
        order.paymentMethod === "efectivo" ||
        order.paymentMethod === "tarjeta" ||
        order.paymentMethod === "transferencia" ||
        order.paymentMethod === "mixto"
      ) {
        setPaymentMethod(order.paymentMethod);
      }
    }
    if (order.status === "pagado" || order.status === "cortesia") {
      setIsReadOnly(true);
    }
  }, [order]);

  // Cargar cashNotes una sola vez por orden (evita pisar lo que el cajero está escribiendo
  // cuando llegan actualizaciones en tiempo real del mismo documento).
  React.useEffect(() => {
    if (!order) return;
    if (cashNotesLoadedRef.current !== order.id) {
      cashNotesLoadedRef.current = order.id;
      setCashNotes(order.cashNotes ?? "");
    }
  }, [order]);

  // Autosave de notas: se guarda solo 800ms después de dejar de escribir, sin botón.
  React.useEffect(() => {
    if (!order) return;
    if (cashNotesLoadedRef.current !== order.id) return; // aún no cargó el valor inicial
    if ((order.cashNotes ?? "") === cashNotes) return; // sin cambios reales
    const timeout = setTimeout(() => {
      setSavingCashNotes(true);
      updateOrderCashNotes(order.id, cashNotes)
        .catch((err) => console.error("Error guardando notas:", err))
        .finally(() => setSavingCashNotes(false));
    }, 800);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cashNotes, order?.id]);

  // Renderiza la lista editable de cargos de tarjeta (usada por pago 100% tarjeta y por el
  // componente "tarjeta" del pago mixto), permitiendo varios cargos con distinto tipo/detalle.
  const renderCardCharges = () => (
    <div className="space-y-3">
      {cardCharges.map((charge, idx) => (
        <div key={charge.id} className="p-3 bg-gray-800 rounded-lg border border-gray-700 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-semibold">Cargo {idx + 1}</span>
            {cardCharges.length > 1 && (
              <button
                type="button"
                disabled={isReadOnly}
                onClick={() => removeCardCharge(charge.id)}
                className="text-red-400 hover:text-red-300 text-xs disabled:opacity-50"
              >
                Quitar
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Monto</label>
              <input
                disabled={isReadOnly}
                type="number"
                min="0"
                step="0.01"
                value={charge.amount}
                onChange={(e) => updateCardCharge(charge.id, "amount", e.target.value)}
                placeholder="0.00"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white disabled:bg-gray-800"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Tipo</label>
              <select
                disabled={isReadOnly}
                value={charge.cardType}
                onChange={(e) => updateCardCharge(charge.id, "cardType", e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white disabled:bg-gray-800"
              >
                <option value="Visa">Visa</option>
                <option value="Mastercard">Mastercard</option>
                <option value="Amex">Amex</option>
                <option value="Otra">Otra</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Operación (Verifone)</label>
            <input
              disabled={isReadOnly}
              type="text"
              value={charge.cardOperationNumber}
              onChange={(e) => updateCardCharge(charge.id, "cardOperationNumber", e.target.value)}
              placeholder="Ej. 123456"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white disabled:bg-gray-800"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Detalle (opcional)</label>
            <input
              disabled={isReadOnly}
              type="text"
              value={charge.cardDetail}
              onChange={(e) => updateCardCharge(charge.id, "cardDetail", e.target.value)}
              placeholder="Notas, últimos 4 dígitos, etc."
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white disabled:bg-gray-800"
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        disabled={isReadOnly}
        onClick={addCardCharge}
        className="w-full py-2 rounded-lg border border-dashed border-blue-700 text-blue-300 hover:bg-blue-700/10 text-sm font-semibold disabled:opacity-50"
      >
        ＋ Agregar cargo de tarjeta
      </button>
      <div className="flex justify-between text-sm pt-1">
        <span className="text-gray-400">Suma de cargos:</span>
        <span className="text-white font-semibold">${cardChargesTotal.toFixed(2)}</span>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Cargando detalles de la orden...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-400">{error}</p>
        <button
          onClick={() => navigate("/admin/home")}
          className="mt-4 bg-red-600 hover:bg-red-700 text-gray-900 px-4 py-2 rounded-lg"
        >
          Volver al Panel
        </button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-bold text-white mb-2">
          Orden no encontrada
        </h2>
        <p className="text-gray-400 mb-4">
          No se encontró una orden activa para esta mesa.
        </p>
        <button
          onClick={() => navigate("/admin/home")}
          className="bg-red-600 hover:bg-red-700 text-gray-900 px-4 py-2 rounded-lg"
        >
          Volver al Panel
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center space-x-3">
            <div>
              <h1 className="text-3xl font-bold text-white">
                Checkout -{" "}
                {order.tableNumber === 0
                  ? "🍹 Barra"
                  : `Mesa ${order.tableNumber}`}
              </h1>
              {order.payments && order.payments.length > 0 && (
                <div className="text-xs text-gray-400">
                  Pago: {order.payments[0].id} — {order.payments[0].method} ${order.payments[0].amount}
                </div>
              )}
            </div>
            {/* Status badge */}
            <span
              className={`px-3 py-1 rounded-full text-sm font-semibold ${
                order.status === "pagado"
                  ? "bg-green-600 text-white"
                  : order.status === "cortesia"
                  ? "bg-amber-500 text-gray-900"
                  : order.status === "cancelado"
                  ? "bg-red-600 text-white"
                  : "bg-yellow-500 text-gray-900"
              }`}
            >
              {order.status === "pagado"
                ? "PAGADO"
                : order.status === "cortesia"
                ? "CORTESÍA"
                : order.status === "cancelado"
                ? "CANCELADO"
                : "PENDIENTE"}
            </span>
          </div>
          <p className="text-gray-400">Finaliza el pago y genera el ticket.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-gray-800 p-6 rounded-2xl border border-gray-800">
          <div className="ticket bg-gray-900 p-6 rounded-lg text-sm text-white">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-extrabold text-red-500">
                PASE DE SALIDA
              </h2>
              <p className="text-sm text-gray-400">
                {config?.name ?? "Wikka Despecho"} — Ticket de salida
              </p>
              {order.createdAt && (
                <p className="text-xs text-gray-500 mt-2">
                  Apertura: {new Date(order.createdAt).toLocaleString()}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Fecha: {(order.completedAt ? new Date(order.completedAt) : new Date()).toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">Id: {order.id}</p>
            </div>

            <div className="border-t border-dashed border-gray-600 pt-3 mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Mesa</p>
                <p className="text-lg font-semibold text-white">
                  {order.tableNumber === 0 ? "Barra" : `${order.tableNumber}`}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-400">Mesero</p>
                <p className="text-lg font-semibold text-white">
                  {order.waiterName}
                </p>
              </div>

              <div className="text-right">
                <p className="text-sm text-gray-400">Personas</p>
                <p className="text-xl font-extrabold text-red-500">
                  {order.peopleCount ?? 1}
                </p>
              </div>
            </div>

            {/* peopleCount is managed in OrderDetails and stored on the order document */}

            <div className="border-t border-dashed border-gray-600 pt-2">
              <div className="flex justify-between">
                <span>CANT. PRODUCTO</span>
                <span>SUBTOTAL</span>
              </div>
              {activeItems.map((item) => {
                const serviceMatch = item.notes?.match(/^Servicios:\s*(.+)$/s);
                const services = serviceMatch
                  ? serviceMatch[1].split(',').map(s => s.trim()).filter(Boolean)
                  : [];
                return (
                  <div key={item.id} className="mt-2">
                    <div className="flex justify-between">
                      <span>
                        {item.quantity}x {item.productName}
                      </span>
                      <span>${(item.productPrice * item.quantity).toFixed(2)}</span>
                    </div>
                    {services.map((svc, i) => (
                      <div key={i} className="flex justify-between text-gray-400 text-xs pl-4">
                        <span>↳ {svc}</span>
                        <span>$0.00</span>
                      </div>
                    ))}
                    {itemDiscountMap[item.id] > 0 && (
                      <div className="flex justify-between text-green-400 text-xs pl-4">
                        <span>↳ {itemPromoMap[item.id]?.name}</span>
                        <span>-${itemDiscountMap[item.id].toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="border-t border-dashed border-gray-600 mt-4 pt-2">
              <div className="flex justify-between">
                <span className="font-bold">Subtotal:</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              {activePromos.map(promo => {
                const promoDiscount = activeItems
                  .filter(i => itemPromoMap[i.id]?.id === promo.id)
                  .reduce((s, i) => s + (itemDiscountMap[i.id] ?? 0), 0);
                return promoDiscount > 0 ? (
                  <div key={promo.id} className="flex justify-between text-green-400">
                    <span className="font-bold">Desc. {promo.name}:</span>
                    <span>-${promoDiscount.toFixed(2)}</span>
                  </div>
                ) : null;
              })}
              {cardCommissionAmount > 0 && (
                <div className="flex justify-between">
                  <span className="font-bold">Comisión tarjeta (4%):</span>
                  <span id="card-commission-amount">${cardCommissionAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-xl mt-2 text-red-500">
                <span className="font-bold">TOTAL:</span>
                <span id="total-amount">${finalTotal.toFixed(2)}</span>
              </div>

              {/* Per-person total */}
              <div className="flex justify-between mt-2 items-center border-t border-gray-800 pt-2">
                <span className="text-sm text-gray-300">
                  Total por persona ({order.peopleCount ?? 1})
                </span>
                <span className="text-sm font-semibold text-white">
                  ${(finalTotal / Math.max(1, order.peopleCount ?? 1)).toFixed(2)}
                </span>
              </div>
            </div>

            <div
              id="ai-message-container"
              className="border-t border-dashed border-gray-600 mt-4 pt-4 text-center"
            >
              <p className="text-sm text-gray-400">
                Gracias por su preferencia.
              </p>
            </div>

            {/* Footer with address and phone (loaded from config/general when available) */}
            <div className="text-center mt-4 text-xs text-gray-400">
              <div>
                {config?.address ??
                  "Prof. Mercedes Camacho 82, Praderas del Sol, 76808 San Juan del Río, Qro."}
              </div>
              <div>Tel: {config?.phone ?? "427-123-4567"}</div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Notas del cajero — se guardan automáticamente, no aparecen en el ticket del cliente */}
          <div className="bg-gray-800 p-6 rounded-2xl border border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-white">📝 Notas del Cajero</h3>
              {savingCashNotes && <span className="text-xs text-gray-500">Guardando...</span>}
            </div>
            <textarea
              value={cashNotes}
              onChange={(e) => setCashNotes(e.target.value)}
              placeholder="Ej. faltó dinero, nota final, incidencias del cobro..."
              rows={3}
              className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              No se imprime en el ticket del cliente. Solo aparece en el corte de caja.
            </p>
          </div>

          {/* Promociones auto-aplicadas */}
          {activePromos.map(promo => {
            const promoDiscount = activeItems
              .filter(i => itemPromoMap[i.id]?.id === promo.id)
              .reduce((s, i) => s + (itemDiscountMap[i.id] ?? 0), 0);
            return (
              <div key={promo.id} className="bg-green-900/20 border border-green-700/50 p-4 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag size={16} className="text-green-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-green-300">{promo.name}</p>
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <Clock size={10} /> Hasta {promo.cutoffTime} hrs
                    </p>
                  </div>
                </div>
                <span className="text-green-400 font-bold text-sm">-${promoDiscount.toFixed(2)}</span>
              </div>
            );
          })}

          <div className="bg-gray-800 p-6 rounded-2xl border border-gray-800">
            <h3 className="font-semibold text-white mb-4">Método de Pago</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                disabled={isReadOnly}
                onClick={() => setPaymentMethod("efectivo")}
                className={`py-3 px-4 rounded-lg font-bold transition-colors flex items-center justify-center ${
                  paymentMethod === "efectivo"
                    ? "bg-green-600 text-white shadow-md ring-2 ring-green-300"
                    : isReadOnly
                    ? "bg-transparent text-gray-500 border border-gray-800 cursor-not-allowed"
                    : "bg-transparent text-green-300 border border-green-700 hover:bg-green-700/20"
                }`}
              >
                Efectivo
              </button>

              <button
                disabled={isReadOnly}
                onClick={() => setPaymentMethod("tarjeta")}
                className={`py-3 px-4 rounded-lg font-bold transition-colors flex items-center justify-center ${
                  paymentMethod === "tarjeta"
                    ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-300"
                    : isReadOnly
                    ? "bg-transparent text-gray-500 border border-gray-800 cursor-not-allowed"
                    : "bg-transparent text-blue-300 border border-blue-700 hover:bg-blue-700/20"
                }`}
              >
                Tarjeta
              </button>

              <button
                disabled={isReadOnly}
                onClick={() => setPaymentMethod("transferencia")}
                className={`py-3 px-4 rounded-lg font-bold transition-colors flex items-center justify-center ${
                  paymentMethod === "transferencia"
                    ? "bg-purple-600 text-white shadow-md ring-2 ring-purple-300"
                    : isReadOnly
                    ? "bg-transparent text-gray-500 border border-gray-800 cursor-not-allowed"
                    : "bg-transparent text-purple-300 border border-purple-700 hover:bg-purple-700/20"
                }`}
              >
                Transferencia
              </button>

              <button
                disabled={isReadOnly}
                onClick={() => setPaymentMethod("mixto")}
                className={`py-3 px-4 rounded-lg font-bold transition-colors flex items-center justify-center ${
                  paymentMethod === "mixto"
                    ? "bg-yellow-600 text-white shadow-md ring-2 ring-yellow-300"
                    : isReadOnly
                    ? "bg-transparent text-gray-500 border border-gray-800 cursor-not-allowed"
                    : "bg-transparent text-yellow-300 border border-yellow-700 hover:bg-yellow-700/20"
                }`}
              >
                Mixto
              </button>
            </div>
            {/* Cash helper: show when efectivo selected */}
            {paymentMethod === "efectivo" && (
              <div className="mt-4">
                <label className="text-sm text-gray-400 block mb-2">
                  Pago en efectivo
                </label>
                <div className="mt-2 text-sm text-gray-300">
                  <div>Monto exacto: ${total.toFixed(2)}</div>
                </div>
              </div>
            )}
            {/* Tarjeta helper: show when tarjeta selected — soporta varios cargos */}
            {paymentMethod === "tarjeta" && (
              <div className="mt-4">
                <h4 className="text-sm text-white font-semibold mb-2">
                  Cargos de Tarjeta
                </h4>
                {renderCardCharges()}
                {Math.abs(cardChargesTotal - total) > 0.01 && (
                  <div className="mt-2 text-sm text-red-400">
                    {cardChargesTotal < total
                      ? `Faltan $${(total - cardChargesTotal).toFixed(2)}`
                      : `Excede $${(cardChargesTotal - total).toFixed(2)}`}
                  </div>
                )}
                {cardCommissionAmount > 0 && (
                  <div className="mt-2 text-sm text-amber-400">
                    + Comisión tarjeta (4%): ${cardCommissionAmount.toFixed(2)} — cobrar ${(cardChargesTotal * (1 + CARD_COMMISSION_RATE)).toFixed(2)} en la terminal
                  </div>
                )}
              </div>
            )}
            {/* Transfer helper: show when transferencia selected */}
            {paymentMethod === "transferencia" && (
              <div className="mt-4">
                <h4 className="text-sm text-white font-semibold mb-2">
                  Datos para Transferencia
                </h4>
                <div className="space-y-2 text-sm text-gray-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-400">Banco</div>
                      <div className="font-semibold">Mercado Pago W</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText("Mercado Pago W");
                      }}
                      className="ml-4 bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-2 rounded-lg"
                    >
                      Copiar
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-400">
                        Cuenta / CLABE
                      </div>
                      <div className="font-mono">722969010236059755</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText("5428780133238824");
                      }}
                      className="ml-4 bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-2 rounded-lg"
                    >
                      Copiar
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-400">Titular</div>
                      <div className="font-semibold">Pedro Ulises Garcia Valle</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText("Oswaldo Reyes Olivera");
                      }}
                      className="ml-4 bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-2 rounded-lg"
                    >
                      Copiar
                    </button>
                  </div>

                  <div className="text-xs text-gray-400">
                    Instrucciones: Al realizar la transferencia, guarda el
                    comprobante y solicita al cliente confirmar el pago.
                  </div>
                </div>
              </div>
            )}

            {/* Mixto helper: show when mixto selected */}
            {paymentMethod === "mixto" && (
              <div className="mt-4 p-4 bg-gray-900 rounded-lg border border-gray-700">
                <h4 className="text-sm font-semibold text-white mb-3">
                  Montos por Método
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-400 w-24">
                      Efectivo:
                    </label>
                    <input
                      disabled={isReadOnly}
                      type="number"
                      min="0"
                      step="0.01"
                      value={mixedEfectivo}
                      onChange={(e) => setMixedEfectivo(e.target.value)}
                      placeholder="0.00"
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white disabled:bg-gray-800"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-2">
                      Tarjeta:
                    </label>
                    {renderCardCharges()}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-400 w-24">
                      Transf.:
                    </label>
                      <input
                        disabled={isReadOnly}
                        type="number"
                        min="0"
                        step="0.01"
                        value={mixedTransferencia}
                        onChange={(e) => setMixedTransferencia(e.target.value)}
                        placeholder="0.00"
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white disabled:bg-gray-800"
                      />
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-700">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Total a cubrir:</span>
                    <span className="text-white font-medium">
                      ${total.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-gray-400">Suma actual:</span>
                    <span
                      className={`font-bold ${
                        Math.abs(
                          Number(mixedEfectivo || 0) +
                            cardChargesTotal +
                            Number(mixedTransferencia || 0) -
                            total
                        ) < 0.01
                          ? "text-green-400"
                          : "text-gray-300"
                      }`}
                    >
                      $
                      {(
                        Number(mixedEfectivo || 0) +
                        cardChargesTotal +
                        Number(mixedTransferencia || 0)
                      ).toFixed(2)}
                    </span>
                  </div>
                  {total - (Number(mixedEfectivo || 0) + cardChargesTotal + Number(mixedTransferencia || 0)) > 0.001 && (
                    <div className="flex justify-between text-sm mt-1 text-red-400">
                      <span>Faltante:</span>
                      <span className="font-bold">
                        ${(total - (Number(mixedEfectivo || 0) + cardChargesTotal + Number(mixedTransferencia || 0))).toFixed(2)}
                      </span>
                    </div>
                  )}
                  {cardCommissionAmount > 0 && (
                    <div className="flex justify-between text-sm mt-1 text-amber-400">
                      <span>+ Comisión tarjeta (4%):</span>
                      <span className="font-bold">${cardCommissionAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm mt-2 pt-2 border-t border-gray-700">
                    <span className="text-gray-300 font-semibold">Total final a cobrar:</span>
                    <span className="text-white font-bold">${finalTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Removed 'Guardar Cliente' block to reduce clutter */}

          <div className="flex flex-col space-y-3">
            {/* Paper size toggle */}
            <div className="flex items-center justify-between bg-gray-800 rounded-lg p-3 border border-gray-700">
              <span className="text-sm text-gray-400">🖨️ Tamaño de papel</span>
              <div className="flex bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
                <button
                  onClick={() => setPaperSize("58mm")}
                  className={`px-4 py-2 text-sm font-semibold transition-colors ${
                    paperSize === "58mm"
                      ? "bg-red-600 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  58mm
                </button>
                <button
                  onClick={() => setPaperSize("80mm")}
                  className={`px-4 py-2 text-sm font-semibold transition-colors ${
                    paperSize === "80mm"
                      ? "bg-red-600 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  80mm
                </button>
              </div>
            </div>
            {/* Imprimir debe permanecer disponible incluso en modo solo-lectura; solo deshabilitamos mientras cerramos */}
            <button
              disabled={closing}
              onClick={() => handlePrint()}
              className={`w-full ${
                closing
                  ? "bg-gray-800 text-gray-400 cursor-not-allowed"
                  : "bg-gray-600 text-white hover:bg-gray-700"
              } font-bold py-3 px-4 rounded-lg transition`}
            >
              {isReadOnly ? "Imprimir Pase de Salida" : "Imprimir Ticket"}
            </button>
            <button
              disabled={closing || isReadOnly}
              onClick={handleFinalize}
              className={`w-full ${
                isReadOnly
                  ? "bg-gray-800 text-gray-400 cursor-not-allowed"
                  : "bg-red-600 text-gray-900 hover:bg-red-700"
              } font-bold py-3 px-4 rounded-lg transition`}
            >
              {closing ? "Cerrando..." : "Finalizar y Cerrar Mesa"}
            </button>

            {/* Botón de cortesía — solo superAdmin */}
            {currentUser?.superAdmin && !isReadOnly && (
              <button
                disabled={closing}
                onClick={handleCourtesy}
                className="w-full flex items-center justify-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 font-semibold py-3 px-4 rounded-lg transition disabled:opacity-50"
              >
                <Gift size={18} />
                Cerrar como Cortesía
              </button>
            )}

            {/* Badge informativo cuando ya es cortesía */}
            {order.status === "cortesia" && order.courtesyByName && (
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3">
                <Gift size={16} className="text-amber-400 shrink-0" />
                <p className="text-sm text-amber-300">
                  Cortesía autorizada por <span className="font-bold">{order.courtesyByName}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* PIN modal — título y mensaje cambian según el modo */}
      <PinModal
        isOpen={showPinModal}
        onClose={() => {
          setShowPinModal(false);
          setPinLoading(false);
          setPinMode("payment");
        }}
        onConfirm={handleConfirmPin}
        title={pinMode === "courtesy" ? "Autorizar Cortesía" : "Confirmar Cobro"}
        message={
          pinMode === "courtesy"
            ? "Ingresa tu PIN de superAdmin para registrar esta mesa como cortesía (sin cobro)."
            : "Ingresa tu PIN para autorizar el cobro y registrar quién recibió el pago."
        }
        loading={pinLoading}
      />
    </div>
  );
};

export default AdminCheckout;
