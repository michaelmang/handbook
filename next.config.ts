import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
