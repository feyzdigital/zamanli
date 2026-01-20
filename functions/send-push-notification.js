// Firebase Cloud Function - Push Notification Gönderme
// Bu fonksiyon 'notifications' koleksiyonuna yeni doküman eklendiğinde tetiklenir

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Admin SDK'yı başlat (eğer başlatılmamışsa)
if (!admin.apps.length) {
    admin.initializeApp();
}

/**
 * Yeni bildirim oluşturulduğunda FCM ile push notification gönder
 * 
 * Firestore trigger: notifications/{notificationId}
 * 
 * Beklenen doküman yapısı:
 * {
 *   targetType: 'salon' | 'customer',
 *   targetId: string,
 *   title: string,
 *   body: string,
 *   data: object (optional),
 *   tokens: string[],
 *   status: 'pending' | 'sent' | 'failed',
 *   createdAt: timestamp
 * }
 */
exports.sendPushNotification = functions
    .region('europe-west1') // Türkiye'ye yakın region
    .firestore
    .document('notifications/{notificationId}')
    .onCreate(async (snapshot, context) => {
        const notification = snapshot.data();
        const notificationId = context.params.notificationId;
        
        console.log(`[Push] Processing notification: ${notificationId}`);
        
        // Zaten işlenmiş mi kontrol et
        if (notification.status !== 'pending') {
            console.log(`[Push] Notification already processed: ${notification.status}`);
            return null;
        }
        
        // Token'ları al
        const tokens = notification.tokens || [];
        
        if (tokens.length === 0) {
            console.log('[Push] No tokens to send');
            await snapshot.ref.update({ 
                status: 'failed', 
                error: 'no_tokens',
                processedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return null;
        }
        
        // FCM mesajı hazırla
        const message = {
            notification: {
                title: notification.title || 'Zamanli',
                body: notification.body || '',
            },
            data: {
                ...(notification.data || {}),
                notificationId: notificationId,
                click_action: 'FLUTTER_NOTIFICATION_CLICK' // Mobil uygulama için
            },
            webpush: {
                notification: {
                    icon: '/icons/icon-192x192.png',
                    badge: '/icons/icon-72x72.png',
                    vibrate: [200, 100, 200],
                    requireInteraction: true,
                    actions: [
                        {
                            action: 'open',
                            title: 'Görüntüle'
                        },
                        {
                            action: 'dismiss',
                            title: 'Kapat'
                        }
                    ]
                },
                fcmOptions: {
                    link: notification.data?.link || '/berber/salon/yonetim/'
                }
            },
            android: {
                notification: {
                    icon: 'ic_notification',
                    color: '#10B981',
                    sound: 'default',
                    priority: 'high'
                }
            },
            apns: {
                payload: {
                    aps: {
                        alert: {
                            title: notification.title,
                            body: notification.body
                        },
                        sound: 'default',
                        badge: 1
                    }
                }
            }
        };
        
        // Her token için gönder
        const results = {
            success: 0,
            failure: 0,
            errors: []
        };
        
        for (const token of tokens) {
            try {
                // Token'ın FCM token mı yoksa Web Push subscription mı olduğunu kontrol et
                if (token.startsWith('{')) {
                    // Web Push subscription - farklı işlem gerekebilir
                    console.log('[Push] Web Push subscription detected, skipping FCM');
                    continue;
                }
                
                await admin.messaging().send({
                    ...message,
                    token: token
                });
                
                results.success++;
                console.log(`[Push] Sent to token: ${token.substring(0, 20)}...`);
                
            } catch (error) {
                results.failure++;
                results.errors.push({
                    token: token.substring(0, 20) + '...',
                    error: error.code || error.message
                });
                
                console.error(`[Push] Failed for token: ${error.code}`);
                
                // Geçersiz token ise veritabanından sil
                if (error.code === 'messaging/invalid-registration-token' ||
                    error.code === 'messaging/registration-token-not-registered') {
                    await removeInvalidToken(token);
                }
            }
        }
        
        // Sonucu güncelle
        await snapshot.ref.update({
            status: results.success > 0 ? 'sent' : 'failed',
            results: results,
            processedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`[Push] Completed: ${results.success} success, ${results.failure} failed`);
        
        return results;
    });

/**
 * Geçersiz token'ı veritabanından sil
 */
async function removeInvalidToken(token) {
    try {
        const db = admin.firestore();
        const tokensSnapshot = await db.collection('push_tokens')
            .where('token', '==', token)
            .get();
        
        const batch = db.batch();
        tokensSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        console.log('[Push] Removed invalid token');
    } catch (error) {
        console.error('[Push] Error removing token:', error);
    }
}

/**
 * Randevu durumu değiştiğinde müşteriye bildirim gönder
 * 
 * Firestore trigger: appointments/{appointmentId}
 */
exports.onAppointmentStatusChange = functions
    .region('europe-west1')
    .firestore
    .document('appointments/{appointmentId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();
        
        // Durum değişmemişse işlem yapma
        if (before.status === after.status) {
            return null;
        }
        
        const appointmentId = context.params.appointmentId;
        console.log(`[Push] Appointment status changed: ${before.status} -> ${after.status}`);
        
        // Müşterinin push token'ını bul (telefon numarasına göre)
        const customerPhone = after.customerPhone?.replace(/\D/g, '').slice(-10);
        if (!customerPhone) {
            console.log('[Push] No customer phone');
            return null;
        }
        
        const db = admin.firestore();
        const tokensSnapshot = await db.collection('push_tokens')
            .where('userType', '==', 'customer')
            .where('phone', '==', customerPhone)
            .get();
        
        if (tokensSnapshot.empty) {
            console.log('[Push] No tokens for customer');
            return null;
        }
        
        // Bildirim mesajını hazırla
        let title, body;
        
        switch (after.status) {
            case 'approved':
                title = '✅ Randevunuz Onaylandı!';
                body = `${after.salonName} - ${after.date} ${after.time}`;
                break;
            case 'cancelled':
                title = '❌ Randevunuz İptal Edildi';
                body = `${after.salonName} - ${after.date} ${after.time}`;
                break;
            case 'completed':
                title = '🎉 Randevunuz Tamamlandı';
                body = `${after.salonName}'ı değerlendirmeyi unutmayın!`;
                break;
            default:
                return null;
        }
        
        // Bildirim dokümanı oluştur (sendPushNotification tetiklenecek)
        await db.collection('notifications').add({
            targetType: 'customer',
            targetId: customerPhone,
            title: title,
            body: body,
            data: {
                type: 'appointment_status',
                appointmentId: appointmentId,
                status: after.status
            },
            tokens: tokensSnapshot.docs.map(doc => doc.data().token),
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log('[Push] Customer notification queued');
        return null;
    });
