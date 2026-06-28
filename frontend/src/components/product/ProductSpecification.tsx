import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export type ProductSpecRow = {
  label: string;
  value: string;
};

export default function ProductSpecification({ specs }: { specs: ProductSpecRow[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-6 sm:mt-8 border border-gray-200 rounded-xl overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-4 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition touch-target"
      >
        Product Specification
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {open && (
        <div className="border-t border-gray-200">
          {specs.map(({ label, value }) => (
            <div key={label}>
              <div className="px-4 py-3 bg-gray-100 text-sm font-semibold text-gray-800">
                {label}
              </div>
              <div className="px-4 py-3 bg-white text-sm text-gray-700 leading-relaxed border-b border-gray-100 last:border-b-0">
                {value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
