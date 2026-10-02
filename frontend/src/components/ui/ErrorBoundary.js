import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from 'react';
export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(error, info) {
        // Log to console so errors are visible in devtools instead of silently swallowed
        console.error('[ErrorBoundary]', error, info.componentStack);
    }
    render() {
        if (this.state.hasError) {
            return (this.props.fallback ?? (_jsxs("div", { className: "flex flex-col items-center justify-center py-20 text-gray-400", children: [_jsx("p", { className: "text-lg font-medium", children: "Something went wrong" }), _jsx("button", { onClick: () => this.setState({ hasError: false }), className: "mt-3 text-sm text-primary hover:underline", children: "Try again" })] })));
        }
        return this.props.children;
    }
}
