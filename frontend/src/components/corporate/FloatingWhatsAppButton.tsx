import { WhatsAppIcon } from '@/components/layout/Navbar/WhatsAppIcon';
import { WHATSAPP_NUMBER } from '@/components/layout/Navbar/navData';

export default function FloatingWhatsAppButton() {
  return (
    <a
      href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hi Plantoga, I want to enquire about corporate gifting / bulk orders.')}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-24 right-4 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-[0_18px_40px_rgba(18,96,58,0.24)] ring-1 ring-green-100 transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_48px_rgba(18,96,58,0.32)] md:bottom-7 md:right-7 md:h-20 md:w-20"
    >
      <span className="md:hidden">
        <WhatsAppIcon size={50} />
      </span>
      <span className="hidden md:block">
        <WhatsAppIcon size={64} />
      </span>
    </a>
  );
}
