/** @type {import('next').NextConfig} */
const config = {
  poweredByHeader: false,
  // Images are served by MyStore's same-origin API in this self-hosted setup.
  // Avoid routing generated product-photo URLs through Next's optimizer.
  images: { unoptimized: true },
  experimental: { cpus: 1 },
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      {
        source: '/shops/:path+',
        destination: '/shop/:path+',
        permanent: true,
      },
    ];
  },
};
export default config;
