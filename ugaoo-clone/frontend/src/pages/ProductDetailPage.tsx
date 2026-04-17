import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, Droplets, Minus, Plus, ShoppingCart, Sun } from 'lucide-react';
import toast from 'react-hot-toast';
import { useProduct, useProducts } from '@/hooks/useProducts';
import { useCartStore } from '@/store/cartStore';
import ProductCard from '@/components/product/ProductCard';
import Spinner from '@/components/ui/Spinner';
import ErrorBoundary from '@/components/ui/ErrorBoundary';

function ImageGallery({ images }: { images: string[] }) {
  const [active, setActive] = useState(0);
  const list = images.length ? images : ['https://placehold.co/600x600?text=Plant'];

  return (
    <div className="space-y-3">
      <div className="aspect-square rounded-2xl overflow-hidden bg-gray-50">
        <img
          src={list[active]}
          alt="Product"
          className="w-full h-full object-cover"
        />
      </div>
      {list.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {list.map((img, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition ${
                i === active ? 'border-primary' : 'border-transparent'
              }`}
            >
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CareTips({ tips }: { tips: string[] }) {
  const [open, setOpen] = useState(false);
  if (!tips?.length) return null;

  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-sm font-semibold hover:bg-gray-50 transition"
      >
        Plant Care Tips
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {open && (
        <div className="px-4 pb-4">
          <ul className="space-y-2">
            {tips.map((tip, i) => (
              <li key={i} className="text-sm text-gray-600 flex gap-2">
                <span className="text-primary-light mt-0.5">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: product, isLoading, isError } = useProduct(slug!);
  const addItem = useCartStore((s) => s.addItem);
  const [qty, setQty] = useState(1);

  const { data: similar } = useProducts({
    category_slug: product?.category_id ? undefined : undefined,
    limit: 5,
  });

  if (isLoading) return <Spinner className="py-32" />;
  if (isError || !product) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-gray-400">
        <p className="text-lg font-medium">Product not found</p>
        <Link to="/products" className="text-sm text-primary hover:underline mt-2">Back to Products</Link>
      </div>
    );
  }

  const discount =
    product.original_price && product.original_price > product.price
      ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
      : null;

  async function handleAddToCart() {
    try {
      await addItem(product!.id, qty);
      toast.success(`${product!.name} added to cart`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to add');
    }
  }

  const similarProducts = similar?.items.filter((p) => p.id !== product.id).slice(0, 4) ?? [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-400 mb-6 flex items-center gap-1.5">
        <Link to="/" className="hover:text-primary">Home</Link>
        <span>/</span>
        <Link to="/products" className="hover:text-primary">Products</Link>
        <span>/</span>
        <span className="text-gray-600">{product.name}</span>
      </nav>

      <div className="grid lg:grid-cols-2 gap-10">
        <ImageGallery images={product.images || []} />

        <div className="space-y-6">
          {product.badge && (
            <span className="inline-block bg-primary text-white text-xs font-medium px-3 py-1 rounded-full">
              {product.badge}
            </span>
          )}
          <h1 className="text-3xl font-bold">{product.name}</h1>

          {/* Price */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-primary">₹{product.price}</span>
            {product.original_price && product.original_price > product.price && (
              <>
                <span className="text-lg text-gray-400 line-through">₹{product.original_price}</span>
                <span className="text-sm font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded">
                  {discount}% OFF
                </span>
              </>
            )}
          </div>

          {/* Stock */}
          {product.stock_qty > 0 ? (
            <p className="text-sm text-green-600 font-medium">
              ✓ In Stock {product.stock_qty <= 5 && `(Only ${product.stock_qty} left)`}
            </p>
          ) : (
            <p className="text-sm text-red-500 font-medium">Out of Stock</p>
          )}

          {/* Description */}
          {product.description && (
            <p className="text-gray-600 leading-relaxed">{product.description}</p>
          )}

          {/* Plant attributes */}
          <div className="flex gap-6">
            {product.sunlight && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Sun size={18} className="text-accent" />
                {product.sunlight}
              </div>
            )}
            {product.watering && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Droplets size={18} className="text-blue-400" />
                {product.watering}
              </div>
            )}
          </div>

          {/* Tags */}
          {product.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {product.tags.map((tag) => (
                <Link
                  key={tag}
                  to={`/products?tags=${tag}`}
                  className="px-3 py-1 text-xs border rounded-full hover:border-primary-light hover:text-primary transition"
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}

          {/* Add to cart */}
          {product.stock_qty > 0 && (
            <div className="flex items-center gap-4">
              <div className="flex items-center border rounded-xl">
                <button
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  className="p-3 hover:bg-gray-50 transition"
                >
                  <Minus size={16} />
                </button>
                <span className="px-4 font-medium">{qty}</span>
                <button
                  onClick={() => setQty(Math.min(product.stock_qty, qty + 1))}
                  className="p-3 hover:bg-gray-50 transition"
                >
                  <Plus size={16} />
                </button>
              </div>
              <button
                onClick={handleAddToCart}
                className="flex-1 py-3.5 bg-primary text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition"
              >
                <ShoppingCart size={18} />
                Add to Cart — ₹{(product.price * qty).toFixed(0)}
              </button>
            </div>
          )}

          {/* Care tips */}
          <CareTips tips={product.care_tips || []} />
        </div>
      </div>

      {/* Similar products */}
      {similarProducts.length > 0 && (
        <ErrorBoundary>
          <section className="mt-16">
            <h2 className="text-2xl font-bold mb-6">You May Also Like</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {similarProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        </ErrorBoundary>
      )}
    </div>
  );
}
