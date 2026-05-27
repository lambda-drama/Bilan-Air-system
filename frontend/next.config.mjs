/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== "production"

const nextConfig = {
  ...(isDev ? {} : { output: "export" }),

  basePath: "/bilan",

  assetPrefix: isDev ? "" : "/assets/bilan_sky/frontend",

  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },

  ...(isDev
    ? {
        async rewrites() {
          const frappeUrl = process.env.FRAPPE_URL || "http://localhost:8000"
          return [
            {
              source: "/api/:path*",
              destination: `${frappeUrl}/api/:path*`,
            },
            {
              source: "/files/:path*",
              destination: `${frappeUrl}/files/:path*`,
            },
          ]
        },
      }
    : {}),
}

export default nextConfig
