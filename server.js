import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import mongoose from "mongoose";

import authRoutes from "./routes/auth.js";
import sensorRoutes from "./routes/sensor.js";
import dataRoutes from "./routes/data.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",") || ["http://localhost:3000"],
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
const connectMongoDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✓ MongoDB connected");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

connectMongoDB();

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/sensor", sensorRoutes);
app.use("/api/data", dataRoutes);

// Health check
app.get("/", (req, res) => {
  res.json({ status: "Motor Monitoring Backend is running ✓" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Backend server running on http://0.0.0.0:${PORT}`);
  console.log(`📊 MongoDB: ${process.env.MONGODB_URI?.split("@")[1]}`);
  console.log(`🌐 CORS: ${process.env.CORS_ORIGIN}\n`);
});

export default app;
