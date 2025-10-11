// src/components/common/MercadoPagoTerminalModal.tsx
import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader, CreditCard } from 'lucide-react';
import { getEnabledTerminals, processPayment } from '../../services/mercadoPagoService';
import { getTerminalsConfig } from '../../services/firestoreService';

interface MercadoPagoTerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError: (error: string) => void;
  amount: number;
  orderId: string;
}

type PaymentStatus = 'select-terminal' | 'initial' | 'sending' | 'processing' | 'success' | 'rejected' | 'error' | 'confirm-close';

const MercadoPagoTerminalModal: React.FC<MercadoPagoTerminalModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onError,
  amount,
  orderId
}) => {
  const [status, setStatus] = useState<PaymentStatus>('select-terminal');
  const [message, setMessage] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [selectedTerminal, setSelectedTerminal] = useState<string | null>(null);
  const [availableTerminals, setAvailableTerminals] = useState<any[]>([]);
  const [loadingTerminals, setLoadingTerminals] = useState(true);

  // Cargar terminales habilitadas al abrir el modal
  useEffect(() => {
    const loadTerminals = async () => {
      if (!isOpen) return;
      
      setLoadingTerminals(true);
      try {
        const configRes = await getTerminalsConfig();
        const config = configRes.success ? configRes.data : {};
        const terminals = await getEnabledTerminals(config || {});
        setAvailableTerminals(terminals);
      } catch (err) {
        console.error('Error loading terminals:', err);
        setAvailableTerminals([]);
      } finally {
        setLoadingTerminals(false);
      }
    };
    
    void loadTerminals();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setStatus('select-terminal');
      setMessage('');
      setCountdown(0);
      setSelectedTerminal(null);
      return;
    }

    // Mostrar pantalla de selección de terminal
    if (status === 'select-terminal') {
      return; // Esperar a que el usuario seleccione terminal
    }

    // Mostrar pantalla inicial con instrucciones
    if (status === 'initial') {
      return; // Esperar a que el usuario confirme iniciar
    }

    // Procesar pago real con Mercado Pago Terminal
    const processRealPayment = async () => {
      if (!selectedTerminal) {
        console.error('❌ [MP Terminal] No hay terminal seleccionada');
        setStatus('error');
        setMessage('Error: No se seleccionó una terminal');
        onError('No se seleccionó una terminal');
        return;
      }

      try {
        console.log('� [MP Terminal] Iniciando pago real:', { 
          terminalId: selectedTerminal, 
          amount, 
          orderId 
        });

        // Usar la función processPayment del servicio que maneja todo el flujo
        const result = await processPayment(
          {
            amount,
            description: `Orden ${orderId.substring(0, 8)}`,
            externalReference: orderId,
            terminalId: selectedTerminal
          },
          (statusUpdate, messageUpdate) => {
            console.log(`� [MP Terminal] Estado: ${statusUpdate} - ${messageUpdate}`);
            
            // Actualizar UI según el estado
            if (statusUpdate === 'sending') {
              setStatus('sending');
              setMessage(messageUpdate);
              setCountdown(0);
            } else if (statusUpdate === 'processing') {
              setStatus('processing');
              setMessage(messageUpdate);
              
              // Extraer segundos del mensaje si existe
              const match = messageUpdate.match(/\((\d+)s\)/);
              if (match) {
                setCountdown(parseInt(match[1]));
              }
            } else if (statusUpdate === 'success') {
              setStatus('success');
              setMessage(messageUpdate);
              setCountdown(0);
            } else if (statusUpdate === 'rejected') {
              setStatus('rejected');
              setMessage(messageUpdate);
              setCountdown(0);
            } else if (statusUpdate === 'error') {
              setStatus('error');
              setMessage(messageUpdate);
              setCountdown(0);
            }
          }
        );

        // Procesar resultado final
        if (result.status === 'APPROVED') {
          console.log('✅ [MP Terminal] Pago aprobado - ID:', result.paymentId);
          setStatus('success');
          setMessage('¡Pago procesado exitosamente!');
          setCountdown(0);
        } else if (result.status === 'REJECTED') {
          console.log('❌ [MP Terminal] Pago rechazado');
          setStatus('rejected');
          setMessage(result.errorMessage || 'Pago rechazado. Intenta nuevamente o usa otro método.');
          setCountdown(0);
          onError(result.errorMessage || 'Pago rechazado');
        } else if (result.status === 'CANCELLED') {
          console.log('🚫 [MP Terminal] Pago cancelado');
          setStatus('rejected');
          setMessage('Pago cancelado por el cliente.');
          setCountdown(0);
          onError('Pago cancelado');
        } else {
          console.log('⚠️ [MP Terminal] Estado final inesperado:', result.status);
          setStatus('error');
          setMessage('Estado de pago inesperado. Verifica en Mercado Pago.');
          setCountdown(0);
          onError(`Estado inesperado: ${result.status}`);
        }

      } catch (error: any) {
        console.error('❌ [MP Terminal] Error procesando pago:', error);
        setStatus('error');
        setMessage(error.message || 'Error de conexión con la terminal. Intenta nuevamente.');
        setCountdown(0);
        onError(error.message || 'Error desconocido');
      }
    };

    if (status === 'sending') {
      processRealPayment();
    }
  }, [isOpen, status, orderId, amount, selectedTerminal, onError]);

  if (!isOpen) return null;

  const canClose = status === 'success' || status === 'rejected' || status === 'error' || status === 'confirm-close';
  
  // Función para reintentar el pago
  const handleRetry = () => {
    setStatus('sending');
    setMessage('');
    setCountdown(0);
  };

  // Función para seleccionar terminal y continuar
  const handleSelectTerminal = (terminalId: string) => {
    setSelectedTerminal(terminalId);
    setStatus('initial');
  };

  // Función para volver a selección de terminal
  const handleBackToTerminalSelection = () => {
    setStatus('select-terminal');
    setSelectedTerminal(null);
  };

  // Función para iniciar el proceso de pago
  const handleStartPayment = () => {
    setStatus('sending');
  };

  // Función para confirmar cierre de mesa después de pago exitoso
  const handleConfirmClose = () => {
    setStatus('confirm-close');
  };

  // Función para finalizar y cerrar mesa
  const handleFinalizeClose = () => {
    onSuccess();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full border-2 border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-center">
          <div className="flex justify-center mb-3">
            <div className="bg-white rounded-full p-3">
              <CreditCard className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white">Terminal Mercado Pago</h2>
          <p className="text-blue-100 text-sm mt-1">Procesando pago</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Amount Display */}
          <div className="bg-gray-900 rounded-lg p-4 mb-6 border border-gray-700">
            <p className="text-sm text-gray-400 text-center mb-1">Monto a cobrar</p>
            <p className="text-4xl font-bold text-white text-center">${amount.toFixed(2)}</p>
            <p className="text-xs text-gray-500 text-center mt-1">Orden: {orderId.substring(0, 8)}...</p>
          </div>

          {/* Terminal Selection Screen */}
          {status === 'select-terminal' && (
            <div className="space-y-4">
              <div className="bg-purple-900/20 border border-purple-700 rounded-lg p-4">
                <h3 className="text-purple-300 font-semibold mb-2 flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Selecciona la Terminal
                </h3>
                <p className="text-sm text-gray-300 leading-relaxed">
                  Elige la terminal de Mercado Pago donde se procesará el pago del cliente.
                </p>
              </div>

              {/* Lista de Terminales */}
              <div className="space-y-3">
                {loadingTerminals && (
                  <div className="text-center py-8">
                    <Loader className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Cargando terminales...</p>
                  </div>
                )}
                
                {!loadingTerminals && availableTerminals.length === 0 && (
                  <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
                    <p className="text-yellow-300 text-sm text-center">
                      ⚠️ No hay terminales habilitadas. Por favor, habilita al menos una terminal en la configuración.
                    </p>
                  </div>
                )}
                
                {!loadingTerminals && availableTerminals.map((terminal) => (
                  <button
                    key={terminal.id}
                    onClick={() => handleSelectTerminal(terminal.id)}
                    className="w-full bg-gray-900 hover:bg-gray-700 border-2 border-gray-700 hover:border-purple-500 rounded-lg p-4 transition-all text-left group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-white font-semibold group-hover:text-purple-300 transition-colors">
                          {terminal.name}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          📍 {terminal.location}
                        </p>
                      </div>
                      <div className="ml-3">
                        <svg className="w-6 h-6 text-gray-600 group-hover:text-purple-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3">
                <p className="text-xs text-blue-200">
                  💡 <strong>Tip:</strong> Selecciona la terminal más cercana al cliente para agilizar el proceso.
                </p>
              </div>

              <button
                onClick={onClose}
                className="w-full py-2 px-4 rounded-lg font-medium text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
            </div>
          )}

          {/* Initial Screen - Instrucciones */}
          {status === 'initial' && (
            <div className="space-y-4">
              {/* Mostrar terminal seleccionada */}
              <div className="bg-purple-900/20 border border-purple-700 rounded-lg p-3">
                <p className="text-xs text-purple-200">
                  📡 <strong>Terminal seleccionada:</strong> {availableTerminals.find(t => t.id === selectedTerminal)?.name}
                </p>
              </div>

              <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                <h3 className="text-blue-300 font-semibold mb-2 flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Terminal de Pago
                </h3>
                <p className="text-sm text-gray-300 leading-relaxed">
                  Se abrirá una ventana en la terminal de Mercado Pago para procesar el pago. 
                  El cliente deberá ingresar o acercar su tarjeta/teléfono para completar la transacción.
                </p>
              </div>
              
              <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3">
                <p className="text-xs text-yellow-200">
                  ⚠️ <strong>Importante:</strong> Asegúrate de que la terminal esté encendida y conectada.
                </p>
              </div>

              <button
                onClick={handleStartPayment}
                className="w-full py-4 px-4 rounded-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white transition-all shadow-lg"
              >
                Abrir Terminal y Continuar
              </button>

              <button
                onClick={handleBackToTerminalSelection}
                className="w-full py-2 px-4 rounded-lg font-medium text-purple-400 hover:text-purple-300 hover:bg-gray-700 transition-colors"
              >
                ← Cambiar Terminal
              </button>

              <button
                onClick={onClose}
                className="w-full py-2 px-4 rounded-lg font-medium text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
            </div>
          )}

          {/* Confirmation Screen - Confirmar cierre de mesa */}
          {status === 'confirm-close' && (
            <div className="space-y-4">
              <div className="bg-green-900/20 border border-green-700 rounded-lg p-4 text-center">
                <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-3" />
                <h3 className="text-green-300 font-bold text-lg mb-2">¡Pago Exitoso!</h3>
                <p className="text-sm text-gray-300">
                  El pago de <strong className="text-white">${amount.toFixed(2)}</strong> fue procesado correctamente.
                </p>
              </div>

              <div className="bg-amber-900/20 border border-amber-700 rounded-lg p-4">
                <h4 className="text-amber-300 font-semibold mb-2">⚠️ Confirmar Cierre de Mesa</h4>
                <p className="text-sm text-gray-300 leading-relaxed">
                  ¿Deseas cerrar la mesa ahora? Esta acción finalizará la orden y liberará la mesa para nuevos clientes.
                </p>
              </div>

              <button
                onClick={handleFinalizeClose}
                className="w-full py-4 px-4 rounded-lg font-bold bg-green-600 hover:bg-green-700 text-white transition-colors shadow-lg"
              >
                ✓ Sí, Cerrar Mesa
              </button>

              <button
                onClick={onClose}
                className="w-full py-2 px-4 rounded-lg font-medium text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
              >
                Cancelar (no cerrar mesa)
              </button>
            </div>
          )}

          {/* Processing Screens */}
          {(status === 'sending' || status === 'processing' || status === 'success' || status === 'rejected' || status === 'error') && (
            <>
              {/* Status Display */}
              <div className="space-y-4">
                {/* Sending Phase */}
                <div className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                  status === 'sending' 
                    ? 'bg-blue-900/30 border border-blue-700' 
                    : 'bg-gray-900/50 border border-gray-700'
                }`}>
                  {status === 'sending' ? (
                    <Loader className="w-5 h-5 text-blue-400 animate-spin flex-shrink-0" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                  )}
                  <span className={`text-sm ${status === 'sending' ? 'text-blue-300 font-medium' : 'text-gray-400'}`}>
                    Conectando con terminal
                  </span>
                </div>

                {/* Processing Phase */}
                <div className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                  status === 'processing' 
                    ? 'bg-yellow-900/30 border border-yellow-700' 
                    : status === 'success' || status === 'rejected' || status === 'error'
                    ? 'bg-gray-900/50 border border-gray-700'
                    : 'bg-gray-900/30 border border-gray-800'
                }`}>
                  {status === 'processing' ? (
                    <Loader className="w-5 h-5 text-yellow-400 animate-spin flex-shrink-0" />
                  ) : status === 'success' ? (
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                  ) : status === 'rejected' || status === 'error' ? (
                    <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-700 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <span className={`text-sm ${
                      status === 'processing' 
                        ? 'text-yellow-300 font-medium' 
                        : status === 'success' || status === 'rejected' || status === 'error'
                        ? 'text-gray-400'
                        : 'text-gray-500'
                    }`}>
                      Esperando pago del cliente
                    </span>
                    {status === 'processing' && countdown > 0 && (
                      <div className="mt-1">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
                            <div 
                              className="bg-yellow-400 h-full transition-all duration-1000"
                              style={{ width: `${(countdown / 10) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-yellow-300 font-mono">{countdown}s</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Result Phase */}
                {(status === 'success' || status === 'rejected' || status === 'error') && (
                  <div className={`flex items-center gap-3 p-4 rounded-lg border-2 ${
                    status === 'success' 
                      ? 'bg-green-900/30 border-green-600' 
                      : 'bg-red-900/30 border-red-600'
                  }`}>
                    {status === 'success' ? (
                      <>
                        <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
                        <div>
                          <p className="text-green-300 font-semibold">Pago Aprobado</p>
                          <p className="text-green-400 text-xs mt-0.5">La transacción fue exitosa</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
                        <div>
                          <p className="text-red-300 font-semibold">
                            {status === 'rejected' ? 'Pago Rechazado' : 'Error'}
                          </p>
                          <p className="text-red-400 text-xs mt-0.5">{message}</p>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Message */}
              {message && status !== 'success' && status !== 'rejected' && status !== 'error' && (
                <div className="mt-4 text-center">
                  <p className="text-sm text-gray-300">{message}</p>
                </div>
              )}

              {/* Action Buttons */}
              {canClose && (
                <div className="space-y-3 mt-6">
                  {status === 'success' ? (
                    /* Pago exitoso - preguntar si cerrar mesa */
                    <button
                      onClick={handleConfirmClose}
                      className="w-full py-3 px-4 rounded-lg font-bold bg-green-600 hover:bg-green-700 text-white transition-colors"
                    >
                      Continuar y Cerrar Mesa
                    </button>
                  ) : status === 'rejected' ? (
                    <>
                      {/* Botón de Reintentar para pago rechazado */}
                      <button
                        onClick={handleRetry}
                        className="w-full py-3 px-4 rounded-lg font-bold bg-purple-600 hover:bg-purple-700 text-white transition-colors"
                      >
                        🔄 Reintentar Pago
                      </button>
                      {/* Botón de Cerrar como opción secundaria */}
                      <button
                        onClick={onClose}
                        className="w-full py-2 px-4 rounded-lg font-medium text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                      >
                        Cancelar y cerrar
                      </button>
                    </>
                  ) : (
                    /* Error */
                    <button
                      onClick={onClose}
                      className="w-full py-3 px-4 rounded-lg font-bold bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                    >
                      Cerrar
                    </button>
                  )}
                </div>
              )}

              {/* Cancel Button (only during processing) */}
              {status === 'processing' && (
                <button
                  onClick={onClose}
                  className="w-full mt-3 py-2 px-4 rounded-lg font-medium text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                >
                  Cancelar operación
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MercadoPagoTerminalModal;
