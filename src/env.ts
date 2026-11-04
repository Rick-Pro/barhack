/** Secrets arrive as Worker bindings. Names only here, never values. */
export interface Env {
  ELASTIC_URL: string;
  ELASTIC_API_KEY: string;
  MISTRAL_API_KEY: string;
}

export const REQUIRED_BINDINGS = ['ELASTIC_URL', 'ELASTIC_API_KEY', 'MISTRAL_API_KEY'] as const;

export function missingBindings(env: Partial<Env>): string[] {
  return REQUIRED_BINDINGS.filter((name) => !env[name]);
}

/** A failed call to Elasticsearch or Mistral. `detail` never contains a secret. */
export class UpstreamError extends Error {
  constructor(
    public readonly service: 'elasticsearch' | 'mistral',
    public readonly status: number,
    public readonly detail: string,
  ) {
    super(`${service} ${status}`);
    this.name = 'UpstreamError';
  }
}
