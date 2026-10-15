import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ['postgres'],
  outputFileTracingIncludes: { '/*': ['./certs/supabase-ca.crt'] },
};
export default config;
