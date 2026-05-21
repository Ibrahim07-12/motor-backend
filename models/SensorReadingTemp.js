import mongoose from "mongoose";

const sensorReadingTempSchema = new mongoose.Schema(
  {
    motorId: {
      type: String,
      required: true,
      default: "motor_main_shakeout",
      enum: ["motor_main_shakeout"],
    },
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
    timestampMs: {
      type: Number,
      required: true,
      index: true,
    },

    // 3-Phase Power Data (PZEM-004T)
    phase: {
      R: {
        voltage: { type: Number, default: 0 },
        current: { type: Number, default: 0 },
        power: { type: Number, default: 0 },
        powerFactor: { type: Number, default: 0 },
      },
      S: {
        voltage: { type: Number, default: 0 },
        current: { type: Number, default: 0 },
        power: { type: Number, default: 0 },
        powerFactor: { type: Number, default: 0 },
      },
      T: {
        voltage: { type: Number, default: 0 },
        current: { type: Number, default: 0 },
        power: { type: Number, default: 0 },
        powerFactor: { type: Number, default: 0 },
      },
    },

    // Aggregated 3-Phase Power
    power: {
      totalPower: { type: Number, default: 0 }, // Sum of R+S+T (Watts)
      totalCurrent: { type: Number, default: 0 }, // Sum of R+S+T (Amps)
    },

    // Other Sensors
    vibration: {
      type: Number,
      default: 0,
      min: 0,
      max: 150,
    }, // m/s² (Gravity Piezo)
    temperature: {
      type: Number,
      default: 0,
      min: -10,
      max: 150,
    }, // °C (MAX6675)
    noise: {
      type: Number,
      default: 0,
      min: 0,
      max: 130,
    }, // dB (INMP441)

    // Status & Metadata
    status: {
      type: String,
      enum: ["normal", "warning", "critical"],
      default: "normal",
    },

    // Mark as dry-run for tracking
    isDryRun: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: "sensorReadingsTemp",
  },
);

// TTL Index: Auto-delete dry-run data after 1 hour (3600 seconds)
sensorReadingTempSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 3600 }
);

// Compound Index for time-series queries
sensorReadingTempSchema.index({ motorId: 1, timestampMs: -1 });

export default mongoose.model("SensorReadingTemp", sensorReadingTempSchema);
