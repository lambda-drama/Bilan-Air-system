/**
 * Frappe session client: credentials + CSRF (same pattern as DMS).
 */

import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

let csrfFetchInFlight: Promise<string | null> | null = null;

function readCsrfFromMeta(): string | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector('meta[name="csrf-token"]');
  const c = el?.getAttribute("content");
  return c && c.trim() ? c.trim() : null;
}

export async function ensureCSRF(forceRefresh = false): Promise<string | null> {
  const win = typeof window !== "undefined" ? (window as Record<string, unknown>) : null;

  if (!forceRefresh) {
    if (win?.csrf_token && typeof win.csrf_token === "string") {
      return win.csrf_token as string;
    }
    const meta = readCsrfFromMeta();
    if (meta && win) {
      win.csrf_token = meta;
      return meta;
    }
  }

  if (csrfFetchInFlight) return csrfFetchInFlight;

  csrfFetchInFlight = (async () => {
    try {
      const endpoints = [
        `/api/method/${API}.website_auth.get_csrf_token`,
        "/api/method/frappe.sessions.get_csrf_token",
      ];
      for (const url of endpoints) {
        const res = await fetchWithTimeout(url, { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) continue;
        const token = data?.message || null;
        if (token && typeof token === "string") {
          if (win) win.csrf_token = token;
          return token;
        }
      }
      return null;
    } catch {
      return null;
    } finally {
      csrfFetchInFlight = null;
    }
  })();

  return csrfFetchInFlight;
}

export function clearCSRF() {
  const win = typeof window !== "undefined" ? (window as Record<string, unknown>) : null;
  if (win) delete win.csrf_token;
}

function getCSRF(): string | null {
  const win = typeof window !== "undefined" ? (window as Record<string, unknown>) : null;
  return (win?.csrf_token as string) || null;
}

function mergeHeaders(
  base: Record<string, string>,
  extra?: HeadersInit,
): Record<string, string> {
  const out: Record<string, string> = { ...base };
  if (!extra) return out;
  if (extra instanceof Headers) {
    extra.forEach((v, k) => {
      out[k] = v;
    });
    return out;
  }
  if (Array.isArray(extra)) {
    for (const [k, v] of extra) out[k] = v;
    return out;
  }
  Object.assign(out, extra as Record<string, string>);
  return out;
}

function injectCsrfIntoJsonBody(
  body: BodyInit | null | undefined,
  csrf: string | null,
): BodyInit | null | undefined {
  if (!csrf || body === undefined || body === null) return body;
  if (typeof body !== "string") return body;
  try {
    const parsed = JSON.parse(body) as unknown;
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return JSON.stringify({ ...(parsed as Record<string, unknown>), csrf_token: csrf });
    }
  } catch {
    /* not JSON */
  }
  return body;
}

function buildHeaders(method: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (method !== "GET") {
    const csrf = getCSRF();
    if (csrf) headers["X-Frappe-CSRF-Token"] = csrf;
  }
  return headers;
}

function isCSRFErrorPayload(resData: Record<string, unknown>): boolean {
  if (resData.exc_type === "CSRFTokenError") return true;
  return String(resData.exc ?? "").includes("CSRFTokenError");
}

function parseError(resData: Record<string, unknown>): string {
  if (resData._server_messages) {
    try {
      const msgs = JSON.parse(resData._server_messages as string);
      if (Array.isArray(msgs) && msgs.length > 0) {
        const first = JSON.parse(msgs[0]);
        return first.message || msgs[0];
      }
      return String(resData._server_messages);
    } catch {
      return String(resData._server_messages);
    }
  }
  if (resData.exc_type) return String(resData.exc_type);
  if (resData.message) return String(resData.message);
  return "Request failed";
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = (options.method?.toUpperCase() || "GET") as string;

  const run = async (isCsrfRetry: boolean) => {
    if (method !== "GET") await ensureCSRF(isCsrfRetry);

    const headers = mergeHeaders(buildHeaders(method), options.headers);
    const csrf = method !== "GET" ? getCSRF() : null;
    const body =
      method !== "GET" ? injectCsrfIntoJsonBody(options.body ?? null, csrf) : options.body;

    const response = await fetch(path, {
      ...options,
      headers,
      body: body ?? options.body,
      credentials: "include",
    });

    const resData = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return { response, resData };
  };

  let { response, resData } = await run(false);

  if (
    !response.ok &&
    method !== "GET" &&
    (response.status === 403 ||
      (response.status === 400 && isCSRFErrorPayload(resData)))
  ) {
    clearCSRF();
    ({ response, resData } = await run(true));
  }

  if (!response.ok) throw new Error(parseError(resData));

  if (resData.data !== undefined) return resData.data as T;
  if (resData.message !== undefined) return resData.message as T;
  return resData as T;
}

/** Base path for bilan_air_booking_system API modules */
export const API = "bilan_sky.bilan_air_booking_system.api";

export function methodUrl(module: string, fn: string) {
  return `/api/method/${API}.${module}.${fn}`;
}

export interface UploadedFile {
  file_url?: string;
  name?: string;
}

/** Multipart upload to Frappe (e.g. User user_image). */
export async function uploadFile(
  file: File,
  opts: {
    doctype: string;
    docname: string;
    fieldname: string;
    isPrivate?: boolean;
  },
): Promise<UploadedFile> {
  await ensureCSRF();
  const csrf = getCSRF();

  const formData = new FormData();
  formData.append("file", file);
  formData.append("doctype", opts.doctype);
  formData.append("docname", opts.docname);
  formData.append("fieldname", opts.fieldname);
  formData.append("is_private", opts.isPrivate ? "1" : "0");

  const headers: Record<string, string> = { Accept: "application/json" };
  if (csrf) headers["X-Frappe-CSRF-Token"] = csrf;

  const response = await fetch("/api/method/upload_file", {
    method: "POST",
    credentials: "include",
    headers,
    body: formData,
  });

  const resData = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new Error(parseError(resData));

  const message = resData.message as UploadedFile | undefined;
  if (message && typeof message === "object") return message;
  if (resData.data && typeof resData.data === "object") return resData.data as UploadedFile;
  return {};
}
