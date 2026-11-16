import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sequelize, { connectPostgres } from './config/postgres.js';
import mongoose, { connectMongo } from './config/mongo.js';
import redisClient, { connectRedis } from './config/redis.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Endpoint de diagnóstico para verificar las 3 bases de datos simultáneamente
app.get('/api/health', async (req, res) => {
  const redisStatus = redisClient.status === 'ready' ? 'connected' : redisClient.status;
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  let postgresStatus = 'disconnected';

  try {
    await sequelize.authenticate();
    postgresStatus = 'connected';
  } catch {
    postgresStatus = 'disconnected';
  }

  res.json({
    status: 'OK',
    service: 'CervantesBank API',
    databases: {
      postgresql: postgresStatus,
      mongodb: mongoStatus,
      redis: redisStatus,
    },
    timestamp: new Date().toISOString(),
  });
});

const startServer = async () => {
  try {
    await connectPostgres();
    await connectMongo();
    await connectRedis();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('No se pudo iniciar el servidor por fallo en base de datos.');
    process.exit(1);
  }
};

startServer();