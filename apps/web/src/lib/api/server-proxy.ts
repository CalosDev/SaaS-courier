const HOP_BY_HOP_HEADERS = [
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
] as const;

export function resolveApiInternalUrl(environment = process.env): URL {
  const configured = environment.API_INTERNAL_URL?.trim();
  const candidate =
    configured ||
    (environment.NODE_ENV === "production" ? "" : "http://127.0.0.1:4000");

  if (!candidate) {
    throw new Error("API_INTERNAL_URL is required in production");
  }

  const url = new URL(candidate);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("API_INTERNAL_URL must use HTTP or HTTPS");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("API_INTERNAL_URL must not contain credentials, query, or hash");
  }

  return url;
}

export function buildApiProxyUrl(
  path: readonly string[],
  search: string,
  environment = process.env,
): URL {
  const url = resolveApiInternalUrl(environment);
  const basePath = url.pathname.replace(/\/$/u, "");
  const encodedPath = path.map((segment) => encodeURIComponent(segment)).join("/");
  url.pathname = `${basePath}/${encodedPath}`;
  url.search = search;
  return url;
}

export function buildApiProxyHeaders(request: Request): Headers {
  const headers = new Headers(request.headers);
  for (const header of HOP_BY_HOP_HEADERS) {
    headers.delete(header);
  }

  // Never trust a client-supplied forwarding chain. The API trusts this web hop.
  headers.delete("forwarded");
  headers.delete("x-forwarded-for");
  headers.delete("x-forwarded-host");
  headers.delete("x-forwarded-port");
  headers.delete("x-forwarded-proto");

  const incomingUrl = new URL(request.url);
  const originalHost = request.headers.get("host");
  if (originalHost) {
    headers.set("x-forwarded-host", originalHost);
  }
  headers.set("x-forwarded-proto", incomingUrl.protocol.replace(":", ""));
  if (incomingUrl.port) {
    headers.set("x-forwarded-port", incomingUrl.port);
  }

  return headers;
}

export function sanitizeApiProxyResponseHeaders(upstream: Headers): Headers {
  const headers = new Headers(upstream);
  for (const header of HOP_BY_HOP_HEADERS) {
    headers.delete(header);
  }
  return headers;
}
