import type { FC } from "hono/jsx";

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  valueColor?:
    | "text-primary"
    | "text-secondary"
    | "text-accent"
    | "text-info"
    | "text-success"
    | "text-warning"
    | "text-error";
  hx_get?: string;
  hx_trigger?: string;
  hx_swap?: string;
}

export const StatsCard: FC<StatsCardProps> = ({
  title,
  value,
  description,
  valueColor,
  hx_get,
  hx_trigger,
  hx_swap,
}) => {
  return (
    <div
      class="stats shadow"
      hx-get={hx_get}
      hx-trigger={hx_trigger}
      hx-swap={hx_swap}
    >
      <div class="stat">
        <div class="stat-title">{title}</div>
        <div class={`stat-value ${valueColor || ""}`}>{value}</div>
        {description && <div class="stat-desc">{description}</div>}
      </div>
    </div>
  );
};
