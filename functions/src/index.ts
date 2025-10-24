import * as functions from 'firebase-functions';
import cors from 'cors';
import * as dotenv from 'dotenv';

// Cargar variables de entorno del archivo .env
dotenv.config();

const corsHandler = cors({ origin: true });

// Proxy para Mercado Pago API
export const mercadopagoProxy = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    
    if (!accessToken) {
      console.error('❌ MERCADOPAGO_ACCESS_TOKEN no encontrado en .env');
      res.status(500).json({ error: 'Access token no configurado' });
      return;
    }

    // console.log('✅ Access token encontrado');
    // console.log('📝 Request:', req.method, req.path);

    // Extraer el path de la URL
    const path = req.path.replace('/api/mercadopago', '');
    const url = `https://api.mercadopago.com${path}`;

    try {
      const response = await fetch(url, {
        method: req.method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
      });

      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      console.error('Error en proxy Mercado Pago:', error);
      res.status(500).json({ error: 'Error al comunicarse con Mercado Pago' });
    }
  });
});
