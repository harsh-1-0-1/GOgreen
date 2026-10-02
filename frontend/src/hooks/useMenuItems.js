import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
export const useMenuItems = () => useQuery({
    queryKey: ['menu_items'],
    queryFn: () => api.get('/menu_items').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    // No placeholderData — we need dataUpdatedAt to stay 0 until the real
    // fetch completes, so consumers can distinguish "haven't fetched yet"
    // from "fetched and got an empty array".
});
