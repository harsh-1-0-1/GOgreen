import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-primary text-white mt-20">
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <div>
          <h3 className="text-lg font-bold mb-4">Ugaoo</h3>
          <p className="text-white/70 text-sm leading-relaxed">
            India's largest online plant nursery. We deliver happiness,
            one plant at a time.
          </p>
        </div>
        <div>
          <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider">Shop</h4>
          <div className="flex flex-col gap-2 text-sm text-white/70">
            <Link to="/products" className="hover:text-white transition">All Plants</Link>
            <Link to="/products?category=indoor-plants" className="hover:text-white transition">Indoor Plants</Link>
            <Link to="/products?category=outdoor-plants" className="hover:text-white transition">Outdoor Plants</Link>
            <Link to="/products?category=seeds" className="hover:text-white transition">Seeds</Link>
          </div>
        </div>
        <div>
          <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider">Help</h4>
          <div className="flex flex-col gap-2 text-sm text-white/70">
            <span>Track Order</span>
            <span>Returns & Refunds</span>
            <span>FAQs</span>
            <span>Contact Us</span>
          </div>
        </div>
        <div>
          <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider">Stay Connected</h4>
          <p className="text-sm text-white/70 mb-3">
            Get plant care tips & exclusive offers.
          </p>
          <div className="flex">
            <input
              type="email"
              placeholder="Your email"
              className="flex-1 px-3 py-2 text-sm rounded-l-lg bg-white/10 border border-white/20 placeholder-white/50 focus:outline-none focus:bg-white/20 transition"
            />
            <button className="px-4 py-2 bg-accent rounded-r-lg text-sm font-medium hover:bg-accent/90 transition">
              Join
            </button>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 text-center py-4 text-xs text-white/50">
        © 2026 Ugaoo Clone. Built for learning purposes.
      </div>
    </footer>
  );
}
