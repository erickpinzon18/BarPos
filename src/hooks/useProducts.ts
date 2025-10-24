// src/hooks/useProducts.ts
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { Product } from '../utils/types';

export const useProducts = (availableOnly: boolean = true) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      let q = query(
        collection(db, 'products'),
        orderBy('name', 'asc')
      );

      // Filtrar solo productos disponibles si se especifica
      if (availableOnly) {
        q = query(
          collection(db, 'products'),
          where('available', '==', true),
          orderBy('name', 'asc')
        );
      }

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const productsData: Product[] = [];
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          productsData.push({
            id: doc.id,
            name: data.name,
            description: data.description,
            price: data.price,
            category: data.category,
            imageUrl: data.imageUrl,
            available: data.available,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt || Date.now())
          });
        });

        // // console.log('🛍️ Products loaded:', productsData.length);
        setProducts(productsData);
        setLoading(false);
        setError(null);
      }, (err) => {
        console.error('❌ Error loading products:', err);
        setError('Error al cargar los productos');
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err) {
      console.error('❌ Error setting up products listener:', err);
      setError('Error al configurar la escucha de productos');
      setLoading(false);
    }
  }, [availableOnly]);

  return { products, loading, error };
};
