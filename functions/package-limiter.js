/**
 * ZAMANLI - Paket Limit Kontrol Sistemi
 * 
 * Bu modül salon paketlerine göre limitleri kontrol eder:
 * - Free: 30 randevu/ay, 1 personel
 * - Pro: Sınırsız randevu, 5 personel
 * - Business: Sınırsız randevu, sınırsız personel
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

// Paket limitleri
const PACKAGE_LIMITS = {
    free: {
        monthlyAppointments: 30,
        maxStaff: 1,
        features: ['whatsapp', 'basicReports', 'qrCode']
    },
    pro: {
        monthlyAppointments: -1, // sınırsız
        maxStaff: 5,
        features: ['whatsapp', 'email', 'advancedReports', 'customerManagement']
    },
    business: {
        monthlyAppointments: -1, // sınırsız
        maxStaff: -1, // sınırsız
        features: ['all']
    }
};

/**
 * Aylık randevu sayısını al
 */
async function getMonthlyAppointmentCount(salonId) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const snapshot = await db.collection('appointments')
        .where('salonId', '==', salonId)
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startOfMonth))
        .where('status', '!=', 'cancelled')
        .count()
        .get();
    
    return snapshot.data().count;
}

/**
 * Personel sayısını al
 */
async function getStaffCount(salonId) {
    const snapshot = await db.collection('salons').doc(salonId)
        .collection('staff')
        .where('active', '==', true)
        .count()
        .get();
    
    return snapshot.data().count;
}

/**
 * Limit aşıldı bildirimi gönder
 */
async function sendLimitExceededNotification(salon, limitType) {
    const notification = {
        salonId: salon.id,
        type: 'limit_exceeded',
        limitType: limitType,
        message: limitType === 'appointments' 
            ? `Aylık ${PACKAGE_LIMITS.free.monthlyAppointments} randevu limitine ulaştınız. Pro pakete yükseltmek için tıklayın.`
            : `Maksimum ${PACKAGE_LIMITS.free.maxStaff} personel limitine ulaştınız. Pro pakete yükseltmek için tıklayın.`,
        upgradeUrl: 'https://zamanli.com/fiyatlandirma',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('notifications').add(notification);
    
    console.log(`[Limit] ${salon.data().name} - ${limitType} limiti aşıldı`);
}

/**
 * Randevu oluşturulduğunda limit kontrolü
 * Firestore trigger: appointments koleksiyonu
 */
exports.checkAppointmentLimit = functions
    .region('europe-west1')
    .firestore
    .document('appointments/{appointmentId}')
    .onCreate(async (snapshot, context) => {
        const appointment = snapshot.data();
        const appointmentId = context.params.appointmentId;
        
        console.log('[Package] Randevu kontrolü:', appointmentId);
        
        if (!appointment.salonId) {
            console.log('[Package] Salon ID yok');
            return null;
        }
        
        try {
            // Salon bilgilerini al
            const salonDoc = await db.collection('salons').doc(appointment.salonId).get();
            
            if (!salonDoc.exists) {
                console.log('[Package] Salon bulunamadı:', appointment.salonId);
                return null;
            }
            
            const salon = salonDoc.data();
            const packageType = salon.package || 'free';
            const limits = PACKAGE_LIMITS[packageType];
            
            // Free paket kontrolü
            if (packageType === 'free' && limits.monthlyAppointments > 0) {
                const currentCount = await getMonthlyAppointmentCount(appointment.salonId);
                
                console.log(`[Package] ${salon.name} - ${currentCount}/${limits.monthlyAppointments} randevu`);
                
                if (currentCount > limits.monthlyAppointments) {
                    // Limit aşıldı - randevuyu iptal et
                    await snapshot.ref.update({
                        status: 'cancelled',
                        cancelReason: 'Aylık randevu limiti aşıldı',
                        cancelledAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    
                    // Bildirim gönder
                    await sendLimitExceededNotification(salonDoc, 'appointments');
                    
                    console.log(`[Package] ❌ Randevu iptal edildi - limit aşıldı`);
                    return null;
                }
            }
            
            // Salon stats güncelle
            await salonDoc.ref.update({
                'monthlyStats.appointments': admin.firestore.FieldValue.increment(1),
                'monthlyStats.lastAppointment': admin.firestore.FieldValue.serverTimestamp()
            });
            
            console.log(`[Package] ✅ Randevu onaylandı`);
            return null;
            
        } catch (error) {
            console.error('[Package] Hata:', error);
            return null;
        }
    });

/**
 * Personel eklendiğinde limit kontrolü
 * Firestore trigger: salons/{salonId}/staff koleksiyonu
 */
exports.checkStaffLimit = functions
    .region('europe-west1')
    .firestore
    .document('salons/{salonId}/staff/{staffId}')
    .onCreate(async (snapshot, context) => {
        const staff = snapshot.data();
        const salonId = context.params.salonId;
        const staffId = context.params.staffId;
        
        console.log('[Package] Personel kontrolü:', staffId);
        
        try {
            // Salon bilgilerini al
            const salonDoc = await db.collection('salons').doc(salonId).get();
            
            if (!salonDoc.exists) {
                console.log('[Package] Salon bulunamadı:', salonId);
                return null;
            }
            
            const salon = salonDoc.data();
            const packageType = salon.package || 'free';
            const limits = PACKAGE_LIMITS[packageType];
            
            // Free ve Pro paket kontrolü
            if (limits.maxStaff > 0) {
                const currentCount = await getStaffCount(salonId);
                
                console.log(`[Package] ${salon.name} - ${currentCount}/${limits.maxStaff} personel`);
                
                if (currentCount > limits.maxStaff) {
                    // Limit aşıldı - personeli pasif yap
                    await snapshot.ref.update({
                        active: false,
                        inactiveReason: 'Personel limiti aşıldı',
                        deactivatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    
                    // Bildirim gönder
                    await sendLimitExceededNotification(salonDoc, 'staff');
                    
                    console.log(`[Package] ❌ Personel pasif edildi - limit aşıldı`);
                    return null;
                }
            }
            
            console.log(`[Package] ✅ Personel eklendi`);
            return null;
            
        } catch (error) {
            console.error('[Package] Hata:', error);
            return null;
        }
    });

/**
 * Her ayın ilk günü stats'ları sıfırla
 * Scheduled function: Her gün 00:00'da çalış
 */
exports.resetMonthlyStats = functions
    .region('europe-west1')
    .pubsub.schedule('0 0 1 * *') // Her ayın 1'i gece yarısı
    .timeZone('Europe/Istanbul')
    .onRun(async (context) => {
        console.log('[Package] Aylık stats sıfırlama başladı');
        
        try {
            const salonsSnapshot = await db.collection('salons').get();
            
            const batch = db.batch();
            let count = 0;
            
            salonsSnapshot.forEach((doc) => {
                batch.update(doc.ref, {
                    'monthlyStats.appointments': 0,
                    'monthlyStats.resetAt': admin.firestore.FieldValue.serverTimestamp()
                });
                count++;
            });
            
            await batch.commit();
            
            console.log(`[Package] ✅ ${count} salonun stats'ı sıfırlandı`);
            return null;
            
        } catch (error) {
            console.error('[Package] Stats sıfırlama hatası:', error);
            return null;
        }
    });

/**
 * Paket yükseltme/düşürme helper function
 */
async function updateSalonPackage(salonId, newPackage) {
    const limits = PACKAGE_LIMITS[newPackage];
    
    await db.collection('salons').doc(salonId).update({
        package: newPackage,
        packageLimits: limits,
        packageUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`[Package] Salon paketi güncellendi: ${newPackage}`);
}

// Export helper functions for external use
exports.updateSalonPackage = updateSalonPackage;
exports.PACKAGE_LIMITS = PACKAGE_LIMITS;
