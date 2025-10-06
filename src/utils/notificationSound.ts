// src/utils/notificationSound.ts
// Generate a bell/ding notification sound using Web Audio API

export const playNotificationSound = () => {
  try {
    // Create audio context
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create oscillator for the bell sound
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Bell-like sound settings
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime); // High pitch for bell
    
    // Envelope for bell effect (quick attack, slow decay)
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01); // Attack
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5); // Decay
    
    // Start and stop
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
    
    // Clean up after sound finishes
    setTimeout(() => {
      try {
        audioContext.close();
      } catch (e) {
        // ignore cleanup errors
      }
    }, 600);
  } catch (error) {
    console.warn('Could not play notification sound:', error);
  }
};

// Alternative: Double ding for more noticeable notification
export const playDoubleNotificationSound = () => {
  playNotificationSound();
  setTimeout(() => {
    playNotificationSound();
  }, 150);
};

export default playNotificationSound;
