// src/services/userAdminService.ts
// Alta de usuarios del personal desde Configuración (solo super admin).
// La cuenta de Firebase Auth se crea con una instancia secundaria de Firebase para no
// cerrar la sesión de quien la crea; el perfil se guarda en `users/{uid}`, que es lo que lee el login.
import { deleteApp, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { collection, doc, getDocs, query, setDoc, Timestamp, where } from 'firebase/firestore';
import { app, db } from './firebase';
import type { User, UserRole } from '../utils/types';

export interface NewStaffUser {
  displayName: string;
  email: string;
  password: string;
  role: UserRole;
  pin?: string;
}

const AUTH_ERRORS: Record<string, string> = {
  'auth/email-already-in-use': 'Ya existe una cuenta con ese correo',
  'auth/invalid-email': 'El correo no es válido',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres',
};

export const createStaffUser = async (data: NewStaffUser, createdBy: User): Promise<string> => {
  if (!createdBy.superAdmin) throw new Error('Solo un super administrador puede crear usuarios');
  const email = data.email.trim().toLowerCase();
  const pin = data.pin?.trim() || '';
  if (pin) {
    // El PIN identifica a la persona al autorizar (verifyUserPin toma el primero que coincida): no se puede repetir
    const dup = await getDocs(query(collection(db, 'users'), where('pin', '==', pin)));
    if (!dup.empty) throw new Error('Ese PIN ya lo usa otro usuario');
  }

  const secondary = initializeApp(app.options, `alta-usuario-${Date.now()}`);
  try {
    const secondaryAuth = getAuth(secondary);
    let uid: string;
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, data.password);
      uid = cred.user.uid;
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      throw new Error(AUTH_ERRORS[code] ?? (err as Error)?.message ?? 'No se pudo crear la cuenta');
    }
    const now = Timestamp.now();
    await setDoc(doc(db, 'users', uid), {
      email,
      displayName: data.displayName.trim(),
      role: data.role,
      ...(pin ? { pin } : {}),
      active: true,
      superAdmin: false,
      createdBy: createdBy.id,
      createdByName: createdBy.displayName || createdBy.email,
      createdAt: now,
      updatedAt: now,
    });
    await signOut(secondaryAuth);
    return uid;
  } finally {
    await deleteApp(secondary);
  }
};
