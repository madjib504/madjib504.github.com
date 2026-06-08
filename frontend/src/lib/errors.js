// Extracts a readable error message from any axios/FastAPI/Pydantic error.
// FastAPI may return:
//   { detail: "string" }                              → simple string
//   { detail: [{type, loc, msg, input, ctx}, ...] }   → Pydantic validation array
//   { detail: { error: "...", code: "..." } }         → custom object
export function extractErrorMessage(err, fallback = 'Une erreur est survenue.') {
  const data = err?.response?.data;
  const detail = data?.detail;

  if (!detail) {
    if (typeof data === 'string') return data;
    if (err?.message) return err.message;
    return fallback;
  }

  if (typeof detail === 'string') return detail;

  if (Array.isArray(detail)) {
    return detail.map((d) => {
      if (typeof d === 'string') return d;
      const field = Array.isArray(d?.loc) ? d.loc.filter((p) => p !== 'body').join('.') : '';
      const msg = d?.msg || 'erreur';
      return field ? `${field}: ${msg}` : msg;
    }).join(' • ');
  }

  if (typeof detail === 'object') {
    if (typeof detail.msg === 'string') return detail.msg;
    try {
      return JSON.stringify(detail);
    } catch {
      return fallback;
    }
  }

  return fallback;
}
