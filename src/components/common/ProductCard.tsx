// src/components/common/ProductCard.tsx
import React from 'react';
import type { Product } from '../../utils/types';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';

interface ProductCardProps {
  product: Product;
  onAdd?: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onAdd }) => {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <span className="font-semibold">{product.name}</span>
          <span className="text-amber-400 font-medium">${product.price.toFixed(2)}</span>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-400 mb-4 line-clamp-2">{product.description}</p>
        <Button onClick={onAdd} size="sm">Agregar</Button>
      </CardContent>
    </Card>
  );
};

export default ProductCard;
