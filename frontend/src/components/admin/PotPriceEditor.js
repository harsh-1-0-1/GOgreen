import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { COMBO_KEY_SEP } from '@/lib/potPrice';
import api from '@/lib/api';
import { getApiErrorDetail } from '@/lib/apiError';
function groupOptions(g) {
    return (g.options ?? []).filter((o) => o.id && o.name?.trim());
}
function axisOrder(groups, selected) {
    // Canonical key order follows the PRODUCT's group order, never the admin's click order.
    // Reordering the pickers must not rewrite every key in the map.
    const wanted = new Set(selected);
    return groups.filter((g) => wanted.has(g.id)).map((g) => g.id);
}
function labelFor(groups, id) {
    return groups.find((g) => g.id === id)?.label ?? id;
}
/** "Small / Grow" for a subset key, so a conflict reads like a cell rather than a hash. */
function cellLabel(groups, axes, key) {
    return key
        .split(COMBO_KEY_SEP)
        .map((id, i) => {
        const opts = groups.find((g) => g.id === axes[i])?.options ?? [];
        return opts.find((o) => o.id === id)?.name ?? id;
    })
        .join(' / ');
}
export default function PotPriceEditor({ productId, groups, draft, onChange, existingPriceMap, priceMapActive, }) {
    const [conflicts, setConflicts] = useState([]);
    const [resolutions, setResolutions] = useState({});
    const [migrating, setMigrating] = useState(false);
    const [projectionError, setProjectionError] = useState(null);
    const usable = groups.filter((g) => groupOptions(g).length > 0);
    const gridAxes = draft ? axisOrder(usable, draft.group_ids) : [];
    const axisCount = gridAxes.length;
    // Rows = first axis, Columns = remaining axes. Which axis is which does not change what
    // the customer sees, so this is purely presentational.
    const rowAxis = axisCount > 0 ? gridAxes[0] : null;
    const colAxes = gridAxes.slice(1);
    // Plain derivations, not useMemo: the admin form re-renders on every keystroke anyway and
    // each of these is a small O(groups × options) pass, so memoizing on a joined dep string
    // would add complexity without avoiding any real work.
    let colCombos = [];
    if (colAxes.length > 0) {
        colCombos = [[]];
        for (const gid of colAxes) {
            const opts = groupOptions(usable.find((g) => g.id === gid));
            colCombos = colCombos.flatMap((c) => opts.map((o) => [...c, o.id]));
        }
    }
    const cellCount = rowAxis ? groupOptions(usable.find((g) => g.id === rowAxis)).length * Math.max(1, colCombos.length) : 0;
    const hasNonZeroPrices = (g) => groupOptions(g).some((o) => Number(o.price ?? 0) !== 0);
    const outsidePriced = groups.filter((g) => g.id && !gridAxes.includes(g.id)).filter(hasNonZeroPrices);
    const gridPriced = groups.filter((g) => gridAxes.includes(g.id)).filter(hasNonZeroPrices);
    const blocking = gridPriced.length > 0 || outsidePriced.length > 0;
    const filled = draft ? Object.keys(draft.map).length : 0;
    function toggleAxis(gid) {
        const cur = draft ?? { group_ids: [], independent_group_ids: [], map: {} };
        const has = cur.group_ids.includes(gid);
        const group_ids = axisOrder(usable, has ? cur.group_ids.filter((x) => x !== gid) : [...cur.group_ids, gid]);
        // Changing the axis set changes every key. Carry values across only where a key still
        // resolves; the rest are dropped rather than silently reinterpreted.
        const nextAxisCount = group_ids.length;
        const map = {};
        for (const [k, v] of Object.entries(cur.map)) {
            if (k.split(COMBO_KEY_SEP).length === nextAxisCount)
                map[k] = v;
        }
        const independent_group_ids = cur.independent_group_ids.filter((x) => !group_ids.includes(x));
        onChange({ ...cur, group_ids, map, independent_group_ids });
        setConflicts([]);
    }
    function setCell(rowOptId, colIds, raw) {
        if (!draft)
            return;
        const parts = [rowOptId, ...colIds];
        const key = parts.join(COMBO_KEY_SEP);
        const map = { ...draft.map };
        const n = Number(raw);
        if (raw === '' || !Number.isFinite(n) || n < 0)
            delete map[key];
        else
            map[key] = n;
        onChange({ ...draft, map });
    }
    // The backend owns the projection. A client-side copy would be a second implementation of
    // the same decision, and the two would drift — which is precisely how a card ends up
    // advertising one price while checkout charges another.
    async function runMigration() {
        if (!draft || !productId)
            return;
        setMigrating(true);
        setProjectionError(null);
        setConflicts([]);
        setResolutions({});
        try {
            const { data } = await api.post(`/products/${productId}/pot-price/projection`, { group_ids: gridAxes });
            // Clean projection: every cell agreed, so the whole grid is filled in.
            onChange({ ...draft, map: { ...draft.map, ...data.map } });
        }
        catch (e) {
            // 422 carries the disagreeing cells so the merchant can choose. The clean cells are NOT
            // returned on a conflict, so nothing partial is applied — the grid keeps whatever it had.
            const detail = e
                ?.response?.data?.detail;
            if (detail && Array.isArray(detail.conflicts)) {
                setConflicts(detail.conflicts.map((c) => ({
                    key: c.key,
                    label: cellLabel(usable, gridAxes, c.key),
                    values: c.values,
                })));
            }
            else {
                setProjectionError(getApiErrorDetail(e, 'Could not build the grid from the existing prices.'));
            }
        }
        finally {
            setMigrating(false);
        }
    }
    // Conflicts are resolved in the UI, then the chosen values are written into the grid by
    // hand alongside the clean cells — the endpoint deliberately never picks for the merchant.
    function applyResolutions() {
        if (!draft)
            return;
        onChange({ ...draft, map: { ...draft.map, ...resolutions } });
        setConflicts([]);
        setResolutions({});
    }
    if (usable.length === 0) {
        return (_jsx("div", { className: "rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500", children: "Add variant groups first \u2014 this grid prices a combination of them." }));
    }
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsxs("p", { className: "text-sm font-semibold text-gray-700", children: ["Variant types priced by this grid", _jsx("span", { className: "ml-2 font-normal text-gray-500", children: "The pot price can depend on more than one choice. Tick every group whose effect this grid already covers." })] }), _jsx("div", { className: "mt-2 flex flex-wrap gap-2", children: usable.map((g) => {
                            const on = gridAxes.includes(g.id);
                            return (_jsx("button", { type: "button", onClick: () => toggleAxis(g.id), "aria-pressed": on, className: `rounded-full border-2 px-3 py-1.5 text-xs font-semibold transition ${on
                                    ? 'border-primary bg-primary text-white'
                                    : 'border-gray-200 bg-white text-gray-600 hover:border-primary/50'}`, children: g.label }, g.id));
                        }) }), axisCount === 0 && (_jsx("p", { className: "mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2", children: "No groups selected, so this grid has no effect. Tick at least one." })), axisCount === 1 && (_jsx("p", { className: "mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2", children: "One group selected. That works, but a grid normally needs two or more \u2014 with one, a single price box per option is simpler and clearer." }))] }), blocking && (_jsxs("div", { className: "rounded-lg border-2 border-red-300 bg-red-50 p-3 text-xs text-red-800 space-y-2", children: [_jsx("p", { className: "font-semibold", children: "This grid would give a wrong total. Fix it before saving." }), gridPriced.map((g) => (_jsxs("p", { children: [_jsx("strong", { children: g.label }), " has its own price, but this grid already prices it, so that amount is ", _jsx("em", { children: "not" }), " being charged. Move it into the grid, or set those option prices to 0."] }, g.id))), outsidePriced.map((g) => (_jsxs("div", { children: [_jsxs("p", { children: [_jsx("strong", { children: g.label }), " has its own price and is not in this grid. Confirm it is a separate charge:"] }), _jsxs("label", { className: "mt-1 inline-flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: !!draft?.independent_group_ids.includes(g.id), onChange: (e) => {
                                            if (!draft)
                                                return;
                                            onChange({
                                                ...draft,
                                                independent_group_ids: e.target.checked
                                                    ? [...draft.independent_group_ids, g.id]
                                                    : draft.independent_group_ids.filter((x) => x !== g.id),
                                            });
                                        } }), _jsxs("span", { children: ["Yes \u2014 charge it separately (\u20B9", groupOptions(g).reduce((s, o) => s + Number(o.price ?? 0), 0), " added on top)"] })] })] }, g.id)))] })), rowAxis && colCombos.length > 0 && (_jsx("div", { className: "overflow-x-auto border rounded-lg", children: _jsxs("table", { className: "w-full text-xs text-left", children: [_jsx("thead", { className: "bg-gray-100 text-gray-600 border-b", children: _jsxs("tr", { children: [_jsxs("th", { className: "p-2 font-medium", children: [labelFor(usable, rowAxis), " \\ ", colAxes.map((g) => labelFor(usable, g)).join(' / ')] }), colCombos.map((combo) => (_jsx("th", { className: "p-2 font-medium whitespace-nowrap", children: combo
                                            .map((id, k) => groupOptions(usable.find((g) => g.id === colAxes[k])).find((o) => o.id === id)?.name ?? id)
                                            .join(' / ') }, combo.join('|'))))] }) }), _jsx("tbody", { children: groupOptions(usable.find((g) => g.id === rowAxis)).map((rowOpt) => (_jsxs("tr", { className: "border-b last:border-0 bg-white", children: [_jsx("td", { className: "p-2 font-semibold text-gray-800 whitespace-nowrap", children: rowOpt.name }), colCombos.map((combo) => {
                                        const key = [rowOpt.id, ...combo].join(COMBO_KEY_SEP);
                                        return (_jsx("td", { className: "p-2", children: _jsx("input", { type: "number", min: 0, step: 1, value: draft?.map[key] ?? '', placeholder: "\u2014", onChange: (e) => setCell(rowOpt.id, combo, e.target.value), className: "w-20 rounded border border-gray-300 px-2 py-1 text-gray-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30" }) }, key));
                                    })] }, rowOpt.id))) })] }) })), _jsx("p", { className: "text-xs text-gray-500", children: axisCount > 0 && (_jsxs(_Fragment, { children: [filled, " of ", cellCount, " cells filled. A blank cell is treated as unknown and falls back to today's price \u2014 it is never read as free. If a pot costs the same at every size, type it in each cell."] })) }), existingPriceMap && Object.keys(existingPriceMap).length > 0 && axisCount > 0 && (_jsxs("div", { className: "rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 space-y-2", children: [_jsxs("p", { children: ["This product already has a per-combination price table with", ' ', Object.keys(existingPriceMap).length, " values. Those can be projected onto this grid automatically \u2014 no retyping."] }), _jsx("button", { type: "button", onClick: runMigration, disabled: migrating, className: "rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50", children: migrating ? 'Building…' : 'Build grid from existing prices' }), projectionError && (_jsx("p", { className: "rounded border border-red-300 bg-red-50 px-2 py-1.5 font-semibold text-red-800", children: projectionError }))] })), conflicts.length > 0 && (_jsxs("div", { className: "rounded-lg border-2 border-amber-400 bg-amber-50 p-3 text-xs text-amber-900 space-y-2", children: [_jsxs("p", { className: "font-semibold", children: [conflicts.length, " cell", conflicts.length > 1 ? 's' : '', " disagree, so nothing was filled in automatically."] }), _jsx("p", { children: "The same selection has different values in the existing table. Choose which to keep:" }), conflicts.map((c) => (_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "font-semibold", children: c.label }), c.values.map((v) => (_jsxs("label", { className: "inline-flex items-center gap-1", children: [_jsx("input", { type: "radio", name: `resolve-${c.key}`, checked: resolutions[c.key] === v, onChange: () => setResolutions((p) => ({ ...p, [c.key]: v })) }), _jsxs("span", { children: ["\u20B9", v] })] }, v)))] }, c.key))), _jsx("button", { type: "button", disabled: Object.keys(resolutions).length !== conflicts.length, onClick: applyResolutions, className: "rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed", children: "Apply choices" })] })), priceMapActive && (_jsxs("div", { className: "rounded-lg border-2 border-amber-400 bg-amber-50 p-3 text-xs text-amber-900 space-y-1", children: [_jsx("p", { className: "font-semibold", children: "This product still has an old per-combination price table, which overrides this grid." }), _jsx("p", { children: "Saving clears that table for good, so the grid becomes the only thing setting the price. If you have not moved its values into the grid yet, build it from the existing prices first \u2014 otherwise those combinations will drop to the base price." })] }))] }));
}
