import api from '@/lib/api';
// Posts to the backend route. Deployments may override with VITE_CORPORATE_INQUIRY_ENDPOINT:
//   - a full http(s):// URL → external webhook/endpoint
//   - a relative path       → posted via the /api/v1 axios client
// Default: /corporate-inquiries (relative path, uses the api client)
const DEFAULT_ENDPOINT = '/corporate-inquiries';
const configured = import.meta.env.VITE_CORPORATE_INQUIRY_ENDPOINT;
const endpoint = configured && configured.trim() ? configured.trim() : DEFAULT_ENDPOINT;
export async function submitCorporateGiftInquiry(payload) {
    // If endpoint is a full URL, use axios directly
    if (/^https?:\/\//i.test(endpoint)) {
        const axios = (await import('axios')).default;
        const { data } = await axios.post(endpoint, payload);
        return data;
    }
    // Otherwise, use the api client (relative path against /api/v1)
    const { data } = await api.post(endpoint, payload);
    return data;
}
