import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { connectPostgres } from './config/postgres.js';
import { connectMongo } from './config/mongo.js';
import redisClient from './config/redis.js';
import usuariosRoutes from './routes/usuariosRoutes.js';

import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Security Headers (Punto 18)
app.use(helmet());

// 2. CORS restringido al origen del frontend (Punto 9 y 18)
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true,
  })
);

// 3. Límite de tamaño de payload para evitar ataques DoS por JSON gigantes
app.use(express.json({ limit: '20kb' }));

app.use(cookieParser());

// 4. Rate Limiting global y anti-bots en creación de cuentas (Puntos 11 y 12)
const limiterGeneral = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones desde esta IP. Intenta de nuevo en 15 minutos.' },
});

const limiterRegistro = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10, // Máximo 10 cuentas creadas por hora por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Límite de registros alcanzado por seguridad. Intenta más tarde.' },
});

app.use('/api', limiterGeneral);
app.post('/api/usuarios', limiterRegistro);
app.use('/api/auth', authRoutes);

// Healthcheck
app.get('/api/health', async (req, res) => {
  const redisPing = await redisClient.ping().catch(() => 'disconnected');
  res.status(200).json({
    status: 'OK',
    service: 'CervantesBank Core API',
    databases: {
      postgresql: 'connected',
      mongodb: 'connected',
      redis: redisPing === 'PONG' ? 'connected' : 'disconnected',
    },
  });
});

// Rutas
app.use('/api/usuarios', usuariosRoutes);

const startServer = async () => {
  try {
    await connectPostgres();
    await connectMongo();
    app.listen(PORT, () => {
      console.log(`🚀 Servidor seguro corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Error crítico al iniciar el servidor:', error.message);
    process.exit(1);
  }
};

startServer();