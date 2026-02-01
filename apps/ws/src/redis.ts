import { Redis } from "ioredis";

let redisClient: Redis | undefined;

export function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL!, {
      tls: {}, 
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