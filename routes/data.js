import express from "express";
import SensorReading from "../models/SensorReading.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// GET /api/data/history - Get historical data (daily, weekly, monthly)
router.get("/history", authenticateToken, async (req, res) => {
  try {
    const { motorId = "motor_main_shakeout", mode = "daily", date } = req.query;

    if (!date) {
      return res
        .status(400)
        .json({ error: "Date parameter required (YYYY-MM-DD)" });
    }

    const selectedDate = new Date(`${date}T00:00:00Z`);

    let startDate,
      endDate,
      aggregationStages = [];

    if (mode === "daily") {
      // Daily: hourly aggregation
      startDate = new Date(selectedDate);
      endDate = new Date(selectedDate);
      endDate.setDate(endDate.getDate() + 1);

      aggregationStages = [
        {
          $match: {
            motorId,
            timestampMs: {
              $gte: startDate.getTime(),
              $lt: endDate.getTime(),
            },
          },
        },
        {
          $group: {
            _id: {
              $toDate: {
                $multiply: [
                  { $floor: { $divide: ["$timestampMs", 3600000] } },
                  3600000,
                ],
              },
            },
            vibration: { $avg: "$vibration" },
            temperature: { $avg: "$temperature" },
            power: { $avg: "$power.totalPower" },
            noise: { $avg: "$noise" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ];
    } else if (mode === "weekly") {
      // Weekly: daily aggregation for 7 days
      startDate = new Date(selectedDate);
      startDate.setDate(startDate.getDate() - 6);
      endDate = new Date(selectedDate);
      endDate.setDate(endDate.getDate() + 1);

      aggregationStages = [
        {
          $match: {
            motorId,
            timestampMs: {
              $gte: startDate.getTime(),
              $lt: endDate.getTime(),
            },
          },
        },
        {
          $group: {
            _id: {
              $toDate: {
                $multiply: [
                  { $floor: { $divide: ["$timestampMs", 86400000] } },
                  86400000,
                ],
              },
            },
            vibration: { $avg: "$vibration" },
            temperature: { $avg: "$temperature" },
            power: { $avg: "$power.totalPower" },
            noise: { $avg: "$noise" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ];
    } else if (mode === "monthly") {
      // Monthly: daily aggregation for the whole month
      startDate = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        1,
      );
      endDate = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth() + 1,
        1,
      );

      aggregationStages = [
        {
          $match: {
            motorId,
            timestampMs: {
              $gte: startDate.getTime(),
              $lt: endDate.getTime(),
            },
          },
        },
        {
          $group: {
            _id: {
              $toDate: {
                $multiply: [
                  { $floor: { $divide: ["$timestampMs", 86400000] } },
                  86400000,
                ],
              },
            },
            vibration: { $avg: "$vibration" },
            temperature: { $avg: "$temperature" },
            power: { $avg: "$power.totalPower" },
            noise: { $avg: "$noise" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ];
    }

    const results = await SensorReading.aggregate(aggregationStages);

    res.json({
      message: `Historical data retrieved (${mode} mode)`,
      motorId,
      mode,
      date,
      count: results.length,
      data: results.map((item) => ({
        timestamp: item._id,
        vibration: parseFloat(item.vibration.toFixed(2)),
        temperature: parseFloat(item.temperature.toFixed(2)),
        power: parseFloat(item.power.toFixed(0)),
        noise: parseFloat(item.noise.toFixed(2)),
        readings: item.count,
      })),
    });
  } catch (error) {
    console.error("Error fetching history:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/data/export - Export data as CSV
router.get("/export", authenticateToken, async (req, res) => {
  try {
    const { motorId = "motor_main_shakeout", startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "startDate and endDate required (YYYY-MM-DD)" });
    }

    const start = new Date(`${startDate}T00:00:00Z`).getTime();
    const end = new Date(`${endDate}T23:59:59Z`).getTime();

    const data = await SensorReading.find({
      motorId,
      timestampMs: { $gte: start, $lte: end },
    })
      .sort({ timestampMs: 1 })
      .lean();

    if (data.length === 0) {
      return res
        .status(404)
        .json({ error: "No data found for this date range" });
    }

    // Generate CSV
    let csv =
      "Timestamp,Voltage_R,Voltage_S,Voltage_T,Current_R,Current_S,Current_T,Power_R,Power_S,Power_T,Total_Power,Vibration,Temperature,Noise\n";

    data.forEach((row) => {
      csv += `${new Date(row.timestampMs).toISOString()},${row.phase.R.voltage},${row.phase.S.voltage},${row.phase.T.voltage},${row.phase.R.current},${row.phase.S.current},${row.phase.T.current},${row.phase.R.power},${row.phase.S.power},${row.phase.T.power},${row.power.totalPower},${row.vibration},${row.temperature},${row.noise}\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=motor_data_${startDate}_${endDate}.csv`,
    );
    res.send(csv);
  } catch (error) {
    console.error("Error exporting data:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
