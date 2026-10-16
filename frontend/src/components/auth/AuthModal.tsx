import { useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import api from '@/lib/api';
import { getApiErrorDetail } from '@/lib/apiError';

export default function AuthModal() {
  const { isAuthModalOpen, closeAuthModal, login, register, isLoading } = useAuthStore();
  const { fetchCart, mergeCart } = useCartStore();
  const [tab, setTab] = useState<'login' | 'register'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  useBodyScrollLock(isAuthModalOpen);

  if (!isAuthModalOpen) return null;

  function reset() {
    setEmail(''); setPassword(''); setFullName(''); setPhone('');
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    try {
      const guestSessionId = localStorage.getItem('cart_session_id');
      await login(email, password);
      toast.success('Welcome back!');
      reset();
      if (guestSessionId) {
        await mergeCart(guestSessionId);
      } else {
        await fetchCart();
      }
    } catch (err) {
      toast.error(getApiErrorDetail(err, 'Login failed'));
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    try {
      const guestSessionId = localStorage.getItem('cart_session_id');
      await register(email, password, fullName, phone || undefined);
      toast.success('Account created!');
      reset();
      if (guestSessionId) {
        await mergeCart(guestSessionId);
      } else {
        await fetchCart();
      }
    } catch (err) {
      toast.error(getApiErrorDetail(err, 'Registration failed'));
    }
  }

  async function handleGoogleLogin() {
    try {
      const { data } = await api.get('/auth/google');
      window.location.href = data.authorization_url;
    } catch {
      toast.error('Failed to start Google login');
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={closeAuthModal} />
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
        <div
          className="bg-white w-full sm:rounded-2xl sm:max-w-md shadow-2xl relative overflow-hidden rounded-t-2xl sm:rounded-b-2xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <button className="absolute top-3 right-3 p-2 text-gray-400 hover:text-gray-600 touch-target z-10" onClick={closeAuthModal}>
            <X size={20} />
          </button>

          <div className="p-5 sm:p-8">
            <h2 className="text-xl sm:text-2xl font-bold text-center mb-5 sm:mb-6">
              {tab === 'login' ? 'Welcome Back' : 'Create Account'}
            </h2>

            <div className="flex bg-gray-100 rounded-lg p-1 mb-5 sm:mb-6">
              <button
                className={`flex-1 py-2.5 text-sm font-medium rounded-md transition touch-target ${tab === 'login' ? 'bg-white shadow text-primary' : 'text-gray-500'}`}
                onClick={() => setTab('login')}
              >
                Login
              </button>
              <button
                className={`flex-1 py-2.5 text-sm font-medium rounded-md transition touch-target ${tab === 'register' ? 'bg-white shadow text-primary' : 'text-gray-500'}`}
                onClick={() => setTab('register')}
              >
                Register
              </button>
            </div>

            {tab === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4">
                <input type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light/40" />
                <input type="password" placeholder="Password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light/40" />
                <button type="submit" disabled={isLoading} className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-60 touch-target">
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-3 sm:space-y-4">
                <input type="text" placeholder="Full Name" required value={fullName} onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light/40" />
                <input type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light/40" />
                <input type="tel" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light/40" />
                <input type="password" placeholder="Password (min 8 chars)" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-light/40" />
                <button type="submit" disabled={isLoading} className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-60 touch-target">
                  {isLoading ? 'Creating account...' : 'Create Account'}
                </button>
              </form>
            )}

            <div className="relative my-5 sm:my-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-white px-3 text-gray-400 uppercase">or</span></div>
            </div>

            <button onClick={handleGoogleLogin} className="w-full py-3 border border-gray-200 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-gray-50 transition touch-target">
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
