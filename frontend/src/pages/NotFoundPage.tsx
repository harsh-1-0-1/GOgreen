import { Link } from 'react-router-dom';
import { ArrowLeft, Home, Search, Sprout } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <section className="min-h-[68vh] bg-bg px-4 py-14 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary-light/15 text-primary">
          <Sprout size={34} strokeWidth={1.8} />
        </div>

        <p className="text-[5.5rem] font-black leading-none text-primary-light/20 sm:text-[8rem]">
          404
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-primary sm:text-4xl">
          Page Not Available
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-gray-600 sm:text-base">
          This page is missing, moved, or no longer available. Let&apos;s get
          you back to the garden path.
        </p>

        <div className="mt-8 flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
          >
            <Home size={18} /> Back to Home
          </Link>
          <Link
            to="/products"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary/25 bg-white px-6 py-3 text-sm font-semibold text-primary transition hover:border-primary/40 hover:bg-primary-light/10"
          >
            <Search size={18} /> Browse Plants
          </Link>
        </div>

        <button
          type="button"
          onClick={() => window.history.back()}
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-primary"
        >
          <ArrowLeft size={16} /> Go back
        </button>
      </div>
    </section>
  );
}
