import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel builds its own deployment format; standalone is used for Docker/VPS/sandbox packaging
  output: process.env.VERCEL ? undefined : "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
