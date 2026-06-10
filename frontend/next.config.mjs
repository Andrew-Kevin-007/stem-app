/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root — the backend repo one level up has its own lockfile.
  turbopack: {
    root: import.meta.dirname,
  },
  images: {
    unoptimized: true,
  },
  // Type safety is enforced via `tsc --noEmit`; don't fail production builds on
  // lint of the vendored shadcn/ui components (version-sensitive react-hooks rules).
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ]
  },
}

export default nextConfig
