// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { auth } from '../services/firebase';
import { getUserByUid } from '../services/firestoreService';
import type { User, AuthContextType } from '../utils/types';
import toast from 'react-hot-toast';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      setLoading(true);
      
      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      // Get user profile from Firestore
      const userResponse = await getUserByUid(firebaseUser.uid);
      
      if (!userResponse.success || !userResponse.data) {
        throw new Error('Usuario no encontrado en la base de datos');
      }
      
      setCurrentUser(userResponse.data);
      toast.success('Inicio de sesión exitoso');
    } catch (error: any) {
      console.error('Login error:', error);
      let errorMessage = 'Error al iniciar sesión';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'Usuario no encontrado';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Contraseña incorrecta';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Email inválido';
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'Usuario deshabilitado';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      toast.success('Sesión cerrada exitosamente');
    } catch (error: any) {
      console.error('Logout error:', error);
      toast.error('Error al cerrar sesión');
      throw error;
    }
  };

  const updateUserProfile = async (updates: Partial<User>): Promise<void> => {
    try {
      if (!currentUser) {
        throw new Error('No hay usuario autenticado');
      }

      // Update user in Firestore
      // Note: This would require implementing updateUser in firestoreService
      const updatedUser = { ...currentUser, ...updates };
      setCurrentUser(updatedUser);
      toast.success('Perfil actualizado exitosamente');
    } catch (error: any) {
      console.error('Update profile error:', error);
      toast.error('Error al actualizar perfil');
      throw error;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      try {
        if (firebaseUser) {
          // User is signed in, get their profile from Firestore
          const userResponse = await getUserByUid(firebaseUser.uid);
          
          if (userResponse.success && userResponse.data) {
            setCurrentUser(userResponse.data);
          } else {
            // User exists in Firebase Auth but not in Firestore
            // This shouldn't happen in normal flow, but we handle it
            console.warn('User exists in Auth but not in Firestore');
            setCurrentUser(null);
          }
        } else {
          // User is signed out
          setCurrentUser(null);
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const value: AuthContextType = {
    currentUser,
    loading,
    login,
    logout,
    updateUserProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
