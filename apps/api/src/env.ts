import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  // Only needed for admin/maintenance scripts. Route handlers use a
  // per-request client scoped to the caller's own token so Postgres RLS
  // stays the real tenant boundary — never wire this into a request path.
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  // Comma-separated list of allowed origins for CORS, e.g.
  // "https://app.example.com,https://staging.example.com".
  CORS_ORIGIN: z.string().min(1),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment configuration:');
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();

export const corsOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim());
