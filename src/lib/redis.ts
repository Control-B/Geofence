import Redis from "ioredis";

let redis: Redis | undefined;

export function getRedis() {
  if (!process.env.REDIS_URL) {
    return null;
  }

  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: false
    });
  }

  return redis;
}

export async function incrementRateLimit(key: string, ttlSeconds = 60) {
  const client = getRedis();
  if (!client) return {count: 1, limited: false};

  const count = await client.incr(key);
  if (count === 1) await client.expire(key, ttlSeconds);

  return {count, limited: count > 30};
}