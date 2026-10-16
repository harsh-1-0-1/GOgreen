/**
 * Colour picker for a badge: a filled swatch showing its own hex code, with a
 * transparent native `<input type="color">` laid over it.
 *
 * Shared by the category badge editor and the product-level bestseller override
 * so that changing a badge colour is the same gesture in both places. Two
 * implementations would mean two subtly different pickers, and the whole point
 * of the per-product override is that it feels like the category config it is
 * overriding.
 */
export default function BadgeColorField({
  color,
  onChange,
  label,
}: {
  color: string;
  onChange: (next: string) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600 shrink-0 w-16">Colour</span>
      <label className="relative flex-1 h-9 rounded-lg border border-gray-200 overflow-hidden cursor-pointer">
        <span
          className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-white/90"
          style={{ backgroundColor: color, textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}
        >
          {color}
        </span>
        <input
          type="color"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
      </label>
    </div>
  );
}
