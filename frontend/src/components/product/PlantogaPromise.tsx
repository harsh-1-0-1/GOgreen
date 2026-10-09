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
      <section className="mt-4 sm:mt-6 rounded-2xl overflow-hidden">
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
      className="mt-4 sm:mt-6 rounded-2xl overflow-hidden"
      style={{ backgroundColor: '#1B4332' }}
    >
      <div className="px-4 py-5 sm:px-6 sm:py-7">
        <div className="text-center mb-4 sm:mb-5">
          <h2
            className="text-lg sm:text-xl font-bold text-white mb-1"
            style={{ fontFamily: SERIF }}
          >
            The Plantoga Promise
          </h2>
          <p className="text-xs sm:text-sm text-white/80">
            The promise we make on every plant we send out.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {PROMISES.map(({ title, text, icon }) => (
            <div
              key={title}
              className="flex flex-col items-center text-center px-2 py-4 sm:px-3 sm:py-5 rounded-xl"
              style={{ backgroundColor: 'rgba(82, 183, 136, 0.18)' }}
            >
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-white/90 flex items-center justify-center mb-2 sm:mb-3">
                {icon}
              </div>
              <h3 className="text-[11px] sm:text-sm font-semibold text-white mb-0.5">{title}</h3>
              <p className="text-[10px] sm:text-xs text-white/75 leading-snug">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
