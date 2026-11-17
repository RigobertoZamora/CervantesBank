import { DataTypes } from 'sequelize';
import sequelize from '../../config/postgres.js';

const Usuario = sequelize.define('Usuario', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING(50), allowNull: false },
  apellidoUno: { type: DataTypes.STRING(50), allowNull: false },
  apellidoDos: { type: DataTypes.STRING(50), allowNull: true },
  rfc: { type: DataTypes.STRING(14), allowNull: false, unique: true },
  email: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  password: { type: DataTypes.STRING(255), allowNull: true }, // allowNull: true evita conflictos con registros previos
  estatus: { type: DataTypes.INTEGER, defaultValue: 1 },
  isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  fechaCreacion: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  fechaUpdate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: 'usuarios',
  timestamps: false,
  defaultScope: {
    where: { isDeleted: false },
    attributes: { exclude: ['password'] },
  },
  scopes: {
    conPassword: {
      where: { isDeleted: false },
    },
  },
});

export default Usuario;