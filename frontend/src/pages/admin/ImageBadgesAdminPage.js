import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Save, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useCategories } from '@/hooks/useCategories';
import { DEFAULT_BADGE_CONFIG, findInheritedFrom, notifyBadgeConfigsChanged, useBadgeConfigs, } from '@/hooks/useBadgeConfigs';
const inputClass = 'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors';
/**
 * What each badge is and what it falls back to when the name is left blank.
 * Blank is a real choice, not an oversight: it keeps the automatic wording.
 */
const BADGES = [
    {
        kind: 'bestseller',
        name: 'Bestseller',
        corner: 'top-right',
        blurb: 'Only shown on products an admin has flagged as a bestseller.',
        blankLabel: 'BESTSELLER',
    },
    {
        kind: 'discount',
        name: 'Discount',
        corner: 'top-left',
        blurb: 'Appears on its own whenever the original price beats the selling price.',
        blankLabel: '40% OFF, worked out from the prices',
    },
    {
        kind: 'rating',
        name: 'Rating',
        corner: 'bottom-left',
        blurb: 'Appears on its own once the product has at least one review.',
        blankLabel: 'the star rating and review count',
    },
];
function draftFrom(config) {
    return {
        bestseller: { ...config.bestseller },
        discount: { ...config.discount },
        rating: { ...config.rating },
    };
}
function draftEquals(draft, config) {
    return BADGES.every(({ kind }) => {
        const a = draft[kind];
        const b = config[kind];
        return a.enabled === b.enabled && a.label === b.label && a.color === b.color;
    });
}
function BadgeColorField({ color, onChange, label, }) {
    return (_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "text-xs text-gray-600 shrink-0 w-16", children: "Colour" }), _jsxs("label", { className: "relative flex-1 h-9 rounded-lg border border-gray-200 overflow-hidden cursor-pointer", children: [_jsx("span", { className: "absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-white/90", style: { backgroundColor: color, textShadow: '0 1px 2px rgba(0,0,0,0.35)' }, children: color }), _jsx("input", { type: "color", value: color, onChange: (e) => onChange(e.target.value), "aria-label": label, className: "absolute inset-0 opacity-0 cursor-pointer w-full h-full" })] })] }));
}
/**
 * Editor for one category. Mounted with a `key` of the category id (plus whether
 * the config map has loaded), so switching category — or the saved values
 * arriving from the server — starts a fresh draft without an effect to reset it.
 */
function BadgeEditor({ categoryId, categoryName, hasOwnConfig, baseline, sourceNote, resetLabel, eligibility, statsLoaded, }) {
    const qc = useQueryClient();
    const [draft, setDraft] = useState(() => draftFrom(baseline));
    const saveMutation = useMutation({
        mutationFn: async (config) => {
            const { data } = await api.put(`/badge-configs/${categoryId}`, config);
            return data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['badge-configs'] });
            // Any other open tab (the storefront, a second admin tab) repaints at once
            // rather than waiting for its cache to lapse.
            notifyBadgeConfigsChanged();
            toast.success(`Badge settings saved for ${categoryName}`);
        },
        onError: () => toast.error('Could not save badge settings'),
    });
    const resetMutation = useMutation({
        mutationFn: async () => {
            await api.delete(`/badge-configs/${categoryId}`);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['badge-configs'] });
            // Any other open tab (the storefront, a second admin tab) repaints at once
            // rather than waiting for its cache to lapse.
            notifyBadgeConfigsChanged();
            toast.success(`${categoryName} now follows the inherited settings`);
        },
        onError: () => toast.error('Could not reset badge settings'),
    });
    const isDirty = !draftEquals(draft, baseline);
    function updateBadge(kind, patch) {
        setDraft((prev) => ({ ...prev, [kind]: { ...prev[kind], ...patch } }));
    }
    return (_jsxs("div", { className: "bg-white rounded-xl border border-gray-200 p-5 space-y-5", children: [_jsxs("div", { className: "flex items-start justify-between gap-4 flex-wrap", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-bold text-gray-900", children: categoryName }), _jsx("p", { className: "text-xs text-gray-500 mt-0.5", children: sourceNote })] }), _jsxs("div", { className: "flex items-center gap-2", children: [hasOwnConfig && (_jsxs("button", { onClick: () => resetMutation.mutate(), disabled: resetMutation.isPending || saveMutation.isPending, className: "inline-flex items-center gap-1.5 text-xs px-3 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50", children: [_jsx(RotateCcw, { size: 13 }), " ", resetLabel] })), _jsxs("button", { onClick: () => saveMutation.mutate(draft), disabled: !isDirty || saveMutation.isPending, className: "inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg bg-primary text-white hover:bg-primary/95 disabled:opacity-40 disabled:cursor-not-allowed", children: [_jsx(Save, { size: 13 }), " Save"] })] })] }), _jsxs("div", { className: "rounded-lg border border-gray-200 bg-gray-50/50 p-4", children: [_jsx("p", { className: "text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wider", children: "Preview" }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [BADGES.filter((b) => draft[b.kind].enabled).map((b) => (_jsx("span", { className: "text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg shadow-sm whitespace-nowrap leading-none", style: { backgroundColor: draft[b.kind].color }, children: draft[b.kind].label || `‹${b.blankLabel}›` }, b.kind))), BADGES.every((b) => !draft[b.kind].enabled) && (_jsx("p", { className: "text-xs text-gray-400", children: "No badges show for this category." }))] })] }), BADGES.map((badge) => {
                const style = draft[badge.kind];
                const isOff = !style.enabled;
                return (_jsxs("div", { className: `rounded-xl border p-4 space-y-3 ${isOff ? 'border-gray-200 bg-gray-50/40' : 'border-gray-200'}`, children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsxs("p", { className: "text-sm font-semibold text-gray-800", children: [badge.kind === 'rating' && (_jsx(Star, { size: 13, className: "inline mr-1 -mt-0.5" })), badge.name, " badge"] }), _jsxs("p", { className: "text-[11px] text-gray-400 mt-0.5", children: [badge.corner, " corner \u00B7 ", badge.blurb] }), eligibility && (_jsx("p", { className: `text-[11px] mt-1 ${eligibility[badge.kind] === 0
                                                ? 'text-amber-600 font-medium'
                                                : 'text-gray-400'}`, children: eligibility[badge.kind] === 0
                                                ? `Shown on no products${statsLoaded ? ' in this category' : ''} — this badge will not appear`
                                                : `Shown on ${eligibility[badge.kind]} of ${eligibility.total} product${eligibility.total === 1 ? '' : 's'}` }))] }), _jsxs("label", { className: "flex items-center gap-2 cursor-pointer select-none shrink-0", children: [_jsx("span", { className: "text-[11px] text-gray-500", children: style.enabled ? 'On' : 'Off' }), _jsx("input", { type: "checkbox", checked: style.enabled, onChange: (e) => updateBadge(badge.kind, { enabled: e.target.checked }), className: "h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" })] })] }), style.enabled && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "text-xs text-gray-600 shrink-0 w-16", children: "Name" }), _jsx("input", { value: style.label, onChange: (e) => updateBadge(badge.kind, { label: e.target.value }), placeholder: `Leave blank — shows ${badge.blankLabel}`, maxLength: 50, className: inputClass })] }), _jsx(BadgeColorField, { color: style.color, onChange: (next) => updateBadge(badge.kind, { color: next }), label: `${badge.name} badge colour` })] }))] }, badge.kind));
            })] }));
}
export default function ImageBadgesAdminPage() {
    const { data: categories } = useCategories();
    const { data: badgeMap, isFetched } = useBadgeConfigs();
    const [selectedId, setSelectedId] = useState(null);
    // Flattened so a subcategory can be configured on its own.
    const categoryRows = useMemo(() => {
        const rows = [];
        (categories ?? []).forEach((parent) => {
            rows.push({ id: parent.id, name: parent.name, depth: 0 });
            (parent.children ?? []).forEach((child) => rows.push({ id: child.id, name: child.name, depth: 1 }));
        });
        return rows;
    }, [categories]);
    // Parent lookup so the editor can say which ancestor a category inherits from.
    const parentOf = useMemo(() => {
        const map = {};
        (categories ?? []).forEach((parent) => {
            map[parent.id] = null;
            (parent.children ?? []).forEach((child) => {
                map[child.id] = parent.id;
            });
        });
        return map;
    }, [categories]);
    const nameById = useMemo(() => {
        const map = new Map();
        categoryRows.forEach((r) => map.set(r.id, r.name));
        return map;
    }, [categoryRows]);
    // Derived, not stored: until the admin picks one, edit the first category.
    const activeId = selectedId ?? categoryRows[0]?.id ?? null;
    const activeRow = categoryRows.find((r) => r.id === activeId) ?? null;
    // Per-badge product counts, so the editor can say whether a badge will show at
    // all in this category.
    const { data: eligibility, isFetched: statsLoaded } = useQuery({
        queryKey: ['badge-config-stats', activeId],
        queryFn: async () => {
            const { data } = await api.get(`/badge-configs/${activeId}/stats`);
            return data;
        },
        enabled: activeId != null,
        staleTime: 60 * 1000,
    });
    const activeHasOwnConfig = activeId != null ? !!badgeMap?.by_category?.[String(activeId)] : false;
    const activeBaseline = (activeId != null ? badgeMap?.effective_by_category?.[String(activeId)] : undefined) ??
        DEFAULT_BADGE_CONFIG;
    const inheritedFromId = activeId != null ? findInheritedFrom(badgeMap, activeId, parentOf) : null;
    const sourceNote = activeHasOwnConfig
        ? 'Using its own settings.'
        : inheritedFromId != null
            ? `Inherited from ${nameById.get(inheritedFromId) ?? 'its parent category'} — change anything below to override just this one.`
            : 'Inherits the store defaults — change anything below to customise this category.';
    const resetLabel = inheritedFromId != null ? 'Use inherited' : 'Reset to defaults';
    return (_jsxs("div", { className: "space-y-5", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-bold text-gray-900", children: "Image Badges" }), _jsx("p", { className: "text-sm text-gray-500 mt-1", children: "The badges drawn on top of product images. Wording and colour are set per category, so renaming \u201CBestseller\u201D to \u201CHot Seller\u201D is one edit for every product in that category." })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 items-start", children: [_jsxs("div", { className: "bg-white rounded-xl border border-gray-200 overflow-hidden", children: [_jsx("div", { className: "px-4 py-3 border-b border-gray-100 text-xs font-bold uppercase tracking-wider text-gray-500", children: "Categories" }), _jsxs("div", { className: "max-h-[60vh] overflow-y-auto p-1.5", children: [categoryRows.length === 0 && (_jsx("p", { className: "px-3 py-4 text-xs text-gray-400", children: "No categories yet." })), categoryRows.map((row) => {
                                        const isSelected = row.id === activeId;
                                        const isCustomised = !!badgeMap?.by_category[String(row.id)];
                                        return (_jsxs("button", { onClick: () => setSelectedId(row.id), className: `w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${isSelected
                                                ? 'bg-primary/10 font-medium text-primary'
                                                : 'hover:bg-gray-50 text-gray-700'}`, children: [_jsx("span", { className: row.depth === 1 ? 'pl-3' : '', children: row.name }), isCustomised && (_jsx("span", { title: "This category has its own badge settings", "aria-label": "Customised", className: "w-1.5 h-1.5 rounded-full bg-primary shrink-0" }))] }, row.id));
                                    })] })] }), !activeRow ? (_jsx("div", { className: "bg-white rounded-xl border border-gray-200 p-5", children: _jsx("p", { className: "text-sm text-gray-400", children: "Pick a category to configure its badges." }) })) : (_jsx(BadgeEditor, { categoryId: activeRow.id, categoryName: activeRow.name, hasOwnConfig: activeHasOwnConfig, baseline: activeBaseline, sourceNote: sourceNote, resetLabel: resetLabel, eligibility: eligibility ?? null, statsLoaded: statsLoaded }, `${activeRow.id}:${isFetched}`))] })] }));
}
