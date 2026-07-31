// src/utils/categories.ts
/**
 * Diccionario centralizado de categorías del sistema
 * Modifica este archivo para agregar/remover categorías y se reflejará en todo el sistema
 */

export type CategoryKey =
  | 'Bebida'
  | 'Botella'
  | 'Shot'
  | 'Servicio'
  | 'Desayunos'
  | 'Guisados'
  | 'Parrilla'
  | 'Mariscos'
  | 'Especiales'
  | 'Hamburguesas'
  | 'Alitas y Más'
  | 'Postres';

export interface Category {
  key: CategoryKey;
  label: string;
  icon?: string; // emoji o icon name
  color?: string; // clase de color tailwind
  workstation?: 'cocina' | 'barra'; // para filtrado en kanban/kitchen
}

/**
 * Lista de todas las categorías disponibles
 */
export const CATEGORIES: Category[] = [
  {
    key: 'Bebida',
    label: 'Bebida',
    icon: '🍹',
    color: 'bg-blue-500',
    workstation: 'barra'
  },
  {
    key: 'Botella',
    label: 'Botella',
    icon: '🍾',
    color: 'bg-purple-500',
    workstation: 'barra'
  },
  {
    key: 'Shot',
    label: 'Shot',
    icon: '🥃',
    color: 'bg-red-500',
    workstation: 'barra'
  },
  {
    key: 'Servicio',
    label: 'Servicio',
    icon: '🔔',
    color: 'bg-gray-500',
    workstation: 'barra'
  },
  {
    key: 'Desayunos',
    label: 'Desayunos',
    icon: '🍳',
    color: 'bg-yellow-500',
    workstation: 'cocina'
  },
  {
    key: 'Guisados',
    label: 'Guisados',
    icon: '🍲',
    color: 'bg-amber-600',
    workstation: 'cocina'
  },
  {
    key: 'Parrilla',
    label: 'Parrilla',
    icon: '🥩',
    color: 'bg-orange-600',
    workstation: 'cocina'
  },
  {
    key: 'Mariscos',
    label: 'Mariscos',
    icon: '🦐',
    color: 'bg-cyan-600',
    workstation: 'cocina'
  },
  {
    key: 'Especiales',
    label: 'Especiales',
    icon: '⭐',
    color: 'bg-indigo-500',
    workstation: 'cocina'
  },
  {
    key: 'Hamburguesas',
    label: 'Hamburguesas',
    icon: '🍔',
    color: 'bg-orange-500',
    workstation: 'cocina'
  },
  {
    key: 'Alitas y Más',
    label: 'Alitas y Más',
    icon: '🍗',
    color: 'bg-red-600',
    workstation: 'cocina'
  },
  {
    key: 'Postres',
    label: 'Postres',
    icon: '🍰',
    color: 'bg-pink-500',
    workstation: 'cocina'
  }
];

/**
 * Obtener solo las keys de las categorías (para types y selects)
 */
export const getCategoryKeys = (): CategoryKey[] => {
  return CATEGORIES.map(cat => cat.key);
};

/**
 * Obtener solo los labels de las categorías
 */
export const getCategoryLabels = (): string[] => {
  return CATEGORIES.map(cat => cat.label);
};

/**
 * Obtener categorías por estación de trabajo
 */
export const getCategoriesByWorkstation = (workstation: 'cocina' | 'barra'): Category[] => {
  return CATEGORIES.filter(cat => cat.workstation === workstation);
};

/**
 * Obtener información completa de una categoría por su key
 */
export const getCategoryInfo = (key: CategoryKey): Category | undefined => {
  return CATEGORIES.find(cat => cat.key === key);
};

/**
 * Categorías para filtros (incluye "Todos")
 */
export const FILTER_CATEGORIES = ['Todos', ...getCategoryLabels()];
