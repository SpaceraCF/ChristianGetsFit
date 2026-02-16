import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).optional().default("postgresql://localhost:5432/app"),
  NEXTAUTH_SECRET: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  CALCOM_API_KEY: z.string().optional(),
  FITBIT_CLIENT_ID: z.string().optional(),
  FITBIT_CLIENT_SECRET: z.string().optional(),
  APP_URL: z.string().url().optional().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

export function getEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid env:", parsed.error.flatten());
    throw new Error("Invalid environment variables");
  }
  return parsed.data;
}
