import type { NextConfig } from "next";

const nextConfig: NextConfig ={
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'www.vonatosszeallitas.hu',
        port: '',
        pathname: '/kocsik/**',
        search: '',
      },
    ],
  },
}

export default nextConfig;
