/**
 * Load Testing Suite for Event Ingestion
 *
 * Tests the queue-based event ingestion pipeline under load:
 * - Submits events at various rates (target: 1000+ events/min)
 * - Monitors queue depth, latency, and worker throughput
 * - Tracks failure rates and error scenarios
 * - Generates detailed performance report
 */

interface LoadTestConfig {
  baseUrl: string;
  targetRatePerSec: number; // Events per second
  durationSec: number; // Test duration in seconds
  eventTypes: string[];
  workers: number;
}

interface MetricsSnapshot {
  timestamp: Date;
  eventsSubmitted: number;
  eventsFailed: number;
  latencies: number[];
  queueLength: number;
  processingRate: number;
}

const DEFAULT_CONFIG: LoadTestConfig = {
  baseUrl: "http://localhost:3000",
  targetRatePerSec: 20, // ~1200 events/min
  durationSec: 60,
  eventTypes: [
    "page_view",
    "button_click",
    "form_submit",
    "error",
    "custom_event",
  ],
  workers: 1,
};

/**
 * Generate a random event
 */
function generateEvent(): {
  event_type: string;
  metadata: Record<string, unknown>;
} {
  const eventTypes = [
    "page_view",
    "button_click",
    "form_submit",
    "error",
    "custom_event",
  ];
  const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];

  return {
    event_type: eventType,
    metadata: {
      userId: `user_${Math.floor(Math.random() * 1000)}`,
      sessionId: `session_${Math.floor(Math.random() * 100)}`,
      timestamp: new Date().toISOString(),
      customField: `value_${Math.random().toString(36).substring(7)}`,
    },
  };
}

/**
 * Submit a single event
 */
async function submitEvent(
  baseUrl: string,
): Promise<{ success: boolean; latency: number; error?: string }> {
  const startTime = Date.now();

  try {
    const event = generateEvent();

    const response = await fetch(`${baseUrl}/api/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          type: "events",
          attributes: event,
        },
      }),
    });

    const latency = Date.now() - startTime;

    if (response.ok || response.status === 202) {
      return { success: true, latency };
    } else {
      return {
        success: false,
        latency,
        error: `HTTP ${response.status}`,
      };
    }
  } catch (error) {
    const latency = Date.now() - startTime;
    return {
      success: false,
      latency,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get queue health
 */
async function getQueueHealth(
  baseUrl: string,
): Promise<{ queueLength: number; metrics: unknown } | null> {
  try {
    const response = await fetch(`${baseUrl}/api/health`);
    const data = (await response.json()) as {
      components?: { queueMetrics?: { currentQueueLength: number } };
    };

    const queueLength =
      data.components?.queueMetrics?.currentQueueLength || 0;

    return {
      queueLength,
      metrics: data,
    };
  } catch (error) {
    console.error("Failed to get queue health:", error);
    return null;
  }
}

/**
 * Run load test
 */
async function runLoadTest(config: Partial<LoadTestConfig> = {}): Promise<{
  success: boolean;
  report: {
    totalSubmitted: number;
    totalSuccessful: number;
    totalFailed: number;
    successRate: number;
    avgLatency: number;
    minLatency: number;
    maxLatency: number;
    p95Latency: number;
    p99Latency: number;
    throughput: number;
    finalQueueLength: number;
  };
}> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  console.log("🚀 Starting load test with config:");
  console.log(
    `   Target rate: ${finalConfig.targetRatePerSec} events/sec (~${finalConfig.targetRatePerSec * 60} events/min)`,
  );
  console.log(`   Duration: ${finalConfig.durationSec} seconds`);
  console.log(`   Base URL: ${finalConfig.baseUrl}\n`);

  let totalSubmitted = 0;
  let totalSuccessful = 0;
  let totalFailed = 0;
  const latencies: number[] = [];
  const snapshots: MetricsSnapshot[] = [];

  const startTime = Date.now();
  const endTime = startTime + finalConfig.durationSec * 1000;

  // Interval between events to reach target rate
  const intervalMs = Math.ceil(1000 / finalConfig.targetRatePerSec);

  let eventTimer: NodeJS.Timeout;
  let metricsTimer: NodeJS.Timeout;

  // Event submission loop
  let nextEventTime = startTime;

  await new Promise<void>((resolve) => {
    eventTimer = setInterval(async () => {
      const now = Date.now();

      if (now >= endTime) {
        clearInterval(eventTimer);
        clearInterval(metricsTimer);
        resolve();
        return;
      }

      // Submit event
      const result = await submitEvent(finalConfig.baseUrl);
      totalSubmitted++;

      if (result.success) {
        totalSuccessful++;
        latencies.push(result.latency);
      } else {
        totalFailed++;
        console.error(`Event failed: ${result.error}`);
      }

      // Progress indicator
      if (totalSubmitted % 100 === 0) {
        const elapsed = (now - startTime) / 1000;
        const rate = totalSubmitted / elapsed;
        console.log(
          `✓ ${totalSubmitted} events submitted (${rate.toFixed(1)} events/sec, success: ${totalSuccessful}, failed: ${totalFailed})`,
        );
      }
    }, intervalMs);

    // Metrics collection loop
    metricsTimer = setInterval(async () => {
      const now = Date.now();
      if (now >= endTime) return;

      const health = await getQueueHealth(finalConfig.baseUrl);

      if (health) {
        snapshots.push({
          timestamp: new Date(),
          eventsSubmitted: totalSubmitted,
          eventsFailed: totalFailed,
          latencies: [...latencies],
          queueLength: health.queueLength,
          processingRate:
            totalSuccessful / ((now - startTime) / 1000),
        });
      }
    }, 5000); // Collect metrics every 5 seconds
  });

  // Calculate statistics
  const sortedLatencies = latencies.sort((a, b) => a - b);
  const avgLatency =
    latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;
  const minLatency = sortedLatencies[0] || 0;
  const maxLatency = sortedLatencies[sortedLatencies.length - 1] || 0;
  const p95Latency = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0;
  const p99Latency = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] || 0;

  const totalTime = (Date.now() - startTime) / 1000;
  const throughput = totalSuccessful / totalTime;

  // Final queue check
  const finalHealth = await getQueueHealth(finalConfig.baseUrl);
  const finalQueueLength = finalHealth?.queueLength || 0;

  const successRate =
    totalSubmitted > 0 ? (totalSuccessful / totalSubmitted) * 100 : 0;

  const report = {
    totalSubmitted,
    totalSuccessful,
    totalFailed,
    successRate,
    avgLatency,
    minLatency,
    maxLatency,
    p95Latency,
    p99Latency,
    throughput,
    finalQueueLength,
  };

  return {
    success: successRate > 95 && finalQueueLength < 10000,
    report,
  };
}

/**
 * Print test report
 */
function printReport(
  report: Awaited<ReturnType<typeof runLoadTest>>["report"],
): void {
  console.log("\n📊 Load Test Report:");
  console.log("━".repeat(50));
  console.log(`Total Events Submitted:     ${report.totalSubmitted}`);
  console.log(`Successfully Processed:     ${report.totalSuccessful}`);
  console.log(`Failed:                     ${report.totalFailed}`);
  console.log(`Success Rate:               ${report.successRate.toFixed(2)}%`);
  console.log("\nLatency Metrics (ms):");
  console.log(`  Min:                      ${report.minLatency.toFixed(2)}`);
  console.log(`  Avg:                      ${report.avgLatency.toFixed(2)}`);
  console.log(`  P95:                      ${report.p95Latency.toFixed(2)}`);
  console.log(`  P99:                      ${report.p99Latency.toFixed(2)}`);
  console.log(`  Max:                      ${report.maxLatency.toFixed(2)}`);
  console.log("\nThroughput & Queue:");
  console.log(
    `  Processing Rate:          ${report.throughput.toFixed(2)} events/sec`,
  );
  console.log(`  Final Queue Length:       ${report.finalQueueLength}`);
  console.log("━".repeat(50));
}

/**
 * Main test runner
 */
async function main(): Promise<void> {
  try {
    // Test 1: Small load (10 sec, 100 events/sec = 1000 events)
    console.log("\n🧪 Test 1: Moderate Load (1000 events over 10 seconds)");
    console.log("=" .repeat(50));
    let result = await runLoadTest({
      durationSec: 10,
      targetRatePerSec: 100,
    });
    printReport(result.report);

    // Wait a bit between tests
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Test 2: Medium load (30 sec, 33 events/sec = 1000 events)
    console.log("\n🧪 Test 2: Medium Load (1000 events over 30 seconds)");
    console.log("=".repeat(50));
    result = await runLoadTest({
      durationSec: 30,
      targetRatePerSec: 33,
    });
    printReport(result.report);

    // Wait a bit between tests
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Test 3: High load (60 sec, 50 events/sec = 3000 events)
    console.log("\n🧪 Test 3: High Load (3000 events over 60 seconds)");
    console.log("=".repeat(50));
    result = await runLoadTest({
      durationSec: 60,
      targetRatePerSec: 50,
    });
    printReport(result.report);

    console.log(
      "\n✅ Load testing complete. Check the reports above for results.",
    );
  } catch (error) {
    console.error("❌ Load test failed:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  main().catch(console.error);
}

export { runLoadTest, generateEvent, submitEvent, getQueueHealth };
