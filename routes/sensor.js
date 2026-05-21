import express from "express";
import SensorReading from "../models/SensorReading.js";
import SensorReadingTemp from "../models/SensorReadingTemp.js";
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
    const dryRun = req.query.dryRun === "1" || req.body.dryRun === true;

    // Validate required fields
    if (!motorId || !timestampMs || !phase) {
      return res.status(400).json({
        error: "Missing required fields: motorId, timestampMs, phase",
      });
    }

    // Calculate aggregated power (sum of 3-phase)
    const totalPower =
      (phase.R?.power || 0) + (phase.S?.power || 0) + (phase.T?.power || 0);

    // Create sensor reading (store per-phase power + totalPower)
    const reading = new SensorReading({
      motorId,
      timestamp: new Date(timestampMs),
      timestampMs,
      phase,
      power: {
        totalPower,
      },
      vibration,
      temperature,
      noise,
      status: "normal",
    });

    if (!dryRun) {
      await reading.save();

      res.status(201).json({
        message: "Sensor data saved successfully",
        data: reading,
      });
      return;
    }

    // DRY RUN: Save to temporary collection (auto-deletes after 1 hour)
    const tempReading = new SensorReadingTemp({
      motorId,
      timestamp: new Date(timestampMs),
      timestampMs,
      phase,
      power: {
        totalPower,
      },
      vibration,
      temperature,
      noise,
      status: "normal",
      isDryRun: true,
    });

    await tempReading.save();

    res.status(200).json({
      message: "Sensor data validated and saved to test collection (expires in 1 hour)",
      data: tempReading,
      dryRun: true,
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

    // Priority 1: Check temporary collection first (dry-run data that's fresh)
    // IMPORTANT: sort by server-side createdAt, not device timestampMs.
    // ESP32 timestampMs often uses millis() and resets after reboot,
    // which can make newer data look "older" if sorted by timestampMs.
    let latest = await SensorReadingTemp.findOne({ motorId })
      .sort({ createdAt: -1 })
      .lean();

    if (latest) {
      return res.json({
        message: "Latest reading retrieved (test/dry-run mode)",
        data: latest,
        source: "temporary",
      });
    }

    // Priority 2: Fall back to permanent collection if no temp data
    latest = await SensorReading.findOne({ motorId })
      .sort({ createdAt: -1 })
      .lean();

    if (!latest) {
      return res.status(404).json({ error: "No readings found" });
    }

    res.json({
      message: "Latest reading retrieved",
      data: latest,
      source: "permanent",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
