/**
 * ZAMANLI - Firebase Cloud Functions
 * 
 * Modüller:
 * - Push Notifications (mevcut)
 * - Package Limiter (paket limitleri)
 * - Auth Helpers (PIN hashleme)
 * - Email Notifications (EmailJS)
 * - WhatsApp URL Helper (Ücretsiz link sistemi)
 * - Payment Integration (iyzico)
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Firebase Admin SDK başlat
admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

// === Modül Import'ları ===
const packageLimiter = require('./package-limiter');
const authHelpers = require('./auth-helpers');
const emailNotifications = require('./email-notifications');
const whatsappUrlHelper = require('./whatsapp-url-helper');
const paymentIyzico = require('./payment-iyzico');

// === Package Limiter Functions ===
exports.checkAppointmentLimit = packageLimiter.checkAppointmentLimit;
exports.checkStaffLimit = packageLimiter.checkStaffLimit;
exports.resetMonthlyStats = packageLimiter.resetMonthlyStats;

// === Auth Helper Functions ===
exports.hashSalonPin = authHelpers.hashSalonPin;
exports.hashStaffPin = authHelpers.hashStaffPin;
exports.verifyPinAuth = authHelpers.verifyPinAuth;
exports.changePinAuth = authHelpers.changePinAuth;
exports.adminAddStaff = authHelpers.adminAddStaff;
exports.adminSetStaffPin = authHelpers.adminSetStaffPin;
exports.verifyAdminAuth = authHelpers.verifyAdminAuth;
exports.changeAdminPin = authHelpers.changeAdminPin;
exports.migrateSalonPins = authHelpers.migrateSalonPins;
exports.adminBroadcastNotification = authHelpers.adminBroadcastNotification;

// === Email Notification Functions ===
exports.sendAppointmentConfirmationEmail = emailNotifications.sendAppointmentConfirmationEmail;
exports.sendAppointmentCancellationEmail = emailNotifications.sendAppointmentCancellationEmail;
exports.sendAppointmentReminderEmails = emailNotifications.sendAppointmentReminders;
exports.sendNewSalonApprovalEmail = emailNotifications.sendNewSalonApprovalEmail;

// === WhatsApp URL Helper Functions (Ücretsiz Link Sistemi) ===
exports.createWhatsAppUrl = whatsappUrlHelper.createWhatsAppUrl;
exports.getWhatsAppTemplate = whatsappUrlHelper.getWhatsAppTemplate;
exports.createWhatsAppUrlOnConfirm = whatsappUrlHelper.createWhatsAppUrlOnConfirm;

// === Payment (iyzico) Functions ===
exports.createIyzicoCheckout = paymentIyzico.createIyzicoCheckout;
exports.iyzicoCallback = paymentIyzico.iyzicoCallback;
exports.getIyzicoPayments = paymentIyzico.getIyzicoPayments;
exports.checkIyzicoSubscriptions = paymentIyzico.checkIyzicoSubscriptions;

/**
 * Yeni randevu oluşturulduğunda SADECE ilgili personele bildirim gönder
 * Eğer personel atanmamışsa salon sahibine gönder
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
            let salonData = null;
            if (!salonSlug) {
                const salonDoc = await db.collection('salons').doc(appointment.salonId).get();
                if (salonDoc.exists) {
                    salonData = salonDoc.data();
                    salonSlug = salonData.slug || '';
                }
            }
            
            // Operatör kontrolü: Randevu operatöre atanmışsa reddet
            if (salonData && appointment.staffId) {
                const staffList = salonData.staff || [];
                const assignedStaff = staffList.find(s => 
                    (s.id || s.name) === appointment.staffId || s.name === appointment.staffName
                );
                if (assignedStaff && (assignedStaff.role === 'operator' || assignedStaff.staffRole === 'operator')) {
                    console.log('[Push] Operatör personele randevu atanamaz:', appointment.staffId);
                    // Randevuyu iptal et
                    await snapshot.ref.update({ 
                        status: 'cancelled', 
                        cancelReason: 'Operatör personele randevu oluşturulamaz',
                        cancelledAt: new Date().toISOString()
                    });
                    return null;
                }
            }
            
            // Token listesi oluştur
            const tokenSet = new Set();
            const tokens = [];
            
            // ÖNCE: Personel atanmışsa SADECE personele gönder
            if (appointment.staffId || appointment.staffName) {
                let staffTokensSnapshot = null;
                
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
                
                // Personel tokenları ekle (operatör hariç)
                if (staffTokensSnapshot && !staffTokensSnapshot.empty) {
                    staffTokensSnapshot.forEach(doc => {
                        const data = doc.data();
                        // Operatör rolündeki personele bildirim GÖNDERİLMEZ
                        if (data.staffRole === 'operator') {
                            console.log('[Push] Operatör atlandı:', data.staffName);
                            return;
                        }
                        if (data.token && !tokenSet.has(data.token)) {
                            tokenSet.add(data.token);
                            tokens.push({ token: data.token, type: 'staff', staffName: data.staffName });
                        }
                    });
                    console.log('[Push] Sadece personele gönderilecek:', tokens.length);
                }
            }
            
            // Personel bulunamadıysa veya personel atanmamışsa salon sahibine gönder
            if (tokens.length === 0) {
                const ownerTokensSnapshot = await db.collection('push_tokens')
                    .where('salonId', '==', appointment.salonId)
                    .where('userType', '==', 'salon')
                    .get();
                
                ownerTokensSnapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.token && !tokenSet.has(data.token)) {
                        tokenSet.add(data.token);
                        tokens.push({ token: data.token, type: 'salon' });
                    }
                });
                console.log('[Push] Salon sahibine gönderilecek:', tokens.length);
            }
            
            if (tokens.length === 0) {
                console.log('[Push] Hiç token bulunamadı:', appointment.salonId);
                return null;
            }
            
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
                    url: clickUrl, // Service Worker click handler için
                    link: clickUrl, // Background message handler için
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
            
            // Bildirim logunu kaydet (fire-and-forget - gecikme yaratmasin)
            db.collection('notification_logs').add({
                type: 'new_appointment',
                appointmentId: appointmentId,
                salonId: appointment.salonId,
                tokenCount: tokens.length,
                successCount: successCount,
                results: results,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            }).catch(e => console.error('[Push] Log kaydetme hatası:', e));
            
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
 * Her 15 dakikada bir çalışır ve yaklaşan randevuları kontrol eder
 * Salon ayarlarından hatırlatma süresini okur
 */
exports.sendAppointmentReminders = functions
    .region('europe-west1')
    .pubsub
    .schedule('*/15 * * * *') // Her 15 dakikada bir
    .timeZone('Europe/Istanbul')
    .onRun(async (context) => {
        console.log('[Reminder] Hatırlatma kontrolü başladı');
        
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        try {
            // Bugün ve yarın için bekleyen/onaylı randevuları al
            const appointmentsSnapshot = await db.collection('appointments')
                .where('date', 'in', [today, tomorrow])
                .where('status', 'in', ['pending', 'confirmed'])
                .get();
            
            console.log('[Reminder] Kontrol edilecek randevu sayısı:', appointmentsSnapshot.size);
            
            let sentCount = 0;
            
            for (const doc of appointmentsSnapshot.docs) {
                const apt = doc.data();
                const aptId = doc.id;
                
                // Zaten hatırlatma gönderilmiş mi?
                if (apt.reminderSent === true) {
                    continue;
                }
                
                // Salon ayarlarını al
                let reminderHours = 1; // Varsayılan 1 saat
                if (apt.salonId) {
                    try {
                        const salonDoc = await db.collection('salons').doc(apt.salonId).get();
                        if (salonDoc.exists) {
                            const salonData = salonDoc.data();
                            reminderHours = parseFloat(salonData.advancedSettings?.reminderHours) || 1;
                        }
                    } catch (e) {
                        console.log('[Reminder] Salon ayarları alınamadı:', apt.salonId);
                    }
                }
                
                // Hatırlatma kapalıysa atla
                if (reminderHours === 0) {
                    continue;
                }
                
                // Randevu zamanını hesapla
                const aptDateTime = new Date(apt.date + 'T' + apt.time + ':00');
                const reminderTime = new Date(aptDateTime.getTime() - reminderHours * 60 * 60 * 1000);
                
                // Hatırlatma zamanı geldi mi? (±10 dakika tolerans)
                const timeDiff = now.getTime() - reminderTime.getTime();
                const shouldRemind = timeDiff >= 0 && timeDiff <= 15 * 60 * 1000; // 15 dakika içinde
                
                if (!shouldRemind) {
                    continue;
                }
                
                console.log('[Reminder] Hatırlatma gönderilecek:', aptId, apt.customerName, apt.time);
                
                // Personele bildirim gönder
                let tokensSent = 0;
                
                if (apt.staffId || apt.staffName) {
                    // Personel token'ını bul
                    let staffTokensSnapshot;
                    
                    if (apt.staffId) {
                        staffTokensSnapshot = await db.collection('push_tokens')
                            .where('salonId', '==', apt.salonId)
                            .where('userType', '==', 'staff')
                            .where('staffId', '==', apt.staffId)
                            .get();
                    }
                    
                    if ((!staffTokensSnapshot || staffTokensSnapshot.empty) && apt.staffName) {
                        staffTokensSnapshot = await db.collection('push_tokens')
                            .where('salonId', '==', apt.salonId)
                            .where('userType', '==', 'staff')
                            .where('staffName', '==', apt.staffName)
                            .get();
                    }
                    
                    if (staffTokensSnapshot && !staffTokensSnapshot.empty) {
                        for (const tokenDoc of staffTokensSnapshot.docs) {
                            const token = tokenDoc.data().token;
                            if (token) {
                                try {
                                    const hoursText = reminderHours < 1 ? `${reminderHours * 60} dakika` : `${reminderHours} saat`;
                                    await messaging.send({
                                        token: token,
                                        notification: {
                                            title: '⏰ Randevu Hatırlatma',
                                            body: `${apt.customerName} - ${hoursText} sonra!\n${apt.time} - ${apt.service || 'Randevu'}`
                                        },
                                        data: {
                                            type: 'reminder',
                                            appointmentId: aptId,
                                            customerName: apt.customerName || '',
                                            customerPhone: apt.customerPhone || '',
                                            time: apt.time || '',
                                            service: apt.service || ''
                                        },
                                        webpush: {
                                            notification: {
                                                icon: '/icons/icon-192x192.png',
                                                badge: '/icons/icon-72x72.png',
                                                vibrate: [200, 100, 200],
                                                requireInteraction: true,
                                                actions: [
                                                    { action: 'whatsapp', title: '📱 WhatsApp' },
                                                    { action: 'dismiss', title: 'Kapat' }
                                                ]
                                            }
                                        }
                                    });
                                    tokensSent++;
                                } catch (error) {
                                    console.error('[Reminder] Personel bildirimi hatası:', error.code);
                                    if (error.code === 'messaging/invalid-registration-token' ||
                                        error.code === 'messaging/registration-token-not-registered') {
                                        await deleteInvalidToken(token);
                                    }
                                }
                            }
                        }
                    }
                }
                
                // Personel bulunamadıysa salon sahibine gönder
                if (tokensSent === 0) {
                    const ownerTokensSnapshot = await db.collection('push_tokens')
                        .where('salonId', '==', apt.salonId)
                        .where('userType', '==', 'salon')
                        .get();
                    
                    for (const tokenDoc of ownerTokensSnapshot.docs) {
                        const token = tokenDoc.data().token;
                        if (token) {
                            try {
                                const hoursText = reminderHours < 1 ? `${reminderHours * 60} dakika` : `${reminderHours} saat`;
                                await messaging.send({
                                    token: token,
                                    notification: {
                                        title: '⏰ Randevu Hatırlatma',
                                        body: `${apt.customerName} - ${hoursText} sonra!\n${apt.time} - ${apt.service || 'Randevu'}`
                                    },
                                    data: {
                                        type: 'reminder',
                                        appointmentId: aptId,
                                        customerName: apt.customerName || '',
                                        customerPhone: apt.customerPhone || '',
                                        time: apt.time || '',
                                        service: apt.service || ''
                                    },
                                    webpush: {
                                        notification: {
                                            icon: '/icons/icon-192x192.png',
                                            badge: '/icons/icon-72x72.png',
                                            vibrate: [200, 100, 200],
                                            requireInteraction: true
                                        }
                                    }
                                });
                                tokensSent++;
                            } catch (error) {
                                console.error('[Reminder] Salon bildirimi hatası:', error.code);
                                if (error.code === 'messaging/invalid-registration-token' ||
                                    error.code === 'messaging/registration-token-not-registered') {
                                    await deleteInvalidToken(token);
                                }
                            }
                        }
                    }
                }
                
                // Hatırlatma gönderildi olarak işaretle
                if (tokensSent > 0) {
                    await doc.ref.update({ 
                        reminderSent: true,
                        reminderSentAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    sentCount++;
                }
            }
            
            console.log('[Reminder] Tamamlandı. Gönderilen:', sentCount);
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
            
            let batch = db.batch();
            let batchCount = 0;
            oldTokensSnapshot.forEach(doc => {
                batch.delete(doc.ref);
                batchCount++;
                if (batchCount >= 400) {
                    batch.commit();
                    batch = db.batch();
                    batchCount = 0;
                }
            });
            
            if (batchCount > 0) {
                await batch.commit();
            }
            console.log('[Cleanup] Temizlik tamamlandı');
            
            return null;
        } catch (error) {
            console.error('[Cleanup] Hata:', error);
            return null;
        }
    });

/**
 * Google Reviews Fetch & Cache
 * Callable function - salon detay sayfasından tetiklenir
 * 24 saat TTL ile cache'lenir
 */
exports.fetchGoogleReviews = functions
    .region('europe-west1')
    .https.onCall(async (data, context) => {
        const { salonId } = data;
        
        if (!salonId) {
            throw new functions.https.HttpsError('invalid-argument', 'Salon ID gerekli');
        }
        
        try {
            // Cache kontrolü (24 saat TTL)
            const cacheRef = db.collection('salons').doc(salonId).collection('googleReviewsCache').doc('latest');
            const cacheDoc = await cacheRef.get();
            
            if (cacheDoc.exists) {
                const cacheData = cacheDoc.data();
                const cachedAt = cacheData.cachedAt?.toDate?.() || new Date(0);
                const hoursSinceCached = (Date.now() - cachedAt.getTime()) / (1000 * 60 * 60);
                
                if (hoursSinceCached < 24) {
                    console.log('[Google Reviews] Cache geçerli, döndürülüyor');
                    return { success: true, reviews: cacheData.reviews || [], rating: cacheData.rating, userRatingsTotal: cacheData.userRatingsTotal || 0, fromCache: true };
                }
            }
            
            // Salon'un Google Place ID'sini al
            const salonDoc = await db.collection('salons').doc(salonId).get();
            if (!salonDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'Salon bulunamadı');
            }
            
            const salonData = salonDoc.data();
            let placeId = salonData.googlePlaceId || salonData.placeId;
            
            // Place ID yoksa URL'den çıkarmayı dene
            if (!placeId && salonData.googleBusinessUrl) {
                const url = salonData.googleBusinessUrl;
                const match = url.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+|ChIJ[a-zA-Z0-9_-]+)/i);
                if (match) placeId = match[1];
            }
            
            if (!placeId) {
                return { success: true, reviews: [], message: 'Google Place ID bulunamadı' };
            }
            
            // Google Places API çağrısı
            // NOT: API key functions config'den alınmalı
            const apiKey = functions.config().google?.places_api_key || '';
            
            if (!apiKey) {
                console.log('[Google Reviews] Google Places API key yapılandırılmamış');
                return { success: true, reviews: [], message: 'API key yapılandırılmamış' };
            }
            
            const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews,rating,user_ratings_total&language=tr&key=${apiKey}`;
            const response = await fetch(url);
            const result = await response.json();
            
            const reviews = (result.result?.reviews || []).map(r => ({
                author_name: r.author_name,
                rating: r.rating,
                text: r.text,
                relative_time_description: r.relative_time_description,
                profile_photo_url: r.profile_photo_url,
                time: r.time
            }));
            const rating = result.result?.rating || null;
            const userRatingsTotal = result.result?.user_ratings_total || 0;
            
            // Cache'e kaydet
            await cacheRef.set({
                reviews: reviews,
                rating: rating,
                userRatingsTotal: userRatingsTotal,
                cachedAt: admin.firestore.FieldValue.serverTimestamp(),
                placeId: placeId
            });
            
            console.log(`[Google Reviews] ${reviews.length} yorum, puan: ${rating} cache'lendi`);
            return { success: true, reviews, rating, userRatingsTotal, fromCache: false };
            
        } catch (error) {
            if (error instanceof functions.https.HttpsError) throw error;
            console.error('[Google Reviews] Hata:', error);
            return { success: false, reviews: [], error: error.message };
        }
    });
