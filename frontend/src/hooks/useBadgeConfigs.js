import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
const BADGE_CONFIG_KEY = ['badge-configs'];
/**
 * Cross-tab bus. Badge colours are edited in one tab (the admin screen) and
 * rendered in another (the storefront), so without a nudge every open tab would
 * keep showing the old colours until its cache expired.
 */
const CHANNEL_NAME = 'plantoga:badge-configs';
const STORAGE_FALLBACK_KEY = 'plantoga:badge-configs-changed';
let channel;
function getChannel() {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window))
        return null;
    if (channel === undefined) {
        channel = new BroadcastChannel(CHANNEL_NAME);
    }
    return channel;
}
/**
 * Announce that badge configs changed. Called after an admin save; every other
 * open tab refetches straight away instead of waiting for its poll or a reload.
 */
export function notifyBadgeConfigsChanged() {
    const stamp = String(Date.now());
    getChannel()?.postMessage({ stamp });
    // Also fire a storage event, which reaches tabs in browsers without
    // BroadcastChannel (and does nothing harmful where it is supported).
    try {
        window.localStorage.setItem(STORAGE_FALLBACK_KEY, stamp);
    }
    catch {
        /* private browsing / storage disabled — the poll still covers it */
    }
}
/**
 * Badge wording/colour for every category, in one request.
 *
 * The storefront calls this once (react-query dedupes it) and each product card
 * resolves against its category, instead of every product carrying its own copy
 * of the styling.
 *
 * Freshness matters here because an admin can restyle a category at any moment:
 * the data is refetched on a short poll, whenever the tab regains focus, and
 * immediately when another tab reports a change. Without that, a shopper (or the
 * admin checking their own work in a second tab) would stare at stale colours
 * for minutes.
 */
export function useBadgeConfigs() {
    const query = useQuery({
        queryKey: BADGE_CONFIG_KEY,
        queryFn: async () => {
            const { data } = await api.get('/badge-configs');
            return data;
        },
        staleTime: 30 * 1000,
        // Another tab said the configs changed: believe it over the cache.
        refetchOnMount: 'always',
        refetchOnWindowFocus: true,
        // Quiet top-up poll for visitors on a different device to the admin's.
        refetchInterval: 30 * 1000,
        refetchIntervalInBackground: false,
        // Never leave a card without badges while loading — the defaults look
        // identical to an uncustomised install.
        placeholderData: undefined,
    });
    const { refetch } = query;
    useEffect(() => {
        const bus = getChannel();
        const onChanged = () => {
            void refetch();
        };
        const onStorage = (event) => {
            if (event.key === STORAGE_FALLBACK_KEY)
                onChanged();
        };
        bus?.addEventListener('message', onChanged);
        window.addEventListener('storage', onStorage);
        return () => {
            bus?.removeEventListener('message', onChanged);
            window.removeEventListener('storage', onStorage);
        };
    }, [refetch]);
    return query;
}
/** Fallback used before the query resolves and for categories with no row. */
export const DEFAULT_BADGE_CONFIG = {
    bestseller: { enabled: true, label: 'BESTSELLER', color: '#F59E0B' },
    discount: { enabled: true, label: '', color: '#1B4332' },
    rating: { enabled: true, label: '', color: '#1B4332' },
};
export function resolveCategoryBadgeConfig(map, categoryId) {
    if (map && categoryId != null) {
        // `effective_by_category` already accounts for inheritance — a config saved
        // on a parent category reaches its subcategories, which is where almost every
        // product actually lives.
        const resolved = map.effective_by_category?.[String(categoryId)];
        if (resolved) {
            return {
                bestseller: resolved.bestseller,
                discount: resolved.discount,
                rating: resolved.rating,
            };
        }
    }
    return map?.defaults ?? DEFAULT_BADGE_CONFIG;
}
/**
 * The category a config was inherited from, for the admin UI's "inherits from
 * …" note. Null when the category has its own row (or nothing to inherit).
 */
export function findInheritedFrom(map, categoryId, parentOf) {
    if (!map)
        return null;
    if (map.by_category?.[String(categoryId)])
        return null;
    let current = parentOf[categoryId] ?? null;
    const seen = new Set();
    while (current != null && !seen.has(current)) {
        seen.add(current);
        if (map.by_category?.[String(current)])
            return current;
        current = parentOf[current] ?? null;
    }
    return null;
}
