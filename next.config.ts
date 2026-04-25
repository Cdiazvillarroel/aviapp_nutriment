import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // typedRoutes will be re-enabled once all pages (alerts, benchmarks, settings)
  // exist. For now, dynamic redirects and forward-references to placeholder
  // pages would otherwise fail the build.
};

export default nextConfig;
