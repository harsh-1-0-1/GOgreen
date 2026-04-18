import { Link } from 'react-router-dom';

const A = ({ to, children }: { to: string; children: React.ReactNode }) => (
  <Link to={to} className="text-[#1B4332] font-medium hover:underline">
    {children}
  </Link>
);

export default function AboutSection() {
  return (
    <section className="bg-[#FAFAF7] py-10 sm:py-16">
      <div className="max-w-[800px] mx-auto px-4 text-center">
        <h2 className="text-[28px] font-bold mb-5">About Plantoga</h2>
        <p className="text-[15px] leading-relaxed text-gray-500">
          Plantoga is India's no.1 online plant store and gardening products
          destination, trusted by millions of plant lovers. Shop a wide range of{' '}
          <A to="/products?category=indoor-plants">indoor plants</A>,{' '}
          <A to="/products?category=flowering-plants">flowering plants</A>,{' '}
          <A to="/products?category=cacti-succulents">succulents</A>, and{' '}
          <A to="/products?tags=air-purifying">air-purifying plants</A> delivered
          right to your doorstep. We also offer a complete range of gardening
          products, including premium <A to="/products?category=seeds">seeds</A>,
          organic{' '}
          <A to="/products?tags=fertiliser">fertilizers</A>, stylish{' '}
          <A to="/products?category=pots-planters">planters</A>, and essential{' '}
          <A to="/products?tags=tools">gardening tools</A> to help your garden
          thrive.
        </p>
      </div>
    </section>
  );
}
