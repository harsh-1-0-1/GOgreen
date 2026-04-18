import { Link } from 'react-router-dom';

const CARDS = [
  {
    image: 'https://images.unsplash.com/photo-1545241047-6083a3684587?w=400&q=80',
    heading: 'Plant Subscriptions',
    subtext:
      'Receive a curated box of handpicked plants, packaged with care, every month.',
    cta: 'Start Saving',
    link: '/subscriptions',
  },
  {
    image: 'https://images.unsplash.com/photo-1591958911259-bee2173bdccc?w=400&q=80',
    heading: 'Join our Plant Parent Rewards Club',
    subtext: 'Earn coins and redeem them for exclusive discounts.',
    cta: 'Refer a Friend',
    link: '/rewards',
  },
] as const;

export default function PromoCTASection() {
  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-4 py-8 sm:py-12">
      <div className="grid md:grid-cols-2 gap-4">
        {CARDS.map((card) => (
          <div
            key={card.link}
            className="border border-gray-200 rounded-2xl p-5 flex flex-col sm:flex-row gap-4 items-start"
          >
            <img
              src={card.image}
              alt={card.heading}
              className="w-full sm:w-[140px] h-40 sm:h-[140px] rounded-lg object-cover shrink-0"
              loading="lazy"
            />
            <div className="flex flex-col gap-2">
              <h3 className="text-xl font-semibold text-[#1B4332]">
                {card.heading}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                {card.subtext}
              </p>
              <Link
                to={card.link}
                className="mt-auto inline-block w-fit px-5 py-2.5 bg-[#1B4332] text-white text-sm font-medium rounded-lg hover:bg-[#143526] transition"
              >
                {card.cta}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
