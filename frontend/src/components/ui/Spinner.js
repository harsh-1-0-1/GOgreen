import { jsx as _jsx } from "react/jsx-runtime";
export default function Spinner({ className = '' }) {
    return (_jsx("div", { className: `flex items-center justify-center ${className}`, children: _jsx("div", { className: "w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin" }) }));
}
