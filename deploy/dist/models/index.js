"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentSetting = exports.Payment = exports.ContactReply = exports.ContactMessage = exports.Review = exports.Gallery = exports.BarberAvailability = exports.Appointment = exports.BarberService = exports.Barber = exports.Service = exports.CustomerOtp = exports.Customer = exports.Admin = void 0;
const Admin_1 = require("./Admin");
Object.defineProperty(exports, "Admin", { enumerable: true, get: function () { return Admin_1.Admin; } });
const Customer_1 = require("./Customer");
Object.defineProperty(exports, "Customer", { enumerable: true, get: function () { return Customer_1.Customer; } });
const CustomerOtp_1 = require("./CustomerOtp");
Object.defineProperty(exports, "CustomerOtp", { enumerable: true, get: function () { return CustomerOtp_1.CustomerOtp; } });
const Service_1 = require("./Service");
Object.defineProperty(exports, "Service", { enumerable: true, get: function () { return Service_1.Service; } });
const Barber_1 = require("./Barber");
Object.defineProperty(exports, "Barber", { enumerable: true, get: function () { return Barber_1.Barber; } });
const BarberService_1 = require("./BarberService");
Object.defineProperty(exports, "BarberService", { enumerable: true, get: function () { return BarberService_1.BarberService; } });
const Appointment_1 = require("./Appointment");
Object.defineProperty(exports, "Appointment", { enumerable: true, get: function () { return Appointment_1.Appointment; } });
const BarberAvailability_1 = require("./BarberAvailability");
Object.defineProperty(exports, "BarberAvailability", { enumerable: true, get: function () { return BarberAvailability_1.BarberAvailability; } });
const Gallery_1 = require("./Gallery");
Object.defineProperty(exports, "Gallery", { enumerable: true, get: function () { return Gallery_1.Gallery; } });
const Review_1 = require("./Review");
Object.defineProperty(exports, "Review", { enumerable: true, get: function () { return Review_1.Review; } });
const ContactMessage_1 = require("./ContactMessage");
Object.defineProperty(exports, "ContactMessage", { enumerable: true, get: function () { return ContactMessage_1.ContactMessage; } });
const ContactReply_1 = require("./ContactReply");
Object.defineProperty(exports, "ContactReply", { enumerable: true, get: function () { return ContactReply_1.ContactReply; } });
const Payment_1 = require("./Payment");
Object.defineProperty(exports, "Payment", { enumerable: true, get: function () { return Payment_1.Payment; } });
const PaymentSetting_1 = require("./PaymentSetting");
Object.defineProperty(exports, "PaymentSetting", { enumerable: true, get: function () { return PaymentSetting_1.PaymentSetting; } });
// Barber <-> Service (many-to-many via BarberService)
Barber_1.Barber.belongsToMany(Service_1.Service, { through: BarberService_1.BarberService, as: 'services', foreignKey: 'barberId', otherKey: 'serviceId' });
Service_1.Service.belongsToMany(Barber_1.Barber, { through: BarberService_1.BarberService, as: 'barbers', foreignKey: 'serviceId', otherKey: 'barberId' });
// Customer
Customer_1.Customer.hasMany(Appointment_1.Appointment, { as: 'appointments', foreignKey: 'customerId', onDelete: 'SET NULL' });
Customer_1.Customer.hasMany(Payment_1.Payment, { as: 'payments', foreignKey: 'customerId', onDelete: 'SET NULL' });
// Appointment
Appointment_1.Appointment.belongsTo(Service_1.Service, { as: 'service', foreignKey: 'serviceId', onDelete: 'RESTRICT' });
Appointment_1.Appointment.belongsTo(Barber_1.Barber, { as: 'barber', foreignKey: 'barberId', onDelete: 'RESTRICT' });
Appointment_1.Appointment.belongsTo(Customer_1.Customer, { as: 'customer', foreignKey: 'customerId', onDelete: 'SET NULL' });
Appointment_1.Appointment.hasOne(Payment_1.Payment, { as: 'payment', foreignKey: 'appointmentId', onDelete: 'CASCADE' });
Service_1.Service.hasMany(Appointment_1.Appointment, { foreignKey: 'serviceId' });
Barber_1.Barber.hasMany(Appointment_1.Appointment, { foreignKey: 'barberId' });
// Payment
Payment_1.Payment.belongsTo(Appointment_1.Appointment, { as: 'appointment', foreignKey: 'appointmentId', onDelete: 'CASCADE' });
Payment_1.Payment.belongsTo(Customer_1.Customer, { as: 'customer', foreignKey: 'customerId', onDelete: 'SET NULL' });
// BarberAvailability
BarberAvailability_1.BarberAvailability.belongsTo(Barber_1.Barber, { as: 'barber', foreignKey: 'barberId', onDelete: 'CASCADE' });
Barber_1.Barber.hasMany(BarberAvailability_1.BarberAvailability, { foreignKey: 'barberId' });
// Gallery
Gallery_1.Gallery.belongsTo(Barber_1.Barber, { as: 'barber', foreignKey: 'barberId', onDelete: 'SET NULL' });
Barber_1.Barber.hasMany(Gallery_1.Gallery, { foreignKey: 'barberId' });
// Contact messaging
ContactMessage_1.ContactMessage.hasMany(ContactReply_1.ContactReply, {
    as: 'replies',
    foreignKey: 'contactMessageId',
    onDelete: 'CASCADE',
});
ContactReply_1.ContactReply.belongsTo(ContactMessage_1.ContactMessage, { as: 'contactMessage', foreignKey: 'contactMessageId', onDelete: 'CASCADE' });
ContactReply_1.ContactReply.belongsTo(Admin_1.Admin, { as: 'admin', foreignKey: 'adminId', onDelete: 'SET NULL' });
//# sourceMappingURL=index.js.map