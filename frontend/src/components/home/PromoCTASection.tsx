import { Link } from 'react-router-dom';

const CARDS = [
  {
    image:
      'https://images.unsplash.com/photo-1545241047-6083a3684587?w=400&q=80',
    heading: 'Plant Subscriptions',
    subtext:
      'Receive a curated box of handpicked plants, packaged with care, every month.',
    cta: 'Start Saving',
    link: '/subscriptions',
  },
  {
    image:
      'https://images.unsplash.com/photo-1591958911259-bee2173bdccc?w=400&q=80',
    heading: 'Join our Plant Parent Rewards Club',
    subtext: 'Earn coins and redeem them for exclusive discounts.',
    cta: 'Refer a Friend',
    link: '/rewards',
  },
] as const;

export default function PromoCTASection() {
  return (
    <section className="w-full py-10 sm:py-14 bg-white">
      <div className="mx-auto px-6 sm:px-10 lg:px-16 xl:px-24">
        <div className="grid md:grid-cols-2 gap-5 sm:gap-6">
          {CARDS.map((card) => (
            <div
              key={card.link}
              className="flex flex-col sm:flex-row items-center gap-5 rounded-2xl p-5 sm:p-7"
              style={{ border: '1px solid #D1FAE5', background: 'white' }}
            >
              <img
                src={card.image}
                alt={card.heading}
                className="w-full sm:w-[160px] h-44 sm:h-[160px] rounded-xl object-cover shrink-0"
                loading="lazy"
              />
              <div className="flex flex-col gap-2.5">
                <h3
                  className="text-xl font-semibold"
                  style={{ color: '#1B4332' }}
                >
                  {card.heading}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {card.subtext}
                </p>
                <Link
                  to={card.link}
                  className="mt-auto inline-block w-fit px-6 py-2.5 text-sm font-medium rounded-lg text-white transition hover:opacity-90"
                  style={{ backgroundColor: '#1B4332' }}
                >
                  {card.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
