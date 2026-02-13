import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import path from "path";

import authRoutes from "./routes/auth.routes.js";
import productRoutes from "./routes/product.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import couponRoutes from "./routes/coupon.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";

import { connectDB } from "./lib/db.js";

import dns from "node:dns/promises";

dotenv.config(); // read the content of .ENV file

const app = express();
const PORT = process.env.PORT || 5000;

// root of application
const __dirname = path.resolve();

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser()); // middle ware

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/analytics", analyticsRoutes);

//console.log(await dns.getServers());
//dns.setServers(["1.1.1.1"]);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "/frontend/dist")));

  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "frontend", "dist", "index.html"));
  });
}

app.listen(PORT, () => {
  console.log("server is running on port:" + PORT);
  connectDB();
});
