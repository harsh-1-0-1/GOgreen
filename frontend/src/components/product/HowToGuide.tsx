import { BookOpen } from 'lucide-react';
import type { Product } from '@/types';

const SERIF = "'Playfair Display', Georgia, serif";

/**
 * How-to text for the buy-box column. Only the authored `how_to_guide` field is
 * used — `sunlight` / `watering` / `care_tips` are surfaced separately by
 * CareEssentials and CareTips, so pulling them in here repeated the same copy
 * three times down one column.
 */
export default function HowToGuide({ product }: { product: Pick<Product, 'how_to_guide'> }) {
  const text = product.how_to_guide?.trim();
  if (!text) return null;

  return (
    <section
      className="rounded-2xl px-5 py-5 sm:px-6 sm:py-6"
      style={{ backgroundColor: '#1B4332' }}
      aria-labelledby="how-to-guide-title"
    >
      <h2
        id="how-to-guide-title"
        className="mb-2 flex items-center gap-2 text-base font-bold text-white sm:text-lg"
        style={{ fontFamily: SERIF }}
      >
        <BookOpen size={17} className="shrink-0 text-[#F4A261]" aria-hidden="true" />
        How to guide
      </h2>
      <p className="text-sm leading-relaxed text-white/90">{text}</p>
    </section>
  );
}