/** @type {import('next').NextConfig} */
const config = {
  poweredByHeader: false,
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
