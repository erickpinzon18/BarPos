// src/utils/addUserPins.ts
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Agrega PINs a usuarios existentes para testing
 */
export const addPinsToUsers = async () => {
  try {
    console.log('🔄 Agregando PINs a usuarios...');

    // Obtener todos los usuarios
    const usersSnapshot = await getDocs(collection(db, 'users'));
    
    const updates = [];
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      let pin = '';
      
      // Asignar PIN basado en el rol
      switch (userData.role) {
        case 'admin':
          pin = '1234'; // PIN para admin
          break;
        case 'waiter':
          pin = '5678'; // PIN para mesero
          break;
        case 'kitchen':
          pin = '9999'; // PIN para cocina
          break;
        default:
          pin = '0000'; // PIN por defecto
      }
      
      // Actualizar usuario con PIN
      const updatePromise = updateDoc(doc(db, 'users', userDoc.id), {
        pin: pin,
        updatedAt: new Date()
      });
      
      updates.push(updatePromise);
      
      console.log(`📌 Usuario ${userData.email} (${userData.role}) -> PIN: ${pin}`);
    }
    
    // Ejecutar todas las actualizaciones
    await Promise.all(updates);
    
    console.log('✅ PINs agregados exitosamente a todos los usuarios');
    
    return {
      success: true,
      message: 'PINs agregados exitosamente',
      pins: {
        admin: '1234',
        waiter: '5678', 
        kitchen: '9999'
      }
    };
    
  } catch (error) {
    console.error('❌ Error agregando PINs:', error);
    throw error;
  }
};

// Exponer función globalmente para desarrollo
if (typeof window !== 'undefined') {
  (window as any).addPinsToUsers = addPinsToUsers;
}
