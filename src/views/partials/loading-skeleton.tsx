import type { FC } from "hono/jsx";

interface LoadingSkeletonProps {
  type: "stats" | "table";
  count?: number;
}

export const LoadingSkeleton: FC<LoadingSkeletonProps> = ({
  type,
  count = 1,
}) => {
  if (type === "stats") {
    return (
      <>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} class="stats shadow">
            <div class="stat">
              <div class="stat-title">
                <div class="skeleton h-4 w-20"></div>
              </div>
              <div class="stat-value">
                <div class="skeleton h-8 w-16"></div>
              </div>
              <div class="stat-desc">
                <div class="skeleton h-3 w-24"></div>
              </div>
            </div>
          </div>
        ))}
      </>
    );
  }

  // Table skeleton
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i}>
          <td>
            <div class="skeleton h-4 w-20"></div>
          </td>
          <td>
            <div class="skeleton h-4 w-32"></div>
          </td>
          <td>
            <div class="skeleton h-4 w-48"></div>
          </td>
        </tr>
      ))}
    </>
  );
};
