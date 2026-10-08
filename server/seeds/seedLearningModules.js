// Idempotent seed script for Learning Modules.
// Usage (from server/): node seeds/seedLearningModules.js
// - First run creates the 5 modules; later runs UPDATE the same documents
//   (matched by slug) instead of creating duplicates.
// - Never touches users, projects, or progress. Never prints connection strings.

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import LearningModule from '../models/LearningModule.js';
import learningModules from './learningContent.js';

dotenv.config();

const run = async () => {
  await connectDB();
  if (mongoose.connection.readyState !== 1) {
    console.error('Seed aborted: could not connect to MongoDB.');
    process.exit(1);
  }

  let created = 0;
  let updated = 0;

  for (const mod of learningModules) {
    const existing = await LearningModule.findOne({ slug: mod.slug }).select('_id');
    if (existing) {
      // $set keeps _id/createdAt intact while refreshing content.
      await LearningModule.updateOne({ _id: existing._id }, { $set: mod });
      updated += 1;
    } else {
      await LearningModule.create(mod);
      created += 1;
    }
  }

  const total = await LearningModule.countDocuments({ slug: { $in: learningModules.map((m) => m.slug) } });
  console.log(`Learning modules seed complete: ${created} created, ${updated} updated, ${total} total in DB.`);

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error(`Seed failed: ${err.message}`);
  process.exit(1);
});
