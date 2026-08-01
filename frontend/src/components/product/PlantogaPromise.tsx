import { Leaf, ShieldCheck, Truck } from 'lucide-react';
import { WhatsAppIcon } from '@/components/layout/Navbar/WhatsAppIcon';

const SERIF = "'Playfair Display', Georgia, serif";

const PROMISES = [
  {
    title: '14-day guarantee',
    text: 'Unhealthy on arrival? Replaced, free.',
    icon: <ShieldCheck size={26} className="text-gray-600" strokeWidth={1.5} />,
  },
  {
    title: 'Free care support',
    text: 'Plant experts on WhatsApp, always.',
    icon: <WhatsAppIcon size={28} />,
  },
  {
    title: 'Pan-India delivery',
    text: 'Travel-safe across all 28 states.',
    icon: <Truck size={26} className="text-gray-600" strokeWidth={1.5} />,
  },
  {
    title: '10M+ Plant Parents',
    text: 'Trusted in homes and offices nationwide.',
    icon: <Leaf size={26} className="text-gray-600" strokeWidth={1.5} />,
  },
];

export default function PlantogaPromise({ bannerImage }: { bannerImage?: string | null }) {
  if (bannerImage) {
    return (
      <section className="mt-6 sm:mt-8 rounded-2xl overflow-hidden">
        <img
          src={bannerImage}
          alt="The Plantoga Promise"
          className="w-full h-auto object-cover"
        />
      </section>
    );
  }

  return (
    <section
      className="mt-6 sm:mt-8 rounded-2xl overflow-hidden"
      style={{ backgroundColor: '#1B4332' }}
    >
      <div className="px-4 sm:px-8 py-6 sm:py-10">
        <div className="text-center mb-6 sm:mb-8">
          <h2
            className="text-2xl sm:text-3xl font-bold text-white mb-2"
            style={{ fontFamily: SERIF }}
          >
            The Plantoga Promise
          </h2>
          <p className="text-sm sm:text-base text-white/80">
            The promise we make on every plant we send out.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
          {PROMISES.map(({ title, text, icon }) => (
            <div
              key={title}
              className="flex flex-col items-center text-center px-3 py-5 sm:px-5 sm:py-7 rounded-xl"
              style={{ backgroundColor: 'rgba(82, 183, 136, 0.18)' }}
            >
              <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-white/90 flex items-center justify-center mb-3 sm:mb-4">
                {icon}
              </div>
              <h3 className="text-xs sm:text-base font-semibold text-white mb-1">{title}</h3>
              <p className="text-[11px] sm:text-sm text-white/75 leading-snug sm:leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
