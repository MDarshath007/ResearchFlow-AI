// Idempotent seed script for Learning Modules.
// Usage (from server/): node seeds/seedLearningModules.js
// - First run creates the 5 modules; later runs UPDATE the same documents
//   (matched by slug) instead of creating duplicates.
// - Never touches users, projects, or progress. Never prints connection strings.

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from '../config/db.js';
import LearningModule from '../models/LearningModule.js';
import learningModules from './learningContent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const seedLearningModules = async () => {
  await connectDB();
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Seed aborted: could not connect to MongoDB.');
  }

  // Validate all content before touching the collection.
  for (const moduleContent of learningModules) {
    await new LearningModule(moduleContent).validate();
  }

  let created = 0;
  let updated = 0;
  let cleared = 0;
  const clearCollection = process.argv.includes('--clear');

  if (clearCollection) {
    const result = await LearningModule.deleteMany({
      slug: { $in: learningModules.map((moduleContent) => moduleContent.slug) },
    });
    cleared = result.deletedCount || 0;
    await LearningModule.insertMany(learningModules, { ordered: true });
    created = learningModules.length;
  } else {
    const operations = learningModules.map((moduleContent) => ({
      replaceOne: {
        filter: { slug: moduleContent.slug },
        replacement: moduleContent,
        upsert: true,
      },
    }));

    const result = await LearningModule.bulkWrite(operations, { ordered: true });
    created = result.upsertedCount || 0;
    updated = result.modifiedCount || 0;
  }

  const total = await LearningModule.countDocuments({ slug: { $in: learningModules.map((m) => m.slug) } });
  console.log(
    `Learning modules seed complete: ${cleared} cleared, ${created} created, ${updated} updated, ${total} total in DB.`
  );
  return { cleared, created, updated, total };
};

const run = async () => {
  await seedLearningModules();
  await mongoose.disconnect();
  process.exit(0);
};

// Execute when invoked directly from CLI
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('seeds/seedLearningModules.js')) {
  run().catch((err) => {
    console.error(`Seed failed: ${err.message}`);
    process.exit(1);
  });
}

export { learningModules };
export default seedLearningModules;
