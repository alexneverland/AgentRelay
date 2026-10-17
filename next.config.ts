import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ['postgres'],
  outputFileTracingIncludes: {
    '/*': ['./certs/supabase-ca.crt'],
    '/api/mcp': ['./docs/mcp-client-guide.md'],
  },
};
export default config;
