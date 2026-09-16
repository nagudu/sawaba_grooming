import { Admin } from './Admin'
import { Customer } from './Customer'
import { CustomerOtp } from './CustomerOtp'
import { Service } from './Service'
import { Barber } from './Barber'
import { BarberService } from './BarberService'
import { Appointment } from './Appointment'
import { BarberAvailability } from './BarberAvailability'
import { Gallery } from './Gallery'
import { Review, type ReviewStatus } from './Review'
import { ContactMessage } from './ContactMessage'
import { ContactReply } from './ContactReply'
import { Payment } from './Payment'
import { PaymentSetting } from './PaymentSetting'

// Barber <-> Service (many-to-many via BarberService)
Barber.belongsToMany(Service, { through: BarberService, as: 'services', foreignKey: 'barberId', otherKey: 'serviceId' })
Service.belongsToMany(Barber, { through: BarberService, as: 'barbers', foreignKey: 'serviceId', otherKey: 'barberId' })

// Customer
Customer.hasMany(Appointment, { as: 'appointments', foreignKey: 'customerId', onDelete: 'SET NULL' })
Customer.hasMany(Payment, { as: 'payments', foreignKey: 'customerId', onDelete: 'SET NULL' })

// Appointment
Appointment.belongsTo(Service, { as: 'service', foreignKey: 'serviceId', onDelete: 'RESTRICT' })
Appointment.belongsTo(Barber, { as: 'barber', foreignKey: 'barberId', onDelete: 'RESTRICT' })
Appointment.belongsTo(Customer, { as: 'customer', foreignKey: 'customerId', onDelete: 'SET NULL' })
Appointment.hasOne(Payment, { as: 'payment', foreignKey: 'appointmentId', onDelete: 'CASCADE' })
Service.hasMany(Appointment, { foreignKey: 'serviceId' })
Barber.hasMany(Appointment, { foreignKey: 'barberId' })

// Payment
Payment.belongsTo(Appointment, { as: 'appointment', foreignKey: 'appointmentId', onDelete: 'CASCADE' })
Payment.belongsTo(Customer, { as: 'customer', foreignKey: 'customerId', onDelete: 'SET NULL' })

// BarberAvailability
BarberAvailability.belongsTo(Barber, { as: 'barber', foreignKey: 'barberId', onDelete: 'CASCADE' })
Barber.hasMany(BarberAvailability, { foreignKey: 'barberId' })

// Gallery
Gallery.belongsTo(Barber, { as: 'barber', foreignKey: 'barberId', onDelete: 'SET NULL' })
Barber.hasMany(Gallery, { foreignKey: 'barberId' })

// Contact messaging
ContactMessage.hasMany(ContactReply, {
  as: 'replies',
  foreignKey: 'contactMessageId',
  onDelete: 'CASCADE',
})
ContactReply.belongsTo(ContactMessage, { as: 'contactMessage', foreignKey: 'contactMessageId', onDelete: 'CASCADE' })
ContactReply.belongsTo(Admin, { as: 'admin', foreignKey: 'adminId', onDelete: 'SET NULL' })

export {
  Admin,
  Customer,
  CustomerOtp,
  Service,
  Barber,
  BarberService,
  Appointment,
  BarberAvailability,
  Gallery,
  Review,
  type ReviewStatus,
  ContactMessage,
  ContactReply,
  Payment,
  PaymentSetting,
}