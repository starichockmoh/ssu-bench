import 'dotenv/config';

const toNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const appConfig = {
  port: toNumber(process.env.PORT, 3000),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: toNumber(process.env.DB_PORT, 5432),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'ssu_bench',
  },
  timeouts: {
    keepAlive: toNumber(process.env.HTTP_KEEP_ALIVE_TIMEOUT, 65000),
    headers: toNumber(process.env.HTTP_HEADERS_TIMEOUT, 66000),
    request: toNumber(process.env.HTTP_REQUEST_TIMEOUT, 30000),
  },
};
