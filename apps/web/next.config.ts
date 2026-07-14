import type { NextConfig } from "next";

const storagePublicOrigin = resolveStoragePublicOrigin();
const connectSources = ["'self'", storagePublicOrigin]
  .filter(Boolean)
  .join(" ");
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  `connect-src ${connectSources}`,
  "font-src 'self' data:",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' blob: data:",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), microphone=()",
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async rewrites() {
    const apiInternalUrl =
      process.env.API_INTERNAL_URL?.trim() || "http://127.0.0.1:4000";

    return [
      {
        source: "/backend/:path*",
        destination: `${apiInternalUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;

function resolveStoragePublicOrigin(): string {
  const configured = process.env.STORAGE_PUBLIC_ORIGIN?.trim();
  const candidate =
    configured ||
    (process.env.NODE_ENV === "production" ? "" : "http://localhost:9000");
  if (!candidate) return "";

  const url = new URL(candidate);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("STORAGE_PUBLIC_ORIGIN must use HTTP or HTTPS");
  }
  return url.origin;
}
