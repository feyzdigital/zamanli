/**
 * ZAMANLI - Authentication Helper Functions
 * 
 * PIN hashleme ve doğrulama işlemleri
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');

const db = admin.firestore();

// Salt rounds for bcrypt
const SALT_ROUNDS = 10;

/**
 * PIN'i hashle
 */
async function hashPin(pin) {
    if (!pin || pin.length < 4 || pin.length > 6) {
        throw new Error('PIN 4-6 haneli olmalı');
    }
    
    return await bcrypt.hash(pin.toString(), SALT_ROUNDS);
}

/**
 * PIN'i doğrula
 */
async function verifyPin(pin, hashedPin) {
    return await bcrypt.compare(pin.toString(), hashedPin);
}

/**
 * Salon kaydı sırasında PIN'i hashle
 * Firestore trigger: salons koleksiyonu onCreate
 */
exports.hashSalonPin = functions
    .region('europe-west1')
    .firestore
    .document('salons/{salonId}')
    .onCreate(async (snapshot, context) => {
        const salon = snapshot.data();
        const salonId = context.params.salonId;
        
        console.log('[Auth] Yeni salon kaydı:', salonId);
        
        // Eğer PIN zaten hashlenmiş ise (bcrypt formatı $2a$ ile başlar)
        if (salon.pin && salon.pin.startsWith('$2a$')) {
            console.log('[Auth] PIN zaten hashlenmiş');
            return null;
        }
        
        // PIN'i hashle
        try {
            const hashedPin = await hashPin(salon.pin);
            
            await snapshot.ref.update({
                pin: hashedPin,
                pinHashedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            console.log('[Auth] ✅ PIN hashlendi');
            return null;
            
        } catch (error) {
            console.error('[Auth] PIN hashleme hatası:', error);
            return null;
        }
    });

/**
 * Personel kaydı sırasında PIN'i hashle
 * Firestore trigger: salons/{salonId}/staff koleksiyonu onCreate
 */
exports.hashStaffPin = functions
    .region('europe-west1')
    .firestore
    .document('salons/{salonId}/staff/{staffId}')
    .onCreate(async (snapshot, context) => {
        const staff = snapshot.data();
        const staffId = context.params.staffId;
        
        console.log('[Auth] Yeni personel kaydı:', staffId);
        
        // Eğer personelin PIN'i yoksa
        if (!staff.pin) {
            console.log('[Auth] Personel PIN yok');
            return null;
        }
        
        // Eğer PIN zaten hashlenmiş ise
        if (staff.pin.startsWith('$2a$')) {
            console.log('[Auth] PIN zaten hashlenmiş');
            return null;
        }
        
        // PIN'i hashle
        try {
            const hashedPin = await hashPin(staff.pin);
            
            await snapshot.ref.update({
                pin: hashedPin,
                pinHashedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            console.log('[Auth] ✅ Personel PIN hashlendi');
            return null;
            
        } catch (error) {
            console.error('[Auth] PIN hashleme hatası:', error);
            return null;
        }
    });

/**
 * PIN doğrulama API endpoint
 * HTTPS callable function
 */
exports.verifyPinAuth = functions
    .region('europe-west1')
    .https.onCall(async (data, context) => {
        const { salonId, pin, userType, staffId } = data;
        
        console.log('[Auth] PIN doğrulama isteği:', { salonId, userType });
        
        // Validation
        if (!salonId || !pin) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Salon ID ve PIN gerekli'
            );
        }
        
        try {
            let userDoc;
            let hashedPin;
            
            // Salon sahibi veya personel kontrolü
            if (userType === 'staff' && staffId) {
                // Personel
                const staffRef = await db.collection('salons').doc(salonId)
                    .collection('staff').doc(staffId).get();
                
                if (!staffRef.exists) {
                    throw new functions.https.HttpsError('not-found', 'Personel bulunamadı');
                }
                
                userDoc = staffRef.data();
                hashedPin = userDoc.pin;
            } else {
                // Salon sahibi
                const salonRef = await db.collection('salons').doc(salonId).get();
                
                if (!salonRef.exists) {
                    throw new functions.https.HttpsError('not-found', 'Salon bulunamadı');
                }
                
                userDoc = salonRef.data();
                hashedPin = userDoc.pin;
            }
            
            // PIN doğrula
            const isValid = await verifyPin(pin, hashedPin);
            
            if (isValid) {
                console.log('[Auth] ✅ PIN doğru');
                
                // Session token oluştur (basit versiyon)
                const sessionToken = Buffer.from(
                    JSON.stringify({
                        salonId,
                        userType,
                        staffId: staffId || null,
                        timestamp: Date.now()
                    })
                ).toString('base64');
                
                return {
                    success: true,
                    sessionToken,
                    userData: {
                        salonId,
                        salonName: userDoc.name || userDoc.salonName,
                        role: userType === 'staff' ? userDoc.role : 'owner',
                        package: userDoc.package || 'free'
                    }
                };
            } else {
                console.log('[Auth] ❌ Yanlış PIN');
                throw new functions.https.HttpsError('unauthenticated', 'Yanlış PIN');
            }
            
        } catch (error) {
            console.error('[Auth] Doğrulama hatası:', error);
            throw new functions.https.HttpsError('internal', error.message);
        }
    });

/**
 * PIN değiştirme API endpoint
 * HTTPS callable function
 */
exports.changePinAuth = functions
    .region('europe-west1')
    .https.onCall(async (data, context) => {
        const { salonId, oldPin, newPin, userType, staffId } = data;
        
        console.log('[Auth] PIN değiştirme isteği:', { salonId, userType });
        
        // Validation
        if (!salonId || !oldPin || !newPin) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Tüm alanlar gerekli'
            );
        }
        
        if (newPin.length < 4 || newPin.length > 6) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Yeni PIN 4-6 haneli olmalı'
            );
        }
        
        try {
            let userRef;
            let hashedPin;
            
            // Kullanıcı tipine göre referans al
            if (userType === 'staff' && staffId) {
                userRef = db.collection('salons').doc(salonId)
                    .collection('staff').doc(staffId);
            } else {
                userRef = db.collection('salons').doc(salonId);
            }
            
            const userDoc = await userRef.get();
            
            if (!userDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'Kullanıcı bulunamadı');
            }
            
            hashedPin = userDoc.data().pin;
            
            // Eski PIN'i doğrula
            const isValid = await verifyPin(oldPin, hashedPin);
            
            if (!isValid) {
                throw new functions.https.HttpsError('unauthenticated', 'Mevcut PIN yanlış');
            }
            
            // Yeni PIN'i hashle ve kaydet
            const newHashedPin = await hashPin(newPin);
            
            await userRef.update({
                pin: newHashedPin,
                pinChangedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            console.log('[Auth] ✅ PIN değiştirildi');
            
            return {
                success: true,
                message: 'PIN başarıyla değiştirildi'
            };
            
        } catch (error) {
            console.error('[Auth] PIN değiştirme hatası:', error);
            throw new functions.https.HttpsError('internal', error.message);
        }
    });

// Export helper functions
exports.hashPin = hashPin;
exports.verifyPin = verifyPin;
