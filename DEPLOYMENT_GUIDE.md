# 🚀 ZAMANLI - Deployment Rehberi

## ⚠️ ÖNEMLİ: Deploy Öncesi Kontrol

Bu deployment **production**'a sorunsuz geçiş sağlayacak şekilde hazırlanmıştır.

### ✅ Yapılan İyileştirmeler

1. **Hybrid Auth Sistemi**: Hem eski hem yeni PIN'lerle çalışır
2. **Cloud Functions**: Otomatik trigger'lar (bildirimler, limitler)
3. **Backward Compatible**: Mevcut kullanıcılar etkilenmez
4. **Security Enhanced**: Yeni kayıtlar güvenli

---

## 🎯 Deploy Adımları

### Adım 1: Dependencies Kurulumu

```bash
cd c:\Users\hiimj\Desktop\zamanli-local\zamanli\functions
npm install
```

**Yüklenecek paketler:**
- bcryptjs (PIN hashleme)
- @emailjs/nodejs (Email)
- twilio (WhatsApp)
- stripe (Ödeme)
- mocha, chai (Test)

### Adım 2: Test (Opsiyonel ama Önerilen)

```bash
# Unit testleri çalıştır
npm test

# Sonuç: 8 passing tests bekleniyor
```

### Adım 3: Firebase Config Ayarla

```bash
# Twilio config (WhatsApp için)
firebase functions:config:set twilio.account_sid="YOUR_TWILIO_SID"
firebase functions:config:set twilio.auth_token="YOUR_TWILIO_TOKEN"
firebase functions:config:set twilio.whatsapp_number="whatsapp:+14155238886"

# Stripe config (Ödeme için)
firebase functions:config:set stripe.secret_key="YOUR_STRIPE_SECRET"
firebase functions:config:set stripe.webhook_secret="YOUR_WEBHOOK_SECRET"

# Config'i kontrol et
firebase functions:config:get
```

**Not:** Test modu için config olmadan da çalışır (console'da warning verir)

### Adım 4: Cloud Functions Deploy

```bash
cd c:\Users\hiimj\Desktop\zamanli-local\zamanli
firebase deploy --only functions
```

**Deploy edilecek functions:**
- ✅ hashSalonPin (Otomatik PIN hashleme)
- ✅ hashStaffPin (Personel PIN hashleme)
- ✅ verifyPinAuth (PIN doğrulama API)
- ✅ changePinAuth (PIN değiştirme API)
- ✅ checkAppointmentLimit (Paket limit kontrolü)
- ✅ checkStaffLimit (Personel limit kontrolü)
- ✅ resetMonthlyStats (Aylık stats sıfırlama)
- ✅ sendAppointmentConfirmationEmail (Email bildirim)
- ✅ sendAppointmentCancellationEmail (Email bildirim)
- ✅ sendAppointmentReminders (Email hatırlatma)
- ✅ sendNewSalonApprovalEmail (Admin bildirimi)
- ✅ sendAppointmentConfirmationWhatsApp (WhatsApp bildirim)
- ✅ sendAppointmentCancellationWhatsApp (WhatsApp bildirim)
- ✅ sendAppointmentRemindersWhatsApp (WhatsApp hatırlatma)
- ✅ sendManualWhatsApp (Manuel WhatsApp API)
- ✅ createCheckoutSession (Stripe checkout)
- ✅ stripeWebhook (Stripe webhook)
- ✅ checkSubscriptions (Abonelik kontrolü)
- ✅ getInvoiceHistory (Fatura geçmişi)
- ✅ onNewAppointment (Mevcut - push notification)

**Beklenen Süre:** 5-10 dakika

**Deploy Sonrası:**
```
✔  functions[hashSalonPin(europe-west1)]: Successful create operation.
✔  functions[verifyPinAuth(europe-west1)]: Successful create operation.
...
✔  Deploy complete!
```

### Adım 5: Firestore Rules Deploy

```bash
firebase deploy --only firestore:rules
```

**Güvenlik İyileştirmeleri:**
- ✅ Authentication kontrolü
- ✅ Rol bazlı erişim (Super Admin, Owner, Staff)
- ✅ Input validation
- ✅ Admin koleksiyonu koruması

**Beklenen Süre:** 30 saniye

### Adım 6: Hosting Deploy

```bash
firebase deploy --only hosting
```

**Deploy edilecek:**
- ✅ Güncellenmiş yönetim paneli
- ✅ Hybrid auth sistemi
- ✅ Loading states

**Beklenen Süre:** 2-3 dakika

### Adım 7: Full Deploy (Hepsi Birden)

**Veya tümünü tek komutla:**

```bash
firebase deploy
```

**Beklenen Süre:** 8-15 dakika

---

## 🧪 Deploy Sonrası Test

### Test 1: Mevcut Salon Girişi

1. https://zamanli.com/berber/salon/yonetim/ adresine git
2. Mevcut bir salonun telefon ve PIN'ini gir
3. ✅ Giriş başarılı olmalı (düz metin PIN)
4. Dashboard'un sorunsuz açıldığını kontrol et

### Test 2: Yeni Salon Kaydı

1. https://zamanli.com/berber/kayit/ adresine git
2. Yeni salon kaydı oluştur
3. ✅ Kayıt başarılı olmalı
4. Giriş yap
5. ✅ Cloud Function ile hashed PIN doğrulaması çalışmalı

### Test 3: Randevu Oluşturma

1. Dashboard'dan "Yeni Randevu" oluştur
2. ✅ Randevu başarıyla oluşmalı
3. ✅ WhatsApp bildirimi gitmeli
4. ✅ Pro paketse email gitmeli

### Test 4: Paket Limiti (Free Paket)

1. Free paketteki bir salonda 31. randevuyu oluşturmayı dene
2. ✅ Randevu iptal edilmeli
3. ✅ Limit aşıldı bildirimi gelmeli

---

## 🔧 Troubleshooting

### Sorun: Functions deploy hata veriyor

**Çözüm:**
```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

### Sorun: "Permission denied" hatası

**Çözüm:**
```bash
firebase login
firebase use zamanli  # Proje adınız
firebase deploy
```

### Sorun: Config hatası (Twilio/Stripe)

**Durum:** Normal! Test modunda çalışır.

**Çözüm:**
```bash
# Config'leri ayarla
firebase functions:config:set twilio.account_sid="ACxxx"
firebase functions:config:set stripe.secret_key="sk_xxx"

# Config'i kontrol et
firebase functions:config:get
```

### Sorun: Hashed PIN girişi çalışmıyor

**Kontrol:**
1. Cloud Functions deploy edildi mi?
2. Firebase Console > Functions > verifyPinAuth var mı?
3. Browser console'da hata var mı?

**Fallback:** Düz metin PIN kontrolü otomatik devreye girer.

---

## 📊 Deploy Checklist

Aşağıdaki kontrol listesini takip edin:

- [ ] `cd functions && npm install` çalıştırıldı
- [ ] `npm test` başarılı (opsiyonel)
- [ ] Firebase config ayarlandı (opsiyonel)
- [ ] `firebase deploy --only functions` başarılı
- [ ] `firebase deploy --only firestore:rules` başarılı
- [ ] `firebase deploy --only hosting` başarılı
- [ ] Test 1: Mevcut salon girişi ✅
- [ ] Test 2: Yeni salon kaydı ✅
- [ ] Test 3: Randevu oluşturma ✅
- [ ] Test 4: Paket limiti ✅

---

## 🎉 Deploy Tamamlandı!

### Aktif Olan Yeni Özellikler

✅ **Otomatik Bildirimler**
- WhatsApp onay/iptal/hatırlatma
- Email bildirimler (Pro+)
- Push notifications

✅ **Paket Limitleri**
- Free: 30 randevu/ay otomatik kontrol
- Limit aşımında bildirim

✅ **Güvenlik**
- PIN hashleme (yeni kayıtlar)
- Gelişmiş Firestore rules
- Rol bazlı erişim

✅ **Ödeme Sistemi**
- Stripe entegrasyonu (hazır)
- Paket yükseltme (aktif)

---

## 📞 Destek

Sorun yaşarsanız:
1. Firebase Console > Functions > Logs kontrol edin
2. Browser Console'da hata var mı bakın
3. `firebase functions:log` komutu ile logları görün

---

**Kolay gelsin! 🚀**

Deploy sonrası gözlemlerinizi kaydedin ve Next.js migration için hazır olun!
