# 📚 ZAMANLI - API Dokümantasyonu

## Genel Bakış

Zamanli Firebase Cloud Functions API'si, salon yönetimi, randevu işlemleri, bildirimler ve ödeme işlemlerini yönetir.

**Base URL:** `https://europe-west1-zamanli.cloudfunctions.net`

**Region:** Europe West 1 (Türkiye'ye yakın)

---

## 🔐 Authentication

### PIN Doğrulama

**Function:** `verifyPinAuth`  
**Type:** HTTPS Callable  
**Method:** POST

**Request:**
```javascript
const verifyPin = firebase.functions().httpsCallable('verifyPinAuth');

const result = await verifyPin({
    salonId: 'salon123',
    pin: '1234',
    userType: 'salon', // veya 'staff'
    staffId: 'staff123' // userType='staff' ise gerekli
});
```

**Response:**
```json
{
    "success": true,
    "sessionToken": "eyJzYWxvbklkIjoic2Fsb24xMjMiLCJ0aW1lc3RhbXAiOjE3MDk...==",
    "userData": {
        "salonId": "salon123",
        "salonName": "Berber Salon",
        "role": "owner",
        "package": "pro"
    }
}
```

**Error Codes:**
- `invalid-argument`: Eksik parametreler
- `not-found`: Salon veya personel bulunamadı
- `unauthenticated`: Yanlış PIN

---

### PIN Değiştirme

**Function:** `changePinAuth`  
**Type:** HTTPS Callable

**Request:**
```javascript
const changePin = firebase.functions().httpsCallable('changePinAuth');

const result = await changePin({
    salonId: 'salon123',
    oldPin: '1234',
    newPin: '5678',
    userType: 'salon',
    staffId: null
});
```

**Response:**
```json
{
    "success": true,
    "message": "PIN başarıyla değiştirildi"
}
```

---

## 📦 Paket Yönetimi

### Cloud Functions (Otomatik)

#### Randevu Limit Kontrolü
**Trigger:** `appointments` koleksiyonu onCreate  
**Fonksiyon:** Yeni randevu oluşturulduğunda otomatik çalışır

**İşlem:**
- Free paket için aylık 30 randevu limitini kontrol eder
- Limit aşıldıysa randevuyu iptal eder
- Salon sahibine bildirim gönderir

#### Personel Limit Kontrolü
**Trigger:** `salons/{salonId}/staff` koleksiyonu onCreate  
**Fonksiyon:** Yeni personel eklendiğinde otomatik çalışır

**İşlem:**
- Free paket için 1 personel limitini kontrol eder
- Pro paket için 5 personel limitini kontrol eder
- Limit aşıldıysa personeli pasif yapar

#### Aylık Stats Sıfırlama
**Trigger:** Her ayın 1'i gece yarısı  
**Fonksiyon:** Scheduled function

**İşlem:**
- Tüm salonların `monthlyStats.appointments` değerini 0'lar
- Yeni ay için limit kontrolü sıfırlanır

---

## 📧 Email Bildirimleri

### Otomatik Email Gönderimi

**Not:** Sadece **Pro** ve **Business** paketlerde aktif

#### Randevu Onayı
**Trigger:** Appointment status: `pending` → `confirmed`

**Template:** `template_appointment`

**Parametreler:**
- Müşteri adı
- Salon adı
- Tarih ve saat
- Hizmet adı
- Personel adı
- Salon iletişim bilgileri

#### Randevu İptali
**Trigger:** Appointment status: `cancelled`

**Template:** `template_cancellation`

#### Randevu Hatırlatma
**Trigger:** Scheduled function (her 15 dakika)  
**Zaman:** Randevudan 2 saat önce

**Template:** `template_reminder`

---

## 📱 WhatsApp Bildirimleri

### Twilio Entegrasyonu

**Not:** Tüm paketlerde aktif

#### Randevu Onayı
**Trigger:** Appointment status: `pending` → `confirmed`

**Mesaj Formatı:**
```
✅ Randevunuz Onaylandı!

🏪 [Salon Adı]
📅 Tarih: [DD Ay YYYY]
⏰ Saat: [HH:mm]
✂️ Hizmet: [Hizmet Adı]
👤 Personel: [Personel Adı]

📍 Adres: [Salon Adresi]
📞 İletişim: [Salon Telefonu]

Görüşmek üzere! 🎉
```

#### Randevu İptali
**Trigger:** Appointment status: `cancelled`

#### Randevu Hatırlatma
**Trigger:** Scheduled function (her 15 dakika)  
**Zaman:** Randevudan 2 saat önce

---

### Manuel WhatsApp Gönderimi

**Function:** `sendManualWhatsApp`  
**Type:** HTTPS Callable

**Request:**
```javascript
const sendWhatsApp = firebase.functions().httpsCallable('sendManualWhatsApp');

const result = await sendWhatsApp({
    phone: '5551234567',
    message: 'Merhaba! Randevu hatırlatması...',
    salonId: 'salon123'
});
```

**Response:**
```json
{
    "success": true,
    "messageId": "SM1234567890abcdef",
    "status": "queued"
}
```

---

## 💳 Ödeme İşlemleri (Stripe)

### Checkout Session Oluşturma

**Function:** `createCheckoutSession`  
**Type:** HTTPS Callable

**Request:**
```javascript
const createCheckout = firebase.functions().httpsCallable('createCheckoutSession');

const result = await createCheckout({
    salonId: 'salon123',
    packageType: 'pro', // veya 'business'
    billingPeriod: 'monthly' // veya 'yearly'
});
```

**Response:**
```json
{
    "sessionId": "cs_test_a1b2c3d4e5f6...",
    "url": "https://checkout.stripe.com/c/pay/cs_test_a1b2c3d4e5f6..."
}
```

**Kullanım:**
```javascript
// Checkout sayfasına yönlendir
window.location.href = result.data.url;
```

---

### Stripe Webhook

**Endpoint:** `https://europe-west1-zamanli.cloudfunctions.net/stripeWebhook`  
**Method:** POST  
**Type:** Webhook

**Stripe Dashboard'da Ayarlama:**
1. Stripe Dashboard > Developers > Webhooks
2. Add Endpoint: `https://europe-west1-zamanli.cloudfunctions.net/stripeWebhook`
3. Events:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`

**İşlenen Event'ler:**

#### checkout.session.completed
- Ödeme başarılı
- Salon paketi yükseltilir
- Payment log kaydedilir
- Bildirim oluşturulur

#### customer.subscription.deleted
- Abonelik iptal edildi
- Salon paketi `free`'ye düşürülür

#### invoice.payment_failed
- Ödeme başarısız
- Salona bildirim gönderilir

---

### Fatura Geçmişi

**Function:** `getInvoiceHistory`  
**Type:** HTTPS Callable

**Request:**
```javascript
const getInvoices = firebase.functions().httpsCallable('getInvoiceHistory');

const result = await getInvoices({
    salonId: 'salon123'
});
```

**Response:**
```json
{
    "invoices": [
        {
            "id": "pay_123",
            "packageType": "pro",
            "amount": 89900,
            "currency": "try",
            "status": "completed",
            "paidAt": "2024-03-15T10:30:00.000Z"
        },
        ...
    ]
}
```

---

## 🔔 Push Notifications

### Token Kaydetme

**Collection:** `push_tokens`

**Document Structure:**
```json
{
    "token": "dFj3k2...FCM_TOKEN...h4k5j",
    "salonId": "salon123",
    "userType": "salon", // veya 'staff', 'customer'
    "staffId": "staff123", // userType='staff' ise
    "platform": "web", // veya 'android', 'ios'
    "createdAt": "2024-03-15T10:30:00.000Z"
}
```

**Kullanım (Frontend):**
```javascript
// FCM token al
const messaging = firebase.messaging();
const token = await messaging.getToken({
    vapidKey: 'YOUR_VAPID_KEY'
});

// Firestore'a kaydet
await firebase.firestore().collection('push_tokens').add({
    token,
    salonId: currentSalonId,
    userType: 'salon',
    platform: 'web',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
});
```

---

## 📊 Firestore Koleksiyonlar

### salons
```json
{
    "name": "Berber Salon",
    "slug": "berber-salon",
    "category": "berber",
    "package": "pro",
    "pin": "$2a$10$...", // hashed
    "ownerEmail": "owner@example.com",
    "phone": "5551234567",
    "address": "İstanbul",
    "active": true,
    "monthlyStats": {
        "appointments": 15
    },
    "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### appointments
```json
{
    "salonId": "salon123",
    "customerId": "customer123",
    "customerName": "Ahmet Yılmaz",
    "customerPhone": "5551234567",
    "customerEmail": "ahmet@example.com",
    "serviceId": "service123",
    "serviceName": "Saç Kesimi",
    "staffId": "staff123",
    "staffName": "Mehmet Barber",
    "date": "2024-03-15T14:00:00.000Z",
    "time": "14:00",
    "duration": 30,
    "price": 150,
    "status": "confirmed", // pending, confirmed, completed, cancelled
    "notes": "Üstten az kesilsin",
    "createdAt": "2024-03-10T10:00:00.000Z"
}
```

### notification_logs
```json
{
    "type": "email", // email, whatsapp, push
    "subType": "appointment_confirmed",
    "appointmentId": "apt123",
    "salonId": "salon123",
    "recipient": "customer@example.com",
    "status": "sent", // sent, failed
    "messageId": "msg_123",
    "error": null,
    "testMode": false,
    "sentAt": "2024-03-15T10:30:00.000Z"
}
```

---

## ⚠️ Rate Limiting

**Limit:** 100 istek / dakika / IP

**Aşım Durumunda:**
- HTTP 429: Too Many Requests
- Retry-After header ile tekrar deneme süresi

---

## 🔧 Configuration

### Firebase Functions Config

```bash
# Twilio (WhatsApp)
firebase functions:config:set twilio.account_sid="ACxxxxx"
firebase functions:config:set twilio.auth_token="xxxxx"
firebase functions:config:set twilio.whatsapp_number="whatsapp:+14155238886"

# Stripe
firebase functions:config:set stripe.secret_key="sk_test_xxxxx"
firebase functions:config:set stripe.webhook_secret="whsec_xxxxx"
```

### Environment Variables (.env.local)

```bash
# Firebase Client
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_PROJECT_ID=zamanli

# EmailJS
NEXT_PUBLIC_EMAILJS_SERVICE_ID=service_nltn6di
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=DFMgbrmsjlK0hxlc5
```

---

## 📝 Örnek Kullanımlar

### Randevu Oluşturma + Bildirim

```javascript
// 1. Randevuyu oluştur
const appointmentRef = await firebase.firestore().collection('appointments').add({
    salonId: 'salon123',
    customerName: 'Ahmet Yılmaz',
    customerPhone: '5551234567',
    serviceId: 'service123',
    serviceName: 'Saç Kesimi',
    date: firebase.firestore.Timestamp.fromDate(new Date('2024-03-15T14:00:00')),
    time: '14:00',
    status: 'pending',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
});

// 2. Randevuyu onayla (otomatik bildirim gider)
await appointmentRef.update({
    status: 'confirmed'
});

// → WhatsApp ve Email (Pro+ paket) otomatik gönderilir
```

---

## 🐛 Hata Yönetimi

### Error Codes

| Code | Description |
|------|-------------|
| `invalid-argument` | Eksik veya hatalı parametreler |
| `not-found` | Kayıt bulunamadı |
| `unauthenticated` | Kimlik doğrulama hatası |
| `permission-denied` | Yetki yok |
| `internal` | Sunucu hatası |
| `unavailable` | Servis geçici olarak kullanılamıyor |

### Error Handling Örneği

```javascript
try {
    const result = await firebase.functions().httpsCallable('verifyPinAuth')({
        salonId: 'salon123',
        pin: '1234'
    });
    
    console.log('Giriş başarılı:', result.data);
    
} catch (error) {
    if (error.code === 'unauthenticated') {
        console.error('Yanlış PIN');
    } else if (error.code === 'not-found') {
        console.error('Salon bulunamadı');
    } else {
        console.error('Hata:', error.message);
    }
}
```

---

## 📞 Destek

- **Email:** support@zamanli.com
- **Dokümantasyon:** https://docs.zamanli.com
- **GitHub:** https://github.com/zamanli/zamanli-app

---

**Son Güncelleme:** Şubat 2026  
**API Version:** 2.0
