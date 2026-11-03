/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  allowedDevOrigins: ['account-*.localhost'],
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  typescript: { tsconfigPath: process.env.NEXT_TSCONFIG_PATH ?? 'tsconfig.json' },
};

export default nextConfig;