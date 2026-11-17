import { DataTypes } from 'sequelize';
import sequelize from '../../config/postgres.js';
import Cuenta from './Cuenta.js';

const Prestamo = sequelize.define('Prestamo', {
  idPrestamo: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  idCuenta: { type: DataTypes.BIGINT, allowNull: false },
  montoOtorgado: { type: DataTypes.DECIMAL(16, 6), allowNull: false },
  saldoPendiente: { type: DataTypes.DECIMAL(16, 6), allowNull: false },
  fechaInicio: { type: DataTypes.DATETIME, allowNull: false },
  fechaVencimiento: { type: DataTypes.DATETIME, allowNull: false },
  fechaUltimoPago: { type: DataTypes.DATETIME, allowNull: true },
  tasaInteresMensual: { type: DataTypes.DECIMAL(16, 6), allowNull: false },
  estatus: { type: DataTypes.INTEGER, defaultValue: 1 },
  isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  fechaCreacion: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  fechaUpdate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'prestamos',
  timestamps: false,
  defaultScope: { where: { isDeleted: false } },
});

Cuenta.hasMany(Prestamo, { foreignKey: 'idCuenta' });
Prestamo.belongsTo(Cuenta, { foreignKey: 'idCuenta' });

export default Prestamo;