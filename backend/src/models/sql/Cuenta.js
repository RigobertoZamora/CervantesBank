import { DataTypes } from 'sequelize';
import sequelize from '../../config/postgres.js';
import Usuario from './Usuario.js';

const Cuenta = sequelize.define('Cuenta', {
  idCuenta: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  idUsuario: { type: DataTypes.BIGINT, allowNull: false },
  saldo: { type: DataTypes.DECIMAL(16, 6), defaultValue: 0.0 },
  clabeInterbancaria: { type: DataTypes.STRING(18), allowNull: false, unique: true },
  estatus: { type: DataTypes.INTEGER, defaultValue: 1 },
  isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  fechaCreacion: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  fechaUpdate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'cuentas',
  timestamps: false,
  defaultScope: { where: { isDeleted: false } },
});

Usuario.hasMany(Cuenta, { foreignKey: 'idUsuario' });
Cuenta.belongsTo(Usuario, { foreignKey: 'idUsuario' });

export default Cuenta;