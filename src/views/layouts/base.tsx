import type { FC } from "hono/jsx";

interface BaseLayoutProps {
  title?: string;
  children?: any;
}

export const BaseLayout: FC<BaseLayoutProps> = ({
  title = "Real-Time Analytics Dashboard",
  children,
}) => {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <link href="/styles/output.css" rel="stylesheet" />
        <script src="https://cdn.jsdelivr.net/npm/htmx.org@2.0.7/dist/htmx.min.js"></script>
        <script src="https://unpkg.com/htmx.org@2.0.7/dist/ext/sse.js"></script>
      </head>
      <body>{children}</body>
    </html>
  );
};
