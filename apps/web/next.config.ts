import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const apiInternalUrl =
      process.env.API_INTERNAL_URL?.trim() || "http://localhost:4000";

    return [
      {
        source: "/backend/:path*",
        destination: `${apiInternalUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
