import type { FC } from "hono/jsx";
import type { Event } from "../../db/schema";
import { EventRow } from "./event-row";
import { LoadingSkeleton } from "./loading-skeleton";

interface EventListProps {
  events: Event[];
  showHeader?: boolean;
  isLoading?: boolean;
}

export const EventList: FC<EventListProps> = ({
  events,
  showHeader = true,
  isLoading = false,
}) => {
  // Empty state
  if (!isLoading && events.length === 0) {
    return (
      <div class="alert alert-info">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          class="stroke-current shrink-0 w-6 h-6"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          ></path>
        </svg>
        <div>
          <h3 class="font-bold">No events yet</h3>
          <div class="text-xs">
            Start sending events to see them here. POST to{" "}
            <code>/api/events</code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div class="w-full">
      {/* Desktop: Table View */}
      <div class="hidden md:block overflow-x-auto">
        <table class="table table-zebra w-full">
          {showHeader && (
            <thead>
              <tr>
                <th>Event Type</th>
                <th>Timestamp</th>
                <th>Metadata</th>
              </tr>
            </thead>
          )}
          <tbody>
            {isLoading ? (
              <LoadingSkeleton type="table" count={5} />
            ) : (
              events.map((event) => <EventRow key={event.id} event={event} />)
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile: Card View */}
      <div class="md:hidden space-y-2">
        {isLoading ? (
          <div class="text-center py-8">
            <span class="loading loading-spinner loading-lg"></span>
          </div>
        ) : (
          events.map((event) => <EventRow key={event.id} event={event} />)
        )}
      </div>
    </div>
  );
};
