/**
 * Worker Pool Manager
 *
 * Manages a pool of background workers that process events asynchronously.
 * Handles:
 * - Spawning/terminating workers
 * - Health monitoring and auto-restart
 * - Graceful shutdown
 * - Load balancing
 */

import { startEventProcessor } from "./event-processor";
import { startAggregationProcessor } from "./aggregation-processor";
import { pubsub } from "../lib/redis";

export interface PoolConfig {
  eventWorkers: number; // Number of event processing workers
  aggregationWorkers: number; // Number of aggregation workers
  healthCheckInterval: number; // ms between health checks
  enableAutoRestart: boolean; // Auto-restart failed workers
}

const DEFAULT_CONFIG: PoolConfig = {
  eventWorkers: 4,
  aggregationWorkers: 1,
  healthCheckInterval: 30000, // 30 seconds
  enableAutoRestart: true,
};

interface WorkerInfo {
  id: string;
  type: "event" | "aggregation";
  promise: Promise<void>;
  controller?: AbortController;
  restarts: number;
  lastRestart: number;
  isRunning: boolean;
}

/**
 * Worker pool manager
 */
class WorkerPool {
  private workers: Map<string, WorkerInfo> = new Map();
  private config: PoolConfig;
  private isShuttingDown = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<PoolConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the worker pool
   */
  async start(): Promise<void> {
    if (this.workers.size > 0) {
      console.warn("Worker pool already started");
      return;
    }

    console.log(
      `Starting worker pool: ${this.config.eventWorkers} event workers, ${this.config.aggregationWorkers} aggregation workers`,
    );

    // Start event workers
    for (let i = 0; i < this.config.eventWorkers; i++) {
      this.spawnEventWorker(i);
    }

    // Start aggregation workers
    for (let i = 0; i < this.config.aggregationWorkers; i++) {
      this.spawnAggregationWorker(i);
    }

    // Start health check
    this.startHealthCheck();

    // Subscribe to worker events for monitoring
    await pubsub.subscribe(
      [
        "worker:event-processed",
        "worker:event-failed",
        "worker:batch-processed",
        "aggregation:metrics-calculated",
      ],
      (channel, message) => {
        this.handleWorkerEvent(channel, message);
      },
    );

    console.log("Worker pool started successfully");
  }

  /**
   * Spawn an event worker
   */
  private spawnEventWorker(index: number): void {
    const workerId = `event-worker-${index}`;

    if (this.workers.has(workerId)) {
      console.warn(`Worker ${workerId} already exists`);
      return;
    }

    const workerInfo: WorkerInfo = {
      id: workerId,
      type: "event",
      promise: this.createEventWorkerPromise(workerId),
      restarts: 0,
      lastRestart: Date.now(),
      isRunning: true,
    };

    this.workers.set(workerId, workerInfo);

    // Handle worker termination
    workerInfo.promise
      .catch((error) => {
        console.error(`Worker ${workerId} crashed:`, error);
        workerInfo.isRunning = false;

        if (this.config.enableAutoRestart && !this.isShuttingDown) {
          const backoffTime = Math.min(1000 * Math.pow(2, workerInfo.restarts), 30000);
          console.log(
            `Restarting ${workerId} in ${backoffTime}ms (restart #${workerInfo.restarts + 1})`,
          );

          setTimeout(() => {
            if (!this.isShuttingDown) {
              workerInfo.restarts++;
              workerInfo.lastRestart = Date.now();
              workerInfo.promise = this.createEventWorkerPromise(workerId);
              workerInfo.isRunning = true;

              workerInfo.promise.catch(() => {
                // Handled above
              });
            }
          }, backoffTime);
        }
      });
  }

  /**
   * Create event worker promise
   */
  private createEventWorkerPromise(workerId: string): Promise<void> {
    return startEventProcessor(workerId);
  }

  /**
   * Spawn an aggregation worker
   */
  private spawnAggregationWorker(index: number): void {
    const workerId = `aggregation-worker-${index}`;

    if (this.workers.has(workerId)) {
      console.warn(`Worker ${workerId} already exists`);
      return;
    }

    const workerInfo: WorkerInfo = {
      id: workerId,
      type: "aggregation",
      promise: this.createAggregationWorkerPromise(workerId),
      restarts: 0,
      lastRestart: Date.now(),
      isRunning: true,
    };

    this.workers.set(workerId, workerInfo);

    // Handle worker termination
    workerInfo.promise
      .catch((error) => {
        console.error(`Worker ${workerId} crashed:`, error);
        workerInfo.isRunning = false;

        if (this.config.enableAutoRestart && !this.isShuttingDown) {
          const backoffTime = Math.min(1000 * Math.pow(2, workerInfo.restarts), 30000);
          console.log(
            `Restarting ${workerId} in ${backoffTime}ms (restart #${workerInfo.restarts + 1})`,
          );

          setTimeout(() => {
            if (!this.isShuttingDown) {
              workerInfo.restarts++;
              workerInfo.lastRestart = Date.now();
              workerInfo.promise = this.createAggregationWorkerPromise(workerId);
              workerInfo.isRunning = true;

              workerInfo.promise.catch(() => {
                // Handled above
              });
            }
          }, backoffTime);
        }
      });
  }

  /**
   * Create aggregation worker promise
   */
  private createAggregationWorkerPromise(workerId: string): Promise<void> {
    return startAggregationProcessor(workerId);
  }

  /**
   * Start periodic health checks
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  /**
   * Perform health check on all workers
   */
  private performHealthCheck(): void {
    let totalWorkers = 0;
    let runningWorkers = 0;
    let failedWorkers = 0;

    for (const worker of this.workers.values()) {
      totalWorkers++;
      if (worker.isRunning) {
        runningWorkers++;
      } else {
        failedWorkers++;
      }
    }

    const status = `Workers: ${runningWorkers}/${totalWorkers} running, ${failedWorkers} failed`;

    if (failedWorkers > 0) {
      console.warn(`[Health Check] ${status}`);
    } else {
      console.log(`[Health Check] ${status}`);
    }
  }

  /**
   * Handle worker events
   */
  private handleWorkerEvent(channel: string, message: unknown): void {
    // Log worker events for monitoring
    console.debug(`[Worker Event] ${channel}:`, message);
  }

  /**
   * Get worker status
   */
  getStatus(): {
    totalWorkers: number;
    runningWorkers: number;
    workers: Array<{
      id: string;
      type: string;
      running: boolean;
      restarts: number;
    }>;
  } {
    const workers = Array.from(this.workers.values()).map((w) => ({
      id: w.id,
      type: w.type,
      running: w.isRunning,
      restarts: w.restarts,
    }));

    const runningWorkers = workers.filter((w) => w.running).length;

    return {
      totalWorkers: workers.length,
      runningWorkers,
      workers,
    };
  }

  /**
   * Gracefully shutdown worker pool
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      console.warn("Shutdown already in progress");
      return;
    }

    this.isShuttingDown = true;
    console.log("Shutting down worker pool...");

    // Stop health check
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Give workers time to finish current work
    const gracefulTimeout = 30000; // 30 seconds
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        console.warn("Graceful shutdown timeout, terminating workers");
        resolve();
      }, gracefulTimeout);
    });

    // Wait for workers to complete or timeout
    const workerPromises = Array.from(this.workers.values()).map(
      (w) => w.promise,
    );

    try {
      await Promise.race([Promise.all(workerPromises), timeoutPromise]);
    } catch (error) {
      console.error("Error during graceful shutdown:", error);
    }

    this.workers.clear();
    console.log("Worker pool shutdown complete");
  }

  /**
   * Get worker config
   */
  getConfig(): PoolConfig {
    return { ...this.config };
  }
}

// Global pool instance
let poolInstance: WorkerPool | null = null;

/**
 * Get or create worker pool
 */
export function getWorkerPool(
  config?: Partial<PoolConfig>,
): WorkerPool {
  if (!poolInstance) {
    poolInstance = new WorkerPool(config);
  }
  return poolInstance;
}

/**
 * Start global worker pool
 */
export async function startWorkers(config?: Partial<PoolConfig>): Promise<void> {
  const pool = getWorkerPool(config);
  await pool.start();
}

/**
 * Stop global worker pool
 */
export async function stopWorkers(): Promise<void> {
  if (poolInstance) {
    await poolInstance.shutdown();
    poolInstance = null;
  }
}

/**
 * Get pool status
 */
export function getPoolStatus() {
  return poolInstance?.getStatus() || {
    totalWorkers: 0,
    runningWorkers: 0,
    workers: [],
  };
}

export { WorkerPool };
