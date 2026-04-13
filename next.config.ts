import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        // returns.missfinchnyc.com/ → show the returns page
        {
          source: '/',
          has: [{ type: 'host', value: 'returns.missfinchnyc.com' }],
          destination: '/returns',
        },
        // app.missfinchnyc.com/ → show the admin page
        {
          source: '/',
          has: [{ type: 'host', value: 'app.missfinchnyc.com' }],
          destination: '/admin',
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
