/**
 * ZAMANLI - Stripe Payment Integration
 * 
 * Paket yükseltme ve abonelik yönetimi
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe');

const db = admin.firestore();

// Stripe client (Firebase Functions config ile ayarlanacak)
// firebase functions:config:set stripe.secret_key="sk_test_xxx"
// firebase functions:config:set stripe.webhook_secret="whsec_xxx"

function getStripeClient() {
    const secretKey = functions.config().stripe?.secret_key;
    
    if (!secretKey) {
        console.warn('[Stripe] Secret key eksik - test modu');
        return null;
    }
    
    return stripe(secretKey);
}

// Paket fiyatları (Türk Lirası - kuruş cinsinden)
const PACKAGE_PRICES = {
    pro: {
        monthly: 89900, // 899 TL
        yearly: 71900   // 719 TL (aylık)
    },
    business: {
        monthly: 159900, // 1599 TL
        yearly: 127900   // 1279 TL (aylık)
    }
};

/**
 * Stripe Checkout Session oluştur
 * HTTPS callable function
 */
exports.createCheckoutSession = functions
    .region('europe-west1')
    .https.onCall(async (data, context) => {
        const { salonId, packageType, billingPeriod } = data;
        
        console.log('[Stripe] Checkout session isteği:', { salonId, packageType, billingPeriod });
        
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
            const stripeClient = getStripeClient();
            
            if (!stripeClient) {
                // Test mode
                return {
                    testMode: true,
                    message: 'Stripe test modu - ödeme yapılmadı',
                    sessionId: 'test_session_' + Date.now()
                };
            }
            
            // Salon bilgilerini al
            const salonDoc = await db.collection('salons').doc(salonId).get();
            
            if (!salonDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'Salon bulunamadı');
            }
            
            const salon = salonDoc.data();
            const price = PACKAGE_PRICES[packageType][billingPeriod];
            
            // Ürün adı
            const productName = billingPeriod === 'yearly'
                ? `Zamanli ${packageType.toUpperCase()} - Yıllık (%20 İndirimli)`
                : `Zamanli ${packageType.toUpperCase()} - Aylık`;
            
            // Checkout session oluştur
            const session = await stripeClient.checkout.sessions.create({
                payment_method_types: ['card'],
                mode: 'subscription',
                line_items: [{
                    price_data: {
                        currency: 'try',
                        product_data: {
                            name: productName,
                            description: `${packageType === 'pro' ? 'Sınırsız randevu, 5 personel' : 'Sınırsız randevu ve personel, tüm özellikler'}`,
                        },
                        unit_amount: price,
                        recurring: {
                            interval: billingPeriod === 'yearly' ? 'year' : 'month',
                        },
                    },
                    quantity: 1,
                }],
                customer_email: salon.ownerEmail,
                client_reference_id: salonId,
                metadata: {
                    salonId,
                    packageType,
                    billingPeriod,
                    salonName: salon.name
                },
                success_url: `https://zamanli.com/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `https://zamanli.com/fiyatlandirma?cancelled=true`,
            });
            
            console.log('[Stripe] ✅ Session oluşturuldu:', session.id);
            
            // Session log kaydet
            await db.collection('payment_sessions').add({
                salonId,
                sessionId: session.id,
                packageType,
                billingPeriod,
                amount: price,
                status: 'created',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            return {
                sessionId: session.id,
                url: session.url
            };
            
        } catch (error) {
            console.error('[Stripe] Checkout session hatası:', error);
            throw new functions.https.HttpsError('internal', error.message);
        }
    });

/**
 * Stripe Webhook Handler
 * Ödeme tamamlandığında paket yükselt
 */
exports.stripeWebhook = functions
    .region('europe-west1')
    .https.onRequest(async (req, res) => {
        console.log('[Stripe] Webhook alındı');
        
        const stripeClient = getStripeClient();
        
        if (!stripeClient) {
            console.log('[Stripe] Test mode - webhook işlenmedi');
            return res.status(200).json({ received: true, testMode: true });
        }
        
        const sig = req.headers['stripe-signature'];
        const webhookSecret = functions.config().stripe?.webhook_secret;
        
        if (!webhookSecret) {
            console.error('[Stripe] Webhook secret eksik');
            return res.status(400).send('Webhook secret not configured');
        }
        
        let event;
        
        try {
            // Webhook signature doğrula
            event = stripeClient.webhooks.constructEvent(
                req.rawBody,
                sig,
                webhookSecret
            );
        } catch (err) {
            console.error('[Stripe] Webhook signature doğrulama hatası:', err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }
        
        console.log('[Stripe] Event type:', event.type);
        
        // Event type'a göre işlem yap
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                const salonId = session.client_reference_id || session.metadata.salonId;
                const packageType = session.metadata.packageType;
                
                console.log('[Stripe] Ödeme tamamlandı:', { salonId, packageType });
                
                try {
                    // Salon paketini yükselt
                    await db.collection('salons').doc(salonId).update({
                        package: packageType,
                        packageUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        stripeCustomerId: session.customer,
                        stripeSubscriptionId: session.subscription
                    });
                    
                    // Payment log kaydet
                    await db.collection('payments').add({
                        salonId,
                        sessionId: session.id,
                        packageType,
                        amount: session.amount_total,
                        currency: session.currency,
                        status: 'completed',
                        stripeSubscriptionId: session.subscription,
                        paidAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    
                    // Bildirim oluştur
                    await db.collection('notifications').add({
                        salonId,
                        type: 'package_upgraded',
                        message: `Paketiniz ${packageType.toUpperCase()} olarak yükseltildi! 🎉`,
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    
                    console.log('[Stripe] ✅ Paket yükseltildi:', packageType);
                    
                } catch (error) {
                    console.error('[Stripe] Paket yükseltme hatası:', error);
                }
                
                break;
            }
            
            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                
                console.log('[Stripe] Abonelik iptal edildi:', subscription.id);
                
                try {
                    // Aboneliği iptal eden salonu bul
                    const salonsSnapshot = await db.collection('salons')
                        .where('stripeSubscriptionId', '==', subscription.id)
                        .limit(1)
                        .get();
                    
                    if (!salonsSnapshot.empty) {
                        const salonDoc = salonsSnapshot.docs[0];
                        
                        // Paketi free'ye düşür
                        await salonDoc.ref.update({
                            package: 'free',
                            packageDowngradedAt: admin.firestore.FieldValue.serverTimestamp(),
                            downgradedReason: 'subscription_cancelled'
                        });
                        
                        console.log('[Stripe] ✅ Paket free\'ye düşürüldü');
                    }
                    
                } catch (error) {
                    console.error('[Stripe] Abonelik iptal işleme hatası:', error);
                }
                
                break;
            }
            
            case 'invoice.payment_failed': {
                const invoice = event.data.object;
                
                console.log('[Stripe] Ödeme başarısız:', invoice.id);
                
                // TODO: Salona bildirim gönder
                
                break;
            }
            
            default:
                console.log('[Stripe] İşlenmeyen event type:', event.type);
        }
        
        res.status(200).json({ received: true });
    });

/**
 * Aktif abonelikleri kontrol et
 * Scheduled function: Her gün çalış
 */
exports.checkSubscriptions = functions
    .region('europe-west1')
    .pubsub.schedule('0 2 * * *') // Her gün 02:00
    .timeZone('Europe/Istanbul')
    .onRun(async (context) => {
        console.log('[Stripe] Abonelik kontrolü başladı');
        
        const stripeClient = getStripeClient();
        
        if (!stripeClient) {
            console.log('[Stripe] Test mode - abonelik kontrolü atlandı');
            return null;
        }
        
        try {
            // Pro ve Business paketli salonları al
            const salonsSnapshot = await db.collection('salons')
                .where('package', 'in', ['pro', 'business'])
                .get();
            
            console.log(`[Stripe] ${salonsSnapshot.size} ücretli salon bulundu`);
            
            for (const doc of salonsSnapshot.docs) {
                const salon = doc.data();
                const subscriptionId = salon.stripeSubscriptionId;
                
                if (!subscriptionId) {
                    console.log(`[Stripe] ${doc.id} - abonelik ID yok`);
                    continue;
                }
                
                try {
                    // Stripe'dan abonelik durumunu al
                    const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);
                    
                    // Abonelik durumu kontrolü
                    if (subscription.status !== 'active') {
                        console.log(`[Stripe] ${doc.id} - abonelik aktif değil: ${subscription.status}`);
                        
                        // Paketi free'ye düşür
                        await doc.ref.update({
                            package: 'free',
                            packageDowngradedAt: admin.firestore.FieldValue.serverTimestamp(),
                            downgradedReason: `subscription_${subscription.status}`
                        });
                    }
                    
                } catch (error) {
                    console.error(`[Stripe] ${doc.id} - abonelik kontrolü hatası:`, error);
                }
            }
            
            console.log('[Stripe] ✅ Abonelik kontrolü tamamlandı');
            return null;
            
        } catch (error) {
            console.error('[Stripe] Abonelik kontrolü genel hatası:', error);
            return null;
        }
    });

/**
 * Fatura geçmişini getir
 * HTTPS callable function
 */
exports.getInvoiceHistory = functions
    .region('europe-west1')
    .https.onCall(async (data, context) => {
        const { salonId } = data;
        
        console.log('[Stripe] Fatura geçmişi isteği:', salonId);
        
        if (!salonId) {
            throw new functions.https.HttpsError('invalid-argument', 'Salon ID gerekli');
        }
        
        try {
            const paymentsSnapshot = await db.collection('payments')
                .where('salonId', '==', salonId)
                .orderBy('paidAt', 'desc')
                .limit(12)
                .get();
            
            const invoices = paymentsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                paidAt: doc.data().paidAt?.toDate().toISOString()
            }));
            
            return { invoices };
            
        } catch (error) {
            console.error('[Stripe] Fatura geçmişi hatası:', error);
            throw new functions.https.HttpsError('internal', error.message);
        }
    });
