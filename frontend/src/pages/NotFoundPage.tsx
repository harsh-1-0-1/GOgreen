import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <p className="text-8xl font-black text-primary-light/20">404</p>
      <h1 className="text-2xl font-bold mt-4 mb-2">Page Not Found</h1>
      <p className="text-gray-500 mb-6 max-w-md">
        The page you're looking for doesn't exist or has been moved.
        Let's get you back to exploring plants!
      </p>
      <Link
        to="/"
        className="px-6 py-3 bg-primary text-white rounded-full font-medium flex items-center gap-2 hover:bg-primary/90 transition"
      >
        <Home size={18} /> Back to Home
      </Link>
    </div>
  );
}
