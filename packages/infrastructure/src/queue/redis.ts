export interface RedisConnectionOptions {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

const parseRedisUrl = (url: string): RedisConnectionOptions => {
  const parsed = new URL(url);

  const port = parsed.port ? Number(parsed.port) : 6379;
  const db = parsed.pathname ? Number(parsed.pathname.replace("/", "")) : undefined;
  const password = parsed.password ? decodeURIComponent(parsed.password) : undefined;

  return {
    host: parsed.hostname,
    port,
    password,
    db: Number.isNaN(db) ? undefined : db
  };
};

export const getRedisConnection = (
  url: string = process.env.REDIS_URL ?? "redis://localhost:6379"
): RedisConnectionOptions => parseRedisUrl(url);
