import { Link } from 'react-router-dom';

const SERIF = "'Playfair Display', Georgia, serif";

const A = ({ to, children }: { to: string; children: React.ReactNode }) => (
  <Link
    to={to}
    className="font-semibold hover:opacity-80 transition-opacity"
    style={{
      color: '#16A34A',
      textDecoration: 'underline',
      textDecorationColor: '#52B788',
      textUnderlineOffset: '3px',
    }}
  >
    {children}
  </Link>
);

const STATS = [
  { number: '10M+', label: 'Plant Parents' },
  { number: '500+', label: 'Plant Varieties' },
  { number: '50+', label: 'Cities Delivered' },
];

const PILLS = [
  '🌿 100% Natural Plants',
  '🚚 Next-Day Delivery',
  '⭐ 4.8 Rated on Google',
  '↩ Easy Returns',
];

export default function AboutSection() {
  return (
    <section
      id="about-us"
      className="w-full border-t-4"
      style={{
        backgroundColor: '#F7F5F0',
        borderTopColor: '#52B788',
      }}
    >
      <div className="mx-auto px-6 sm:px-10 lg:px-16 xl:px-24 py-14 sm:py-20">
        <div className="grid md:grid-cols-2 gap-10 md:gap-20 items-start">

          {/* Left column */}
          <div className="relative">
            {/* Decorative leaf behind text */}
            <svg
              viewBox="0 0 200 280"
              className="absolute -top-6 -left-6 w-48 h-auto opacity-[0.06] pointer-events-none select-none"
              fill="#2D6A4F"
              aria-hidden="true"
            >
              <path d="M100 0C60 40 10 100 10 170c0 60 40 110 90 110s90-50 90-110C190 100 140 40 100 0zM100 260c-40 0-70-40-70-90 0-55 40-105 70-140 30 35 70 85 70 140 0 50-30 90-70 90z" />
              <path d="M97 60v180M97 120c-20-15-40-10-50 5M103 160c20-15 40-10 50 5M97 90c-15-10-30-8-38 3M103 200c15-10 30-8 38 3" fill="none" stroke="#2D6A4F" strokeWidth="3" />
            </svg>

            <div className="relative">
              <h2
                className="text-[32px] sm:text-[48px] font-bold leading-[1.1] mb-5"
                style={{ fontFamily: SERIF, color: '#1B4332' }}
              >
                About Plantoga
              </h2>

              {/* Accent bar */}
              <div
                className="mb-6"
                style={{
                  width: '4px',
                  height: '48px',
                  backgroundColor: '#52B788',
                  display: 'inline-block',
                  borderRadius: '2px',
                }}
              />

              {/* Stats row */}
              <div className="flex items-start gap-0">
                {STATS.map((stat, i) => (
                  <div key={stat.label} className="flex items-start">
                    {i > 0 && (
                      <div className="w-px h-12 bg-gray-300 mx-4 sm:mx-6 mt-1 shrink-0" />
                    )}
                    <div>
                      <p
                        className="text-[28px] sm:text-[32px] font-bold leading-none"
                        style={{ color: '#1B4332' }}
                      >
                        {stat.number}
                      </p>
                      <p className="text-[13px] text-gray-500 mt-1">{stat.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div>
            <p
              className="leading-[1.85] mb-6"
              style={{ fontSize: '17px', color: '#2C2C2A' }}
            >
              Plantoga is India&#39;s no.1 online plant store and gardening products
              destination, trusted by millions of plant lovers. Shop a wide range of{' '}
              <A to="/products?category=indoor-plants">indoor plants</A>,{' '}
              <A to="/products?category=flowering-plants">flowering plants</A>,{' '}
              <A to="/products?category=cacti-succulents">succulents</A>, and{' '}
              <A to="/products?tags=air-purifying">air-purifying plants</A> delivered
              right to your doorstep. We also offer a complete range of gardening
              products, including premium{' '}
              <A to="/products?category=seeds">seeds</A>, organic{' '}
              <A to="/products?tags=fertiliser">fertilizers</A>, stylish{' '}
              <A to="/products?category=pots-planters">planters</A>, and essential{' '}
              <A to="/products?tags=tools">gardening tools</A> to help your garden
              thrive.
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2">
              {PILLS.map((pill) => (
                <span
                  key={pill}
                  className="inline-flex items-center px-4 py-2 text-[13px] rounded-full"
                  style={{
                    border: '1.5px solid #52B788',
                    color: '#16A34A',
                  }}
                >
                  {pill}
                </span>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
