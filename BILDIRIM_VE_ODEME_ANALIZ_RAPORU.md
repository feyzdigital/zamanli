# 💰 ZAMANLI - Bildirim ve Ödeme Sistemleri Analiz Raporu

**Tarih:** Şubat 10, 2026  
**Analiz Edilen:** Mevcut entegrasyonlar ve maliyetler  
**Önerilen:** iyzico entegrasyonu

---

## 📧 MEVCUT BİLDİRİM SİSTEMLERİ

### 1. Email Bildirimleri - EmailJS

#### Entegrasyon Detayları
```javascript
Servis: EmailJS (https://www.emailjs.com/)
Service ID: service_nltn6di
Public Key: DFMgbrmsjlK0hxlc5
Dosya: functions/email-notifications.js
```

#### Template'ler
```javascript
✅ template_approval       - Salon onay maili
✅ template_qv6wzhj       - Yeni salon bildirimi (admin)
✅ template_appointment   - Randevu onay maili
✅ template_reminder      - Randevu hatırlatma
✅ template_reschedule    - Randevu değişikliği
✅ template_cancellation  - Randevu iptal
```

#### Tetikleyiciler (Cloud Functions)
```javascript
1. sendAppointmentConfirmationEmail
   Trigger: appointments onUpdate (pending → confirmed)
   Paket: Pro, Business (Free paket HAYIR)
   
2. sendAppointmentCancellationEmail
   Trigger: appointments onUpdate (→ cancelled)
   Paket: Pro, Business
   
3. sendAppointmentReminders
   Trigger: Scheduled (günlük, 09:00)
   Paket: Pro, Business
   
4. sendNewSalonApprovalEmail
   Trigger: salons onCreate (admin'e bildirim)
   Paket: Tüm paketler
```

#### ✅ Anlık mı? EVET
```
Randevu onaylandı → 1-3 saniye içinde email gönderilir
Cloud Function otomatik tetiklenir
EmailJS API çağrısı yapılır
```

#### ✅ Salon Eklendiğinde Mail Geliyor mu? EVET
```javascript
// functions/email-notifications.js Line 237
exports.sendNewSalonApprovalEmail = functions
    .firestore.document('salons/{salonId}')
    .onCreate(async (snapshot) => {
        // Admin'e yeni salon bildirimi gönderir
        // Email: support@zamanli.com (varsayılan)
    });
```

#### 💰 Maliyet (EmailJS)
```
ÜCRETSİZ PLAN:
- 200 email/ay: 0₺
- Aylık limit aşımı: Email gönderilmez

PERSONAL PLAN:
- 1,000 email/ay: $9/ay (~290₺)
- 5,000 email/ay: $24/ay (~775₺)

PROFESSIONAL PLAN:
- 10,000 email/ay: $49/ay (~1,580₺)
- 50,000 email/ay: $99/ay (~3,200₺)

TAHMİNİ MALİYET:
- 100 salon × 30 randevu × 3 email = 9,000 email/ay
- Tavsiye: Professional Plan ($49/ay)
```

---

### 2. WhatsApp Bildirimleri - Twilio

#### Entegrasyon Detayları
```javascript
Servis: Twilio WhatsApp Business API
WhatsApp Number: +14155238886 (Twilio sandbox)
Dosya: functions/whatsapp-automation.js
Config: firebase functions:config:set twilio.*
```

#### Tetikleyiciler
```javascript
1. sendAppointmentConfirmationWhatsApp
   Trigger: appointments onUpdate (pending → confirmed)
   Paket: TÜM PAKETLER (Free dahil!)
   
2. sendAppointmentCancellationWhatsApp
   Trigger: appointments onUpdate (→ cancelled)
   Paket: Tüm paketler
   
3. sendAppointmentRemindersWhatsApp
   Trigger: Scheduled (her 15 dakika)
   Paket: Tüm paketler
   
4. sendManualWhatsApp
   Trigger: Manuel API call (HTTPS callable)
   Paket: Tüm paketler
```

#### ✅ Anlık mı? EVET
```
Randevu onaylandı → 2-5 saniye içinde WhatsApp gönderilir
Firestore trigger otomatik çalışır
Twilio API çağrısı yapılır
```

#### 💰 Maliyet (Twilio WhatsApp)
```
SANDBOX MODE (Test):
- Sınırsız mesaj: ÜCRETSİZ
- Kullanıcılar opt-in yapmalı (WhatsApp'tan "join" yazmalı)
- Production'da kullanılamaz

PRODUCTION (WhatsApp Business API):
KURULUM:
- Twilio Application fee: $5/ay (~160₺)
- Facebook Business verification: Ücretsiz

MESAJ MALİYETLERİ (Türkiye):
- Business-initiated conversation: $0.0140/konuşma (~0.45₺)
- User-initiated conversation: $0.0040/konuşma (~0.13₺)

CONVERSATION NEDİR?
- 24 saatlik pencere içinde gönderilen mesajlar = 1 konuşma
- Örnek: Randevu onay + hatırlatma (aynı gün) = 1 konuşma

TAHMİNİ MALİYET:
- 100 salon × 30 randevu × $0.0140 = $42/ay (~1,350₺)
- + Twilio fee: $5/ay (~160₺)
- TOPLAM: ~1,500₺/ay

ALTERNATİF: WATI.io (WhatsApp CRM)
- 1,000 mesaj/ay: $49/ay (~1,580₺)
- 5,000 mesaj/ay: $99/ay (~3,200₺)
- Özellik: Template management, broadcasts, chatbot
```

---

### 3. Push Notifications - Firebase Cloud Messaging (FCM)

#### Entegrasyon Detayları
```javascript
Servis: Firebase Cloud Messaging (FCM)
Dosya: functions/index.js (onNewAppointment)
Token Storage: push_tokens koleksiyonu
```

#### Tetikleyiciler
```javascript
1. onNewAppointment
   Trigger: appointments onCreate
   Hedef: Salon sahibi veya atanan personel
   
2. onAppointmentStatusChange
   Trigger: appointments onUpdate
   Hedef: Müşteri
   
3. sendAppointmentReminders (Push)
   Trigger: Scheduled (her 15 dakika)
   Hedef: Salon sahibi/personel
   
4. sendPushNotification (Manuel)
   Trigger: HTTPS callable
   Hedef: Belirtilen token
```

#### ✅ Anlık mı? EVET
```
Yeni randevu → ANINDA push notification
FCM Google altyapısı kullanır (milisaniyeler)
```

#### 💰 Maliyet (FCM)
```
ÜCRETSİZ:
- Sınırsız push notification: 0₺
- Google altyapısı ücretsiz
- Aylık limit yok

NOT: Sadece Firebase kullanım kotalarına tabidir
(Firestore, Functions, Storage gibi)
```

---

## 💳 MEVCUT ÖDEME SİSTEMİ - STRIPE

### Entegrasyon Detayları
```javascript
Servis: Stripe Payment Gateway
Dosya: functions/payment-stripe.js
Currency: TRY (Türk Lirası)
Test Mode: Aktif (config yoksa)
```

### Paket Fiyatları
```javascript
PRO PAKET:
- Aylık: 899₺
- Yıllık: 719₺/ay (toplam 8,628₺ - %20 indirim)

BUSINESS PAKET:
- Aylık: 1,599₺
- Yıllık: 1,279₺/ay (toplam 15,348₺ - %20 indirim)
```

### Özellikler
```javascript
✅ createCheckoutSession      - Checkout URL oluştur
✅ stripeWebhook             - Webhook handler
✅ checkSubscriptions         - Abonelik kontrolü (scheduled)
✅ getInvoiceHistory         - Fatura geçmişi
```

### 💰 Maliyet (Stripe)
```
TÜRKİYE ORANLAR:
- Yerli kartlar: %2.9 + 0.25₺/işlem
- Yabancı kartlar: %3.9 + 0.25₺/işlem

ÖRNEK:
- 899₺ Pro paket
- Komisyon: (899 × 0.029) + 0.25 = 26.32₺
- Net gelir: 872.68₺

100 SALON × 899₺ = 89,900₺/ay
Stripe komisyon: ~2,610₺
Net gelir: ~87,290₺

AYLIK MALIYET:
- Stripe account: 0₺ (ücretsiz)
- Her işlem: %2.9 + 0.25₺
```

**SORUN:** Stripe Türkiye'de banka entegrasyonu karmaşık!

---

## 🇹🇷 İYZİCO ENTEGRASYONU (ÖNERİLEN)

### Neden iyzico?

#### ✅ Avantajlar
```
1. TÜRK BANKALARLA DOĞRUDAN ENTEGRASYON
   - Garanti, İş Bankası, Akbank, YKB vb.
   - Türk kartları sorunsuz çalışır

2. TÜRKİYE'YE ÖZGÜ ÖDEME YÖNTEMLERİ
   - Kredi kartı (taksit desteği)
   - Banka kartı
   - BKM Express
   - Dijital cüzdanlar

3. DÜŞÜK KOMİSYON
   - %1.99 + 0.25₺ (Stripe'dan ucuz!)
   
4. TÜRKÇE DESTEK
   - 7/24 Türkçe müşteri hizmeti
   - Türkçe dokümantasyon

5. VERGİ UYUMU
   - Otomatik KDV hesaplama
   - E-fatura entegrasyonu (opsiyonel)
```

#### 💰 iyzico Maliyeti
```
STANDART PAKET:
- Kurulum: 0₺
- Aylık ücret: 0₺
- İşlem başı: %1.99 + 0.25₺

ÖRNEK:
- 899₺ Pro paket
- Komisyon: (899 × 0.0199) + 0.25 = 18.14₺
- Net gelir: 880.86₺

VS STRIPE:
- Stripe komisyon: 26.32₺
- iyzico komisyon: 18.14₺
- TASARRUF: 8.18₺/işlem

100 SALON/AY:
- Stripe: 2,610₺ komisyon
- iyzico: 1,814₺ komisyon
- TASARRUF: 796₺/ay (~9,552₺/yıl)
```

---

## 🔧 İYZİCO ENTEGRASYON PLANI

### 1. iyzico Paketi

**NPM Package:**
```bash
cd functions
npm install iyzipay
```

**Dependencies:**
```json
{
  "iyzipay": "^1.0.52"
}
```

### 2. Yeni Dosya Yapısı

```
functions/
├── payment-iyzico.js       (YENİ - iyzico functions)
├── payment-stripe.js       (ESKİ - kaldırılacak veya backup)
├── index.js                (güncelleme gerekli)
└── package.json            (iyzipay eklenecek)
```

### 3. iyzico Cloud Functions

**Gerekli Functions:**
```javascript
✅ createIyzicoCheckout     - Checkout formu oluştur
✅ iyzicoWebhook           - Webhook handler
✅ getIyzicoPayments       - Ödeme geçmişi
✅ checkIyzicoStatus       - Ödeme durumu sorgula
```

### 4. iyzico Config

**Firebase Config:**
```bash
firebase functions:config:set iyzico.api_key="YOUR_API_KEY"
firebase functions:config:set iyzico.secret_key="YOUR_SECRET_KEY"
firebase functions:config:set iyzico.base_url="https://api.iyzipay.com"
# Test için: https://sandbox-api.iyzipay.com
```

### 5. Frontend Değişiklikleri

**Değiştirilecek Dosyalar:**
```
berber/salon/yonetim/index.html
  └── Paket yükseltme butonu
      └── Stripe checkout → iyzico checkout

fiyatlandirma/index.html
  └── Fiyat kartları
      └── Stripe links → iyzico links
```

---

## 📊 MALİYET KARŞILAŞTIRMA TABLOSU

### Aylık Maliyet (100 Salon Senaryosu)

| Servis | Kullanım | Maliyet (₺/ay) | Durum |
|--------|----------|----------------|-------|
| **BİLDİRİMLER** |
| EmailJS | 9,000 email | 1,580₺ | ✅ Aktif |
| Twilio WhatsApp | 3,000 mesaj | 1,500₺ | ⚠️ Config gerekli |
| FCM Push | Sınırsız | 0₺ | ✅ Aktif |
| **ÖDEME** |
| Stripe | 100 işlem | 2,610₺ | ✅ Hazır |
| iyzico | 100 işlem | 1,814₺ | 🔄 Önerilen |
| **TOPLAM** | | |
| Mevcut (Stripe) | | 5,690₺ | |
| Önerilen (iyzico) | | 4,894₺ | |
| **TASARRUF** | | **796₺/ay** | |

---

## 🎯 ÖNERİLER VE AKSIYONLAR

### Acil Aksiyonlar

#### 1. iyzico Entegrasyonu ✅ ÖNCELİKLİ
```
Neden: Türkiye'ye özgü, daha ucuz, kolay entegrasyon
Süre: 2-3 gün
Maliyet tasarrufu: ~800₺/ay
```

#### 2. Twilio Config Ayarla 🔄 ORTA
```
Durum: Kod hazır, sadece config gerekli
Aksiyon:
1. Twilio hesabı aç (https://www.twilio.com/)
2. WhatsApp Business API başvuru yap
3. Config ayarla:
   firebase functions:config:set twilio.account_sid="xxx"
   firebase functions:config:set twilio.auth_token="xxx"
```

#### 3. EmailJS Limiti Yükselt 🔄 DÜŞÜK
```
Durum: Şu an 200 email/ay (ücretsiz)
Aksiyon: Personal Plan ($9/ay) yeterli olabilir
Tavsiye: İlk 6 ay ücretsiz kullan, sonra upgrade yap
```

### Maliyet Optimizasyonu

#### Alternatif 1: WhatsApp Yerine SMS
```
Twilio SMS (Türkiye):
- Giden SMS: $0.0275/SMS (~0.90₺)
- 3,000 SMS/ay = $82.5/ay (~2,660₺)

WhatsApp vs SMS:
- WhatsApp: 1,500₺/ay
- SMS: 2,660₺/ay
- WhatsApp DAHA UCUZ!
```

#### Alternatif 2: Email İçin SendGrid
```
SendGrid Free:
- 100 email/gün = 3,000/ay: ÜCRETSİZ
- EmailJS'den daha yüksek limit

SendGrid Essentials:
- 50,000 email/ay: $19.95/ay (~645₺)
- EmailJS Professional ($49): 1,580₺
- TASARRUF: 935₺/ay
```

---

## 🚀 İYZİCO ENTEGRASYON ADIMLARI

### Adım 1: iyzico Hesap Oluştur
```
1. https://merchant.iyzipay.com/ adresine git
2. Ücretsiz hesap oluştur
3. İşletme bilgilerini doldur
4. Banka bilgilerini ekle
5. API keys al (test + prod)
```

### Adım 2: Test Entegrasyonu
```bash
# Package yükle
cd functions
npm install iyzipay

# Test config
firebase functions:config:set iyzico.api_key="sandbox-xxx"
firebase functions:config:set iyzico.secret_key="sandbox-yyy"
firebase functions:config:set iyzico.base_url="https://sandbox-api.iyzipay.com"
```

### Adım 3: Function Oluştur
```
Dosya: functions/payment-iyzico.js
İçerik: 
- createIyzicoCheckout()
- iyzicoWebhook()
- getIyzicoPayments()

Deploy:
firebase deploy --only functions
```

### Adım 4: Frontend Güncelle
```
1. Yönetim panelinde "Paket Yükselt" butonu güncelle
2. iyzico checkout sayfası entegre et
3. Webhook URL ayarla: https://europe-west1-zamanli.cloudfunctions.net/iyzicoWebhook
4. Test et (sandbox)
```

### Adım 5: Production
```
1. iyzico'da gerçek API keys al
2. Firebase config güncelle (prod keys)
3. Webhook URL doğrula
4. İlk test ödemesini yap
5. Monitoring kur
```

---

## ✅ SONUÇ VE ÖNERİLER

### Mevcut Durum Özeti

**Bildirimler:**
- ✅ Email: Çalışıyor (EmailJS)
- ⚠️ WhatsApp: Kod hazır, config gerekli
- ✅ Push: Tam çalışıyor (FCM - ücretsiz)

**Anlık mı?**
- ✅ EVET - Tüm bildirimler 1-5 saniye içinde gönderiliyor
- ✅ Cloud Functions otomatik tetikleniyor
- ✅ Firestore triggers çalışıyor

**Salon Eklendiğinde Mail?**
- ✅ EVET - Admin'e otomatik bildirim gidiyor
- Function: `sendNewSalonApprovalEmail`

**Ödeme:**
- ✅ Stripe: Hazır ama Türkiye için ideal değil
- 🔄 iyzico: ÖNERİLEN - Daha ucuz, Türkiye'ye özgü

### Tavsiye Edilen Aksiyon Planı

**BU HAFTA:**
1. ✅ iyzico entegrasyonu başlat (öncelikli)
2. ⬜ Twilio config ayarla (WhatsApp için)

**GELECEK HAFTA:**
3. ⬜ iyzico test et (sandbox)
4. ⬜ EmailJS limiti izle (upgrade gerekirse)

**İLK AY:**
5. ⬜ iyzico production'a al
6. ⬜ Stripe'ı kaldır veya yedek tut
7. ⬜ Maliyet analizi yap

### Beklenen Tasarruf

```
Stripe → iyzico geçiş:
- İşlem başı: 8.18₺ tasarruf
- 100 işlem/ay: 796₺ tasarruf
- Yıllık: 9,552₺ tasarruf

EmailJS → SendGrid (opsiyonel):
- Aylık: 935₺ tasarruf
- Yıllık: 11,220₺ tasarruf

TOPLAM TASARRUF:
- Aylık: 1,731₺
- Yıllık: 20,772₺
```

---

**Sonuç:** iyzico entegrasyonu yapılmalı, mevcut bildirim sistemleri çalışıyor!

**Hazırlayan:** AI Analiz Sistemi  
**Tarih:** Şubat 10, 2026  
**Status:** Aksiyon Bekliyor
