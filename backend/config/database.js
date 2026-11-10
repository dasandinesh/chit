const mongoose = require('mongoose');
module.exports = async () => {
  if (!process.env.DB_LOCAL_URL) throw new Error('DB_LOCAL_URL is not configured');
  await mongoose.connect(process.env.DB_LOCAL_URL, { serverSelectionTimeoutMS: 5000 });
  console.log('MongoDB connected');
};
