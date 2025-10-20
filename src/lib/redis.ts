import { Redis } from "bun:redis";

let redisClient: Redis | null = null;
let pubsubConnections: Map<string, (message: string) => void> = new Map();

/**
 * Get or create a Redis client connection
 */
export function getRedis(): Redis {
  if (!redisClient) {
    const host = process.env.REDIS_HOST || "localhost";
    const port = parseInt(process.env.REDIS_PORT || "6379");

    redisClient = new Redis({
      host,
      port,
      lazyConnect: false,
    });

    // Handle connection errors
    redisClient.on("error", (err) => {
      console.error("Redis connection error:", err);
    });

    redisClient.on("close", () => {
      console.log("Redis connection closed");
      redisClient = null;
    });
  }

  return redisClient;
}

/**
 * Queue operations - uses Redis lists as FIFO queue
 */
export const queue = {
  /**
   * Enqueue an event for processing
   * Uses LPUSH to add to the head of the queue
   */
  async enqueue(queueName: string, event: unknown): Promise<number> {
    const redis = getRedis();
    const serialized = JSON.stringify(event);
    return redis.lpush(queueName, serialized);
  },

  /**
   * Dequeue events for processing
   * Uses RPOP to remove from the tail (FIFO)
   * Returns null if queue is empty
   */
  async dequeue(queueName: string): Promise<unknown | null> {
    const redis = getRedis();
    const serialized = await redis.rpop(queueName);

    if (!serialized) return null;

    try {
      return JSON.parse(serialized);
    } catch (err) {
      console.error("Failed to parse dequeued event:", err);
      return null;
    }
  },

  /**
   * Get queue length without removing items
   */
  async getLength(queueName: string): Promise<number> {
    const redis = getRedis();
    return redis.llen(queueName);
  },

  /**
   * Get items from queue without removing them (for inspection)
   */
  async peek(queueName: string, count: number = 10): Promise<unknown[]> {
    const redis = getRedis();
    const items = await redis.lrange(queueName, 0, count - 1);

    return items
      .map((item) => {
        try {
          return JSON.parse(item);
        } catch {
          return null;
        };
      })
      .filter((item) => item !== null);
  },

  /**
   * Clear the entire queue
   */
  async clear(queueName: string): Promise<number> {
    const redis = getRedis();
    return redis.del(queueName);
  },

  /**
   * Batch dequeue - get up to N items at once
   */
  async dequeueBatch(queueName: string, count: number): Promise<unknown[]> {
    const redis = getRedis();
    const items: unknown[] = [];

    for (let i = 0; i < count; i++) {
      const serialized = await redis.rpop(queueName);
      if (!serialized) break;

      try {
        items.push(JSON.parse(serialized));
      } catch (err) {
        console.error("Failed to parse batch item:", err);
      }
    }

    return items;
  },
};

/**
 * Pub/Sub operations - for real-time updates
 */
export const pubsub = {
  /**
   * Publish a message to a channel
   */
  async publish(channel: string, message: unknown): Promise<number> {
    const redis = getRedis();
    const serialized = JSON.stringify(message);
    return redis.publish(channel, serialized);
  },

  /**
   * Subscribe to a channel and call handler for each message
   * Note: This creates a separate Redis connection for subscriptions
   */
  async subscribe(
    channels: string[],
    handler: (channel: string, message: unknown) => void,
  ): Promise<void> {
    // Create a new Redis client specifically for pub/sub
    // (can't reuse main client as it gets blocked)
    const host = process.env.REDIS_HOST || "localhost";
    const port = parseInt(process.env.REDIS_PORT || "6379");

    const subscriber = new Redis({
      host,
      port,
      lazyConnect: false,
    });

    subscriber.on("message", (channel, message) => {
      try {
        const parsed = JSON.parse(message);
        handler(channel, parsed);
      } catch (err) {
        console.error("Failed to parse pub/sub message:", err);
      }
    });

    subscriber.on("error", (err) => {
      console.error("Redis subscriber error:", err);
    });

    // Subscribe to channels
    await subscriber.subscribe(...channels);

    // Store subscriber reference for cleanup
    const key = `subscriber:${channels.join(",")}`;
    pubsubConnections.set(key, () => subscriber.disconnect());
  },

  /**
   * Unsubscribe from a channel
   */
  async unsubscribe(channels: string[]): Promise<void> {
    const key = `subscriber:${channels.join(",")}`;
    const cleanup = pubsubConnections.get(key);
    if (cleanup) {
      cleanup();
      pubsubConnections.delete(key);
    }
  },
};

/**
 * Cache operations - simple key-value caching
 */
export const cache = {
  /**
   * Set a key with optional TTL (in seconds)
   */
  async set(
    key: string,
    value: unknown,
    ttl?: number,
  ): Promise<"OK" | null> {
    const redis = getRedis();
    const serialized = JSON.stringify(value);

    if (ttl) {
      return redis.setex(key, ttl, serialized);
    }

    return redis.set(key, serialized);
  },

  /**
   * Get a cached value
   */
  async get(key: string): Promise<unknown | null> {
    const redis = getRedis();
    const serialized = await redis.get(key);

    if (!serialized) return null;

    try {
      return JSON.parse(serialized);
    } catch (err) {
      console.error("Failed to parse cached value:", err);
      return null;
    }
  },

  /**
   * Delete a key
   */
  async delete(key: string): Promise<number> {
    const redis = getRedis();
    return redis.del(key);
  },

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<number> {
    const redis = getRedis();
    return redis.exists(key);
  },

  /**
   * Get multiple keys at once
   */
  async getMany(keys: string[]): Promise<(unknown | null)[]> {
    const redis = getRedis();
    const values = await redis.mget(...keys);

    return values.map((val) => {
      if (!val) return null;
      try {
        return JSON.parse(val);
      } catch {
        return null;
      };
    });
  },

  /**
   * Set multiple keys at once
   */
  async setMany(keyValues: Record<string, unknown>): Promise<"OK" | null> {
    const redis = getRedis();
    const args: (string | number)[] = [];

    for (const [key, value] of Object.entries(keyValues)) {
      args.push(key, JSON.stringify(value));
    }

    return redis.mset(...args);
  },

  /**
   * Increment a numeric value
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    const redis = getRedis();
    return redis.incrby(key, amount);
  },

  /**
   * Decrement a numeric value
   */
  async decrement(key: string, amount: number = 1): Promise<number> {
    const redis = getRedis();
    return redis.decrby(key, amount);
  },

  /**
   * Clear all cached values (use with caution!)
   */
  async flushAll(): Promise<"OK" | null> {
    const redis = getRedis();
    return redis.flushall();
  },
};

/**
 * Hash operations - for structured data
 */
export const hash = {
  /**
   * Set a hash field
   */
  async set(
    key: string,
    field: string,
    value: unknown,
  ): Promise<number> {
    const redis = getRedis();
    const serialized = JSON.stringify(value);
    return redis.hset(key, field, serialized);
  },

  /**
   * Get a hash field
   */
  async get(key: string, field: string): Promise<unknown | null> {
    const redis = getRedis();
    const serialized = await redis.hget(key, field);

    if (!serialized) return null;

    try {
      return JSON.parse(serialized);
    } catch {
      return null;
    }
  },

  /**
   * Get all fields in a hash
   */
  async getAll(key: string): Promise<Record<string, unknown>> {
    const redis = getRedis();
    const values = await redis.hgetall(key);

    const result: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(values)) {
      try {
        result[field] = JSON.parse(value);
      } catch {
        result[field] = value;
      }
    }

    return result;
  },

  /**
   * Delete a hash field
   */
  async delete(key: string, field: string): Promise<number> {
    const redis = getRedis();
    return redis.hdel(key, field);
  },
};

/**
 * Connection management
 */
export async function closeRedis(): Promise<void> {
  // Close all pub/sub connections
  for (const cleanup of pubsubConnections.values()) {
    cleanup();
  }
  pubsubConnections.clear();

  // Close main connection
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

/**
 * Health check - verify Redis is accessible
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const redis = getRedis();
    const response = await redis.ping();
    return response === "PONG";
  } catch (err) {
    console.error("Redis health check failed:", err);
    return false;
  }
}
