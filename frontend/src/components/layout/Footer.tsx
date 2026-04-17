import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-primary text-white mt-10 sm:mt-20 mb-14 md:mb-0">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-8 sm:py-12 grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
        <div className="col-span-2 lg:col-span-1">
          <h3 className="text-lg font-bold mb-3 sm:mb-4">GOgreen</h3>
          <p className="text-white/70 text-sm leading-relaxed">
            Your independent solution for gardening and farming needs.
            We deliver green happiness, one plant at a time.
          </p>
        </div>
        <div>
          <h4 className="font-semibold mb-2 sm:mb-3 text-sm uppercase tracking-wider">Shop</h4>
          <div className="flex flex-col gap-1.5 sm:gap-2 text-sm text-white/70">
            <Link to="/products" className="hover:text-white transition">All Plants</Link>
            <Link to="/products?category=indoor-plants" className="hover:text-white transition">Indoor Plants</Link>
            <Link to="/products?category=outdoor-plants" className="hover:text-white transition">Outdoor Plants</Link>
            <Link to="/products?category=seeds" className="hover:text-white transition">Seeds</Link>
          </div>
        </div>
        <div>
          <h4 className="font-semibold mb-2 sm:mb-3 text-sm uppercase tracking-wider">Help</h4>
          <div className="flex flex-col gap-1.5 sm:gap-2 text-sm text-white/70">
            <span>Track Order</span>
            <span>Returns & Refunds</span>
            <span>FAQs</span>
            <span>Contact Us</span>
          </div>
        </div>
        <div className="col-span-2 lg:col-span-1">
          <h4 className="font-semibold mb-2 sm:mb-3 text-sm uppercase tracking-wider">Stay Connected</h4>
          <p className="text-sm text-white/70 mb-3">
            Get plant care tips & exclusive offers.
          </p>
          <div className="flex">
            <input
              type="email"
              placeholder="Your email"
              className="flex-1 min-w-0 px-3 py-2.5 text-sm rounded-l-lg bg-white/10 border border-white/20 placeholder-white/50 focus:outline-none focus:bg-white/20 transition"
            />
            <button className="px-4 py-2.5 bg-accent rounded-r-lg text-sm font-medium hover:bg-accent/90 transition shrink-0">
              Join
            </button>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 text-center py-3 sm:py-4 text-xs text-white/50">
        © 2026 GOgreen. Your garden, your way.
      </div>
    </footer>
  );
}
