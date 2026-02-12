/**
 * ZAMANLI - iyzico Payment Integration
 * 
 * Türkiye'ye özgü ödeme çözümü
 * Paket yükseltme ve abonelik yönetimi
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Iyzipay = require('iyzipay');

const db = admin.firestore();

/**
 * iyzico client oluştur
 */
function getIyzicoClient() {
    const apiKey = functions.config().iyzico?.api_key;
    const secretKey = functions.config().iyzico?.secret_key;
    const baseUrl = functions.config().iyzico?.base_url || 'https://api.iyzipay.com';
    
    if (!apiKey || !secretKey) {
        console.warn('[iyzico] Credentials eksik - test modu');
        return null;
    }
    
    return new Iyzipay({
        apiKey: apiKey,
        secretKey: secretKey,
        uri: baseUrl
    });
}

// Paket fiyatları (Türk Lirası)
const PACKAGE_PRICES = {
    pro: {
        monthly: {
            price: 899,
            pricePaid: 899, // Ödenen tutar
            name: 'Zamanli PRO - Aylık',
            description: 'Sınırsız randevu, 5 personel, email + WhatsApp bildirimleri'
        },
        yearly: {
            price: 8628, // 719 x 12
            pricePaid: 8628,
            name: 'Zamanli PRO - Yıllık (%20 İndirim)',
            description: 'Sınırsız randevu, 5 personel, yıllık özel fiyat'
        }
    },
    business: {
        monthly: {
            price: 1599,
            pricePaid: 1599,
            name: 'Zamanli BUSINESS - Aylık',
            description: 'Sınırsız randevu, sınırsız personel, tüm özellikler'
        },
        yearly: {
            price: 15348, // 1279 x 12
            pricePaid: 15348,
            name: 'Zamanli BUSINESS - Yıllık (%20 İndirim)',
            description: 'Sınırsız randevu, sınırsız personel, yıllık özel fiyat'
        }
    }
};

/**
 * iyzico Checkout Form oluştur
 * HTTPS callable function
 */
exports.createIyzicoCheckout = functions
    .region('europe-west1')
    .https.onCall(async (data, context) => {
        const { salonId, packageType, billingPeriod } = data;
        
        console.log('[iyzico] Checkout isteği:', { salonId, packageType, billingPeriod });
        
        // Validation
        if (!salonId || !packageType || !billingPeriod) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Salon ID, paket tipi ve ödeme periyodu gerekli'
            );
        }
        
        if (!['pro', 'business'].includes(packageType)) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Geçersiz paket tipi'
            );
        }
        
        if (!['monthly', 'yearly'].includes(billingPeriod)) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Geçersiz ödeme periyodu'
            );
        }
        
        try {
            const iyzicoClient = getIyzicoClient();
            
            if (!iyzicoClient) {
                // Test mode
                return {
                    testMode: true,
                    message: 'iyzico test modu - ödeme yapılmadı',
                    checkoutFormContent: '<div>TEST MODE - Ödeme formu burada görünecek</div>'
                };
            }
            
            // Salon bilgilerini al
            const salonDoc = await db.collection('salons').doc(salonId).get();
            
            if (!salonDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'Salon bulunamadı');
            }
            
            const salon = salonDoc.data();
            const packageInfo = PACKAGE_PRICES[packageType][billingPeriod];
            
            // Conversation ID (benzersiz işlem ID)
            const conversationId = `zamanli_${salonId}_${Date.now()}`;
            
            // Buyer (Alıcı) bilgileri
            // TC Kimlik ve IP adresi salon verisinden veya request context'inden alınır
            const buyerIdentity = salon.identityNumber || salon.tcKimlik || '00000000000';
            const buyerIp = context.rawRequest?.ip || context.rawRequest?.headers?.['x-forwarded-for'] || '0.0.0.0';
            
            if (buyerIdentity === '00000000000') {
                console.warn('[iyzico] TC Kimlik numarası eksik - salon ayarlarından girilmeli');
            }
            
            const buyer = {
                id: salonId,
                name: salon.ownerName || salon.name || 'Salon',
                surname: salon.ownerSurname || 'Sahibi',
                gsmNumber: salon.phone || '+905551234567',
                email: salon.ownerEmail || 'info@zamanli.com',
                identityNumber: buyerIdentity,
                lastLoginDate: new Date().toISOString().split('T')[0] + ' 00:00:00',
                registrationDate: (salon.createdAt?.toDate?.()?.toISOString()?.split('T')[0] || '2024-01-01') + ' 00:00:00',
                registrationAddress: salon.address || 'İstanbul, Türkiye',
                ip: buyerIp,
                city: salon.city || 'İstanbul',
                country: 'Türkiye',
                zipCode: salon.zipCode || '34000'
            };
            
            // Billing Address (Fatura adresi)
            const billingAddress = {
                contactName: salon.name || 'Salon Sahibi',
                city: salon.city || 'İstanbul',
                country: 'Türkiye',
                address: salon.address || 'İstanbul, Türkiye',
                zipCode: salon.zipCode || '34000'
            };
            
            // Shipping Address (aynı fatura adresi)
            const shippingAddress = billingAddress;
            
            // Basket Items (Sepet)
            const basketItems = [
                {
                    id: packageType + '_' + billingPeriod,
                    name: packageInfo.name,
                    category1: 'Abonelik',
                    category2: packageType.toUpperCase(),
                    itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
                    price: packageInfo.price.toFixed(2),
                    paidPrice: packageInfo.pricePaid.toFixed(2)
                }
            ];
            
            // Checkout Form Request
            const request = {
                locale: Iyzipay.LOCALE.TR,
                conversationId: conversationId,
                price: packageInfo.price.toFixed(2),
                paidPrice: packageInfo.pricePaid.toFixed(2),
                currency: Iyzipay.CURRENCY.TRY,
                basketId: conversationId,
                paymentGroup: Iyzipay.PAYMENT_GROUP.SUBSCRIPTION,
                callbackUrl: `https://zamanli.web.app/payment/callback?salonId=${salonId}&packageType=${packageType}&period=${billingPeriod}`,
                enabledInstallments: [1, 2, 3, 6, 9, 12], // Taksit seçenekleri
                buyer: buyer,
                shippingAddress: shippingAddress,
                billingAddress: billingAddress,
                basketItems: basketItems
            };
            
            // Checkout form oluştur
            const checkoutForm = await new Promise((resolve, reject) => {
                iyzicoClient.checkoutFormInitialize.create(request, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
            
            if (checkoutForm.status !== 'success') {
                console.error('[iyzico] Checkout form hatası:', checkoutForm.errorMessage);
                throw new functions.https.HttpsError('internal', checkoutForm.errorMessage);
            }
            
            console.log('[iyzico] ✅ Checkout form oluşturuldu:', checkoutForm.token);
            
            // Payment log kaydet
            await db.collection('payment_logs').add({
                salonId: salonId,
                provider: 'iyzico',
                packageType: packageType,
                billingPeriod: billingPeriod,
                amount: packageInfo.price,
                currency: 'TRY',
                conversationId: conversationId,
                token: checkoutForm.token,
                status: 'pending',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            // Return checkout form
            return {
                success: true,
                token: checkoutForm.token,
                checkoutFormContent: checkoutForm.checkoutFormContent,
                paymentPageUrl: checkoutForm.paymentPageUrl,
                conversationId: conversationId
            };
            
        } catch (error) {
            console.error('[iyzico] Hata:', error);
            throw new functions.https.HttpsError('internal', error.message);
        }
    });

/**
 * iyzico Callback Handler (Webhook değil, redirect callback)
 * HTTPS function
 */
exports.iyzicoCallback = functions
    .region('europe-west1')
    .https.onRequest(async (req, res) => {
        console.log('[iyzico] Callback alındı:', req.query);
        
        const { token, salonId, packageType, period } = req.query;
        
        if (!token) {
            return res.status(400).send('Token eksik');
        }
        
        try {
            const iyzicoClient = getIyzicoClient();
            
            if (!iyzicoClient) {
                return res.redirect(`https://zamanli.web.app/payment/success?status=test`);
            }
            
            // Ödeme sonucunu al
            const request = {
                locale: Iyzipay.LOCALE.TR,
                conversationId: 'zamanli_' + Date.now(),
                token: token
            };
            
            const result = await new Promise((resolve, reject) => {
                iyzicoClient.checkoutForm.retrieve(request, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
            
            console.log('[iyzico] Ödeme sonucu:', result.paymentStatus);
            
            // Payment log güncelle
            await db.collection('payment_logs')
                .where('token', '==', token)
                .limit(1)
                .get()
                .then(snapshot => {
                    if (!snapshot.empty) {
                        snapshot.docs[0].ref.update({
                            status: result.paymentStatus === 'SUCCESS' ? 'completed' : 'failed',
                            paymentId: result.paymentId,
                            fraudStatus: result.fraudStatus,
                            paidPrice: result.paidPrice,
                            errorMessage: result.errorMessage,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                    }
                });
            
            if (result.paymentStatus === 'SUCCESS') {
                // Başarılı ödeme - Salon paketini yükselt
                await db.collection('salons').doc(salonId).update({
                    package: packageType,
                    packagePeriod: period,
                    packageUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    subscriptionActive: true,
                    subscriptionEndDate: calculateSubscriptionEndDate(period)
                });
                
                // Payment kaydet
                await db.collection('payments').add({
                    salonId: salonId,
                    provider: 'iyzico',
                    packageType: packageType,
                    billingPeriod: period,
                    amount: parseFloat(result.paidPrice),
                    currency: result.currency,
                    paymentId: result.paymentId,
                    conversationId: result.conversationId,
                    status: 'completed',
                    paidAt: admin.firestore.FieldValue.serverTimestamp()
                });
                
                console.log('[iyzico] ✅ Paket yükseltildi:', salonId, packageType);
                
                // Başarı sayfasına yönlendir
                return res.redirect(`https://zamanli.web.app/payment/success?package=${packageType}&period=${period}`);
            } else {
                // Başarısız ödeme
                console.log('[iyzico] ❌ Ödeme başarısız:', result.errorMessage);
                return res.redirect(`https://zamanli.web.app/payment/failed?error=${encodeURIComponent(result.errorMessage)}`);
            }
            
        } catch (error) {
            console.error('[iyzico] Callback hatası:', error);
            return res.redirect(`https://zamanli.web.app/payment/failed?error=${encodeURIComponent(error.message)}`);
        }
    });

/**
 * iyzico Ödeme Geçmişi
 * HTTPS callable function
 */
exports.getIyzicoPayments = functions
    .region('europe-west1')
    .https.onCall(async (data, context) => {
        const { salonId } = data;
        
        if (!salonId) {
            throw new functions.https.HttpsError('invalid-argument', 'Salon ID gerekli');
        }
        
        try {
            const paymentsSnapshot = await db.collection('payments')
                .where('salonId', '==', salonId)
                .where('provider', '==', 'iyzico')
                .orderBy('paidAt', 'desc')
                .limit(50)
                .get();
            
            const payments = paymentsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                paidAt: doc.data().paidAt?.toDate().toISOString()
            }));
            
            return { payments };
            
        } catch (error) {
            console.error('[iyzico] Ödeme geçmişi hatası:', error);
            throw new functions.https.HttpsError('internal', error.message);
        }
    });

/**
 * Abonelik bitiş tarihini hesapla
 */
function calculateSubscriptionEndDate(period) {
    const now = new Date();
    const endDate = new Date(now);
    
    if (period === 'monthly') {
        endDate.setMonth(endDate.getMonth() + 1);
    } else if (period === 'yearly') {
        endDate.setFullYear(endDate.getFullYear() + 1);
    }
    
    return admin.firestore.Timestamp.fromDate(endDate);
}

/**
 * Abonelik kontrolü (Scheduled Function)
 * Her gün 03:00'da çalışır - süresi dolan abonelikleri kontrol eder
 */
exports.checkIyzicoSubscriptions = functions
    .region('europe-west1')
    .pubsub.schedule('0 3 * * *')
    .timeZone('Europe/Istanbul')
    .onRun(async (context) => {
        console.log('[iyzico] Abonelik kontrolü başladı');
        
        try {
            const now = admin.firestore.Timestamp.now();
            
            // Süresi dolmuş abonelikleri bul
            const expiredSnapshot = await db.collection('salons')
                .where('subscriptionActive', '==', true)
                .where('subscriptionEndDate', '<', now)
                .get();
            
            console.log('[iyzico] Süresi dolmuş abonelik sayısı:', expiredSnapshot.size);
            
            const batch = db.batch();
            
            expiredSnapshot.forEach(doc => {
                // Paketi free'ye düşür
                batch.update(doc.ref, {
                    package: 'free',
                    subscriptionActive: false,
                    subscriptionExpiredAt: admin.firestore.FieldValue.serverTimestamp()
                });
                
                console.log('[iyzico] Abonelik sona erdi:', doc.id);
            });
            
            await batch.commit();
            
            return null;
            
        } catch (error) {
            console.error('[iyzico] Abonelik kontrolü hatası:', error);
            return null;
        }
    });
