import express from "express";
import SensorReading from "../models/SensorReading.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// POST /api/sensor/upload - Receive data from ESP32
router.post("/upload", async (req, res) => {
  try {
    const {
      motorId,
      timestampMs,
      phase,
      vibration,
      temperature,
      noise,
    } = req.body;
    const dryRun = req.query.dryRun === "1" || req.body.dryRun === true;

    // Validate required fields
    if (!motorId || !timestampMs || !phase) {
      return res.status(400).json({
        error: "Missing required fields: motorId, timestampMs, phase",
      });
    }

    // Use server-side receipt time so latest/history/weekly/monthly queries
    // stay consistent even if the ESP32 reboots and millis() resets.
    const serverTimestampMs = Date.now();
    const serverTimestamp = new Date(serverTimestampMs);

    // Calculate aggregated power (sum of 3-phase)
    const totalPower =
      (phase.R?.power || 0) + (phase.S?.power || 0) + (phase.T?.power || 0);

    // Always store to the permanent Atlas collection so dashboards,
    // history, weekly averages, and monthly averages all read the same data.
    const reading = new SensorReading({
      motorId,
      timestamp: serverTimestamp,
      timestampMs: serverTimestampMs,
      phase,
      power: {
        totalPower,
      },
      vibration,
      temperature,
      noise,
      status: "normal",
    });

    await reading.save();

    res.status(200).json({
      message: dryRun
        ? "Sensor data saved to permanent collection (dryRun request)"
        : "Sensor data saved successfully",
      data: reading,
      dryRun,
      savedTo: "permanent",
    });
  } catch (error) {
    console.error("Error saving sensor data:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/sensor/latest - Get latest reading (for real-time dashboard)
// NOTE: Temporarily unauthenticated for testing. Add authenticateToken back after testing complete.
router.get("/latest", async (req, res) => {
  try {
    const motorId = req.query.motorId || "motor_main_shakeout";

    // Read latest from the permanent Atlas collection.
    // Sort by server-side createdAt so rebooted ESP32s don't affect recency.
    let latest = await SensorReading.findOne({ motorId })
      .sort({ createdAt: -1 })
      .lean();

    if (latest) {
      return res.json({
        message: "Latest reading retrieved",
        data: latest,
        source: "permanent",
      });
    }

    return res.status(404).json({ error: "No readings found" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
