export function getApiErrorDetail(err, fallback) {
    if (err && typeof err === 'object') {
        const e = err;
        const detail = e.response?.data?.detail;
        if (typeof detail === 'string' && detail)
            return detail;
        if (detail && typeof detail === 'object' && detail.message)
            return detail.message;
        if (e.message)
            return e.message;
    }
    return fallback;
}
export function isUnauthorizedError(err) {
    if (err && typeof err === 'object') {
        return err.response?.status === 401;
    }
    return false;
}
