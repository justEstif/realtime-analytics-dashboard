import type { FC } from "hono/jsx";
import type { EventStatsResult } from "../../services/events";
import { StatsCard } from "./stats-card";
import { LoadingSkeleton } from "./loading-skeleton";

interface MetricsSectionProps {
  stats: EventStatsResult;
  isLoading?: boolean;
}

export const MetricsSection: FC<MetricsSectionProps> = ({
  stats,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <LoadingSkeleton type="stats" count={4} />
      </div>
    );
  }

  // Determine the top event type
  const topEventType =
    stats.byType.length > 0
      ? `${stats.byType[0].eventType} (${stats.byType[0].count})`
      : "N/A";

  return (
    <div
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      id="metrics-container"
    >
      <div id="total-events-stat">
        <StatsCard
          title="Total Events"
          value={stats.total.toLocaleString()}
          description="All time"
          valueColor="text-primary"
        />
      </div>

      <div id="today-events-stat">
        <StatsCard
          title="Events Today"
          value={stats.today.toLocaleString()}
          description={new Date().toLocaleDateString()}
          valueColor="text-secondary"
        />
      </div>

      <div id="events-per-min-stat">
        <StatsCard
          title="Events/Minute"
          value={stats.eventsPerMinute.toLocaleString()}
          description="Last 60 seconds"
          valueColor="text-accent"
        />
      </div>

      <div id="top-event-type-stat">
        <StatsCard
          title="Top Event Type"
          value={topEventType}
          description={`${stats.byType.length} unique types`}
          valueColor="text-info"
        />
      </div>
    </div>
  );
};
