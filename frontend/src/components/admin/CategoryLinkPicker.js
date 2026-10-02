import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function flattenCategoryOptions(categories) {
    const options = [];
    const walk = (cat, depth) => {
        options.push({
            value: cat.slug,
            label: `${'— '.repeat(depth)}${cat.name} (/products?category=${cat.slug})`,
        });
        (cat.children ?? []).forEach((child) => walk(child, depth + 1));
    };
    (categories ?? []).forEach((cat) => walk(cat, 0));
    return options;
}
export default function CategoryLinkPicker({ categories, onPick, label = 'Or pick a category link:', value = '', }) {
    const options = flattenCategoryOptions(categories);
    return (_jsxs("div", { className: "mt-1.5 flex items-center gap-2", children: [_jsx("span", { className: "text-[10px] font-semibold text-gray-500 whitespace-nowrap", children: label }), _jsxs("select", { value: value, onChange: (e) => {
                    if (e.target.value) {
                        onPick(`/products?category=${e.target.value}`);
                    }
                    else {
                        onPick('');
                    }
                }, className: "flex-1 min-w-0 px-2 py-1.5 border rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary/50", children: [_jsx("option", { value: "", children: "\u2014 toggle category link \u2014" }), options.map((opt) => (_jsx("option", { value: opt.value, children: opt.label }, opt.value)))] })] }));
}
