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

    console.log('✅ Access token encontrado');
    console.log('📝 Request:', req.method, req.path);

    // Extraer el path de la URL
    const path = req.path.replace('/api/mercadopago', '');
    const url = `https://api.mercadopago.com${path}`;

    try {
      // Copiar headers del request original (excepto host)
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };

      // Copiar headers importantes del request original
      if (req.headers['x-idempotency-key']) {
        headers['X-Idempotency-Key'] = req.headers['x-idempotency-key'] as string;
      }
      if (req.headers['x-request-id']) {
        headers['X-Request-Id'] = req.headers['x-request-id'] as string;
      }

      console.log('📤 Headers enviados:', Object.keys(headers));

      const response = await fetch(url, {
        method: req.method,
        headers,
        body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
      });

      const data = await response.json();
      
      console.log('📥 Response status:', response.status);
      
      res.status(response.status).json(data);
    } catch (error) {
      console.error('Error en proxy Mercado Pago:', error);
      res.status(500).json({ error: 'Error al comunicarse con Mercado Pago' });
    }
  });
});
