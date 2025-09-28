// src/utils/errorHandler.ts
import toast from 'react-hot-toast';

export class AppError extends Error {
  public code?: string;
  public statusCode?: number;
  
  constructor(
    message: string,
    code?: string,
    statusCode?: number
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export const handleFirebaseError = (error: any): string => {
  console.error('Firebase error:', error);
  
  switch (error.code) {
    case 'auth/user-not-found':
      return 'Usuario no encontrado';
    case 'auth/wrong-password':
      return 'Contraseña incorrecta';
    case 'auth/invalid-email':
      return 'Email inválido';
    case 'auth/user-disabled':
      return 'Usuario deshabilitado';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Intenta más tarde';
    case 'permission-denied':
      return 'No tienes permisos para realizar esta acción';
    case 'unavailable':
      return 'Servicio no disponible. Verifica tu conexión';
    case 'deadline-exceeded':
      return 'Tiempo de espera agotado. Intenta nuevamente';
    default:
      return error.message || 'Ha ocurrido un error inesperado';
  }
};

export const showErrorToast = (error: any): void => {
  const message = error instanceof AppError 
    ? error.message 
    : handleFirebaseError(error);
  
  toast.error(message);
};

export const showSuccessToast = (message: string): void => {
  toast.success(message);
};

export const showLoadingToast = (message: string): string => {
  return toast.loading(message);
};

export const dismissToast = (toastId: string): void => {
  toast.dismiss(toastId);
};
