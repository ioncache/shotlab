import { z } from 'zod';

const finiteNumberSchema = z.preprocess(
  (value) =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined,
  z.number().finite().optional(),
);

const sensorsSchema = z
  .object({
    p: finiteNumberSchema,
    t: finiteNumberSchema,
    w: finiteNumberSchema,
  })
  .passthrough();

const payloadObjectSchema = z
  .object({
    p: finiteNumberSchema,
    profile_time: finiteNumberSchema,
    sensors: sensorsSchema.optional(),
    t: finiteNumberSchema,
    t_ext_1: finiteNumberSchema,
    t_tube: finiteNumberSchema,
    time: finiteNumberSchema,
    w: finiteNumberSchema,
    weight_pred: finiteNumberSchema,
  })
  .passthrough();

export type SocketPayloadMetrics = {
  machineTime?: number;
  pressure?: number;
  profileTime?: number;
  temperature?: number;
  weight?: number;
};

export function parseSocketPayloadMetrics(
  payload: unknown[],
): SocketPayloadMetrics {
  const parsed = payloadObjectSchema.safeParse(payload[0]);
  if (!parsed.success) {
    return {};
  }

  const record = parsed.data;
  const metrics = {
    machineTime: record.time,
    pressure: record.sensors?.p ?? record.p,
    profileTime: record.profile_time,
    temperature:
      record.sensors?.t ?? record.t ?? record.t_tube ?? record.t_ext_1,
    weight: record.sensors?.w ?? record.w ?? record.weight_pred,
  };

  return Object.fromEntries(
    Object.entries(metrics).filter(([, value]) => value !== undefined),
  ) as SocketPayloadMetrics;
}

export function sanitizeNormalizedValue(value: unknown): unknown {
  if (value === 'NaN') {
    return null;
  }

  if (typeof value === 'number' && !Number.isFinite(value)) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeNormalizedValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        sanitizeNormalizedValue(entryValue),
      ]),
    );
  }

  return value;
}
