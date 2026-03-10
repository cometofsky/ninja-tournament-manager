/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 14: keep mongoose and nodemailer in Node.js runtime (not Edge).
  experimental: {
    serverComponentsExternalPackages: ['mongoose', 'nodemailer'],
  },
};

module.exports = nextConfig;
