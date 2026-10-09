import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export type ProductSpecRow = {
  label: string;
  value: string;
};

export default function ProductSpecification({ specs }: { specs: ProductSpecRow[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-8 sm:mt-10 border border-primary/20 rounded-xl overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-4 text-sm font-semibold text-primary hover:bg-primary/5 transition touch-target"
      >
        Product Specification
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {open && (
        <div className="border-t border-primary/15">
          {specs.map(({ label, value }) => (
            <div key={label}>
              <div className="px-4 py-3 bg-primary/8 text-sm font-semibold text-primary">
                {label}
              </div>
              <div className="px-4 py-3 bg-white text-sm text-gray-700 leading-relaxed border-b border-primary/10 last:border-b-0">
                {value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
