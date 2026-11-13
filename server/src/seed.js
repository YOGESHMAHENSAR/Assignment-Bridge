import mongoose from 'mongoose';
import env from './config/env.js';
import connectDB from './config/db.js';
import User from './models/User.js';

async function seed() {
  await connectDB();
  const { name, email, password } = env.admin;
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    console.log(`Admin already exists: ${existing.email}`);
  } else {
    await User.create({ name, email, password, role: 'admin' });
    console.log(`Admin created: ${email}  (password from ADMIN_PASSWORD in .env)`);
  }
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
