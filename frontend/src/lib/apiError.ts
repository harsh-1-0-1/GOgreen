type ApiErrorLike = {
  response?: { data?: { detail?: string }; status?: number };
  message?: string;
};

export function getApiErrorDetail(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const e = err as ApiErrorLike;
    const detail = e.response?.data?.detail;
    if (detail) return detail;
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
