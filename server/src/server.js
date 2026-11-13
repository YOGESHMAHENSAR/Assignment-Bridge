import env from './config/env.js';
import connectDB from './config/db.js';
import app from './app.js';

async function start() {
  await connectDB();
  app.listen(env.port, () => {
    console.log(`API running on http://localhost:${env.port}`);
    console.log(
      `Payments: ${env.razorpayEnabled ? 'Razorpay' : env.mockPayments ? 'DEMO mode (no Razorpay keys)' : 'NOT CONFIGURED'}`
    );
    console.log(`Storage:  ${env.cloudinaryEnabled ? 'Cloudinary' : 'local disk (no Cloudinary keys)'}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
