import { Hono } from "hono";
import { HomePage } from "../views/pages/index";

const routes = new Hono();

routes.get("/", (c) => {
  return c.render(<HomePage />, { title: "Home - Real-Time Analytics" });
});

export default routes;
