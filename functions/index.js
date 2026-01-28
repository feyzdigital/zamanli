/**
 * ZAMANLI - Firebase Cloud Functions
 * Push Notification Sistemi
 * 
 * Bu fonksiyonlar yeni randevu geldiğinde salon sahibine
 * push notification gönderir.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Firebase Admin SDK başlat
admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

/**
 * Yeni randevu oluşturulduğunda salon sahibine VE ilgili personele bildirim gönder
 * Firestore trigger: appointments koleksiyonu dinlenir
 */
exports.onNewAppointment = functions
    .region('europe-west1') // Türkiye'ye yakın region
    .firestore
    .document('appointments/{appointmentId}')
    .onCreate(async (snapshot, context) => {
        const appointment = snapshot.data();
        const appointmentId = context.params.appointmentId;
        
        console.log('[Push] Yeni randevu:', appointmentId, appointment);
        
        if (!appointment.salonId) {
            console.log('[Push] Salon ID yok, bildirim gönderilmedi');
            return null;
        }
        
        try {
            // Salon bilgilerini al (slug için)
            let salonSlug = appointment.salonSlug || '';
            if (!salonSlug) {
                const salonDoc = await db.collection('salons').doc(appointment.salonId).get();
                if (salonDoc.exists) {
                    salonSlug = salonDoc.data().slug || '';
                }
            }
            
            // 1. Salon sahibinin push token'larını al
            const ownerTokensSnapshot = await db.collection('push_tokens')
                .where('salonId', '==', appointment.salonId)
                .where('userType', '==', 'salon')
                .get();
            
            // 2. İlgili personelin push token'larını al (staffId veya staffName ile)
            let staffTokensSnapshot = null;
            if (appointment.staffId || appointment.staffName) {
                // staffId ile dene
                if (appointment.staffId) {
                    staffTokensSnapshot = await db.collection('push_tokens')
                        .where('salonId', '==', appointment.salonId)
                        .where('userType', '==', 'staff')
                        .where('staffId', '==', appointment.staffId)
                        .get();
                }
                
                // staffId ile bulunamadıysa staffName ile dene
                if ((!staffTokensSnapshot || staffTokensSnapshot.empty) && appointment.staffName) {
                    staffTokensSnapshot = await db.collection('push_tokens')
                        .where('salonId', '==', appointment.salonId)
                        .where('userType', '==', 'staff')
                        .where('staffName', '==', appointment.staffName)
                        .get();
                }
            }
            
            // Token listesi oluştur (tekrar eden tokenları önle)
            const tokenSet = new Set();
            const tokens = [];
            
            // Salon sahibi tokenları
            ownerTokensSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.token && !tokenSet.has(data.token)) {
                    tokenSet.add(data.token);
                    tokens.push({ token: data.token, type: 'salon' });
                }
            });
            
            // Personel tokenları
            if (staffTokensSnapshot && !staffTokensSnapshot.empty) {
                staffTokensSnapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.token && !tokenSet.has(data.token)) {
                        tokenSet.add(data.token);
                        tokens.push({ token: data.token, type: 'staff', staffName: data.staffName });
                    }
                });
            }
            
            if (tokens.length === 0) {
                console.log('[Push] Hiç token bulunamadı:', appointment.salonId);
                return null;
            }
            
            console.log('[Push] Gönderilecek token sayısı:', tokens.length, '(Salon:', ownerTokensSnapshot.size, ', Personel:', staffTokensSnapshot?.size || 0, ')');
            
            // Bildirim içeriği
            const notification = {
                title: '🎉 Yeni Randevu!',
                body: `${appointment.customerName || 'Müşteri'} - ${appointment.service || 'Hizmet'}\n${appointment.date || ''} ${appointment.time || ''}`
            };
            
            const clickUrl = salonSlug ? `https://zamanli.com/berber/salon/yonetim/?slug=${salonSlug}` : 'https://zamanli.com/berber/';
            
            // FCM mesajı - SES VE TİTREŞİM AKTİF
            const message = {
                notification: notification,
                data: {
                    type: 'new_appointment',
                    appointmentId: appointmentId,
                    salonId: appointment.salonId,
                    salonSlug: salonSlug,
                    customerName: appointment.customerName || '',
                    service: appointment.service || '',
                    date: appointment.date || '',
                    time: appointment.time || '',
                    click_action: clickUrl,
                    playSound: 'true' // Özel ses için flag
                },
                webpush: {
                    headers: {
                        'Urgency': 'high' // Yüksek öncelik
                    },
                    notification: {
                        ...notification,
                        icon: 'https://zamanli.com/icons/icon-192x192.png',
                        badge: 'https://zamanli.com/icons/icon-72x72.png',
                        vibrate: [300, 100, 300, 100, 300], // Güçlü titreşim
                        requireInteraction: true,
                        silent: false, // SES AÇIK
                        renotify: true,
                        tag: 'new-appointment-' + appointmentId,
                        actions: [
                            {
                                action: 'view',
                                title: '👁️ Görüntüle'
                            },
                            {
                                action: 'dismiss',
                                title: '❌ Kapat'
                            }
                        ]
                    },
                    fcmOptions: {
                        link: clickUrl
                    }
                },
                android: {
                    priority: 'high', // Yüksek öncelik
                    notification: {
                        ...notification,
                        icon: 'ic_notification',
                        color: '#10B981',
                        sound: 'default', // Varsayılan ses
                        channelId: 'high_importance_channel', // Yüksek önem kanalı
                        defaultSound: true,
                        defaultVibrateTimings: true,
                        notificationPriority: 'PRIORITY_MAX',
                        visibility: 'PUBLIC',
                        clickAction: 'OPEN_ACTIVITY'
                    }
                },
                apns: {
                    headers: {
                        'apns-priority': '10' // Maksimum öncelik
                    },
                    payload: {
                        aps: {
                            alert: notification,
                            sound: 'default', // iOS ses
                            badge: 1,
                            'content-available': 1,
                            'mutable-content': 1
                        }
                    }
                }
            };
            
            // Her token'a gönder
            const sendPromises = tokens.map(async (tokenObj) => {
                try {
                    const response = await messaging.send({
                        ...message,
                        token: tokenObj.token
                    });
                    console.log('[Push] Başarılı:', tokenObj.type, tokenObj.token.substring(0, 20) + '...', response);
                    return { success: true, token: tokenObj.token, type: tokenObj.type };
                } catch (error) {
                    console.error('[Push] Hata:', tokenObj.type, tokenObj.token.substring(0, 20) + '...', error.code);
                    
                    // Geçersiz token'ı sil
                    if (error.code === 'messaging/invalid-registration-token' ||
                        error.code === 'messaging/registration-token-not-registered') {
                        await deleteInvalidToken(tokenObj.token);
                    }
                    
                    return { success: false, token: tokenObj.token, type: tokenObj.type, error: error.code };
                }
            });
            
            const results = await Promise.all(sendPromises);
            const successCount = results.filter(r => r.success).length;
            
            console.log('[Push] Sonuç:', successCount, '/', tokens.length, 'başarılı');
            
            // Bildirim logunu kaydet
            await db.collection('notification_logs').add({
                type: 'new_appointment',
                appointmentId: appointmentId,
                salonId: appointment.salonId,
                tokenCount: tokens.length,
                successCount: successCount,
                results: results,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            return { success: true, sent: successCount, total: tokens.length };
            
        } catch (error) {
            console.error('[Push] Genel hata:', error);
            return { success: false, error: error.message };
        }
    });

/**
 * Randevu durumu değiştiğinde müşteriye bildirim gönder
 * (Onaylandı, İptal edildi, vb.)
 */
exports.onAppointmentStatusChange = functions
    .region('europe-west1')
    .firestore
    .document('appointments/{appointmentId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();
        const appointmentId = context.params.appointmentId;
        
        // Status değişmemişse çık
        if (before.status === after.status) {
            return null;
        }
        
        console.log('[Push] Randevu durumu değişti:', appointmentId, before.status, '->', after.status);
        
        // Müşteri token'ı varsa bildirim gönder
        if (!after.customerPhone) {
            console.log('[Push] Müşteri telefonu yok');
            return null;
        }
        
        try {
            // Müşterinin push token'larını al (telefon numarasına göre)
            const tokensSnapshot = await db.collection('push_tokens')
                .where('userType', '==', 'customer')
                .where('phone', '==', after.customerPhone)
                .get();
            
            if (tokensSnapshot.empty) {
                console.log('[Push] Müşteri için token bulunamadı');
                return null;
            }
            
            const tokens = [];
            tokensSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.token) tokens.push(data.token);
            });
            
            if (tokens.length === 0) return null;
            
            // Durum mesajları
            let notification;
            switch (after.status) {
                case 'confirmed':
                    notification = {
                        title: '✅ Randevunuz Onaylandı!',
                        body: `${after.salonName || 'Salon'} - ${after.date} ${after.time}`
                    };
                    break;
                case 'cancelled':
                    notification = {
                        title: '❌ Randevunuz İptal Edildi',
                        body: `${after.salonName || 'Salon'} - ${after.date} ${after.time}`
                    };
                    break;
                case 'completed':
                    notification = {
                        title: '🎉 Randevunuz Tamamlandı',
                        body: `${after.salonName || 'Salon'}'ı değerlendirmeyi unutmayın!`
                    };
                    break;
                default:
                    return null;
            }
            
            // Her token'a gönder
            for (const token of tokens) {
                try {
                    await messaging.send({
                        token: token,
                        notification: notification,
                        webpush: {
                            notification: {
                                ...notification,
                                icon: '/icons/icon-192x192.png',
                                badge: '/icons/icon-72x72.png'
                            }
                        }
                    });
                } catch (error) {
                    console.error('[Push] Müşteri bildirimi hatası:', error.code);
                    if (error.code === 'messaging/invalid-registration-token' ||
                        error.code === 'messaging/registration-token-not-registered') {
                        await deleteInvalidToken(token);
                    }
                }
            }
            
            return { success: true };
            
        } catch (error) {
            console.error('[Push] Durum değişikliği bildirimi hatası:', error);
            return { success: false, error: error.message };
        }
    });

/**
 * Randevu hatırlatma bildirimi (Scheduled Function)
 * Her saat başı çalışır ve 1 saat sonraki randevuları hatırlatır
 */
exports.sendAppointmentReminders = functions
    .region('europe-west1')
    .pubsub
    .schedule('0 * * * *') // Her saat başı
    .timeZone('Europe/Istanbul')
    .onRun(async (context) => {
        console.log('[Reminder] Hatırlatma kontrolü başladı');
        
        const now = new Date();
        const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
        
        // Bugünün tarihi
        const today = now.toISOString().split('T')[0];
        const targetHour = oneHourLater.getHours().toString().padStart(2, '0') + ':00';
        
        try {
            // 1 saat sonraki randevuları bul
            const appointmentsSnapshot = await db.collection('appointments')
                .where('date', '==', today)
                .where('time', '==', targetHour)
                .where('status', 'in', ['pending', 'confirmed'])
                .where('reminderSent', '!=', true)
                .get();
            
            console.log('[Reminder] Bulunan randevu sayısı:', appointmentsSnapshot.size);
            
            for (const doc of appointmentsSnapshot.docs) {
                const apt = doc.data();
                
                // Müşteriye hatırlatma gönder
                if (apt.customerPhone) {
                    const tokensSnapshot = await db.collection('push_tokens')
                        .where('userType', '==', 'customer')
                        .where('phone', '==', apt.customerPhone)
                        .get();
                    
                    for (const tokenDoc of tokensSnapshot.docs) {
                        const token = tokenDoc.data().token;
                        if (token) {
                            try {
                                await messaging.send({
                                    token: token,
                                    notification: {
                                        title: '⏰ Randevu Hatırlatma',
                                        body: `${apt.salonName || 'Randevunuz'} 1 saat sonra! ${apt.time}`
                                    },
                                    webpush: {
                                        notification: {
                                            icon: '/icons/icon-192x192.png',
                                            badge: '/icons/icon-72x72.png'
                                        }
                                    }
                                });
                            } catch (error) {
                                console.error('[Reminder] Bildirim hatası:', error.code);
                            }
                        }
                    }
                }
                
                // Hatırlatma gönderildi olarak işaretle
                await doc.ref.update({ reminderSent: true });
            }
            
            console.log('[Reminder] Tamamlandı');
            return null;
            
        } catch (error) {
            console.error('[Reminder] Hata:', error);
            return null;
        }
    });

/**
 * Manuel bildirim gönderme (HTTP endpoint)
 * Test ve özel durumlar için kullanılır
 */
exports.sendPushNotification = functions
    .region('europe-west1')
    .https
    .onCall(async (data, context) => {
        // Yetkilendirme kontrolü (opsiyonel)
        // if (!context.auth) {
        //     throw new functions.https.HttpsError('unauthenticated', 'Yetkilendirme gerekli');
        // }
        
        const { token, title, body, data: notificationData } = data;
        
        if (!token || !title) {
            throw new functions.https.HttpsError('invalid-argument', 'Token ve title gerekli');
        }
        
        try {
            const response = await messaging.send({
                token: token,
                notification: {
                    title: title,
                    body: body || ''
                },
                data: notificationData || {},
                webpush: {
                    notification: {
                        icon: '/icons/icon-192x192.png',
                        badge: '/icons/icon-72x72.png'
                    }
                }
            });
            
            return { success: true, messageId: response };
            
        } catch (error) {
            console.error('[Manual Push] Hata:', error);
            throw new functions.https.HttpsError('internal', error.message);
        }
    });

/**
 * Geçersiz token'ı sil
 */
async function deleteInvalidToken(token) {
    try {
        const snapshot = await db.collection('push_tokens')
            .where('token', '==', token)
            .get();
        
        const batch = db.batch();
        snapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        console.log('[Push] Geçersiz token silindi');
    } catch (error) {
        console.error('[Push] Token silme hatası:', error);
    }
}

/**
 * Token temizleme (30 günden eski inaktif tokenları sil)
 * Haftada bir çalışır
 */
exports.cleanupOldTokens = functions
    .region('europe-west1')
    .pubsub
    .schedule('0 3 * * 0') // Her Pazar 03:00
    .timeZone('Europe/Istanbul')
    .onRun(async (context) => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        try {
            const oldTokensSnapshot = await db.collection('push_tokens')
                .where('lastActive', '<', thirtyDaysAgo)
                .get();
            
            console.log('[Cleanup] Silinecek eski token sayısı:', oldTokensSnapshot.size);
            
            const batch = db.batch();
            oldTokensSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            console.log('[Cleanup] Temizlik tamamlandı');
            
            return null;
        } catch (error) {
            console.error('[Cleanup] Hata:', error);
            return null;
        }
    });
