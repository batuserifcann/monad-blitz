import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["phaser"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3001/api/:path*",
      },
      {
        source: "/socket.io/:path*",
        destination: "http://localhost:3001/socket.io/:path*",
      },
    ];
  },
};

export default nextConfig;
