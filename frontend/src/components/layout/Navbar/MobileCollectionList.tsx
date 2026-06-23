import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { useBanners } from '@/hooks/useBanners';
import { MOBILE_COLLECTIONS, LABEL_TO_NAV, bannerToCollection } from './navData';
import type { MobileCollection, NavItemDef } from './navData';

function CollectionAccordionRow({
  item,
  navItem,
  expanded,
  onToggle,
  onNavigate,
}: {
  item: MobileCollection;
  navItem?: NavItemDef;
  expanded: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const hasGroups = navItem?.groups && navItem.groups.length > 0;

  return (
    <li className="bg-white rounded-xl overflow-hidden">
      {/* Main row — image card */}
      <div className="relative flex items-center overflow-hidden">
        <Link
          to={item.href}
          onClick={onNavigate}
          className="flex-1 flex items-center active:bg-[#f5f5f5] transition-colors"
          style={{ height: 100, paddingLeft: 20 }}
        >
          <span
            className="relative z-10"
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#16A34A',
              lineHeight: 1.1,
            }}
          >
            {item.label}
          </span>
        </Link>

        {/* Right side: image + optional expand button */}
        <div className="flex items-center shrink-0" style={{ height: 100 }}>
          {hasGroups && (
            <button
              onClick={onToggle}
              className="relative z-10 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              <ChevronDown
                size={18}
                className={clsx(
                  'transition-transform duration-200',
                  expanded && 'rotate-180',
                )}
              />
            </button>
          )}
          <span className="relative shrink-0" style={{ width: 90, height: 100 }}>
            <span
              aria-hidden
              className="absolute"
              style={{
                top: 10,
                left: -25,
                width: 70,
                height: 70,
                opacity: 0.3,
                borderRadius: '40% 60% 70% 30% / 50% 40% 60% 50%',
                backgroundColor: item.accent,
              }}
            />
            {item.image && (
              <img
                src={item.image}
                alt=""
                loading="lazy"
                className="absolute"
                style={{
                  top: 0,
                  right: 0,
                  width: 90,
                  height: 100,
                  objectFit: 'cover',
                  zIndex: 1,
                  borderTopRightRadius: 12,
                  borderBottomRightRadius: 12,
                }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
          </span>
        </div>
      </div>

      {/* Expanded subcategories */}
      {expanded && hasGroups && (
        <div className="px-5 pb-4 pt-1 border-t border-gray-100">
          {navItem!.groups!.flat().map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-3' : ''}>
              {group.title && (
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 pb-1 border-b border-gray-50">
                  {group.title}
                </p>
              )}
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {group.links.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    onClick={onNavigate}
                    className="py-2 text-[13px] text-gray-600 hover:text-secondary active:text-secondary transition-colors truncate"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
          <Link
            to={navItem!.href}
            onClick={onNavigate}
            className="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-secondary hover:underline"
          >
            View All {item.label} →
          </Link>
        </div>
      )}
    </li>
  );
}

export function MobileCollectionList({ onNavigate }: { onNavigate: () => void }) {
  const { data: banners = [] } = useBanners('menu_banner');
  const rows: MobileCollection[] =
    banners.length > 0
      ? banners.map(bannerToCollection)
      : MOBILE_COLLECTIONS;

  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <ul className="flex flex-col gap-2.5 px-3 py-3 bg-[#fafafa]">
      {rows.map((item) => {
        const navItem = LABEL_TO_NAV[item.label];
        return (
          <CollectionAccordionRow
            key={item.label}
            item={item}
            navItem={navItem}
            expanded={expanded === item.label}
            onToggle={() =>
              setExpanded(expanded === item.label ? null : item.label)
            }
            onNavigate={onNavigate}
          />
        );
      })}
    </ul>
  );
}
