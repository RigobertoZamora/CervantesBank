import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const sequelize = new Sequelize(
  process.env.POSTGRES_DB || 'digital_wallet',
  process.env.POSTGRES_USER || 'wallet_admin',
  process.env.POSTGRES_PASSWORD || 'wallet_secret',
  {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT) || 5432,
    dialect: 'postgres',
    logging: false, // Evita saturar la terminal con el SQL crudo de cada consulta
  }
);

export const connectPostgres = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL conectado correctamente.');
  } catch (error) {
    console.error('❌ Error al conectar con PostgreSQL:', error.message);
    throw error;
  }
};

export default sequelize;