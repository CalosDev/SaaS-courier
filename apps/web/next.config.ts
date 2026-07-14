import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
