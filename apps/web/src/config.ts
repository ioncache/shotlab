export interface AppConfig {
  meticulousBaseUrl?: string;
  meticulousBaseUrlError?: string;
}

export function readAppConfig(env: ImportMetaEnv = import.meta.env): AppConfig {
  const rawBaseUrl = env.METICULOUS_BASE_URL?.trim();

  if (!rawBaseUrl) {
    return {
      meticulousBaseUrlError:
        'METICULOUS_BASE_URL is required to connect to the machine.',
    };
  }

  try {
    const url = new URL(rawBaseUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return {
        meticulousBaseUrlError:
          'METICULOUS_BASE_URL must be an http(s) URL.',
      };
    }

    return {
      meticulousBaseUrl: rawBaseUrl,
    };
  } catch {
    return {
      meticulousBaseUrlError:
        'METICULOUS_BASE_URL must be a valid URL.',
    };
  }
}
