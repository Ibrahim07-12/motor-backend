import mongoose from "mongoose";
import dotenv from "dotenv";
import SensorReading from "./models/SensorReading.js";

dotenv.config();

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not configured in .env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('✓ Connected to MongoDB');

  const unsetFields = {
    'phase.R.voltage': "",
    'phase.R.current': "",
    'phase.R.powerFactor': "",
    'phase.S.voltage': "",
    'phase.S.current': "",
    'phase.S.powerFactor': "",
    'phase.T.voltage': "",
    'phase.T.current': "",
    'phase.T.powerFactor': "",
    'power': ""
  };

  const res = await SensorReading.updateMany({}, { $unset: unsetFields });
  console.log(`Matched: ${res.matchedCount}, Modified: ${res.modifiedCount}`);

  const remaining = await SensorReading.countDocuments({
    $or: [
      { 'phase.R.voltage': { $exists: true } },
      { 'phase.S.voltage': { $exists: true } },
      { 'phase.T.voltage': { $exists: true } },
      { 'power': { $exists: true } }
    ]
  });

  console.log(`Documents still containing removed fields: ${remaining}`);

  await mongoose.disconnect();
  console.log('✓ Migration completed');
}

run().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
