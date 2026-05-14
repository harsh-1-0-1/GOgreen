import axios from 'axios';
import api from '@/lib/api';

export interface CorporateGiftInquiryPayload {
  fullName: string;
  phone: string;
  email: string;
  companyName: string;
  customisation?: string;
}

const endpoint = import.meta.env.VITE_CORPORATE_INQUIRY_ENDPOINT as string | undefined;

export async function submitCorporateGiftInquiry(payload: CorporateGiftInquiryPayload) {
  if (!endpoint) {
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    return { ok: true };
  }

  if (/^https?:\/\//i.test(endpoint)) {
    const { data } = await axios.post(endpoint, payload);
    return data;
  }

  const { data } = await api.post(endpoint, payload);
  return data;
}
