/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // The e2e console test runs a dev server in its own folder, so it never fights one you already have running
  distDir: process.env.NEXT_DIST_DIR || ".next",
}

export default nextConfig
