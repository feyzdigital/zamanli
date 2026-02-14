# Zamanli - Kapsamlı Güncelleme Raporu

**Tarih:** Son Deploy  
**Proje:** Zamanli - Online Randevu Sistemi  
**Versiyon:** v3.0+

---

## TEST KONTROL LİSTESİ (Teker Teker Test İçin)

Aşağıdaki maddeleri sırayla test edebilirsiniz. Her madde için: ✅ Geçti / ❌ Hata

| # | Test | Sonuç |
|---|------|-------|
| 1 | [Bildirim](#1-bildirim-sistemi) Tek randevuda tek bildirim | |
| 2 | [Bildirim](#1-bildirim-sistemi) Panel açılışında eski bildirim yok | |
| 3 | [Akıllı Öneri](#2-akıllı-öneri-sistemi) Her tıklamada numara soruyor | |
| 4 | [WhatsApp](#3-whatsapp-ve-hatırlatma-bildirimleri) Mesajlar doğru zamanda | |
| 5 | [PDF Rapor](#10-raporlar-ve-pdf) İndirilebilir, müşteri listesi yok | |
| 6 | [Salon/Sahip No](#11-salon-ve-salon-sahibi-numarası-ayrımı) Ara butonu salon numarası | |
| 7 | [Değerlendirme](#12-değerlendirme-yorum-sistemi) Numara, hizmet, puan, yorum | |
| 8 | [Personel Şifreleri](#6-süper-admin-paneli) Süper admin ve salon sahibi PIN görüyor | |
| 9 | [Operatör](#operatör-yetkileri) Tüm randevular, müşteriler, manuel ekleme | |
| 10 | [Operatör](#operatör-yetkileri) Personel filtresi (sahip dahil) | |
| 11 | [Operatör](#operatör-yetkileri) Kendine randevu oluşturamaz | |
| 12 | [Google](#google-maps-entegrasyonu) Yorumlar salon sayfasında | |
| 13 | [Google](#google-maps-entegrasyonu) Puan butonu ve salon değerlendirme butonu | |

---

## 1. Bildirim Sistemi

### Tek Randevuda Tek Bildirim
- **Sorun:** Tek randevu talebinde birden fazla bildirim geliyordu.
- **Çözüm:** `ZamanliNotify.startListening` içindeki appointments listener düzenlendi; `showToast` tekrarlı bildirim kaldırıldı.
- **Sonuç:** Her randevu için yalnızca bir bildirim gösteriliyor.

### Yönetim Paneli Açılış Bildirimi
- **Sorun:** Yönetim paneli her açıldığında eski randevulardan bildirim geliyordu.
- **Çözüm:** Panel açılışında geçmiş randevu bildirimleri filtrelendi.
- **Sonuç:** Sadece güncel ve ilgili bildirimler gösteriliyor.

---

## 2. Akıllı Öneri Sistemi

- **Her seferinde numara sor:** Tıklanınca otomatik analiz yapılmıyor; her defasında telefon numarası prompt ile soruluyor.
- **Veri:** `allAppointments`, `salonId` filtresi, `workingHours` yapısına uygun öneriler.

**Test:** Randevu sayfası → Akıllı Öneri tıkla → Numara prompt'u çıkmalı.

---

## 3. WhatsApp ve Hatırlatma Bildirimleri

### Tarih ve Reminder Mantığı
- **Dosya:** `functions/whatsapp-automation.js`
- **Değişiklikler:**
  - Tarih string desteği eklendi.
  - Hatırlatma (reminder) mantığı düzeltildi.
- **Sonuç:** WhatsApp mesajları ve hatırlatma bildirimleri doğru zamanda gönderiliyor.

---

## 4. Giriş Sistemi

### Telefon Normalizasyonu
- **Sorun:** Telefon numarası 0 ile veya 0 olmadan girildiğinde tutarsızlık.
- **Çözüm:** Telefon normalizasyonu eklendi; her iki format da kabul ediliyor.

### Hata Mesajları
- Tüm hata mesajları Türkçe olacak şekilde güncellendi.

### Hızlı Giriş
- `firebase.app().functions('europe-west1')` sayfa yüklenirken çağrılıyor.
- Yönetim ve admin panellerinde giriş süresi kısaltıldı.

---

## 5. Yönetim Paneli (Salon Yönetimi)

### Oturum (Session) Yönetimi
- **Dosya:** `berber/salon/yonetim/index.html`
- **Değişiklikler:**
  - Salon ve personel için **7 gün** otomatik giriş süresi.
  - Sayfa yenilendiğinde oturum korunuyor (çıkış olmuyor).
  - Salon yüklenemezse session silinmiyor; retry (tekrar dene) seçeneği gösteriliyor.
- **Sonuç:** Kullanıcılar sık sık tekrar giriş yapmak zorunda kalmıyor.

---


---

## 6. Süper Admin Paneli

### Personel PIN Görüntüleme ve Düzenleme

- **Süper admin:** Personel tablosunda `pinPlain` varsa PIN görünüyor; yoksa "••••••" (Düzenle'den yeni PIN belirleyerek görüntülenir).
- **Admin sekmesi:** Salon sayfasında Admin sekmesine geçildiğinde veri yeniden çekiliyor; giriş bilgileri güncel.
- **Salon sahibi paneli:** Personel kartında `pinPlain` veya düz PIN gösteriliyor; hashliyse "••••••".
- **Cloud Functions:** `adminAddStaff` ve `adminSetStaffPin` `pinPlain` alanını da kaydediyor.
- **Salon sahibi kayıt:** `saveStaff` ve `resetStaffPin` `pinPlain` alanını güncelliyor.

**Test:** Süper admin → Salon → Personel: PIN görünmeli. Salon sahibi → Personel: PIN görünmeli. Düzenle ile PIN değiştirilebilmeli.

---

## 7. Anasayfa

### Buton Değişiklikleri
- **Eklendi:** "Randevu Al" butonu.
- **Kaldırıldı:** "Demo İncele" butonu.

---

## 8. Mobil Odaklı UX

### Admin Paneli Mobil İyileştirmeleri
- **Hamburger Menü:** Mobilde sol üstte menü butonu; tıklanınca sidebar overlay olarak açılıyor.
- **Backdrop:** Menü açıkken arka plana tıklayınca menü kapanıyor.
- **Dokunmatik Dostu:** Butonlar ve tab'lar minimum 44px yükseklikte (Apple/Google dokunmatik önerisi).
- **Responsive Tablolar:** Mobilde font boyutu ve padding optimize edildi.
- **Kaydırma:** `detail-tabs` için `-webkit-overflow-scrolling: touch` eklendi.

---

## 9. Yetkiler ve Senkronizasyon

### Firestore Kuralları
- Süper admin için tüm salon, personel ve müşteri üzerinde tam yetki mevcut.
- Cloud Functions Admin SDK kullanarak kuralları bypass ediyor; güvenli güncellemeler yapılıyor.

---

## 10. Raporlar ve PDF İndirme

### PDF Rapor
- **İndirme:** `html2pdf.js` ile doğrudan PDF indiriliyor (`zamanli_rapor_[SalonAdı]_[Tarih].pdf`).
- **Kurumsal kimlik:** Logo, mağaza adı, Zamanli markası header'da.
- **Müşteri listesi yok:** PDF'de müşteri adları/telefonları gösterilmiyor (gizlilik).
- **İçerik:** Özet istatistikler, personel performansı, hizmet dağılımı.
- **Sayfa düzeni:** `page-break-inside: avoid` ile bölümler düzgün sayfalanıyor.

### CSV Raporları Kaldırıldı
- "Randevu CSV" ve "Müşteri CSV" butonları kaldırıldı.

**Test:** Yönetim paneli → Raporlar → PDF İndir. Müşteri listesi olmamalı, logo ve mağaza adı görünmeli.

---

## 11. Salon ve Salon Sahibi Numarası Ayrımı

### İki Numaralı Yapı
- **Salon Numarası (Ara için):** Müşterilerin "Ara" butonunda gördüğü ve aradığı numara (sabit hat).
- **Salon Sahibi GSM:** Randevu bildirimleri ve WhatsApp mesajlarının gittiği numara.

### Uygulama
- **Salon sayfası:** "Ara" butonu ve gösterilen telefon `landlinePhone` varsa onu, yoksa `phone` kullanıyor.
- **Kayıt formu:** "Salon Sahibi GSM" ve "Salon Numarası (Ara için)" ayrı alanlar.
- **Yönetim paneli ayarları:** Her iki numara da ayrı alanlarla düzenlenebiliyor.

---

## 12. Değerlendirme (Yorum) Sistemi

- **Numara ile hizmet listesi:** Telefon doğrulandığında müşterinin aldığı **tüm hizmetler** listeleniyor.
- **Yorum ve puan:** Yıldız puanı ve yorum alanı.
- **Salon sayfası:** Son 50 değerlendirme.
- **Telefon formatı:** 0 ile/olmadan, 90 ile başlayan formatlar kabul ediliyor.

**Test:** Salon sayfası → Değerlendirme Yap → Numara gir (05XX veya 5XX) → Hizmetler listelenmeli, puan ve yorum gönderilebilmeli.

---

## Operatör Yetkileri

### Manuel Randevu
- **Tüm müşteriler:** Operatör salonun tüm müşterilerini görebiliyor.
- **Yeni müşteri:** "Yeni Müşteri" ile kayıt eklenebiliyor.
- **Personel seçimi:** Tüm personel (sahip dahil) seçilebiliyor; operatör **kendini seçemez**.
- **Personel zorunlu:** Operatör için personel seçimi zorunlu.

### Takvim ve Randevular
- **Tüm randevular:** Operatör tüm randevuları görüyor (personel filtresi yok).
- **Personel filtresi:** Takvimde ve listede personel filtresi (sahip dahil) kullanılabiliyor.
- **Düzenleme:** Randevu düzenleyebiliyor. Onay/iptal yetkisi yok.

**Test:** Operatör ile giriş → Manuel randevu ekle → Tüm müşteriler listelenmeli, yeni müşteri eklenebilmeli, personel seçilebilmeli (operatör kendisi hariç). Takvimde personel filtresi çalışmalı.

---

## Google Maps Entegrasyonu

### Yorumlar
- **fetchGoogleReviews:** Salon sayfası yüklendiğinde çağrılıyor.
- **Place ID:** `googleBusinessUrl` kaydedilirken URL'den çıkarılıp `googlePlaceId` olarak saklanıyor.
- **Cache:** 24 saat TTL ile cache'leniyor.

### Butonlar (Salon Sayfası)
- **"Google'da Değerlendir" kaldırıldı.**
- **Google puanı butonu:** Örn. "4.8 Google" – tıklanınca Google sayfasına gidiyor.
- **Salon değerlendirme butonu:** Örn. "4.5" – tıklanınca değerlendirme bölümüne scroll.

**Test:** Google entegrasyonu olan salon → Yorumlar sayfanın altında görünmeli. Google puanı ve salon puanı butonları görünmeli.

---

## 13. Değiştirilen Dosyalar Özeti

| Dosya | Değişiklik |
|-------|------------|
| `admin/admin-app.js` | Personel PIN (pinPlain) gösterimi, Admin sekmesi refresh |
| `admin/admin-styles.css` | Mobil hamburger menü |
| `functions/auth-helpers.js` | `adminAddStaff`, `adminSetStaffPin` + pinPlain |
| `functions/index.js` | fetchGoogleReviews (rating, placeId URL'den) |
| `berber/salon/yonetim/index.html` | Raporlar (müşteri listesi yok), operatör yetkileri, personel şifreleri, loadCustomers operatör, populateStaffForManual |
| `berber/salon/index.html` | Google puanı/salon butonları, loadReviews fetchGoogleReviews çağrısı |
| `berber/kayit/index.html` | Salon/Sahip numarası alanları |

---

## 14. Deploy Durumu

- **Hosting:** Güncel
- **Functions:** `firebase deploy --only functions` gerekli (fetchGoogleReviews, adminAddStaff, adminSetStaffPin)
- **Google Places API:** `functions.config().google.places_api_key` tanımlı olmalı

---

## 15. Test Adımları (Teker Teker)

1. **Bildirim:** Tek randevu talebi → Tek bildirim. Panel açılışı → Eski bildirim yok.
2. **Akıllı Öneri:** Randevu sayfası → Akıllı Öneri tıkla → Her seferinde numara sorulmalı.
3. **WhatsApp:** Randevu onayı ve hatırlatma mesajları doğru zamanda.
4. **PDF Rapor:** Yönetim → Raporlar → PDF İndir → İndirilebilmeli, müşteri listesi olmamalı.
5. **Salon/Sahip No:** Ayarlar → Salon Numarası gir → Salon sayfasında Ara bu numarayı kullanmalı.
6. **Değerlendirme:** Salon sayfası → Değerlendirme Yap → Numara (05XX veya 5XX) → Hizmetler, puan, yorum.
7. **Personel Şifreleri:** Süper admin + Salon sahibi → Personel sekmesi → PIN görünmeli, düzenlenebilmeli.
8. **Operatör:** Operatör girişi → Manuel randevu → Tüm müşteriler, yeni müşteri, personel seçimi (kendisi hariç). Takvimde personel filtresi.
9. **Google:** Google entegrasyonu olan salon → Yorumlar görünmeli. Google puanı + Salon puanı butonları.

---

*Bu rapor Zamanli projesi güncellemelerini özetlemektedir. Teker teker test için yukarıdaki kontrol listesini kullanın.*
