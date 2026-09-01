import type { NextRequest } from "next/server";

import {
  buildApiProxyHeaders,
  buildApiProxyUrl,
  sanitizeApiProxyResponseHeaders,
} from "@/lib/api/server-proxy";

export const dynamic = "force-dynamic";

type ProxyContext = {
  params: Promise<{ path: string[] }>;
};

async function proxyRequest(
  request: NextRequest,
  context: ProxyContext,
): Promise<Response> {
  try {
    const { path } = await context.params;
    const target = buildApiProxyUrl(path, request.nextUrl.search);
    const hasBody = request.method !== "GET" && request.method !== "HEAD";
    const body = hasBody ? await request.arrayBuffer() : undefined;
    const upstream = await fetch(target, {
      method: request.method,
      headers: buildApiProxyHeaders(request),
      body: body && body.byteLength > 0 ? body : undefined,
      cache: "no-store",
      redirect: "manual",
      signal: request.signal,
    });

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: sanitizeApiProxyResponseHeaders(upstream.headers),
    });
  } catch (error) {
    const configurationError =
      error instanceof Error && error.message.startsWith("API_INTERNAL_URL");
    return Response.json(
      {
        error: {
          code: configurationError
            ? "API_PROXY_MISCONFIGURED"
            : "API_PROXY_UNAVAILABLE",
          message: configurationError
            ? "The API proxy is not configured"
            : "The API is temporarily unavailable",
        },
      },
      { status: configurationError ? 500 : 502 },
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
export const OPTIONS = proxyRequest;
export const HEAD = proxyRequest;
