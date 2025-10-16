// src/pages/public/CustomerTicket.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { Order, Table } from '../../utils/types';
import { formatCurrency } from '../../utils/formatters';
import { getConfig } from '../../services/firestoreService';
import { QRCodeSVG } from 'qrcode.react';

type PaymentMethod = 'cash' | 'card' | 'transfer' | 'mercadopago_qr' | 'mercadopago_terminal';

const PAYMENT_METHOD_NAMES: Record<PaymentMethod, string> = {
  cash: '💵 Efectivo',
  card: '💳 Tarjeta',
  transfer: '🏦 Transferencia',
  mercadopago_qr: '📱 Mercado Pago QR',
  mercadopago_terminal: '💳 Terminal Mercado Pago',
};

interface BusinessConfig {
  name?: string;
  logo?: string;
  address?: string;
  phone?: string;
}

// Helper para convertir Timestamp de Firebase a Date
const toDate = (timestamp: any): Date | null => {
  if (!timestamp) return null;
  
  // Si ya es un Date
  if (timestamp instanceof Date) {
    return timestamp;
  }
  
  // Si es un Timestamp de Firebase
  if (timestamp?.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  
  // Si es un objeto con seconds (formato Timestamp serializado)
  if (timestamp?.seconds) {
    return new Date(timestamp.seconds * 1000);
  }
  
  // Intento de conversión directa
  try {
    return new Date(timestamp);
  } catch {
    return null;
  }
};

const CustomerTicket = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [table, setTable] = useState<Table | null>(null);
  const [config, setConfig] = useState<BusinessConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadOrderData = async () => {
      if (!orderId) {
        setError('ID de orden no válido');
        setLoading(false);
        return;
      }

      try {
        // Cargar la configuración del negocio (solo una vez)
        const configResult = await getConfig();
        if (configResult.success && configResult.data) {
          setConfig(configResult.data);
        }

        // Suscribirse a la orden en tiempo real
        const orderRef = doc(db, 'orders', orderId);
        const unsubscribeOrder = onSnapshot(
          orderRef,
          async (orderDoc) => {
            if (!orderDoc.exists()) {
              setError('Orden no encontrada');
              setLoading(false);
              return;
            }

            const orderData = { id: orderDoc.id, ...orderDoc.data() } as Order;
            setOrder(orderData);

            // Cargar la mesa asociada (solo una vez o cuando cambie el tableId)
            if (orderData.tableId) {
              const tableDoc = await getDoc(doc(db, 'tables', orderData.tableId));
              if (tableDoc.exists()) {
                setTable({ id: tableDoc.id, ...tableDoc.data() } as Table);
              }
            }

            setLoading(false);
          },
          (err) => {
            console.error('Error al cargar la orden:', err);
            setError('Error al cargar la información');
            setLoading(false);
          }
        );

        // Cleanup: desuscribirse cuando el componente se desmonte
        return () => {
          unsubscribeOrder();
        };
      } catch (err) {
        console.error('Error al inicializar:', err);
        setError('Error al cargar la información');
        setLoading(false);
      }
    };

    const unsubscribe = loadOrderData();
    
    // Cleanup function
    return () => {
      if (unsubscribe && typeof unsubscribe.then === 'function') {
        unsubscribe.then(unsub => unsub && unsub());
      }
    };
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Cargando ticket...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 border border-red-500/50 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-white mb-2">Error</h1>
          <p className="text-gray-400">{error || 'No se pudo cargar el ticket'}</p>
        </div>
      </div>
    );
  }

  // Calcular totales
  const subtotal = order.items
    .filter(item => !item.isDeleted)
    .reduce((sum, item) => sum + (item.productPrice * item.quantity), 0);
  const total = order.total || subtotal;
  
  // Calcular propina total de todos los pagos
  const totalTip = order.payments?.reduce((sum, payment) => sum + (payment.tipAmount || 0), 0) || 0;
  const finalTotal = total + totalTip;

  // Determinar estado
  const getStatusInfo = () => {
    if (order.status === 'pagado') {
      return {
        icon: '✅',
        text: 'PAGADO',
        color: 'text-green-400',
        bgColor: 'bg-green-900/30',
        borderColor: 'border-green-500/50',
        message: '¡Gracias por tu visita! Vuelve pronto 🙏',
      };
    } else if (order.completedAt) {
      return {
        icon: '🍽️',
        text: 'LISTO PARA PAGAR',
        color: 'text-amber-400',
        bgColor: 'bg-amber-900/30',
        borderColor: 'border-amber-500/50',
        message: 'Tu orden está lista. Puedes solicitar tu cuenta al mesero.',
      };
    } else {
      return {
        icon: '⏳',
        text: 'EN PROGRESO',
        color: 'text-blue-400',
        bgColor: 'bg-blue-900/30',
        borderColor: 'border-blue-500/50',
        message: 'Tu orden está siendo preparada. ¡Pronto estará lista!',
      };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-block bg-gray-800 rounded-2xl p-4 border border-gray-700 mb-4">
            {config?.logo ? (
              <div className="flex flex-col items-center gap-3">
                <img 
                  src={config.logo} 
                  alt={config.name || 'Logo del negocio'} 
                  className="h-16 w-auto object-contain"
                />
                {config.name && (
                  <h1 className="text-2xl font-bold text-amber-400">{config.name}</h1>
                )}
              </div>
            ) : (
              <h1 className="text-3xl font-bold text-amber-400">
                {config?.name || '🍽️ Bar Pos'}
              </h1>
            )}
          </div>
          <p className="text-gray-400">Tu Ticket Digital</p>
        </div>

        {/* Código QR para compartir */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 mb-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-amber-400 mb-3">
              📱 Escanea para compartir
            </h3>
            <div className="flex justify-center mb-3">
              <div className="bg-white p-4 rounded-xl">
                <QRCodeSVG 
                  value={`${window.location.origin}/ticket/${orderId}`}
                  size={200}
                  level="H"
                  includeMargin={false}
                />
              </div>
            </div>
            <p className="text-sm text-gray-400">
              Comparte este ticket escaneando el código QR
            </p>
          </div>
        </div>

        {/* Estado de la Orden */}
        <div className={`${statusInfo.bgColor} border ${statusInfo.borderColor} rounded-2xl p-6 mb-6`}>
          <div className="text-center">
            <div className="text-6xl mb-3">{statusInfo.icon}</div>
            <h2 className={`text-2xl font-bold ${statusInfo.color} mb-2`}>
              {statusInfo.text}
            </h2>
            <p className="text-gray-300">{statusInfo.message}</p>
          </div>
        </div>

        {/* Información del Ticket */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 mb-6">
          {/* Número de Personas - Destacado */}
          {order.peopleCount && order.peopleCount > 0 && (
            <div className="bg-gradient-to-r from-amber-900/30 to-amber-800/20 border border-amber-500/50 rounded-xl p-6 mb-6 text-center">
              <p className="text-gray-400 text-sm mb-2">Número de Personas</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-5xl">👥</span>
                <span className="text-6xl font-bold text-amber-400">
                  {order.peopleCount}
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm mb-4 pb-4 border-b border-gray-700">
            <div>
              <p className="text-gray-500">Mesa</p>
              <p className="text-white font-semibold text-lg">
                {table?.number || order.tableId || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Orden</p>
              <p className="text-white font-semibold text-lg">
                #{order.id.slice(-6).toUpperCase()}
              </p>
            </div>
            {order.waiterName && (
              <div>
                <p className="text-gray-500">Mesero</p>
                <p className="text-white font-semibold">{order.waiterName}</p>
              </div>
            )}
            <div>
              <p className="text-gray-500">Fecha</p>
              <p className="text-white font-semibold">
                {toDate(order.createdAt)?.toLocaleDateString('es-MX', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }) || 'N/A'}
              </p>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-amber-400 mb-3">📋 Tu Orden</h3>
            {order.items.filter(item => !item.isDeleted).map((item, index) => (
              <div key={index} className="bg-gray-900/50 rounded-xl p-4 border border-gray-700">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-semibold">{item.productName}</span>
                      <span className="text-amber-400 font-bold">x{item.quantity}</span>
                    </div>
                    {item.notes && (
                      <p className="text-gray-400 text-sm italic">📝 {item.notes}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold">{formatCurrency(item.productPrice * item.quantity)}</p>
                    <p className="text-gray-500 text-xs">{formatCurrency(item.productPrice)} c/u</p>
                  </div>
                </div>
                
                {/* Estado del item */}
                <div className="flex items-center gap-2 text-xs mt-2">
                  {item.status === 'listo' ? (
                    <span className="bg-green-900/30 text-green-400 px-2 py-1 rounded-full">
                      ✅ Listo
                    </span>
                  ) : item.status === 'en_preparacion' ? (
                    <span className="bg-blue-900/30 text-blue-400 px-2 py-1 rounded-full">
                      👨‍🍳 Preparando
                    </span>
                  ) : item.status === 'entregado' ? (
                    <span className="bg-purple-900/30 text-purple-400 px-2 py-1 rounded-full">
                      🍽️ Entregado
                    </span>
                  ) : (
                    <span className="bg-gray-700 text-gray-400 px-2 py-1 rounded-full">
                      ⏳ Pendiente
                    </span>
                  )}
                  {item.category && (
                    <span className="bg-gray-700 text-gray-300 px-2 py-1 rounded-full">
                      {item.category}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totales */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-semibold text-amber-400 mb-4">💰 Total</h3>
          
          <div className="space-y-3">
            <div className="flex justify-between text-gray-300">
              <span>Subtotal</span>
              <span className="font-semibold">{formatCurrency(subtotal)}</span>
            </div>
            
            {totalTip > 0 && (
              <div className="flex justify-between text-gray-300">
                <span>Propina 🙏</span>
                <span className="font-semibold text-amber-400">{formatCurrency(totalTip)}</span>
              </div>
            )}

            <div className="border-t border-gray-700 pt-3">
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-white">Total</span>
                <span className="text-3xl font-bold text-amber-400">
                  {formatCurrency(finalTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Información de Pago (solo si está pagado) */}
        {order.status === 'pagado' && order.payments && order.payments.length > 0 && (
          <div className="bg-green-900/20 border border-green-500/50 rounded-2xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-green-400 mb-4 flex items-center gap-2">
              <span>✅</span>
              <span>Información de Pago</span>
            </h3>
            
            <div className="space-y-3">
              {order.payments.map((payment, index) => (
                <div key={index} className="bg-gray-800/50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Método de Pago</span>
                    <span className="font-semibold text-white">
                      {PAYMENT_METHOD_NAMES[payment.method as PaymentMethod] || payment.method}
                    </span>
                  </div>

                  {payment.receivedAmount && payment.receivedAmount > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">Monto Recibido</span>
                      <span className="font-semibold text-white">
                        {formatCurrency(payment.receivedAmount)}
                      </span>
                    </div>
                  )}

                  {payment.change && payment.change > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">Cambio</span>
                      <span className="font-semibold text-amber-400">
                        {formatCurrency(payment.change)}
                      </span>
                    </div>
                  )}

                  {payment.tipAmount && payment.tipAmount > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">Propina</span>
                      <span className="font-semibold text-green-400">
                        {formatCurrency(payment.tipAmount)}
                        {payment.tipPercent && ` (${(payment.tipPercent * 100).toFixed(0)}%)`}
                      </span>
                    </div>
                  )}

                  {payment.createdAt && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Fecha de Pago</span>
                      <span className="font-semibold text-gray-300">
                        {toDate(payment.createdAt)?.toLocaleString('es-MX', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        }) || 'N/A'}
                      </span>
                    </div>
                  )}
                </div>
              ))}

              <div className="flex justify-between items-center bg-green-900/30 rounded-lg p-3 border border-green-500/30">
                <span className="text-green-300 font-semibold">Total Pagado</span>
                <span className="font-bold text-green-400 text-xl">
                  {formatCurrency(finalTotal)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Mensaje de despedida */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 text-center">
          <p className="text-gray-300 mb-2">
            ¿Tienes alguna pregunta o necesitas ayuda?
          </p>
          <p className="text-amber-400 font-semibold">
            No dudes en llamar a tu mesero 🙋‍♂️
          </p>
          
          {order.status === 'pagado' && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <p className="text-lg font-bold text-white mb-2">
                ✨ ¡Gracias por tu visita! ✨
              </p>
              <p className="text-gray-400">
                Esperamos verte pronto en {config?.name || 'Casa Pedre'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-gray-500 text-sm">
          <p>Ticket generado el {new Date().toLocaleString('es-MX')}</p>
          <p className="mt-2">{config?.name || 'Casa Pedre'} - Sistema de Gestión</p>
        </div>
      </div>
    </div>
  );
};

export default CustomerTicket;
