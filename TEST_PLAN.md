# 🧪 ZAMANLI v2.0 - Test Planı

## 📅 Test Tarihi: Şubat 10, 2026

---

## 🎯 Test Kategorileri

### 1️⃣ GERİYE UYUMLULUK TESTLERİ

#### Test 1.1: Mevcut Salon Girişi (Eski PIN)
**Amaç:** Mevcut salonların düz metin PIN'leriyle giriş yapabilmesi

**Adımlar:**
1. https://zamanli.web.app/berber/salon/yonetim/ aç
2. Mevcut bir salonun telefon numarasını gir
3. Düz metin PIN'i gir (örn: 1234)
4. Giriş yap butonuna tıkla

**Beklenen Sonuç:**
- ✅ Giriş başarılı olmalı
- ✅ Dashboard açılmalı
- ✅ Salon bilgileri görünmeli
- ✅ Hiçbir hata olmamalı

**Konsol Kontrolleri:**
```javascript
// Browser Console'da kontrol et:
console.log('Session:', sessionStorage.getItem('activeSalon'))
console.log('Giriş başarılı')
```

---

#### Test 1.2: Mevcut Randevular
**Amaç:** Eskiden oluşturulmuş randevuların görünmesi

**Adımlar:**
1. Dashboard'a gir
2. "Randevular" sekmesine tıkla
3. Bugünün tarihini seç

**Beklenen Sonuç:**
- ✅ Tüm randevular listelenmeli
- ✅ Randevu detayları eksiksiz olmalı
- ✅ Status'ler doğru görünmeli

---

### 2️⃣ YENİ ÖZELLİKLER TESTLERİ

#### Test 2.1: Yeni Salon Kaydı (Hashed PIN)
**Amaç:** Yeni kayıtların otomatik olarak PIN hashlemesi

**Adımlar:**
1. https://zamanli.web.app/berber/kayit/ aç
2. Yeni salon formu doldur:
   - Ad: Test Berber Salonu
   - Telefon: 5551234567
   - Email: test@zamanli.com
   - PIN: 9876
   - Kategori: Berber
3. Kayıt ol

**Beklenen Sonuç:**
- ✅ Kayıt başarılı
- ✅ Firestore'da PIN bcrypt formatında ($2a$ ile başlamalı)
- ✅ Cloud Function `hashSalonPin` çalışmalı

**Firestore Kontrolü:**
```javascript
// Firebase Console > Firestore > salons > [yeni salon]
{
  "pin": "$2a$10$...",  // ✅ Hashlenmiş
  "pinHashedAt": Timestamp,
  "package": "free",
  "active": false
}
```

**Functions Log Kontrolü:**
```bash
firebase functions:log --only hashSalonPin
# Beklenen: "[Auth] ✅ PIN hashlendi"
```

---

#### Test 2.2: Hashed PIN ile Giriş
**Amaç:** Yeni oluşturulan salonun hashlenmiş PIN ile giriş yapması

**Adımlar:**
1. Yönetim paneline git
2. Yeni salonun telefonu ve PIN'i ile giriş yap (9876)
3. Giriş butonuna tıkla

**Beklenen Sonuç:**
- ✅ Cloud Function `verifyPinAuth` çağrılmalı
- ✅ Bcrypt doğrulaması başarılı olmalı
- ✅ Session token oluşturulmalı
- ✅ Dashboard açılmalı

**Network Kontrolü (F12 > Network):**
```
POST https://europe-west1-zamanli.cloudfunctions.net/verifyPinAuth
Response:
{
  "success": true,
  "sessionToken": "eyJz...",
  "userData": {...}
}
```

---

#### Test 2.3: Randevu Oluşturma + WhatsApp Bildirimi
**Amaç:** Yeni randevu oluşturulduğunda WhatsApp gitmesi

**Adımlar:**
1. Dashboard > Yeni Randevu
2. Randevu bilgilerini gir:
   - Müşteri: Ahmet Test
   - Telefon: 5559876543
   - Tarih: Bugün
   - Saat: 14:00
   - Hizmet: Saç Kesimi
3. Kaydet
4. Randevu durumunu "Onaylandı" yap

**Beklenen Sonuç:**
- ✅ Randevu oluşturulmalı
- ✅ Cloud Function `sendAppointmentConfirmationWhatsApp` tetiklenmeli
- ✅ WhatsApp bildirimi gönderilmeli (test modu)

**Functions Log:**
```bash
firebase functions:log --only sendAppointmentConfirmationWhatsApp
```

**Beklenen Log:**
```
[WhatsApp] Randevu onayı gönderiliyor: apt_xxx
[WhatsApp] ✅ Bildirim gönderildi (TEST MODE)
```

---

#### Test 2.4: Paket Limiti (Free Paket)
**Amaç:** Free paket 30 randevu limitini kontrol etmesi

**Adımlar:**
1. Free paketteki bir salon oluştur
2. 30 randevu oluştur (script veya manuel)
3. 31. randevuyu oluştur

**Beklenen Sonuç:**
- ✅ İlk 30 randevu başarılı
- ✅ 31. randevu otomatik iptal edilmeli
- ✅ Salon sahibine bildirim gitmeli

**Functions Log:**
```bash
firebase functions:log --only checkAppointmentLimit
```

**Beklenen:**
```
[Package] Test Salon - 31/30 randevu
[Package] ❌ Randevu iptal edildi - limit aşıldı
```

**Firestore Kontrolü:**
```javascript
// appointments/[31. randevu]
{
  "status": "cancelled",
  "cancelReason": "Aylık randevu limiti aşıldı",
  "cancelledAt": Timestamp
}
```

---

#### Test 2.5: Personel Limiti (Free Paket)
**Amaç:** Free paket 1 personel limitini kontrol etmesi

**Adımlar:**
1. Free paketteki salona 1. personeli ekle (başarılı olmalı)
2. 2. personeli eklemeyi dene

**Beklenen Sonuç:**
- ✅ 1. personel aktif
- ✅ 2. personel oluşturulur ama `active: false` olmalı
- ✅ Bildirim gönderilmeli

**Functions Log:**
```bash
firebase functions:log --only checkStaffLimit
```

---

#### Test 2.6: Email Bildirimleri (Pro Paket)
**Amaç:** Pro paket randevu email'i alması

**Ön Koşul:**
- Salonu Pro pakete yükselt (admin panel veya Firestore)

**Adımlar:**
1. Pro paketteki salonda randevu oluştur
2. Müşteri email'i gir
3. Randevuyu onayla

**Beklenen Sonuç:**
- ✅ Email bildirimi gönderilmeli
- ✅ EmailJS API çağrılmalı

**Functions Log:**
```bash
firebase functions:log --only sendAppointmentConfirmationEmail
```

**Beklenen:**
```
[Email] Randevu onayı gönderiliyor
[Email] ✅ Email gönderildi: msg_xxx
```

---

#### Test 2.7: PIN Değiştirme
**Amaç:** Kullanıcının PIN'ini değiştirmesi

**Adımlar:**
1. Yönetim paneline gir
2. Ayarlar > PIN Değiştir
3. Eski PIN: 1234
4. Yeni PIN: 5678
5. Kaydet

**Beklenen Sonuç:**
- ✅ Cloud Function `changePinAuth` çağrılmalı
- ✅ Eski PIN doğrulanmalı
- ✅ Yeni PIN hashlenip kaydedilmeli
- ✅ Başarı mesajı görünmeli

**Firestore Kontrolü:**
```javascript
// salons/[salon_id]
{
  "pin": "$2a$10$[yeni_hash]",
  "pinChangedAt": Timestamp
}
```

---

#### Test 2.8: Stripe Ödeme Akışı
**Amaç:** Paket yükseltme ödeme sürecini test etmesi

**Adımlar:**
1. Dashboard > Paket Yükselt
2. Pro paket seç
3. Aylık/Yıllık seç
4. Ödeme yap butonuna tıkla

**Beklenen Sonuç:**
- ✅ Cloud Function `createCheckoutSession` çağrılmalı
- ✅ Stripe checkout URL'i oluşturulmalı
- ✅ Kullanıcı Stripe sayfasına yönlendirilmeli

**Network Kontrolü:**
```
POST /createCheckoutSession
Response:
{
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/..."
}
```

**Not:** Test modunda ödeme tamamlamayın (gerçek ücretlendirme olmaz ama log kirli olur)

---

#### Test 2.9: Stripe Webhook (Ödeme Tamamlama)
**Amaç:** Ödeme tamamlandığında salonun paket yükseltilmesi

**Ön Koşul:**
- Stripe webhook endpoint ayarlanmış olmalı
- Test webhook event gönderebilme

**Adımlar:**
1. Stripe Dashboard > Webhooks > Test Event gönder
2. Event: `checkout.session.completed`
3. Metadata: `salonId`, `packageType: pro`

**Beklenen Sonuç:**
- ✅ Cloud Function `stripeWebhook` tetiklenmeli
- ✅ Salon paketi `pro` olmalı
- ✅ Payment log kaydedilmeli

**Firestore Kontrolü:**
```javascript
// salons/[salon_id]
{
  "package": "pro",
  "packageUpdatedAt": Timestamp
}

// payments/[payment_id]
{
  "salonId": "...",
  "packageType": "pro",
  "amount": 89900,
  "status": "completed"
}
```

---

### 3️⃣ GÜVENLİK TESTLERİ

#### Test 3.1: Firestore Rules - Yetkisiz Yazma
**Amaç:** Firestore rules'ın geçersiz verileri engellemesi

**Test Scriptleri (Browser Console):**

```javascript
// ❌ Geçersiz PIN (3 haneli) - REDDEDİLMELİ
db.collection('salons').add({
  name: 'Test',
  phone: '5551234567',
  pin: '123',  // ❌ 3 haneli (4-6 olmalı)
  ownerEmail: 'test@test.com',
  package: 'free',
  active: false
})
.then(() => console.log('❌ HATA: Geçersiz PIN kabul edildi!'))
.catch(e => console.log('✅ Doğru: Geçersiz PIN reddedildi', e.code))

// ❌ Geçersiz telefon - REDDEDİLMELİ
db.collection('salons').add({
  name: 'Test',
  phone: '123',  // ❌ Çok kısa
  pin: '1234',
  ownerEmail: 'test@test.com',
  package: 'free',
  active: false
})
.catch(e => console.log('✅ Doğru: Geçersiz telefon reddedildi'))

// ❌ Eksik alan - REDDEDİLMELİ
db.collection('salons').add({
  name: 'Test',
  phone: '5551234567'
  // ❌ pin, ownerEmail eksik
})
.catch(e => console.log('✅ Doğru: Eksik alan reddedildi'))

// ✅ Geçerli salon - KABUL EDİLMELİ
db.collection('salons').add({
  name: 'Test Salon',
  phone: '5551234567',
  pin: '1234',
  ownerEmail: 'valid@test.com',
  package: 'free',
  active: false,
  createdAt: firebase.firestore.FieldValue.serverTimestamp()
})
.then(() => console.log('✅ Geçerli salon eklendi'))
```

**Beklenen Sonuç:**
- ✅ Geçersiz veriler reddedilmeli
- ✅ Geçerli veriler kabul edilmeli

---

#### Test 3.2: Bcrypt PIN Güvenliği
**Amaç:** PIN hashlerinin güvenli olması

**Firestore Kontrol:**
```javascript
// Firestore'dan bir salon al
db.collection('salons').doc('SALON_ID').get()
  .then(doc => {
    const pin = doc.data().pin;
    console.log('PIN:', pin);
    console.log('Bcrypt formatı:', pin.startsWith('$2a$10$'));
    console.log('Uzunluk:', pin.length, '(60 olmalı)');
  })
```

**Beklenen:**
```
PIN: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
Bcrypt formatı: true
Uzunluk: 60
```

---

### 4️⃣ PERFORMANS TESTLERİ

#### Test 4.1: Cloud Functions Yanıt Süresi
**Amaç:** Functions'ların hızlı çalışması

**Test:**
1. Browser Console'da timing ölç:
```javascript
const start = Date.now();
firebase.functions().httpsCallable('verifyPinAuth')({
  salonId: 'test_salon',
  pin: '1234',
  userType: 'salon'
})
.then(() => {
  const duration = Date.now() - start;
  console.log('Yanıt süresi:', duration + 'ms');
  console.log(duration < 2000 ? '✅ Hızlı' : '⚠️ Yavaş');
})
```

**Beklenen:**
- ✅ < 2 saniye (2000ms)
- ⚠️ İlk cold start 3-5 saniye olabilir (normal)

---

#### Test 4.2: Firestore Sorgu Performansı
**Amaç:** Index'lerin doğru çalışması

**Test:**
```javascript
const start = Date.now();
db.collection('appointments')
  .where('salonId', '==', 'test_salon')
  .where('date', '>=', new Date())
  .orderBy('date')
  .limit(50)
  .get()
  .then(() => {
    console.log('Sorgu süresi:', Date.now() - start + 'ms');
  })
```

**Beklenen:**
- ✅ < 500ms

**Index Kontrolü:**
```bash
firebase firestore:indexes
```

---

### 5️⃣ KULLANICI DENEYİMİ (UX) TESTLERİ

#### Test 5.1: Loading States
**Amaç:** Tüm async işlemlerde loading gösterilmesi

**Kontrol Listesi:**
- [ ] Giriş yapılırken loading spinner
- [ ] Randevu kaydedilirken loading
- [ ] PIN değiştirirken loading
- [ ] Personel eklerken loading
- [ ] Hizmet kaydederken loading

---

#### Test 5.2: Error Handling
**Amaç:** Hataların kullanıcı dostu gösterilmesi

**Test Senaryoları:**
1. Yanlış PIN girişi
   - Beklenen: "Yanlış PIN" mesajı
2. İnternet bağlantısı yok
   - Beklenen: "Bağlantı hatası" mesajı
3. Limit aşımı
   - Beklenen: "Limit aşıldı, paket yükseltiniz" mesajı

---

### 6️⃣ ENTEGRASYON TESTLERİ

#### Test 6.1: Tam Akış (End-to-End)
**Senaryo:** Yeni salon kaydından randevu oluşturmaya kadar

**Adımlar:**
1. Yeni salon kaydı oluştur
2. PIN ile giriş yap
3. Personel ekle
4. Hizmet ekle
5. Çalışma saatleri ayarla
6. Yeni randevu oluştur
7. Randevuyu onayla
8. WhatsApp bildirimi al

**Süre:** ~10 dakika
**Beklenen:** ✅ Tüm adımlar sorunsuz tamamlanmalı

---

#### Test 6.2: Multi-Device Test
**Amaç:** Farklı cihazlarda çalışması

**Test Cihazları:**
- [ ] Desktop (Chrome)
- [ ] Desktop (Firefox)
- [ ] Mobile (Chrome Android)
- [ ] Mobile (Safari iOS)
- [ ] Tablet

---

## 📊 Test Raporu Şablonu

Her test sonrası doldurun:

```markdown
## Test Sonucu: [Test Adı]

**Tarih:** [TARİH]
**Tester:** [AD]
**Ortam:** Production / Staging

### Sonuç
- [ ] ✅ Başarılı
- [ ] ⚠️ Kısmen Başarılı (açıklama gerekli)
- [ ] ❌ Başarısız

### Notlar
[Gözlemler, hatalar, iyileştirme önerileri]

### Ekran Görüntüleri
[Gerekirse]

### Log Çıktıları
```
[Log snippet]
```
```

---

## 🚨 Kritik Test Öncelikleri

### YÜKSEK ÖNCELİKLİ (Önce bunları test edin)
1. ✅ Test 1.1: Mevcut salon girişi (geriye uyumluluk)
2. ✅ Test 2.1: Yeni salon kaydı
3. ✅ Test 2.2: Hashed PIN girişi
4. ✅ Test 2.3: Randevu oluşturma
5. ✅ Test 3.1: Firestore rules güvenlik

### ORTA ÖNCELİKLİ
6. ✅ Test 2.4: Paket limiti
7. ✅ Test 2.7: PIN değiştirme
8. ✅ Test 4.1: Performans

### DÜŞÜK ÖNCELİKLİ (İsteğe bağlı)
9. ✅ Test 2.8: Stripe ödeme
10. ✅ Test 5.1-5.2: UX testleri

---

## 🔧 Test Araçları

### Firebase CLI
```bash
# Functions logs
firebase functions:log

# Belirli function
firebase functions:log --only verifyPinAuth

# Son 50 log
firebase functions:log --limit 50

# Firestore rules test
firebase emulators:start --only firestore
```

### Browser Console
```javascript
// Firestore instance
const db = firebase.firestore();

// Functions instance
const functions = firebase.functions();

// Test helper
window.testAuth = async (phone, pin) => {
  const result = await functions.httpsCallable('verifyPinAuth')({
    salonId: 'test',
    pin,
    userType: 'salon'
  });
  console.log(result.data);
}
```

---

## 📞 Sorun Bildirimi

Test sırasında sorun bulursanız:

1. **Konsol loglarını kaydedin** (F12 > Console)
2. **Network tab'ı kontrol edin** (F12 > Network)
3. **Firestore verilerini kontrol edin**
4. **Functions loglarını kontrol edin** (`firebase functions:log`)
5. **Ekran görüntüsü alın**

**Rapor Formatı:**
```
Test: [Test Adı]
Hata: [Hata Mesajı]
Adımlar: [Hatayı tetikleyen adımlar]
Log: [Konsol/Functions log]
Ekran: [Screenshot link]
```

---

**Test Planı Hazırlandı:** Şubat 10, 2026  
**Version:** 2.0  
**Toplam Test Sayısı:** 20+
