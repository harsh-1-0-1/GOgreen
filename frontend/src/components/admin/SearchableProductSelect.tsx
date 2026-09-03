import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import type { Product } from '@/types';

interface SearchableProductSelectProps {
  products: Product[];
  onSelect: (productId: number) => void;
  placeholder?: string;
}

export default function SearchableProductSelect({
  products,
  onSelect,
  placeholder = 'Search products...',
}: SearchableProductSelectProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(true);

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q)
    );
  }, [search, products]);

  function handleSelect(productId: number) {
    onSelect(productId);
    setSearch('');
    setIsOpen(false);
  }

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder={placeholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
          autoFocus
        />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-20 max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">
              {search.trim() ? 'No products found' : 'No products available'}
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleSelect(product.id)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition flex items-center gap-3"
                >
                  <img
                    src={product.images?.[0] || 'https://placehold.co/40x40?text=P'}
                    alt={product.name}
                    className="w-8 h-8 rounded object-cover bg-gray-100 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                    <p className="text-xs text-gray-500">₹{product.price}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isOpen && products.length > 0 && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
