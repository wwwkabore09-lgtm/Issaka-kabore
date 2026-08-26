/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@finza/ui', '@finza/shared-types', '@finza/config'],
};

export default nextConfig;
