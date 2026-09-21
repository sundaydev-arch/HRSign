/**
 * Frontend shared request helper.
 *
 * On non-2xx responses the backend returns `{ error: { code, params? } }`; this
 * helper throws an ApiClientError carrying the machine code so callers can
 * render a localized message (code + params are locale-independent).
 */
export class ApiClientError extends Error {
  constructor(
    public code: string,
    public params?: Record<string, string | number | boolean>,
  ) {
    super(code);
    this.name = "ApiClientError";
  }
}

interface ErrorBody {
  error?:
    | { code?: string; params?: Record<string, string | number | boolean> }
    | string;
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const res = await fetch(url, {
    ...init,
    headers: isFormData ? init?.headers : { "Content-Type": "application/json", ...init?.headers },
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = (data as ErrorBody).error;
    if (error && typeof error === "object" && error.code) {
      throw new ApiClientError(error.code, error.params);
    }
    if (typeof error === "string") {
      throw new ApiClientError(error);
    }
    throw new ApiClientError(`HTTP_ERROR_${res.status}`);
  }
  return data as T;
}
