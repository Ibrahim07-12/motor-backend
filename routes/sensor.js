import express from "express";
import SensorReading from "../models/SensorReading.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// POST /api/sensor/upload - Receive data from ESP32
router.post("/upload", async (req, res) => {
  try {
    const {
      motorId,
      timestamp,
      timestampMs,
      phase,
      vibration,
      temperature,
      noise,
    } = req.body;

    // Validate required fields
    if (!motorId || !timestampMs || !phase) {
      return res.status(400).json({
        error: "Missing required fields: motorId, timestampMs, phase",
      });
    }

    // Calculate aggregated power (sum of 3-phase)
    const totalPower =
      (phase.R?.power || 0) + (phase.S?.power || 0) + (phase.T?.power || 0);
    const totalCurrent =
      (phase.R?.current || 0) +
      (phase.S?.current || 0) +
      (phase.T?.current || 0);

    // Create sensor reading
    const reading = new SensorReading({
      motorId,
      timestamp: new Date(timestampMs),
      timestampMs,
      phase,
      power: {
        totalPower,
        totalCurrent,
      },
      vibration,
      temperature,
      noise,
      status: "normal",
    });

    await reading.save();

    res.status(201).json({
      message: "Sensor data saved successfully",
      data: reading,
    });
  } catch (error) {
    console.error("Error saving sensor data:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/sensor/latest - Get latest reading (for real-time dashboard)
router.get("/latest", authenticateToken, async (req, res) => {
  try {
    const motorId = req.query.motorId || "motor_main_shakeout";

    const latest = await SensorReading.findOne({ motorId })
      .sort({ timestampMs: -1 })
      .lean();

    if (!latest) {
      return res.status(404).json({ error: "No readings found" });
    }

    res.json({
      message: "Latest reading retrieved",
      data: latest,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
