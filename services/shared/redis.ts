import Redis from "ioredis";

let redis: Redis | undefined;

export function getRedis() {
  if (!process.env.REDIS_URL) return null;
  if (!redis) redis = new Redis(process.env.REDIS_URL, {maxRetriesPerRequest: 1});
  return redis;
}

export async function incrementRateLimit(key: string, windowSeconds: number, limit = 20) {
  const client = getRedis();
  if (!client) return {limited: false, count: 0};
  const count = await client.incr(key);
  if (count === 1) await client.expire(key, windowSeconds);
  return {limited: count > limit, count};
}
