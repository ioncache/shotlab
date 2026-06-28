import { z } from 'zod';

const optionalTrimmedStringSchema = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  });

const optionalUrlStringSchema = optionalTrimmedStringSchema.refine(
  (value) => value == null || isValidHttpUrl(value),
  {
    message: 'METICULOUS_BASE_URL must be a valid http(s) URL',
  },
);

function flagSchema(name: string) {
  return z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (value == null || value === '') {
        return false;
      }

      if (value === '0') {
        return false;
      }

      if (value === '1') {
        return true;
      }

      ctx.addIssue({
        code: 'custom',
        message: `${name} must be "0" or "1" when set`,
      });
      return z.NEVER;
    });
}

const settingsPatchSchema = z
  .string()
  .optional()
  .transform((value, ctx) => {
    const trimmed = value?.trim();
    if (!trimmed) {
      return undefined;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      ctx.addIssue({
        code: 'custom',
        message: 'METICULOUS_SETTINGS_PATCH_JSON must be valid JSON when set',
      });
      return z.NEVER;
    }

    if (!isJsonObject(parsed)) {
      ctx.addIssue({
        code: 'custom',
        message: 'METICULOUS_SETTINGS_PATCH_JSON must decode to a JSON object',
      });
      return z.NEVER;
    }

    return parsed;
  });

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidHttpUrl(value: string): boolean {
  if (!URL.canParse(value)) {
    return false;
  }

  const { protocol } = new URL(value);
  return protocol === 'http:' || protocol === 'https:';
}

const integrationEnvSchema = z
  .object({
    METICULOUS_ALLOW_WRITE_TESTS: flagSchema('METICULOUS_ALLOW_WRITE_TESTS'),
    METICULOUS_BASE_URL: optionalUrlStringSchema,
    METICULOUS_RUN_INTEGRATION: flagSchema('METICULOUS_RUN_INTEGRATION'),
    METICULOUS_SETTINGS_PATCH_JSON: settingsPatchSchema,
  })
  .transform((env) => ({
    allowWriteTests: env.METICULOUS_ALLOW_WRITE_TESTS,
    baseUrl: env.METICULOUS_BASE_URL,
    enabled: env.METICULOUS_RUN_INTEGRATION,
    settingsPatch: env.METICULOUS_SETTINGS_PATCH_JSON,
  }))
  .superRefine((config, ctx) => {
    if (config.enabled && !config.baseUrl) {
      ctx.addIssue({
        code: 'custom',
        message:
          'METICULOUS_BASE_URL is required when METICULOUS_RUN_INTEGRATION=1',
        path: ['METICULOUS_BASE_URL'],
      });
    }
  });

export type MeticulousIntegrationConfig = z.infer<typeof integrationEnvSchema>;

export function readIntegrationConfig(
  env: Record<string, string | undefined> = process.env,
): MeticulousIntegrationConfig {
  const parsed = integrationEnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues.map((issue) => issue.message).join('\n'),
    );
  }

  return parsed.data;
}
