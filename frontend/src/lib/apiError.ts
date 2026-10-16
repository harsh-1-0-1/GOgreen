type ApiErrorLike = {
  // Some endpoints (e.g. the pot-price projection) return a structured `detail` carrying
  // machine-readable conflicts alongside the human message, so this is not always a string.
  response?: { data?: { detail?: string | { message?: string } }; status?: number };
  message?: string;
};

export function getApiErrorDetail(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const e = err as ApiErrorLike;
    const detail = e.response?.data?.detail;
    if (typeof detail === 'string' && detail) return detail;
    if (detail && typeof detail === 'object' && detail.message) return detail.message;
    if (e.message) return e.message;
  }
  return fallback;
}

export function isUnauthorizedError(err: unknown): boolean {
  if (err && typeof err === 'object') {
    return (err as ApiErrorLike).response?.status === 401;
  }
  return false;
}
