/**
 * ZAMANLI - WhatsApp Automation via Twilio
 * 
 * Otomatik WhatsApp mesajı gönderimi
 * Twilio API kullanarak WhatsApp Business entegrasyonu
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const twilio = require('twilio');

const db = admin.firestore();

// Twilio Configuration (Firebase Functions config ile ayarlanacak)
// firebase functions:config:set twilio.account_sid="YOUR_ACCOUNT_SID"
// firebase functions:config:set twilio.auth_token="YOUR_AUTH_TOKEN"
// firebase functions:config:set twilio.whatsapp_number="whatsapp:+14155238886"

/**
 * Twilio client oluştur
 */
function getTwilioClient() {
    const accountSid = functions.config().twilio?.account_sid;
    const authToken = functions.config().twilio?.auth_token;
    
    if (!accountSid || !authToken) {
        console.warn('[WhatsApp] Twilio credentials eksik - test modu');
        return null;
    }
    
    return twilio(accountSid, authToken);
}

/**
 * WhatsApp mesajı gönder
 */
async function sendWhatsAppMessage(to, message) {
    const client = getTwilioClient();
    
    if (!client) {
        console.log('[WhatsApp] Test mode - mesaj gönderilmedi:', to);
        return { success: false, testMode: true };
    }
    
    try {
        // Türkiye telefon numarasını formatla
        let phoneNumber = to.toString().replace(/\D/g, ''); // Sadece rakamlar
        
        if (phoneNumber.startsWith('0')) {
            phoneNumber = '90' + phoneNumber.substring(1);
        } else if (!phoneNumber.startsWith('90')) {
            phoneNumber = '90' + phoneNumber;
        }
        
        const whatsappNumber = `whatsapp:+${phoneNumber}`;
        const fromNumber = functions.config().twilio?.whatsapp_number || 'whatsapp:+14155238886';
        
        console.log('[WhatsApp] Gönderiliyor:', whatsappNumber);
        
        const result = await client.messages.create({
            from: fromNumber,
            to: whatsappNumber,
            body: message
        });
        
        console.log('[WhatsApp] ✅ Gönderildi:', result.sid);
        
        return { 
            success: true, 
            messageId: result.sid,
            status: result.status
        };
        
    } catch (error) {
        console.error('[WhatsApp] ❌ Hata:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Randevu onaylandığında WhatsApp mesajı gönder
 * Firestore trigger: appointments koleksiyonu onUpdate
 */
exports.sendAppointmentConfirmationWhatsApp = functions
    .region('europe-west1')
    .firestore
    .document('appointments/{appointmentId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();
        const appointmentId = context.params.appointmentId;
        
        // Status 'pending' -> 'confirmed' değişti mi?
        if (before.status === 'pending' && after.status === 'confirmed') {
            console.log('[WhatsApp] Randevu onay mesajı gönderiliyor:', appointmentId);
            
            try {
                // Salon bilgilerini al
                const salonDoc = await db.collection('salons').doc(after.salonId).get();
                const salon = salonDoc.data();
                
                // Mesaj içeriği
                const message = `✅ *Randevunuz Onaylandı!*

🏪 ${salon.name}
📅 Tarih: ${new Date(after.date.toDate()).toLocaleDateString('tr-TR', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
})}
⏰ Saat: ${after.time}
✂️ Hizmet: ${after.serviceName}
${after.staffName ? `👤 Personel: ${after.staffName}` : ''}

📍 Adres: ${salon.address}
📞 İletişim: ${salon.phone}

Randevunuzu iptal etmek için: ${salon.bookingUrl || 'zamanli.com'}

Görüşmek üzere! 🎉`;

                const result = await sendWhatsAppMessage(after.customerPhone, message);
                
                // WhatsApp log kaydet
                await db.collection('notification_logs').add({
                    type: 'whatsapp',
                    subType: 'appointment_confirmed',
                    appointmentId,
                    salonId: after.salonId,
                    recipient: after.customerPhone,
                    status: result.success ? 'sent' : 'failed',
                    messageId: result.messageId || null,
                    error: result.error || null,
                    testMode: result.testMode || false,
                    sentAt: admin.firestore.FieldValue.serverTimestamp()
                });
                
                return null;
                
            } catch (error) {
                console.error('[WhatsApp] Hata:', error);
                return null;
            }
        }
        
        return null;
    });

/**
 * Randevu iptal edildiğinde WhatsApp mesajı gönder
 */
exports.sendAppointmentCancellationWhatsApp = functions
    .region('europe-west1')
    .firestore
    .document('appointments/{appointmentId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();
        const appointmentId = context.params.appointmentId;
        
        // Status 'cancelled' oldu mu?
        if (before.status !== 'cancelled' && after.status === 'cancelled') {
            console.log('[WhatsApp] Randevu iptal mesajı gönderiliyor:', appointmentId);
            
            try {
                // Salon bilgilerini al
                const salonDoc = await db.collection('salons').doc(after.salonId).get();
                const salon = salonDoc.data();
                
                const message = `❌ *Randevunuz İptal Edildi*

🏪 ${salon.name}
📅 Tarih: ${new Date(after.date.toDate()).toLocaleDateString('tr-TR')}
⏰ Saat: ${after.time}
✂️ Hizmet: ${after.serviceName}

${after.cancelReason ? `📝 İptal Nedeni: ${after.cancelReason}` : ''}

Yeni randevu almak için: ${salon.bookingUrl || 'zamanli.com'}

📞 İletişim: ${salon.phone}`;

                const result = await sendWhatsAppMessage(after.customerPhone, message);
                
                // Log kaydet
                await db.collection('notification_logs').add({
                    type: 'whatsapp',
                    subType: 'appointment_cancelled',
                    appointmentId,
                    salonId: after.salonId,
                    recipient: after.customerPhone,
                    status: result.success ? 'sent' : 'failed',
                    messageId: result.messageId || null,
                    error: result.error || null,
                    testMode: result.testMode || false,
                    sentAt: admin.firestore.FieldValue.serverTimestamp()
                });
                
                return null;
                
            } catch (error) {
                console.error('[WhatsApp] Hata:', error);
                return null;
            }
        }
        
        return null;
    });

/**
 * Randevu hatırlatma WhatsApp mesajı gönder
 * Scheduled function: Her 15 dakikada bir çalış
 */
exports.sendAppointmentRemindersWhatsApp = functions
    .region('europe-west1')
    .pubsub.schedule('every 15 minutes')
    .timeZone('Europe/Istanbul')
    .onRun(async (context) => {
        console.log('[WhatsApp] Randevu hatırlatmaları kontrol ediliyor');
        
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
            
            console.log(`[WhatsApp] ${appointmentsSnapshot.size} randevu bulundu`);
            
            for (const doc of appointmentsSnapshot.docs) {
                const appointment = doc.data();
                const appointmentId = doc.id;
                
                // Daha önce hatırlatma gönderilmiş mi?
                const logSnapshot = await db.collection('notification_logs')
                    .where('appointmentId', '==', appointmentId)
                    .where('subType', '==', 'reminder')
                    .where('type', '==', 'whatsapp')
                    .get();
                
                if (!logSnapshot.empty) {
                    console.log(`[WhatsApp] ${appointmentId} - zaten hatırlatma gönderilmiş`);
                    continue;
                }
                
                // Salon bilgilerini al
                const salonDoc = await db.collection('salons').doc(appointment.salonId).get();
                const salon = salonDoc.data();
                
                // Randevuya kalan süreyi hesapla
                const timeDiff = appointment.date.toDate().getTime() - now.toDate().getTime();
                const hoursLeft = Math.floor(timeDiff / (1000 * 60 * 60));
                const minutesLeft = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                
                const message = `⏰ *Randevu Hatırlatması*

Merhaba ${appointment.customerName}! 👋

Randevunuza ${hoursLeft > 0 ? `${hoursLeft} saat ` : ''}${minutesLeft} dakika kaldı.

🏪 ${salon.name}
📅 ${new Date(appointment.date.toDate()).toLocaleDateString('tr-TR')}
⏰ Saat: ${appointment.time}
✂️ Hizmet: ${appointment.serviceName}
${appointment.staffName ? `👤 Personel: ${appointment.staffName}` : ''}

📍 Adres: ${salon.address}
📞 İletişim: ${salon.phone}

Görüşmek üzere! 🎉`;

                const result = await sendWhatsAppMessage(appointment.customerPhone, message);
                
                // Log kaydet
                await db.collection('notification_logs').add({
                    type: 'whatsapp',
                    subType: 'reminder',
                    appointmentId,
                    salonId: appointment.salonId,
                    recipient: appointment.customerPhone,
                    status: result.success ? 'sent' : 'failed',
                    messageId: result.messageId || null,
                    error: result.error || null,
                    testMode: result.testMode || false,
                    sentAt: admin.firestore.FieldValue.serverTimestamp()
                });
                
                console.log(`[WhatsApp] ✅ Hatırlatma gönderildi: ${appointmentId}`);
            }
            
            return null;
            
        } catch (error) {
            console.error('[WhatsApp] Hatırlatma hatası:', error);
            return null;
        }
    });

/**
 * Manuel WhatsApp mesajı gönderme API
 * HTTPS callable function
 */
exports.sendManualWhatsApp = functions
    .region('europe-west1')
    .https.onCall(async (data, context) => {
        const { phone, message, salonId } = data;
        
        console.log('[WhatsApp] Manuel mesaj isteği:', { phone, salonId });
        
        // Validation
        if (!phone || !message) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Telefon ve mesaj gerekli'
            );
        }
        
        try {
            const result = await sendWhatsAppMessage(phone, message);
            
            // Log kaydet
            if (salonId) {
                await db.collection('notification_logs').add({
                    type: 'whatsapp',
                    subType: 'manual',
                    salonId,
                    recipient: phone,
                    status: result.success ? 'sent' : 'failed',
                    messageId: result.messageId || null,
                    error: result.error || null,
                    testMode: result.testMode || false,
                    sentAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
            
            return result;
            
        } catch (error) {
            console.error('[WhatsApp] Manuel mesaj hatası:', error);
            throw new functions.https.HttpsError('internal', error.message);
        }
    });

// Export helper function
exports.sendWhatsAppMessage = sendWhatsAppMessage;
