import { jsx as _jsx } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
import { useTagColorMap } from '@/hooks/useTags';
import { resolveTagStyles } from './productTagBadges.utils';
export default function ProductTagBadges({ tags, maxTags, size = 'sm', asLinks = false, className = '', }) {
    const tagColors = useTagColorMap();
    const uniqueMapped = resolveTagStyles(tags, tagColors);
    if (uniqueMapped.length === 0)
        return null;
    const visibleTags = maxTags !== undefined ? uniqueMapped.slice(0, maxTags) : uniqueMapped;
    const sizeClasses = size === 'md'
        ? 'text-[10px] sm:text-xs px-2.5 py-0.75 sm:px-3 sm:py-1'
        : 'text-[9px] sm:text-[10px] px-2 py-0.5 sm:px-2.5 sm:py-0.75';
    const baseClass = `inline-flex items-center font-semibold rounded-full leading-none tracking-wide whitespace-nowrap transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.03)] ${sizeClasses}`;
    return (_jsx("div", { className: `flex flex-wrap gap-1 sm:gap-1.5 ${className}`, children: visibleTags.map((tag) => {
            const badgeStyle = {
                backgroundColor: tag.bg,
                color: tag.text,
                border: `1px solid ${tag.border}`,
            };
            if (asLinks) {
                return (_jsx(Link, { to: `/products?tags=${encodeURIComponent(tag.slug)}`, className: `${baseClass} hover:brightness-[0.98] active:brightness-[0.96]`, style: badgeStyle, onClick: (e) => e.stopPropagation(), children: tag.label }, tag.label));
            }
            return (_jsx("span", { className: baseClass, style: badgeStyle, children: tag.label }, tag.label));
        }) }));
}
