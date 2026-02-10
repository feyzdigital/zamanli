# ⚡ ZAMANLI v2.0 - 10 Dakikalık Hızlı Test

## 🎯 Amaç
Deploy sonrası kritik özellikleri hızlıca test etmek (10-15 dakika)

---

## ✅ Test 1: Mevcut Salon Girişi (2 dk) ⭐⭐⭐

**URL:** https://zamanli.web.app/berber/salon/yonetim/

**Adımlar:**
1. Sayfayı aç
2. Mevcut salon telefonu gir
3. Mevcut PIN gir (düz metin)
4. Giriş yap

**✅ Başarı Kriterleri:**
- Giriş başarılı
- Dashboard açıldı
- Randevular görünüyor
- Hata yok

**❌ Başarısız ise:**
🚨 ACIL! Geriye uyumluluk bozulmuş - Rollback gerekli!

---

## ✅ Test 2: Yeni Salon Kaydı (3 dk) ⭐⭐

**URL:** https://zamanli.web.app/berber/kayit/

**Adımlar:**
1. Formu doldur:
   - Ad: `Test Berber [BUGÜNÜN TARİHİ]`
   - Telefon: `555[RANDOM]` (örn: 5559876543)
   - Email: `test[RANDOM]@zamanli.com`
   - PIN: `1234`
   - Kategori: Berber
2. Kayıt ol

**✅ Başarı Kriterleri:**
- Kayıt başarılı mesajı
- Yönlendirme çalışıyor

**Firestore Kontrol (30sn):**
1. Firebase Console > Firestore > salons
2. En yeni salon bulun
3. `pin` alanına bakın

**Beklenen:**
```
pin: "$2a$10$N9qo8uLOickgx2Z..."  ✅ Hashlenmiş
```

**Functions Log Kontrol:**
```bash
firebase functions:log --only hashSalonPin --limit 1
```
**Beklenen:** `[Auth] ✅ PIN hashlendi`

---

## ✅ Test 3: Hashed PIN ile Giriş (2 dk) ⭐⭐⭐

**URL:** https://zamanli.web.app/berber/salon/yonetim/

**Adımlar:**
1. Yeni oluşturduğunuz salonun telefonu girin
2. PIN: `1234` (kayıt sırasında girdiğiniz)
3. Giriş yap

**✅ Başarı Kriterleri:**
- Giriş başarılı
- Dashboard açıldı

**Browser Console Kontrol (F12):**
- Network tab > `verifyPinAuth` çağrısı var mı?
- Response: `{"success": true, "sessionToken": "..."}`

**❌ Başarısız ise:**
🚨 Cloud Function çalışmıyor - Functions log kontrol edin!

---

## ✅ Test 4: Randevu Oluşturma (2 dk) ⭐⭐⭐

**Yer:** Dashboard > Yeni Randevu

**Adımlar:**
1. Randevu bilgileri:
   - Müşteri: `Test Müşteri`
   - Telefon: `5559998877`
   - Email: `test@example.com`
   - Tarih: Bugün
   - Saat: 14:00
   - Hizmet: Saç Kesimi
2. Kaydet

**✅ Başarı Kriterleri:**
- Randevu kaydedildi
- Dashboard'da görünüyor
- Firestore'da var

**Functions Log Kontrol:**
```bash
firebase functions:log --limit 5
```
**Beklenen:**
- `[Push] Yeni randevu:` mesajı
- Hata yok

---

## ✅ Test 5: WhatsApp Bildirimi (1 dk) ⭐

**Adımlar:**
1. Oluşturduğunuz randevuyu bulun
2. Durumunu "Onaylandı" yapın

**Functions Log:**
```bash
firebase functions:log --only sendAppointmentConfirmationWhatsApp --limit 1
```

**✅ Başarı Kriterleri:**
**Test Modu (Config YOK):**
```
[WhatsApp] Randevu onayı gönderiliyor
[WhatsApp] ⚠️ TEST MODU: Twilio config yok
[WhatsApp] Test simülasyonu başarılı
```

**Prod Modu (Config VAR):**
```
[WhatsApp] ✅ Bildirim gönderildi: SM...
```

**Her iki durumda da OK!** Test modu normal bir durum.

---

## ✅ Test 6: Firestore Rules Güvenlik (1 dk) ⭐⭐

**Browser Console (F12):**

```javascript
// Test 1: Geçersiz PIN (REDDEDİLMELİ)
firebase.firestore().collection('salons').add({
  name: 'Test',
  phone: '5551234567',
  pin: '12',  // ❌ 2 haneli
  ownerEmail: 'test@test.com',
  package: 'free',
  active: false
})
.then(() => console.log('❌ HATA: Geçersiz PIN kabul edildi!'))
.catch(e => console.log('✅ DOĞRU: Geçersiz PIN reddedildi -', e.code))
```

**Beklenen Çıktı:**
```
✅ DOĞRU: Geçersiz PIN reddedildi - permission-denied
```

---

## 📊 Hızlı Özet

| Test | Durum | Not |
|------|-------|-----|
| 1. Mevcut Giriş | ⬜ | |
| 2. Yeni Kayıt | ⬜ | |
| 3. Hashed Giriş | ⬜ | |
| 4. Randevu | ⬜ | |
| 5. WhatsApp | ⬜ | |
| 6. Security Rules | ⬜ | |

**Toplam Süre:** ~10-15 dakika

---

## 🚨 Kritik Başarısızlık Senaryoları

### Test 1 veya Test 3 Başarısız
**Etki:** ⚠️⚠️⚠️ Yüksek - Kullanıcılar giriş yapamıyor

**Hemen Yapılacaklar:**
1. Browser console kontrol (F12)
2. Network tab kontrol (verifyPinAuth çağrısı var mı?)
3. Functions log kontrol (`firebase functions:log`)
4. ROLLBACK düşünün!

---

### Test 2 Başarısız
**Etki:** ⚠️⚠️ Orta - Yeni kayıtlar çalışmıyor

**Hemen Yapılacaklar:**
1. Functions log: `hashSalonPin` çalışıyor mu?
2. Firestore rules: salon create izni var mı?
3. Browser console hata var mı?

---

### Test 4 Başarısız
**Etki:** ⚠️⚠️⚠️ Yüksek - Randevular oluşturulmuyor

**Hemen Yapılacaklar:**
1. Firestore rules: appointments create izni var mı?
2. Browser console hata kontrol
3. Network tab kontrol

---

### Test 5 veya Test 6 Başarısız
**Etki:** ⚠️ Düşük - Yardımcı özellikler

**Yapılacaklar:**
- Test 5: Config eksikliği normal (test modu çalışır)
- Test 6: Rules deployment kontrol edin

---

## 🔧 Hızlı Troubleshooting

### Sorun: Functions çağrılmıyor
```bash
# Functions deploy edildi mi kontrol
firebase functions:list

# Logs kontrol
firebase functions:log --limit 20
```

---

### Sorun: Firestore yazma hatası
```bash
# Rules deploy edildi mi
firebase firestore:rules

# Rules test
# Firebase Console > Firestore > Rules > Simulator
```

---

### Sorun: "Permission denied" hatası
1. Firestore Rules deploy edildi mi?
2. Rules syntax hatası var mı?
3. Firebase Console > Firestore > Rules kontrol

---

## ✅ Başarı Durumu

Tüm 6 test başarılı ise:

**🎉 Production Hazır!**

**Sonraki Adımlar:**
1. Monitoring kur (24 saat izle)
2. Gerçek kullanıcı feedback topla
3. Bug tracker hazırla
4. Performance metrics topla

---

## 📞 Yardım

**Sorun devam ederse:**
1. `firebase functions:log` - Functions log
2. Browser F12 > Console - Frontend hata
3. Browser F12 > Network - API çağrıları
4. Firebase Console > Functions > Dashboard - Genel durum

**Dökümantasyon:**
- `TEST_PLAN.md` - Detaylı test senaryoları
- `PRODUCTION_CHECKLIST.md` - Deployment checklist
- `API_DOCUMENTATION.md` - API referansı

---

**Hızlı Test Hazırlandı:** Şubat 10, 2026  
**Version:** 2.0  
**Süre:** 10-15 dakika ⚡
