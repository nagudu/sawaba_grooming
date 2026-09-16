import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from 'sequelize'
import { sequelize } from '../config/database'
import type { Service } from './Service'

export class Barber extends Model<InferAttributes<Barber>, InferCreationAttributes<Barber>> {
  declare id: CreationOptional<number>
  declare name: string
  declare slug: string
  declare image: CreationOptional<string | null>
  declare phone: CreationOptional<string | null>
  declare email: CreationOptional<string | null>
  declare specialty: CreationOptional<string | null>
  declare biography: CreationOptional<string | null>
  declare experience: CreationOptional<number>
  declare rating: CreationOptional<number>
  declare isActive: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  declare services?: Service[]
  declare setServices: (ids: number[]) => Promise<void>
}

Barber.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(160),
      allowNull: false,
      unique: true,
    },
    image: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    specialty: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    biography: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    experience: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      comment: 'Years of experience',
    },
    rating: {
      type: DataTypes.DECIMAL(2, 1),
      allowNull: false,
      defaultValue: 0,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'barbers',
    indexes: [{ fields: ['slug'] }, { fields: ['is_active'] }],
  },
)