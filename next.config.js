/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Increase body size limit for API routes — mobile app sends base64 photos
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
  // Allow large request bodies for route handlers
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
    responseLimit: '20mb',
  },
}

module.exports = nextConfig
