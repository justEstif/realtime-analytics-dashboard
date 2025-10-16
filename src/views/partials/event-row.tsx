import type { FC } from "hono/jsx";
import type { Event } from "../../db/schema";

interface EventRowProps {
  event: Event;
}

/**
 * Format a timestamp as relative time (e.g., "2m ago") or absolute time if older
 */
function formatTimestamp(timestamp: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - timestamp.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  // Fallback to formatted date
  return timestamp.toLocaleString();
}

/**
 * Truncate metadata for display
 */
function formatMetadata(metadata: Record<string, unknown>): string {
  const str = JSON.stringify(metadata);
  if (str.length <= 100) return str;
  return str.substring(0, 97) + "...";
}

/**
 * Get badge color based on event type
 */
function getBadgeColor(eventType: string): string {
  const colors: Record<string, string> = {
    page_view: "badge-primary",
    click: "badge-secondary",
    form_submit: "badge-accent",
    error: "badge-error",
    custom: "badge-info",
  };
  return colors[eventType] || "badge-ghost";
}

export const EventRow: FC<EventRowProps> = ({ event }) => {
  const badgeColor = getBadgeColor(event.eventType);
  const formattedTime = formatTimestamp(event.timestamp);
  const formattedMetadata = formatMetadata(event.metadata);

  return (
    <>
      {/* Desktop: Table Row */}
      <tr class="hidden md:table-row hover">
        <td>
          <span class={`badge ${badgeColor}`}>{event.eventType}</span>
        </td>
        <td>
          <span class="text-sm" title={event.timestamp.toISOString()}>
            {formattedTime}
          </span>
        </td>
        <td>
          <code class="text-xs">{formattedMetadata}</code>
        </td>
      </tr>

      {/* Mobile: Card */}
      <div class="card bg-base-100 shadow-sm mb-2 md:hidden">
        <div class="card-body p-4">
          <div class="flex items-center justify-between mb-2">
            <span class={`badge ${badgeColor}`}>{event.eventType}</span>
            <span class="text-xs text-base-content/60">{formattedTime}</span>
          </div>
          <code class="text-xs break-all">{formattedMetadata}</code>
        </div>
      </div>
    </>
  );
};
