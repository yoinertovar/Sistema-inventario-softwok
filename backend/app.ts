import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import storageRouter from "./routes/storage";
import aiRouter from "./routes/ai";
import authRouter from "./routes/auth.routes";
import usersRouter from "./routes/users.routes";
import productsRouter from "./routes/products.routes";
import clientsRouter from "./routes/clients.routes";
import salesRouter from "./routes/sales.routes";
import suppliersRouter from "./routes/suppliers.routes";
import financeRouter from "./routes/finance.routes";
import dashboardRouter from "./routes/dashboard.routes";
import { PORT } from "./config";

export async function createApp() {
  const app = express();

  // Middleware for body parsing
  app.use(express.json({ limit: "10mb" }));

  // API Routes
  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/clients", clientsRouter);
  app.use("/api/sales", salesRouter);
  app.use("/api/suppliers", suppliersRouter);
  app.use("/api/finance", financeRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/storage", storageRouter);
  app.use("/api", aiRouter);


  // Vite middleware for development or Static Assets for Production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  return app;
}
