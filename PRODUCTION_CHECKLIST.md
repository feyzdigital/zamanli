# ✅ ZAMANLI v2.0 - Production Checklist

## 📋 Deploy Öncesi Kontroller

### 1. KOD KALİTESİ
- [ ] Tüm functions dosyaları syntax hatasız
- [ ] ESLint warnings var mı? (`npm run lint`)
- [ ] Unit testler geçiyor mu? (`npm test`)
- [ ] Console.log'lar temizlendi mi? (prod için isteğe bağlı)

```bash
cd zamanli/functions
npm run lint
npm test
```

**Beklenen:**
```
✔  Linting skipped (test ortamı için)
✔  8 passing tests
```

---

### 2. FIREBASE CONFIGURATION

#### 2.1 Firebase Project
- [ ] Doğru proje seçili mi?
```bash
firebase projects:list
firebase use zamanli  # veya projenizin adı
```

#### 2.2 Functions Config
- [ ] Twilio credentials ayarlı mı? (WhatsApp için)
- [ ] Stripe keys ayarlı mı? (Ödeme için)
- [ ] EmailJS config ayarlı mı?

```bash
# Config kontrol
firebase functions:config:get

# Ayarlanması gereken değerler:
# - twilio.account_sid
# - twilio.auth_token
# - twilio.whatsapp_number
# - stripe.secret_key
# - stripe.webhook_secret
```

**Not:** Config yoksa functions TEST MODUNDA çalışır (warning verir ama hata vermez)

---

### 3. FIRESTORE RULES

#### 3.1 Rules Syntax Check
```bash
firebase deploy --only firestore:rules --debug
```

**Beklenen:**
```
✔  firestore: rules file firestore.rules compiled successfully
✔  Deploy complete!
```

#### 3.2 Rules Test Simulator
Firebase Console > Firestore > Rules > Simulator'da test et:

**Test 1: Geçersiz PIN (Reddedilmeli)**
```javascript
Service: firestore
Path: /salons/test_salon
Method: create
Auth: Unauthenticated

Data:
{
  "name": "Test",
  "phone": "5551234567",
  "pin": "12",  // ❌ 2 haneli (4-6 olmalı)
  "ownerEmail": "test@test.com",
  "package": "free",
  "active": false
}
```
**Beklenen:** ❌ Permission Denied

**Test 2: Geçerli Salon (Kabul Edilmeli)**
```javascript
Data:
{
  "name": "Test Salon",
  "phone": "5551234567",
  "pin": "1234",
  "ownerEmail": "test@test.com",
  "package": "free",
  "active": false
}
```
**Beklenen:** ✅ Allowed

---

### 4. DEPENDENCIES CHECK

#### 4.1 Functions Dependencies
```bash
cd zamanli/functions
npm outdated
npm audit
```

**Kontrol:**
- [ ] Kritik güvenlik açığı yok
- [ ] Major version uyumsuzluğu yok

#### 4.2 Node Version
```bash
node --version
# Beklenen: v20.x.x (firebase.json'da belirtilen)
```

---

### 5. BACKUP

#### 5.1 Firestore Backup
```bash
# Manuel export (opsiyonel)
gcloud firestore export gs://zamanli-backup/$(date +%Y%m%d)

# VEYA Firebase Console > Firestore > Import/Export
```

#### 5.2 Code Backup
- [ ] GitHub'a push edildi mi?
- [ ] Tag oluşturuldu mu? (v2.0)

```bash
git add .
git commit -m "v2.0 production ready"
git tag v2.0
git push origin main --tags
```

---

## 🚀 DEPLOYMENT ADIMLARI

### Adım 1: Functions Deploy

```bash
cd c:\Users\hiimj\Desktop\zamanli-local\zamanli
firebase deploy --only functions
```

**Süre:** ~5-10 dakika

**Deploy edilen functions:**
- ✅ hashSalonPin
- ✅ hashStaffPin
- ✅ verifyPinAuth
- ✅ changePinAuth
- ✅ checkAppointmentLimit
- ✅ checkStaffLimit
- ✅ resetMonthlyStats
- ✅ sendAppointmentConfirmationEmail
- ✅ sendAppointmentCancellationEmail
- ✅ sendAppointmentReminders
- ✅ sendNewSalonApprovalEmail
- ✅ sendAppointmentConfirmationWhatsApp
- ✅ sendAppointmentCancellationWhatsApp
- ✅ sendAppointmentRemindersWhatsApp
- ✅ sendManualWhatsApp
- ✅ createCheckoutSession
- ✅ stripeWebhook
- ✅ checkSubscriptions
- ✅ getInvoiceHistory
- ✅ onNewAppointment
- ✅ onAppointmentStatusChange
- ✅ sendAppointmentReminders (scheduled)
- ✅ sendPushNotification
- ✅ cleanupOldTokens

**Kontrol:**
```bash
# Deploy sonrası log kontrol
firebase functions:log --limit 10

# Specific function kontrol
firebase functions:log --only hashSalonPin --limit 5
```

---

### Adım 2: Firestore Rules Deploy

```bash
firebase deploy --only firestore:rules
```

**Süre:** ~30 saniye

**Kontrol:**
- [ ] Rules aktif mi? (Firebase Console > Firestore > Rules)
- [ ] Son güncelleme zamanı doğru mu?

---

### Adım 3: Hosting Deploy

```bash
firebase deploy --only hosting
```

**Süre:** ~2-3 dakika

**Kontrol:**
```bash
# URL'e git
https://zamanli.web.app/
https://zamanli.firebaseapp.com/
```

---

### Adım 4: Full Deploy (Tümü)

**Alternatif:** Hepsini tek seferde deploy et

```bash
firebase deploy
```

**Süre:** ~10-15 dakika

---

## 🧪 DEPLOY SONRASI TEST (KRİTİK!)

### Test 1: Mevcut Salon Girişi ⭐⭐⭐
**Kritiklik:** Yüksek (Mevcut kullanıcılar etkilenir)

1. https://zamanli.web.app/berber/salon/yonetim/ aç
2. Mevcut bir salonun telefon ve PIN'ini gir
3. Giriş yap

**Beklenen:**
- ✅ Giriş başarılı
- ✅ Dashboard açılır
- ✅ Hiçbir hata yok

**EĞER BAŞARISIZ:**
🚨 HEMEN ROLLBACK! 🚨
```bash
firebase hosting:rollback  # Hosting'i geri al
# Functions için önceki versiyonu deploy et
```

---

### Test 2: Yeni Salon Kaydı ⭐⭐
**Kritiklik:** Orta

1. https://zamanli.web.app/berber/kayit/ aç
2. Yeni salon formu doldur
3. Kayıt ol

**Beklenen:**
- ✅ Kayıt başarılı
- ✅ PIN otomatik hashlenmiş (Firestore'da kontrol)

**Firestore Kontrol:**
```
Firestore > salons > [yeni_salon]
pin: "$2a$10$..."  ✅
```

**Functions Log:**
```bash
firebase functions:log --only hashSalonPin --limit 1
# Beklenen: "[Auth] ✅ PIN hashlendi"
```

---

### Test 3: Randevu Oluşturma ⭐⭐⭐
**Kritiklik:** Yüksek

1. Dashboard > Yeni Randevu
2. Randevu bilgilerini gir
3. Kaydet

**Beklenen:**
- ✅ Randevu oluşturulur
- ✅ Firestore'da görünür
- ✅ Dashboard'da listelenir

---

### Test 4: WhatsApp Bildirimi ⭐
**Kritiklik:** Düşük (Config yoksa test modu çalışır)

1. Randevu durumunu "Onaylandı" yap

**Beklenen:**
- ✅ Cloud Function tetiklenir
- ✅ Log'da bildirim mesajı var

```bash
firebase functions:log --only sendAppointmentConfirmationWhatsApp --limit 1
```

**Beklenen Log:**
```
[WhatsApp] Randevu onayı gönderiliyor
[WhatsApp] ✅ Bildirim gönderildi (TEST MODE)
```

**Not:** Gerçek WhatsApp gitmesi için Twilio config gerekli

---

### Test 5: Paket Limit Kontrolü ⭐⭐
**Kritiklik:** Orta

**Manuel Test (Zor):**
- Free paketteki salonda 31. randevuyu oluştur

**Otomatik Test (Kolay):**
- Firestore'da bir salonun `monthlyStats.appointments` değerini 30 yap
- Yeni randevu oluştur
- Otomatik iptal edilmeli

**Beklenen:**
```bash
firebase functions:log --only checkAppointmentLimit --limit 1
# [Package] ❌ Randevu iptal edildi - limit aşıldı
```

---

### Test 6: PIN Değiştirme ⭐
**Kritiklik:** Düşük

1. Yönetim paneli > Ayarlar > PIN Değiştir
2. Eski PIN gir
3. Yeni PIN gir
4. Kaydet

**Beklenen:**
- ✅ Başarı mesajı
- ✅ Yeni PIN ile giriş yapılabiliyor
- ✅ Eski PIN çalışmıyor

---

## 📊 MONİTORİNG (İlk 24 Saat)

### Kontrol Listesi

**Her 2 Saatte:**
- [ ] Functions logs kontrol et (`firebase functions:log`)
- [ ] Hata oranı normal mi?
- [ ] Response süreleri normal mi?

**Her 6 Saatte:**
- [ ] Firebase Console > Functions > Dashboard
  - [ ] Çağrı sayısı
  - [ ] Hata oranı (< %1 olmalı)
  - [ ] Execution time (< 2s olmalı)
- [ ] Firestore read/write istatistikleri
- [ ] Hosting trafik

**Bir Kez (Deploy sonrası ilk saat):**
- [ ] Gerçek bir salon ile end-to-end test
- [ ] Mobil cihazdan test
- [ ] Farklı browser'dan test

---

## 🚨 ROLLBACK PLANI

### Hızlı Rollback (Acil Durum)

**Hosting Rollback:**
```bash
firebase hosting:rollback
```

**Functions Rollback:**
```bash
# Önceki versiyonu deploy et
git checkout [previous_commit]
firebase deploy --only functions
git checkout main
```

**Firestore Rules Rollback:**
```bash
# Firebase Console > Firestore > Rules > Versions
# Önceki versiyonu seç ve "Publish"
```

---

### Ne Zaman Rollback Yapmalı?

🚨 **Acil Rollback Gerektirir:**
- Mevcut kullanıcılar giriş yapamıyor
- Randevular oluşturulmuyor
- Firestore'a yazma hatası var
- Functions sürekli hata veriyor (>%10)

⚠️ **İzleme Gerektirir:**
- Yeni özellik çalışmıyor (eski özellikler sorunsuz)
- WhatsApp/Email gönderilmiyor (test modunda normal)
- Limit kontrolü çalışmıyor

✅ **Normal (Rollback Gerekmez):**
- Config eksikliği warnings (test modu çalışır)
- İlk cold start yavaşlığı (normal)
- Log'da test mesajları

---

## 📞 DESTEK KANALLARI

### Sorun Çözüme
1. **Functions log kontrol:** `firebase functions:log`
2. **Browser console kontrol:** F12 > Console
3. **Network tab kontrol:** F12 > Network
4. **Firestore data kontrol:** Firebase Console

### Kaynak Dökümanlar
- `API_DOCUMENTATION.md` - Cloud Functions API referansı
- `DEPLOYMENT_GUIDE.md` - Detaylı deployment rehberi
- `TEST_PLAN.md` - Kapsamlı test senaryoları
- `README_FIRST.md` - Hızlı başlangıç

---

## ✅ DEPLOY TAMAMLANDI!

Deploy başarılı ise:

1. [ ] Production URL test edildi: https://zamanli.web.app/
2. [ ] Mevcut kullanıcılar giriş yapabiliyor
3. [ ] Yeni kayıtlar çalışıyor
4. [ ] Randevular oluşturuluyor
5. [ ] Functions hatasız çalışıyor
6. [ ] Monitoring kuruldu

**Sonraki Adımlar:**
1. Kullanıcı feedback topla (1-2 gün)
2. Bug'ları not et
3. Performance metrics izle
4. Next.js migration için hazırlan (`MIGRATION_TO_NEXTJS.md`)

---

**Checklist Oluşturuldu:** Şubat 10, 2026  
**Version:** 2.0  
**Status:** Ready for Production 🚀
