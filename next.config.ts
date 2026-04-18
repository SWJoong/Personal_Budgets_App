import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
    optimizePackageImports: ['@supabase/supabase-js', '@supabase/ssr'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;
