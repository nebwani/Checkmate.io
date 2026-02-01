import { Redis } from "ioredis";

let redisClient: Redis | undefined;

export function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: process.env.REDIS_HOST ?? "127.0.0.1",
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD ?? "",
      lazyConnect: true,
    });

    redisClient.on("connect", () => {
      console.log("Redis connected");
    });

    redisClient.on("error", (err: Error) => {
      console.error("Redis error:", err);
    });
  }

  return redisClient;
}