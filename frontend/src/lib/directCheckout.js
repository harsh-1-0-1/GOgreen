export const DIRECT_CHECKOUT_KEY = 'plantoga_direct_checkout';
export function saveDirectCheckoutSession(session) {
    sessionStorage.setItem(DIRECT_CHECKOUT_KEY, JSON.stringify(session));
}
export function readDirectCheckoutSession() {
    const raw = sessionStorage.getItem(DIRECT_CHECKOUT_KEY);
    if (!raw)
        return null;
    try {
        const parsed = JSON.parse(raw);
        if (parsed.mode !== 'buy-now' || !Array.isArray(parsed.items) || parsed.items.length === 0)
            return null;
        return parsed;
    }
    catch {
        return null;
    }
}
export function clearDirectCheckoutSession() {
    sessionStorage.removeItem(DIRECT_CHECKOUT_KEY);
}
