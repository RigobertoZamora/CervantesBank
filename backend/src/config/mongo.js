import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI =
  process.env.MONGO_URI ||
  'mongodb://wallet_admin:wallet_secret@localhost:27017/digital_wallet_docs?authSource=admin';

export const connectMongo = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB conectado correctamente.');
  } catch (error) {
    console.error('❌ Error al conectar con MongoDB:', error.message);
    throw error;
  }
};

export default mongoose;