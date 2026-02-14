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
 * - Rate limiting: phone+salonId bazlı, 5 deneme / 15 dk
 * - Lazy migration: düz metin PIN varsa otomatik hash'e çevir
 */
exports.verifyPinAuth = functions
    .region('europe-west1')
    .https.onCall(async (data, context) => {
        let { salonId, pin, userType, staffId, phone } = data;
        if (phone) phone = String(phone).replace(/\D/g, '').slice(-10);
        
        console.log('[Auth] PIN doğrulama isteği:', { salonId, userType, phone: phone ? '***' + phone.slice(-4) : null });
        
        // Validation
        if (!pin) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'PIN gerekli'
            );
        }
        
        const MAX_ATTEMPTS = 5;
        const LOCKOUT_MINUTES = 15;
        
        try {
            // === TELEFON İLE SALON ARAMA (salonId yoksa) ===
            let salonData = null;
            let docRef = null;
            
            if (!salonId && phone) {
                const phone10 = phone.length === 10 ? phone : phone.replace(/\D/g, '').slice(-10);
                if (phone10.length !== 10) {
                    throw new functions.https.HttpsError('invalid-argument', 'Geçerli 10 haneli telefon numarası girin');
                }
                console.log('[Auth] Telefon ile salon aranıyor...');
                
                const salonsSnap = await db.collection('salons').get();
                
                for (const doc of salonsSnap.docs) {
                    const sd = doc.data();
                    
                    // 1. Salon sahibi telefon eşleşmesi
                    const salonPhone = (sd.phone || '').replace(/\D/g, '').slice(-10);
                    const salonMobile = (sd.mobilePhone || '').replace(/\D/g, '').slice(-10);
                    if (salonPhone === phone10 || salonMobile === phone10) {
                        salonId = doc.id;
                        salonData = sd;
                        docRef = db.collection('salons').doc(doc.id);
                        userType = 'owner';
                        staffId = null;
                        
                        // Owner staff array'inde isOwner olarak varsa kontrol et
                        if (sd.staff) {
                            const ownerStaff = sd.staff.find(s => s.isOwner === true);
                            if (ownerStaff) staffId = null; // owner PIN kullanılacak
                        }
                        break;
                    }
                    
                    // 2. Personel telefon eşleşmesi
                    const staffArray = sd.staff || [];
                    const matchedStaff = staffArray.find(s => {
                        const sp = (s.phone || '').replace(/\D/g, '').slice(-10);
                        return sp === phone10;
                    });
                    
                    if (matchedStaff) {
                        salonId = doc.id;
                        salonData = sd;
                        docRef = db.collection('salons').doc(doc.id);
                        if (matchedStaff.isOwner) {
                            userType = 'owner';
                            staffId = null;
                        } else {
                            userType = 'staff';
                            staffId = matchedStaff.id || matchedStaff.name;
                        }
                        break;
                    }
                }
                
                if (!salonId) {
                    throw new functions.https.HttpsError('not-found', 'Bu telefon numarası kayıtlı değil');
                }
                phone = phone10;
                console.log('[Auth] Salon bulundu:', salonId, 'userType:', userType);
            }
            
            if (!salonId) {
                throw new functions.https.HttpsError('invalid-argument', 'Salon ID veya telefon numarası gerekli');
            }
            
            // === RATE LIMIT CHECK ===
            const rateLimitKey = `${phone || 'unknown'}_${salonId}`.replace(/[^a-zA-Z0-9_]/g, '_');
            const attemptsRef = db.collection('admin').doc('pinAttempts_' + rateLimitKey);
            const attemptsDoc = await attemptsRef.get();
            
            if (attemptsDoc.exists) {
                const ad = attemptsDoc.data();
                const failedCount = ad.failedCount || 0;
                const lastFailed = ad.lastFailedAt?.toDate?.() || new Date(ad.lastFailedAt || 0);
                const lockoutUntil = new Date(lastFailed.getTime() + LOCKOUT_MINUTES * 60 * 1000);
                
                if (failedCount >= MAX_ATTEMPTS && new Date() < lockoutUntil) {
                    const remaining = Math.ceil((lockoutUntil - new Date()) / 60000);
                    throw new functions.https.HttpsError(
                        'resource-exhausted',
                        `Çok fazla yanlış deneme. ${remaining} dakika sonra tekrar deneyin.`
                    );
                }
                // Lockout süresi geçtiyse sıfırla
                if (failedCount >= MAX_ATTEMPTS && new Date() >= lockoutUntil) {
                    await attemptsRef.update({ failedCount: 0 });
                }
            }
            
            // === PIN LOOKUP ===
            let userDoc;
            let storedPin;
            let staffIndex = -1; // staff array güncelleme için index
            
            // Salon dokümanı henüz okunmadıysa oku
            if (!salonData) {
                docRef = db.collection('salons').doc(salonId);
                const salonSnap = await docRef.get();
                if (!salonSnap.exists) {
                    throw new functions.https.HttpsError('not-found', 'Salon bulunamadı');
                }
                salonData = salonSnap.data();
            }
            
            if (userType === 'staff' && staffId) {
                // Staff: salon dokümanındaki staff array'inden bul
                const staffArray = salonData.staff || [];
                staffIndex = staffArray.findIndex(s => 
                    s.id === staffId || s.name === staffId
                );
                if (staffIndex === -1) {
                    throw new functions.https.HttpsError('not-found', 'Personel bulunamadı');
                }
                userDoc = staffArray[staffIndex];
                storedPin = userDoc.pin;
            } else {
                // Owner: salon dokümanının kendi pin'i
                userDoc = salonData;
                storedPin = salonData.pin;
            }
            
            // === PIN VERIFY (hash veya düz metin + lazy migration) ===
            let isValid = false;
            const isHashed = storedPin && storedPin.startsWith('$2a$');
            
            if (isHashed) {
                isValid = await verifyPin(pin, storedPin);
            } else {
                // Düz metin karşılaştırma (eski salonlar)
                isValid = (storedPin === pin);
                
                // Lazy migration: doğruysa hash'e çevir
                if (isValid && docRef) {
                    try {
                        const newHash = await bcrypt.hash(pin.toString(), SALT_ROUNDS);
                        if (userType === 'staff' && staffIndex >= 0) {
                            // Staff: salon dokümanındaki staff array'ini güncelle
                            const freshSnap = await docRef.get();
                            const freshData = freshSnap.data();
                            const updatedStaff = [...(freshData.staff || [])];
                            if (updatedStaff[staffIndex]) {
                                updatedStaff[staffIndex].pin = newHash;
                                updatedStaff[staffIndex].pinMigratedAt = new Date().toISOString();
                                await docRef.update({ staff: updatedStaff });
                            }
                        } else {
                            // Owner: salon dokümanını doğrudan güncelle
                            await docRef.update({ pin: newHash, pinMigratedAt: admin.firestore.FieldValue.serverTimestamp() });
                        }
                        console.log('[Auth] PIN lazy migrated to bcrypt for', salonId);
                    } catch (migErr) {
                        console.error('[Auth] Lazy migration hatası:', migErr);
                    }
                }
            }
            
            if (isValid) {
                console.log('[Auth] PIN doğru');
                
                // Başarılı girişte rate limit sayacını sıfırla
                attemptsRef.set({ failedCount: 0, lastSuccessAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }).catch(() => {});
                
                // Rol belirleme (staffRole RBAC alanı, role eski display alanı)
                const role = userType === 'staff' ? (userDoc.staffRole || userDoc.role || 'staff') : 'owner';
                
                // UID oluştur: salonId + userType + staffId kombinasyonu
                const uid = staffId 
                    ? `staff_${salonId}_${staffId}`.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 128)
                    : `owner_${salonId}`.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 128);
                
                // Firebase Custom Token oluştur (claims ile)
                let customToken = null;
                try {
                    customToken = await admin.auth().createCustomToken(uid, {
                        salonId: salonId,
                        role: role,
                        staffId: staffId || null,
                        level: role === 'owner' ? 50 : (role === 'operator' ? 30 : 10)
                    });
                    console.log('[Auth] Custom token oluşturuldu:', uid, role);
                    
                    // users/{uid} dokümanını oluştur/güncelle (fire-and-forget)
                    db.collection('users').doc(uid).set({
                        phone: phone || null,
                        name: userType === 'staff' ? (userDoc.name || staffId || '') : (salonData.ownerName || salonData.name || ''),
                        role: role,
                        salonId: salonId,
                        lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true }).catch(e => console.error('[Auth] User doc yazma hatası:', e));
                    
                } catch (tokenErr) {
                    console.error('[Auth] Custom token oluşturma hatası:', tokenErr);
                    // Token oluşturulamazsa da giriş başarılı sayılır (graceful degradation)
                }
                
                // Legacy session token (geçiş dönemi için)
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
                    customToken: customToken, // Firebase Auth Custom Token
                    sessionToken, // Legacy fallback
                    userData: {
                        uid: uid,
                        salonId,
                        salonName: salonData.name || salonData.salonName,
                        slug: salonData.slug,
                        role: role,
                        staffRole: role,
                        package: salonData.package || 'free',
                        // Staff bilgileri (client session oluşturma için)
                        staffId: staffId || null,
                        staffName: userType === 'staff' ? (userDoc.name || staffId || '') : null,
                        isOwner: userType === 'owner'
                    }
                };
            } else {
                console.log('[Auth] Yanlış PIN');
                
                // Başarısız deneme sayacını artır
                const currentCount = attemptsDoc.exists ? (attemptsDoc.data().failedCount || 0) : 0;
                await attemptsRef.set({
                    failedCount: currentCount + 1,
                    lastFailedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                
                const remaining = MAX_ATTEMPTS - (currentCount + 1);
                if (remaining > 0) {
                    throw new functions.https.HttpsError('unauthenticated', `Yanlış PIN. ${remaining} hak kaldı.`);
                } else {
                    throw new functions.https.HttpsError('resource-exhausted', `Çok fazla yanlış deneme. ${LOCKOUT_MINUTES} dakika sonra tekrar deneyin.`);
                }
            }
            
        } catch (error) {
            if (error instanceof functions.https.HttpsError) throw error;
            console.error('[Auth] Doğrulama hatası:', error);
            throw new functions.https.HttpsError('internal', 'Doğrulama hatası');
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
            // Her zaman salon dokümanını oku
            const salonRef = db.collection('salons').doc(salonId);
            const salonSnap = await salonRef.get();
            
            if (!salonSnap.exists) {
                throw new functions.https.HttpsError('not-found', 'Salon bulunamadı');
            }
            
            const salonData = salonSnap.data();
            let hashedPin;
            let staffIndex = -1;
            
            if (userType === 'staff' && staffId) {
                // Staff: salon dokümanındaki staff array'inden bul
                const staffArray = salonData.staff || [];
                staffIndex = staffArray.findIndex(s => s.id === staffId || s.name === staffId);
                if (staffIndex === -1) {
                    throw new functions.https.HttpsError('not-found', 'Personel bulunamadı');
                }
                hashedPin = staffArray[staffIndex].pin;
            } else {
                hashedPin = salonData.pin;
            }
            
            // Eski PIN'i doğrula (hash veya düz metin)
            let isValid = false;
            const isHashed = hashedPin && hashedPin.startsWith('$2a$');
            
            if (isHashed) {
                isValid = await verifyPin(oldPin, hashedPin);
            } else {
                // Düz metin karşılaştırma (eski salonlar)
                isValid = (hashedPin === oldPin);
                
                // Lazy migration: doğruysa hash'e çevir
                if (isValid) {
                    try {
                        const migHash = await bcrypt.hash(oldPin.toString(), SALT_ROUNDS);
                        if (userType === 'staff' && staffIndex >= 0) {
                            const freshSnap = await salonRef.get();
                            const updatedStaff = [...(freshSnap.data().staff || [])];
                            if (updatedStaff[staffIndex]) {
                                updatedStaff[staffIndex].pin = migHash;
                                await salonRef.update({ staff: updatedStaff });
                            }
                        } else {
                            await salonRef.update({ pin: migHash, pinMigratedAt: admin.firestore.FieldValue.serverTimestamp() });
                        }
                        console.log('[Auth] PIN lazy migrated during changePin');
                    } catch (migErr) {
                        console.error('[Auth] Lazy migration hatası:', migErr);
                    }
                }
            }
            
            if (!isValid) {
                throw new functions.https.HttpsError('unauthenticated', 'Mevcut PIN yanlış');
            }
            
            // Yeni PIN'i hashle ve kaydet
            const newHashedPin = await hashPin(newPin);
            
            if (userType === 'staff' && staffIndex >= 0) {
                // Staff: salon dokümanındaki staff array'ini güncelle
                const freshSnap = await salonRef.get();
                const updatedStaff = [...(freshSnap.data().staff || [])];
                if (updatedStaff[staffIndex]) {
                    updatedStaff[staffIndex].pin = newHashedPin;
                    updatedStaff[staffIndex].pinChangedAt = new Date().toISOString();
                    await salonRef.update({ staff: updatedStaff });
                }
            } else {
                // Owner: salon dokümanını doğrudan güncelle
                await salonRef.update({
                    pin: newHashedPin,
                    pinChangedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
            
            console.log('[Auth] ✅ PIN değiştirildi');
            
            return {
                success: true,
                message: 'PIN başarıyla değiştirildi'
            };
            
        } catch (error) {
            console.error('[Auth] PIN değiştirme hatası:', error);
            if (error instanceof functions.https.HttpsError) throw error;
            throw new functions.https.HttpsError('internal', error.message);
        }
    });

/**
 * Admin: Yeni personel ekle (PIN hashlenerek)
 */
exports.adminAddStaff = functions
    .region('europe-west1')
    .https.onCall(async (data, context) => {
        const { salonId, name, staffRole, phone, pin } = data;
        if (!salonId || !name) {
            throw new functions.https.HttpsError('invalid-argument', 'Salon ve ad gerekli');
        }
        const pinVal = (pin && String(pin).trim()) ? String(pin).trim() : '000000';
        if (pinVal.length < 4 || pinVal.length > 6) {
            throw new functions.https.HttpsError('invalid-argument', 'PIN 4-6 haneli olmalı');
        }
        try {
            const salonRef = db.collection('salons').doc(salonId);
            const salonSnap = await salonRef.get();
            if (!salonSnap.exists) {
                throw new functions.https.HttpsError('not-found', 'Salon bulunamadı');
            }
            const salonData = salonSnap.data();
            const staffArray = salonData.staff || [];
            const roleLabel = staffRole === 'operator' ? 'Operatör' : 'Personel';
            const hashedPin = await hashPin(pinVal);
            const newStaff = {
                id: 'staff-' + Date.now(),
                name: String(name).trim(),
                staffRole: staffRole || 'staff',
                role: roleLabel,
                title: roleLabel,
                phone: (phone != null) ? String(phone).replace(/\D/g, '').slice(-10) : '',
                pin: hashedPin,
                active: true,
                createdAt: new Date().toISOString()
            };
            staffArray.push(newStaff);
            await salonRef.update({ staff: staffArray });
            return { success: true };
        } catch (error) {
            if (error instanceof functions.https.HttpsError) throw error;
            throw new functions.https.HttpsError('internal', error.message);
        }
    });

/**
 * Admin: Personel bilgilerini güncelle (PIN dahil, hashlenerek)
 * Süper admin panelinden personel düzenleme için kullanılır.
 * - PIN asla düz metin saklanmaz
 * - newPin boşsa mevcut PIN korunur
 */
exports.adminSetStaffPin = functions
    .region('europe-west1')
    .https.onCall(async (data, context) => {
        const { salonId, staffId, newPin, name, staffRole, phone, active } = data;
        
        if (!salonId || !staffId) {
            throw new functions.https.HttpsError('invalid-argument', 'Salon ve personel ID gerekli');
        }
        
        try {
            const salonRef = db.collection('salons').doc(salonId);
            const salonSnap = await salonRef.get();
            if (!salonSnap.exists) {
                throw new functions.https.HttpsError('not-found', 'Salon bulunamadı');
            }
            
            const salonData = salonSnap.data();
            const staffArray = salonData.staff || [];
            const staffIndex = staffArray.findIndex(s => s.id === staffId || s.name === staffId);
            if (staffIndex === -1) {
                throw new functions.https.HttpsError('not-found', 'Personel bulunamadı');
            }
            
            const current = staffArray[staffIndex];
            const roleLabel = staffRole === 'operator' ? 'Operatör' : 'Personel';
            
            let pinToSave = current.pin;
            if (newPin && String(newPin).trim().length >= 4 && String(newPin).trim().length <= 6) {
                pinToSave = await hashPin(String(newPin).trim());
            }
            
            const updatedStaff = [...staffArray];
            updatedStaff[staffIndex] = {
                ...current,
                name: (name != null && name !== '') ? String(name).trim() : current.name,
                staffRole: staffRole || current.staffRole || 'staff',
                role: roleLabel,
                title: roleLabel,
                phone: (phone != null) ? String(phone).replace(/\D/g, '').slice(-10) : (current.phone || ''),
                pin: pinToSave,
                active: active !== false,
                updatedAt: new Date().toISOString()
            };
            
            await salonRef.update({ staff: updatedStaff });
            console.log('[Auth] Admin personel güncellendi:', staffId);
            return { success: true };
        } catch (error) {
            console.error('[Auth] adminSetStaffPin hatası:', error);
            if (error instanceof functions.https.HttpsError) throw error;
            throw new functions.https.HttpsError('internal', error.message);
        }
    });

/**
 * Batch PIN Migration - düz metin PIN'leri bcrypt'e çevir
 * HTTPS callable function (admin panelden tetiklenir)
 */
exports.migrateSalonPins = functions
    .region('europe-west1')
    .https.onCall(async (data, context) => {
        console.log('[Migration] PIN migration başlatılıyor...');
        
        try {
            const salonsSnap = await db.collection('salons').get();
            let migrated = 0;
            let skipped = 0;
            let errors = 0;
            
            let batch = db.batch();
            let batchCount = 0;
            
            for (const doc of salonsSnap.docs) {
                const salon = doc.data();
                const pin = salon.pin;
                
                // Zaten hashli mi?
                if (pin && !pin.startsWith('$2a$') && pin.length >= 4 && pin.length <= 6) {
                    try {
                        const hashed = await bcrypt.hash(pin, SALT_ROUNDS);
                        batch.update(doc.ref, { 
                            pin: hashed, 
                            pinMigratedAt: admin.firestore.FieldValue.serverTimestamp() 
                        });
                        migrated++;
                        batchCount++;
                        
                        // Firestore batch max 500
                        if (batchCount >= 400) {
                            await batch.commit();
                            batch = db.batch();
                            batchCount = 0;
                        }
                    } catch (e) {
                        errors++;
                        console.error('[Migration] Hata:', doc.id, e.message);
                    }
                } else {
                    skipped++;
                }
                
                // Staff PIN'leri lazy migration ile login sırasında migrate edilir
            }
            
            if (batchCount > 0) {
                await batch.commit();
            }
            
            console.log(`[Migration] Tamamlandı: ${migrated} migrate, ${skipped} atlandı, ${errors} hata`);
            return { success: true, migrated, skipped, errors };
        } catch (error) {
            console.error('[Migration] Genel hata:', error);
            throw new functions.https.HttpsError('internal', error.message);
        }
    });

/**
 * Super Admin doğrulama API endpoint
 * HTTPS callable function
 * - PIN, Firestore admin/superAdminConfig doc'unda bcrypt hash olarak saklanır
 * - Rate limiting: 5 yanlış deneme / 15 dk kilit
 */
exports.verifyAdminAuth = functions
    .region('europe-west1')
    .https.onCall(async (data, context) => {
        const { pin } = data;
        
        if (!pin || typeof pin !== 'string') {
            throw new functions.https.HttpsError('invalid-argument', 'PIN gerekli');
        }
        
        const MAX_ATTEMPTS = 5;
        const LOCKOUT_MINUTES = 15;
        
        try {
            // Rate limit kontrolü
            const attemptsRef = db.collection('admin').doc('loginAttempts');
            const attemptsDoc = await attemptsRef.get();
            
            if (attemptsDoc.exists) {
                const attemptsData = attemptsDoc.data();
                const failedCount = attemptsData.failedCount || 0;
                const lastFailedAt = attemptsData.lastFailedAt?.toDate?.() || new Date(attemptsData.lastFailedAt || 0);
                const lockoutUntil = new Date(lastFailedAt.getTime() + LOCKOUT_MINUTES * 60 * 1000);
                
                if (failedCount >= MAX_ATTEMPTS && new Date() < lockoutUntil) {
                    const remainingMin = Math.ceil((lockoutUntil - new Date()) / 60000);
                    console.log('[Admin Auth] Hesap kilitli. Kalan süre:', remainingMin, 'dk');
                    throw new functions.https.HttpsError(
                        'resource-exhausted',
                        `Çok fazla yanlış deneme. ${remainingMin} dakika sonra tekrar deneyin.`
                    );
                }
                
                // Lockout süresi geçtiyse sayacı sıfırla
                if (failedCount >= MAX_ATTEMPTS && new Date() >= lockoutUntil) {
                    await attemptsRef.update({ failedCount: 0 });
                }
            }
            
            // Admin config'i al
            const configRef = db.collection('admin').doc('superAdminConfig');
            const configDoc = await configRef.get();
            
            let hashedPin;
            
            if (configDoc.exists && configDoc.data().pinHash) {
                // Yeni sistem: bcrypt hash
                hashedPin = configDoc.data().pinHash;
            } else {
                // İlk kurulum: varsayılan şifreyi hashle ve kaydet
                const defaultPin = 'admin2026';
                // hashPin 4-6 karakter zorunluluğu var, admin şifresi daha uzun olabilir - doğrudan bcrypt
                hashedPin = await bcrypt.hash(defaultPin, SALT_ROUNDS);
                await configRef.set({
                    pinHash: hashedPin,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    note: 'Varsayılan şifre kullanılıyor - lütfen değiştirin'
                });
            }
            
            // PIN doğrula
            const isValid = await bcrypt.compare(pin, hashedPin);
            
            if (isValid) {
                console.log('[Admin Auth] Başarılı giriş');
                
                // Başarılı girişte sayacı sıfırla
                await attemptsRef.set({
                    failedCount: 0,
                    lastSuccessAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                
                return { success: true };
            } else {
                console.log('[Admin Auth] Yanlış PIN');
                
                // Başarısız deneme sayacını artır
                const currentCount = attemptsDoc.exists ? (attemptsDoc.data().failedCount || 0) : 0;
                await attemptsRef.set({
                    failedCount: currentCount + 1,
                    lastFailedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                
                const remaining = MAX_ATTEMPTS - (currentCount + 1);
                if (remaining > 0) {
                    throw new functions.https.HttpsError('unauthenticated', `Yanlış şifre. ${remaining} hak kaldı.`);
                } else {
                    throw new functions.https.HttpsError('resource-exhausted', `Çok fazla yanlış deneme. ${LOCKOUT_MINUTES} dakika sonra tekrar deneyin.`);
                }
            }
        } catch (error) {
            if (error instanceof functions.https.HttpsError) throw error;
            console.error('[Admin Auth] Hata:', error);
            throw new functions.https.HttpsError('internal', 'Doğrulama hatası');
        }
    });

/**
 * Super Admin şifre değiştirme
 * HTTPS callable function
 */
exports.changeAdminPin = functions
    .region('europe-west1')
    .https.onCall(async (data, context) => {
        const { currentPin, newPin } = data;
        
        if (!currentPin || !newPin) {
            throw new functions.https.HttpsError('invalid-argument', 'Mevcut ve yeni şifre gerekli');
        }
        
        if (newPin.length < 6) {
            throw new functions.https.HttpsError('invalid-argument', 'Yeni şifre en az 6 karakter olmalı');
        }
        
        try {
            const configRef = db.collection('admin').doc('superAdminConfig');
            const configDoc = await configRef.get();
            
            if (!configDoc.exists || !configDoc.data().pinHash) {
                throw new functions.https.HttpsError('not-found', 'Admin config bulunamadı');
            }
            
            // Mevcut şifreyi doğrula
            const isValid = await bcrypt.compare(currentPin, configDoc.data().pinHash);
            if (!isValid) {
                throw new functions.https.HttpsError('unauthenticated', 'Mevcut şifre yanlış');
            }
            
            // Yeni şifreyi hashle
            const newHash = await bcrypt.hash(newPin, SALT_ROUNDS);
            await configRef.update({
                pinHash: newHash,
                changedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            console.log('[Admin Auth] Şifre değiştirildi');
            return { success: true, message: 'Şifre başarıyla değiştirildi' };
        } catch (error) {
            if (error instanceof functions.https.HttpsError) throw error;
            console.error('[Admin Auth] Şifre değiştirme hatası:', error);
            throw new functions.https.HttpsError('internal', 'Şifre değiştirme hatası');
        }
    });

// Export helper functions
exports.hashPin = hashPin;
exports.verifyPin = verifyPin;
