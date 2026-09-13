import type { NextConfig } from "next";

const apiOrigin = process.env.RECTIFY_API_ORIGIN;

const nextConfig: NextConfig = {
  typedRoutes: true,
  poweredByHeader: false,
  ...(apiOrigin === undefined || apiOrigin.length === 0
    ? {}
    : {
        rewrites: () =>
          Promise.resolve({
            beforeFiles: [
              { source: "/api/:path*", destination: `${new URL(apiOrigin).origin}/api/:path*` },
            ],
            afterFiles: [],
            fallback: [],
          }),
      }),
};

export default nextConfig;
