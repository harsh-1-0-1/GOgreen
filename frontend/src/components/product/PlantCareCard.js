import { jsx as _jsx } from "react/jsx-runtime";
export default function PlantCareCard({ careCardImage }) {
    if (!careCardImage)
        return null;
    return (_jsx("img", { src: careCardImage, alt: "Plant care guide", className: "w-full h-auto object-cover rounded-2xl mt-6 sm:mt-8" }));
}
