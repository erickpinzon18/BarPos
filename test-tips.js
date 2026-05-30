import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, getDocs } from "firebase/firestore";
import fs from "fs";

// Leer la configuración del archivo .env local si existe o inferir del entorno
const firebaseConfigStr = fs.readFileSync(".env", "utf8").match(/VITE_FIREBASE_CONFIG='(.*?)'/)?.[1];
if (!firebaseConfigStr) {
  console.error("No VITE_FIREBASE_CONFIG found in .env");
  process.exit(1);
}

const firebaseConfig = JSON.parse(firebaseConfigStr);
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const q = query(collection(db, "orders"));
  const snapshot = await getDocs(q);
  let missingPaymentMethod = 0;
  let missingButHasTip = 0;
  
  snapshot.forEach(doc => {
    const data = doc.data();
    const tip = (data.total || 0) - (data.subtotal || 0);
    if (!data.paymentMethod && tip > 0) {
      missingButHasTip++;
    }
  });
  console.log(`Missing payment method but has tip: ${missingButHasTip}`);
  process.exit(0);
}

run().catch(console.error);
