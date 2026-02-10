/**
 * ZAMANLI - WhatsApp URL Helper
 * 
 * WhatsApp Business API onaylanana kadar URL ile mesaj gönderimi
 * Salon sahibi kendi WhatsApp'ından gönderir
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * WhatsApp mesaj URL'i oluştur
 * HTTPS callable function
 */
exports.createWhatsAppUrl = functions
    .region('europe-west1')
    .https.onCall(async (data, context) => {
        const { phone, message, appointmentId } = data;
        
        console.log('[WhatsApp URL] URL oluşturma isteği:', { phone, appointmentId });
        
        // Validation
        if (!phone || !message) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Telefon ve mesaj gerekli'
            );
        }
        
        try {
            // Telefon numarasını formatla
            let cleanPhone = phone.toString().replace(/\D/g, '');
            
            // Türkiye kodu ekle
            if (cleanPhone.startsWith('0')) {
                cleanPhone = '90' + cleanPhone.substring(1);
            } else if (!cleanPhone.startsWith('90')) {
                cleanPhone = '90' + cleanPhone;
            }
            
            // WhatsApp URL oluştur
            const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
            
            console.log('[WhatsApp URL] ✅ URL oluşturuldu:', whatsappUrl);
            
            // Log kaydet (opsiyonel tracking)
            if (appointmentId) {
                await db.collection('notification_logs').add({
                    type: 'whatsapp_url',
                    method: 'manual',
                    appointmentId: appointmentId,
                    recipient: cleanPhone,
                    message: message,
                    url: whatsappUrl,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
            
            return {
                success: true,
                url: whatsappUrl,
                phone: cleanPhone
            };
            
        } catch (error) {
            console.error('[WhatsApp URL] Hata:', error);
            throw new functions.https.HttpsError('internal', error.message);
        }
    });

/**
 * Randevu için WhatsApp mesaj template'i oluştur
 * HTTPS callable function
 */
exports.getWhatsAppTemplate = functions
    .region('europe-west1')
    .https.onCall(async (data, context) => {
        const { appointmentId, templateType } = data;
        
        console.log('[WhatsApp Template] Template isteği:', { appointmentId, templateType });
        
        if (!appointmentId || !templateType) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Randevu ID ve template tipi gerekli'
            );
        }
        
        try {
            // Randevu bilgilerini al
            const aptDoc = await db.collection('appointments').doc(appointmentId).get();
            
            if (!aptDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'Randevu bulunamadı');
            }
            
            const apt = aptDoc.data();
            
            // Salon bilgilerini al
            const salonDoc = await db.collection('salons').doc(apt.salonId).get();
            const salon = salonDoc.data();
            
            // Tarih formatlama
            const dateObj = new Date(apt.date);
            const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
                          'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
            const formattedDate = `${dateObj.getDate()} ${months[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
            
            let message = '';
            
            // Template tipine göre mesaj oluştur
            switch (templateType) {
                case 'confirmation':
                    message = `✅ *Randevunuz Onaylandı!*

🏪 *${salon.name}*
📅 Tarih: ${formattedDate}
⏰ Saat: ${apt.time}
✂️ Hizmet: ${apt.service || apt.serviceName}
👤 Personel: ${apt.staffName || 'Belirtilmedi'}

💰 Tutar: ${apt.servicePrice || 0} ₺

📍 Adres: ${salon.address || ''}
📞 İletişim: ${salon.phone}

Görüşmek üzere! 🎉`;
                    break;
                    
                case 'reminder':
                    message = `⏰ *Randevu Hatırlatması*

Sayın ${apt.customerName},

🏪 ${salon.name}
📅 ${formattedDate}
⏰ Saat: ${apt.time}
✂️ Hizmet: ${apt.service || apt.serviceName}

Randevunuz 2 saat sonra başlayacak.

📍 Adres: ${salon.address || ''}

Görüşmek üzere!`;
                    break;
                    
                case 'cancellation':
                    message = `❌ *Randevunuz İptal Edildi*

Sayın ${apt.customerName},

Maalesef aşağıdaki randevunuz iptal edilmiştir:

🏪 ${salon.name}
📅 ${formattedDate}
⏰ Saat: ${apt.time}

Yeni randevu için iletişime geçebilirsiniz.
📞 ${salon.phone}`;
                    break;
                    
                default:
                    throw new functions.https.HttpsError('invalid-argument', 'Geçersiz template tipi');
            }
            
            return {
                success: true,
                message: message,
                phone: apt.customerPhone,
                salonName: salon.name
            };
            
        } catch (error) {
            console.error('[WhatsApp Template] Hata:', error);
            throw new functions.https.HttpsError('internal', error.message);
        }
    });

/**
 * Randevu onaylandığında WhatsApp URL oluştur (geçici sistem)
 * Firestore trigger: appointments koleksiyonu onUpdate
 */
exports.createWhatsAppUrlOnConfirm = functions
    .region('europe-west1')
    .firestore
    .document('appointments/{appointmentId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();
        const appointmentId = context.params.appointmentId;
        
        // Status 'pending' -> 'confirmed' değişti mi?
        if (before.status === 'pending' && after.status === 'confirmed') {
            console.log('[WhatsApp URL] Randevu onaylandı, bildirim hazırlanıyor:', appointmentId);
            
            try {
                // Salon bilgilerini al
                const salonDoc = await db.collection('salons').doc(after.salonId).get();
                const salon = salonDoc.data();
                
                // Tarih formatlama
                const dateObj = new Date(after.date);
                const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
                              'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
                const formattedDate = `${dateObj.getDate()} ${months[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
                
                // WhatsApp mesajı
                const message = `✅ *Randevunuz Onaylandı!*

🏪 *${salon.name}*
📅 Tarih: ${formattedDate}
⏰ Saat: ${after.time}
✂️ Hizmet: ${after.service || after.serviceName}
👤 Personel: ${after.staffName || 'Belirtilmedi'}

💰 Tutar: ${after.servicePrice || 0} ₺

📍 Adres: ${salon.address || ''}
📞 İletişim: ${salon.phone}

Görüşmek üzere! 🎉`;

                // Telefon formatla
                let cleanPhone = after.customerPhone.toString().replace(/\D/g, '');
                if (cleanPhone.startsWith('0')) {
                    cleanPhone = '90' + cleanPhone.substring(1);
                } else if (!cleanPhone.startsWith('90')) {
                    cleanPhone = '90' + cleanPhone;
                }
                
                const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
                
                // Notification kaydı (salon sahibi için)
                await db.collection('pending_notifications').add({
                    type: 'whatsapp_url',
                    appointmentId: appointmentId,
                    salonId: after.salonId,
                    customerName: after.customerName,
                    customerPhone: after.customerPhone,
                    whatsappUrl: whatsappUrl,
                    message: message,
                    status: 'pending',
                    instructions: 'Yönetim panelinde "WhatsApp Gönder" butonuna tıklayın',
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    expiresAt: admin.firestore.Timestamp.fromDate(
                        new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 saat
                    )
                });
                
                console.log('[WhatsApp URL] ✅ Bildirim hazır:', whatsappUrl);
                
                return null;
                
            } catch (error) {
                console.error('[WhatsApp URL] Hata:', error);
                return null;
            }
        }
        
        return null;
    });
