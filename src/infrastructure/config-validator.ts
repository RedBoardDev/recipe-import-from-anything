import { z } from "zod";

const nonEmptyString = z.string().min(1, "cannot be empty");

const productionEnvSchema = z.object({
  REDIS_HOST: nonEmptyString,
  JWT_SECRET: nonEmptyString,
  JWT_ISSUER: nonEmptyString,
  JWT_AUDIENCE: nonEmptyString,
});

export interface EnvValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateEnvironment(): EnvValidationResult {
  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction) {
    return { valid: true, errors: [] };
  }

  const result = productionEnvSchema.safeParse(process.env);

  if (result.success) {
    return { valid: true, errors: [] };
  }

  const errors = result.error.issues.map((issue) => `FATAL: ${issue.path.join(".")} ${issue.message}`);

  return { valid: false, errors };
}

export function assertEnvironment(): void {
  const result = validateEnvironment();

  if (!result.valid) {
    for (const error of result.errors) {
      console.error(error);
    }
    process.exit(1);
  }
}
