import type { Product } from '@/types';

const SERIF = "'Playfair Display', Georgia, serif";

function buildGuideText(product: Pick<Product, 'how_to_guide' | 'sunlight' | 'watering' | 'care_tips'>): string | null {
  if (product.how_to_guide?.trim()) return product.how_to_guide.trim();

  const parts: string[] = [];
  if (product.sunlight) {
    parts.push(`Keep it in a spot with ${product.sunlight.toLowerCase()}.`);
  }
  if (product.watering) {
    parts.push(`Water ${product.watering.toLowerCase()}.`);
  }
  if (product.care_tips?.length) {
    parts.push(...product.care_tips.map((tip) => (tip.endsWith('.') ? tip : `${tip}.`)));
  }

  return parts.length ? parts.join(' ') : null;
}

export default function HowToGuide({ product }: { product: Pick<Product, 'how_to_guide' | 'sunlight' | 'watering' | 'care_tips'> }) {
  const text = buildGuideText(product);
  if (!text) return null;

  return (
    <section
      className="mt-6 sm:mt-8 rounded-2xl px-5 py-7 sm:px-8 sm:py-9 text-center"
      style={{ backgroundColor: '#16A34A' }}
    >
      <h2
        className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-5"
        style={{ fontFamily: SERIF }}
      >
        How to guide
      </h2>
      <p className="text-sm sm:text-base text-white/95 leading-relaxed max-w-2xl mx-auto">
        {text}
      </p>
    </section>
  );
}
