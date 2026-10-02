import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { SUPPORT_PHONE_DISPLAY } from '@/components/layout/Navbar/navData';
const DEFAULT_FAQS = [
    {
        question: "What is the Plantoga quality guarantee?",
        answer: "We offer a 100% Thrive Guarantee. If any plant or pot arrives damaged, withered, or incorrect, simply submit our Damage Replacement form with a photo within 48 hours, and we'll ship a replacement immediately, completely free of charge. No return shipment required!"
    },
    {
        question: "How do I care for my plant after it arrives?",
        answer: "Allow your plant to settle for 24-48 hours before watering or repotting. Keep it in indirect, bright sunlight first so it can acclimate to your space. You can find detailed, plant-specific care instructions on the product page for each specific plant."
    },
    {
        question: "How often should I water my plants?",
        answer: "The golden rule is to water only when the top 1-2 inches of soil feels dry to the touch. Stick your finger in the soil to check. Overwatering is the most common cause of plant distress, so when in doubt, it is better to underwater."
    },
    {
        question: "Where do you deliver?",
        answer: "We safely deliver plants, seeds, and pots to over 15,000 pin codes across India, covering all major metropolitan areas and tier 1 and tier 2 cities."
    },
    {
        question: "How long does delivery take?",
        answer: "Standard deliveries take 3 to 7 business days depending on your location. Metro orders are typically delivered faster within 2 to 4 days."
    },
    {
        question: "Can I cancel or modify my order?",
        answer: `You can cancel or modify your order within 2 hours of placing it. Please call or WhatsApp our support team at ${SUPPORT_PHONE_DISPLAY} to request changes.`
    }
];
export default function ProductFaq({ faqs, embedded = false }) {
    const [expandedIndex, setExpandedIndex] = useState(null);
    const items = faqs && faqs.length > 0 ? faqs : DEFAULT_FAQS;
    const toggleExpand = (index) => {
        setExpandedIndex(expandedIndex === index ? null : index);
    };
    return (_jsx("section", { id: "product-faqs", className: embedded ? '' : 'border-t border-gray-100 pt-8 sm:pt-10', "aria-labelledby": "product-faqs-title", children: _jsxs("div", { className: embedded ? 'w-full' : 'mx-auto w-full max-w-3xl px-0', children: [_jsxs("div", { className: `mb-8 ${embedded ? '' : 'mx-auto max-w-2xl text-center'}`, children: [_jsx("h2", { id: "product-faqs-title", className: "text-2xl font-bold tracking-normal text-gray-950 sm:text-3xl", style: { fontFamily: "'Playfair Display', Georgia, serif" }, children: "Frequently Asked Questions" }), _jsx("p", { className: "mt-2 text-sm text-gray-500", children: "Got questions about orders, shipping, or care? We've got you covered." })] }), _jsx("div", { className: "space-y-3 sm:space-y-4", children: items.map((faq, index) => {
                        const isExpanded = expandedIndex === index;
                        return (_jsxs("article", { onClick: () => toggleExpand(index), className: "bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 shadow-sm hover:shadow-md transition cursor-pointer select-none", children: [_jsxs("div", { className: "flex justify-between items-start gap-4", children: [_jsx("h3", { className: "text-sm sm:text-base font-bold text-[#173A2A]", children: faq.question }), _jsx("button", { className: `text-[#2D6A4F] p-1 rounded-lg hover:bg-emerald-50 transition shrink-0 ${isExpanded ? 'bg-emerald-50' : ''}`, "aria-label": isExpanded ? 'Collapse' : 'Expand', onClick: (e) => {
                                                // Prevent double triggering from card onClick
                                                e.stopPropagation();
                                                toggleExpand(index);
                                            }, children: isExpanded ? _jsx(ChevronUp, { size: 20 }) : _jsx(ChevronDown, { size: 20 }) })] }), isExpanded && (_jsx("div", { className: "mt-4 text-xs sm:text-sm leading-relaxed text-gray-600 border-t border-gray-100 pt-4 animate-[fadeInScale_0.15s_ease-out]", children: faq.answer }))] }, index));
                    }) })] }) }));
}
