// src/services/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Tu configuración de Firebase que copiaste de la consola
const firebaseConfig = {
  apiKey: "AIzaSyCXCsPO1P-fWcHe9g8SLcWJCXQOIu1cN4U",
  authDomain: "bar-pos-app.firebaseapp.com",
  projectId: "bar-pos-app",
  storageBucket: "bar-pos-app.firebasestorage.app",
  messagingSenderId: "669593640045",
  appId: "1:669593640045:web:f1928e177c014e1ee97364"
};
// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar los servicios que usarás
export const db = getFirestore(app);
export const auth = getAuth(app);