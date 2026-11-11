import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./lib/env";
import { withUser } from "./middleware/auth.middleware";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";
import { authRouter } from "./routes/auth.routes";
import { peopleRouter } from "./routes/people.routes";
import { erasureRouter } from "./routes/erasure.routes";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(withUser);

app.get("/", (_req, res) =>
  res.json({ name: "Kinweb API", ok: true, docs: "This is the API. The app lives at the client URL; endpoints are under /api." })
);
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/people", peopleRouter);
app.use("/api/erasure", erasureRouter);

// Unknown /api paths get JSON, not Express's default HTML "Cannot GET" page,
// so the client's fetch wrapper can surface a readable error.
app.use("/api", notFoundHandler);

app.use(errorHandler);

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Kinweb API on :${env.port}`);
});
