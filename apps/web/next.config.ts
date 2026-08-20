import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Linting is a separate workspace/CI gate; avoid Next.js's legacy ESLint
  // config detection warning for the repository-level flat config.
  eslint: { ignoreDuringBuilds: true },
  reactStrictMode: true,
  transpilePackages: ['@werewolf/game-engine', '@werewolf/shared'],
};

export default nextConfig;
