// src/utils/notificationSound.ts
// Play notification sound using audio file
import ding from "../assets/ding.mp3"

export const playNotificationSound = () => {
  console.log('🔔 [NOTIFICATION SOUND] Intentando reproducir sonido...');
  try {
    const audio = new Audio(ding);
    audio.volume = 0.8; // 80% volume
    console.log('🔔 [NOTIFICATION SOUND] Audio creado, ruta:', ding);
    console.log('🔔 [NOTIFICATION SOUND] Volumen configurado:', audio.volume);
    
    audio.play()
      .then(() => {
        console.log('✅ [NOTIFICATION SOUND] Sonido reproducido exitosamente');
      })
      .catch(error => {
        console.error('❌ [NOTIFICATION SOUND] Error al reproducir:', error);
      });
  } catch (error) {
    console.error('❌ [NOTIFICATION SOUND] Error en catch:', error);
  }
};

// Alternative: Double ding for more noticeable notification
export const playDoubleNotificationSound = () => {
  console.log('🔔🔔 [DOUBLE DING] Reproduciendo doble ding...');
  playNotificationSound();
  setTimeout(() => {
    console.log('🔔🔔 [DOUBLE DING] Reproduciendo segundo ding...');
    playNotificationSound();
  }, 1000); // Wait 1 second for the first ding to finish
};

export default playNotificationSound;
