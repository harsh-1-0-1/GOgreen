import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { X, LogIn } from 'lucide-react';
import { LOGO_PATH } from '@/lib/branding';
import { useAuthStore } from '@/store/authStore';

const LINK_COLUMNS = [
  {
    title: 'Plants',
    links: [
      { label: 'Indoor Plants', to: '/products?category=indoor-plants' },
      { label: 'Outdoor Plants', to: '/products?category=outdoor-plants' },
      { label: 'Air Purifying', to: '/products?tags=air-purifying' },
      { label: 'Low Maintenance', to: '/products?tags=low-maintenance' },
      { label: 'XL Plants', to: '/products?category=xl-plants' },
      { label: 'Hanging Plants', to: '/products?tags=hanging' },
      { label: 'Flowering Plants', to: '/products?category=flowering-plants' },
    ],
  },
  {
    title: 'Seeds & Pots',
    links: [
      { label: 'Vegetable Seeds', to: '/products?category=vegetable-seeds' },
      { label: 'Flower Seeds', to: '/products?category=flower-seeds' },
      { label: 'Herb Seeds', to: '/products?tags=herb,seeds' },
      { label: 'Ceramic Pots', to: '/products?tags=ceramic' },
      { label: 'Plastic Pots', to: '/products?tags=plastic' },
      { label: 'Hanging Planters', to: '/products?tags=hanging' },
      { label: 'Plant Stands', to: '/products?category=plant-stands' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Us', to: '/' },
      { label: 'Blog', to: '/blog' },
      { label: 'Garden Services', to: '/products?tags=garden-services' },
      { label: 'Corporate Gifts', to: '/corporate-gifting' },
    ],
  },
  {
    title: 'Help',
    links: [
      { label: 'FAQs', to: '/faqs' },
    ],
  },
];

function scrollTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
      <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const SOCIALS = [
  { Icon: InstagramIcon, href: 'https://instagram.com', label: 'Instagram' },
  { Icon: FacebookIcon, href: 'https://facebook.com', label: 'Facebook' },
  { Icon: YouTubeIcon, href: 'https://youtube.com', label: 'YouTube' },
  { Icon: XIcon, href: 'https://x.com', label: 'X' },
];

/** Modal that prompts the user to log in before viewing their orders. */
function LoginRequiredModal({ onClose, onLogin }: { onClose: () => void; onLogin: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-7 flex flex-col items-center text-center gap-5 animate-[fadeInScale_0.2s_ease-out]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {/* Icon */}
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <LogIn size={26} className="text-primary" />
        </div>

        <div>
          <h2 id="login-modal-title" className="text-lg font-bold text-gray-900 mb-1">
            Sign in Required
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Please log in to track your order and view your order history.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <button
            onClick={onLogin}
            className="flex-1 py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition active:scale-[0.98]"
          >
            Login / Sign Up
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-50 transition active:scale-[0.98]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Footer() {
  const { user, openAuthModal } = useAuthStore();
  const navigate = useNavigate();
  const [showLoginModal, setShowLoginModal] = useState(false);

  function handleTrackOrder() {
    if (user) {
      scrollTop();
      navigate('/orders');
    } else {
      setShowLoginModal(true);
    }
  }

  function handleLoginFromModal() {
    setShowLoginModal(false);
    openAuthModal();
  }

  return (
    <>
      {showLoginModal && (
        <LoginRequiredModal
          onClose={() => setShowLoginModal(false)}
          onLogin={handleLoginFromModal}
        />
      )}

      <footer className="bg-[#1B4332] text-white mt-10 sm:mt-20 pb-20 md:pb-0">
        <div className="mx-auto px-6 sm:px-10 lg:px-16 xl:px-24 py-10 sm:py-14">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-6">
            {/* Logo column */}
            <div className="col-span-2 lg:col-span-1 mb-2 lg:mb-0">
              <Link to="/" onClick={scrollTop} className="flex items-center gap-2 mb-3">
                <img src={LOGO_PATH} alt="Plantoga" className="h-12 sm:h-14 object-contain" />
              </Link>
              <p className="text-white/60 text-sm leading-relaxed mb-5">
                Where every leaf begins a new story.
              </p>
              <div className="flex items-center gap-3">
                {SOCIALS.map(({ Icon, href, label }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="text-white/60 hover:text-white transition"
                  >
                    <Icon />
                  </a>
                ))}
              </div>
            </div>

            {/* Link columns */}
            {LINK_COLUMNS.map((col) => (
              <div key={col.title}>
                <h4 className="font-bold text-sm mb-3 sm:mb-4">{col.title}</h4>
                <ul className="flex flex-col gap-2 text-sm text-white/60">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        to={link.to}
                        onClick={scrollTop}
                        className="hover:text-white transition"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                  {/* Inject Track Order into Help column */}
                  {col.title === 'Help' && (
                    <li>
                      <button
                        onClick={handleTrackOrder}
                        className="hover:text-white transition text-left"
                      >
                        Track Order
                      </button>
                    </li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10">
          <div className="mx-auto px-6 sm:px-10 lg:px-16 xl:px-24 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/40">
            <span>© 2026 Plantoga. All rights reserved.</span>
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 bg-white/10 rounded text-[10px] font-semibold tracking-wider">VISA</span>
              <span className="px-2 py-1 bg-white/10 rounded text-[10px] font-semibold tracking-wider">MASTERCARD</span>
              <span className="px-2 py-1 bg-white/10 rounded text-[10px] font-semibold tracking-wider">UPI</span>
              <span className="px-2 py-1 bg-white/10 rounded text-[10px] font-semibold tracking-wider">Razorpay</span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
