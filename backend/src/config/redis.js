import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://:redis_secret@localhost:6379';

const redisClient = new Redis(REDIS_URL, {
  lazyConnect: true,
});

redisClient.on('error', (err) => {
  console.error('❌ Error en cliente Redis:', err.message);
});

export const connectRedis = async () => {
  try {
    await redisClient.connect();
    const pong = await redisClient.ping();
    console.log(`✅ Redis conectado correctamente (${pong}).`);
  } catch (error) {
    console.error('❌ Error al conectar con Redis:', error.message);
    throw error;
  }
};

export default redisClient;