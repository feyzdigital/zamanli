const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const pushModule = require('./send-push-notification');
exports.sendPushNotification = pushModule.sendPushNotification;
exports.onAppointmentStatusChange = pushModule.onAppointmentStatusChange;