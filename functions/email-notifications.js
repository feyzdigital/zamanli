/**
 * ZAMANLI - Email Notification System
 * 
 * EmailJS kullanarak otomatik email gönderimi
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const emailjs = require('@emailjs/nodejs');

const db = admin.firestore();

// EmailJS Configuration (config.js'den alınacak)
const EMAILJS_CONFIG = {
    serviceId: 'service_nltn6di',
    publicKey: 'DFMgbrmsjlK0hxlc5',
    templates: {
        approval: 'template_k0an00y',
        newSalon: 'template_qv6wzhj',
        appointment: 'template_appointment',
        reminder: 'template_reminder',
        reschedule: 'template_reschedule',
        cancellation: 'template_cancellation'
    }
};

/**
 * Email gönderme helper function
 */
async function sendEmail(templateId, templateParams) {
    try {
        const response = await emailjs.send(
            EMAILJS_CONFIG.serviceId,
            templateId,
            templateParams,
            {
                publicKey: EMAILJS_CONFIG.publicKey,
            }
        );
        
        console.log('[Email] ✅ Gönderildi:', response.status);
        return true;
    } catch (error) {
        console.error('[Email] ❌ Hata:', error);
        return false;
    }
}

/**
 * Randevu onaylandığında email gönder
 * Firestore trigger: appointments koleksiyonu onUpdate
 */
exports.sendAppointmentConfirmationEmail = functions
    .region('europe-west1')
    .firestore
    .document('appointments/{appointmentId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();
        const appointmentId = context.params.appointmentId;
        
        // Status 'pending' -> 'confirmed' değişti mi?
        if (before.status === 'pending' && after.status === 'confirmed') {
            console.log('[Email] Randevu onay emaili gönderiliyor:', appointmentId);
            
            try {
                // Salon bilgilerini al
                const salonDoc = await db.collection('salons').doc(after.salonId).get();
                const salon = salonDoc.data();
                
                // Package kontrolü - Pro veya Business pakette email var
                if (salon.package === 'free') {
                    console.log('[Email] Free paket - email gönderilmedi');
                    return null;
                }
                
                // Email template parametreleri
                const templateParams = {
                    to_email: after.customerEmail || salon.ownerEmail,
                    customer_name: after.customerName,
                    salon_name: salon.name,
                    date: new Date(after.date?.toDate ? after.date.toDate() : after.date).toLocaleDateString('tr-TR'),
                    time: after.time,
                    service_name: after.serviceName,
                    staff_name: after.staffName || 'Herhangi bir personel',
                    salon_phone: salon.phone,
                    salon_address: salon.address
                };
                
                await sendEmail(EMAILJS_CONFIG.templates.appointment, templateParams);
                
                // Email log kaydet
                await db.collection('notification_logs').add({
                    type: 'email',
                    subType: 'appointment_confirmed',
                    appointmentId,
                    salonId: after.salonId,
                    recipient: after.customerEmail || salon.ownerEmail,
                    status: 'sent',
                    sentAt: admin.firestore.FieldValue.serverTimestamp()
                });
                
                return null;
                
            } catch (error) {
                console.error('[Email] Hata:', error);
                return null;
            }
        }
        
        return null;
    });

/**
 * Randevu iptal edildiğinde email gönder
 */
exports.sendAppointmentCancellationEmail = functions
    .region('europe-west1')
    .firestore
    .document('appointments/{appointmentId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();
        const appointmentId = context.params.appointmentId;
        
        // Status 'cancelled' oldu mu?
        if (before.status !== 'cancelled' && after.status === 'cancelled') {
            console.log('[Email] Randevu iptal emaili gönderiliyor:', appointmentId);
            
            try {
                // Salon bilgilerini al
                const salonDoc = await db.collection('salons').doc(after.salonId).get();
                const salon = salonDoc.data();
                
                // Package kontrolü
                if (salon.package === 'free') {
                    console.log('[Email] Free paket - email gönderilmedi');
                    return null;
                }
                
                const templateParams = {
                    to_email: after.customerEmail || salon.ownerEmail,
                    customer_name: after.customerName,
                    salon_name: salon.name,
                    date: new Date(after.date?.toDate ? after.date.toDate() : after.date).toLocaleDateString('tr-TR'),
                    time: after.time,
                    service_name: after.serviceName,
                    cancel_reason: after.cancelReason || 'Belirtilmedi',
                    salon_phone: salon.phone
                };
                
                await sendEmail(EMAILJS_CONFIG.templates.cancellation, templateParams);
                
                // Log kaydet
                await db.collection('notification_logs').add({
                    type: 'email',
                    subType: 'appointment_cancelled',
                    appointmentId,
                    salonId: after.salonId,
                    recipient: after.customerEmail || salon.ownerEmail,
                    status: 'sent',
                    sentAt: admin.firestore.FieldValue.serverTimestamp()
                });
                
                return null;
                
            } catch (error) {
                console.error('[Email] Hata:', error);
                return null;
            }
        }
        
        return null;
    });

/**
 * Randevu hatırlatma emaili gönder
 * Scheduled function: Her 15 dakikada bir çalış
 */
exports.sendAppointmentReminders = functions
    .region('europe-west1')
    .pubsub.schedule('every 15 minutes')
    .timeZone('Europe/Istanbul')
    .onRun(async (context) => {
        console.log('[Email] Randevu hatırlatmaları kontrol ediliyor');
        
        try {
            const now = admin.firestore.Timestamp.now();
            const twoHoursLater = admin.firestore.Timestamp.fromDate(
                new Date(now.toDate().getTime() + 2 * 60 * 60 * 1000)
            );
            
            // 2 saat içinde başlayacak onaylanmış randevuları bul
            const appointmentsSnapshot = await db.collection('appointments')
                .where('date', '>=', now)
                .where('date', '<=', twoHoursLater)
                .where('status', '==', 'confirmed')
                .get();
            
            console.log(`[Email] ${appointmentsSnapshot.size} randevu bulundu`);
            
            for (const doc of appointmentsSnapshot.docs) {
                const appointment = doc.data();
                const appointmentId = doc.id;
                
                // Daha önce hatırlatma gönderilmiş mi?
                const logSnapshot = await db.collection('notification_logs')
                    .where('appointmentId', '==', appointmentId)
                    .where('subType', '==', 'reminder')
                    .get();
                
                if (!logSnapshot.empty) {
                    console.log(`[Email] ${appointmentId} - zaten hatırlatma gönderilmiş`);
                    continue;
                }
                
                // Salon bilgilerini al
                const salonDoc = await db.collection('salons').doc(appointment.salonId).get();
                const salon = salonDoc.data();
                
                // Package kontrolü
                if (salon.package === 'free') {
                    continue;
                }
                
                // Randevuya kalan süreyi hesapla
                const appointmentDate = appointment.date?.toDate ? appointment.date.toDate() : new Date(appointment.date);
                const timeDiff = appointmentDate.getTime() - now.toDate().getTime();
                const hoursLeft = Math.floor(timeDiff / (1000 * 60 * 60));
                const minutesLeft = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                
                const templateParams = {
                    to_email: appointment.customerEmail || salon.ownerEmail,
                    customer_name: appointment.customerName,
                    salon_name: salon.name,
                    date: new Date(appointmentDate).toLocaleDateString('tr-TR'),
                    time: appointment.time,
                    service_name: appointment.serviceName,
                    staff_name: appointment.staffName || 'Herhangi bir personel',
                    time_left: `${hoursLeft} saat ${minutesLeft} dakika`,
                    salon_phone: salon.phone,
                    salon_address: salon.address
                };
                
                await sendEmail(EMAILJS_CONFIG.templates.reminder, templateParams);
                
                // Log kaydet
                await db.collection('notification_logs').add({
                    type: 'email',
                    subType: 'reminder',
                    appointmentId,
                    salonId: appointment.salonId,
                    recipient: appointment.customerEmail || salon.ownerEmail,
                    status: 'sent',
                    sentAt: admin.firestore.FieldValue.serverTimestamp()
                });
                
                console.log(`[Email] ✅ Hatırlatma gönderildi: ${appointmentId}`);
            }
            
            return null;
            
        } catch (error) {
            console.error('[Email] Hatırlatma hatası:', error);
            return null;
        }
    });

/**
 * Yeni salon kaydı admin onay emaili
 */
exports.sendNewSalonApprovalEmail = functions
    .region('europe-west1')
    .firestore
    .document('salons/{salonId}')
    .onCreate(async (snapshot, context) => {
        const salon = snapshot.data();
        const salonId = context.params.salonId;
        
        console.log('[Email] Yeni salon onay emaili gönderiliyor:', salonId);
        
        try {
            // Admin email (config'den alınabilir)
            const ADMIN_EMAIL = 'admin@zamanli.com';
            
            const templateParams = {
                to_email: ADMIN_EMAIL,
                salon_name: salon.name,
                salon_category: salon.category || 'berber',
                owner_name: salon.ownerName,
                owner_phone: salon.phone,
                owner_email: salon.ownerEmail,
                salon_address: salon.address,
                approval_url: `https://zamanli.com/admin/?action=approve&salonId=${salonId}`
            };
            
            await sendEmail(EMAILJS_CONFIG.templates.newSalon, templateParams);
            
            return null;
            
        } catch (error) {
            console.error('[Email] Hata:', error);
            return null;
        }
    });

// Export helper function
exports.sendEmail = sendEmail;
