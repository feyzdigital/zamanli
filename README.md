# 💈 ZAMANLI - Online Randevu Sistemi

Berber, kuaför ve güzellik salonları için modern, güvenli ve kullanımı kolay online randevu yönetim platformu.

[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=flat&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-38B2AC?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

---

## 🚀 Özellikler

### 🎯 Salon Yönetimi
- ✅ 3 kategori desteği (Berber, Kuaför, Güzellik)
- ✅ Çoklu personel yönetimi
- ✅ Hizmet & fiyatlandırma yönetimi
- ✅ Çalışma saatleri & izin yönetimi
- ✅ QR kod ile kolay randevu alma
- ✅ Logo & galeri yönetimi

### 📅 Randevu Sistemi
- ✅ Haftalık takvim görünümü
- ✅ Gerçek zamanlı slot kontrolü
- ✅ Otomatik çakışma kontrolü
- ✅ Randevu onay/iptal sistemi
- ✅ Müşteri notu & geçmiş takibi
- ✅ Randevu durumları (beklemede, onaylandı, tamamlandı, iptal)

### 🔔 Bildirim Sistemi
- ✅ WhatsApp bildirimleri (Twilio)
- ✅ Email bildirimleri (EmailJS) - Pro+
- ✅ Push notifications (FCM)
- ✅ Otomatik hatırlatmalar (2 saat önce)
- ✅ Randevu onay/iptal bildirimleri

### 💳 Paket Sistemi
- ✅ **Free**: 30 randevu/ay, 1 personel
- ✅ **Pro**: Sınırsız randevu, 5 personel, gelişmiş özellikler
- ✅ **Business**: Sınırsız her şey, çoklu şube, API erişimi

### 🛡️ Güvenlik
- ✅ PIN-based authentication (bcrypt hashed)
- ✅ Firestore security rules
- ✅ Rol bazlı yetkilendirme (Super Admin, Salon Owner, Staff)
- ✅ Rate limiting
- ✅ Input validation (Zod)

### 📊 Raporlama
- ✅ Günlük/aylık istatistikler
- ✅ Gelir takibi
- ✅ Personel performansı
- ✅ Popüler hizmetler
- ✅ Müşteri sadakati

---

## 📁 Proje Yapısı

```
zamanli/
├── index.html                  # Ana sayfa
├── config.js                   # İş mantığı & sabitler
├── berber/
│   ├── index.html              # Salon listesi
│   ├── kayit/                  # Salon kaydı
│   └── salon/
│       ├── index.html          # Salon detay (public)
│       └── yonetim/            # Yönetim paneli (private)
├── admin/                      # Super admin paneli
├── functions/                  # Firebase Cloud Functions
│   ├── index.js                # Ana export dosyası
│   ├── package-limiter.js      # Paket limit kontrolü
│   ├── auth-helpers.js         # PIN hashleme & auth
│   ├── email-notifications.js # Email otomasyonu
│   ├── whatsapp-automation.js  # WhatsApp otomasyonu
│   ├── payment-stripe.js       # Stripe entegrasyonu
│   └── test/                   # Test dosyaları
├── firestore.rules             # Güvenlik kuralları
├── firebase.json               # Firebase config
├── API_DOCUMENTATION.md        # API dökümanı
├── MIGRATION_TO_NEXTJS.md      # Next.js geçiş rehberi
└── .env.example                # Environment variables
```

---

## 🛠️ Kurulum

### Gereksinimler

- Node.js 18+
- Firebase CLI
- Git

### Adım 1: Projeyi Klonla

```bash
git clone https://github.com/yourusername/zamanli.git
cd zamanli
```

### Adım 2: Firebase Kurulumu

```bash
# Firebase CLI'ı yükle
npm install -g firebase-tools

# Firebase'e giriş yap
firebase login

# Projeyi başlat
firebase init
```

**Seçenekler:**
- ✅ Firestore
- ✅ Functions
- ✅ Hosting
- ✅ Storage

### Adım 3: Environment Variables

```bash
# .env.example dosyasını kopyala
cp .env.example .env.local

# Firebase credentials ekle
# Dosyayı düzenle ve gerçek değerleri gir
```

### Adım 4: Cloud Functions

```bash
cd functions
npm install

# Test et (local)
npm run serve

# Deploy et (production)
npm run deploy
```

### Adım 5: Firestore Rules

```bash
# Güvenlik kurallarını deploy et
firebase deploy --only firestore:rules
```

### Adım 6: Hosting

```bash
# Tüm projeyi deploy et
firebase deploy

# Sadece hosting deploy et
firebase deploy --only hosting
```

---

## 🔧 Konfigürasyon

### Firebase Functions Config

```bash
# Twilio (WhatsApp)
firebase functions:config:set twilio.account_sid="ACxxxxx"
firebase functions:config:set twilio.auth_token="xxxxx"
firebase functions:config:set twilio.whatsapp_number="whatsapp:+14155238886"

# Stripe
firebase functions:config:set stripe.secret_key="sk_test_xxxxx"
firebase functions:config:set stripe.webhook_secret="whsec_xxxxx"

# Config'i görüntüle
firebase functions:config:get
```

### EmailJS Template'leri

1. [EmailJS Dashboard](https://dashboard.emailjs.com/) açın
2. Service oluşturun (Gmail/Outlook/etc.)
3. Template'leri oluşturun:
   - `template_appointment` - Randevu onayı
   - `template_reminder` - Randevu hatırlatma
   - `template_cancellation` - Randevu iptali
   - `template_reschedule` - Randevu değişikliği
4. Service ID ve Public Key'i `.env.local`'e ekleyin

---

## 🧪 Testing

### Unit Tests

```bash
cd functions
npm test
```

### E2E Tests (Playwright)

```bash
# Kurulum
npm init playwright@latest

# Test çalıştır
npx playwright test

# UI mode
npx playwright test --ui
```

### Firebase Emulator

```bash
# Emulator başlat
firebase emulators:start

# Sadece functions
firebase emulators:start --only functions

# Sadece firestore
firebase emulators:start --only firestore
```

---

## 📚 Dokümantasyon

- **API Dokümantasyonu:** [API_DOCUMENTATION.md](API_DOCUMENTATION.md)
- **Migration Guide:** [MIGRATION_TO_NEXTJS.md](MIGRATION_TO_NEXTJS.md)
- **Changelog:** [CHANGELOG-v2.md](CHANGELOG-v2.md)
- **Roadmap:** [CURSOR_NEXTJS_YOL_HARITASI.md](file:///c%3A/Users/hiimj/Desktop/CURSOR_NEXTJS_YOL_HARITASI.md)

---

## 🚀 Deployment

### Firebase Hosting

```bash
# Production deploy
firebase deploy

# Preview deploy
firebase hosting:channel:deploy preview
```

### Vercel (Next.js için)

```bash
# Vercel CLI
npm i -g vercel

# Deploy
vercel

# Production deploy
vercel --prod
```

---

## 🔐 Güvenlik

### Firestore Rules

Güvenlik kuralları şu şekilde organize edilmiştir:

- ✅ Authentication kontrolü
- ✅ Rol bazlı erişim (Super Admin, Owner, Staff, Customer)
- ✅ Input validation
- ✅ Rate limiting
- ✅ Paket limit kontrolü

**Rules Deploy:**
```bash
firebase deploy --only firestore:rules
```

### PIN Güvenliği

- ✅ bcrypt ile hashleme (10 salt rounds)
- ✅ Otomatik hashleme (Cloud Function trigger)
- ✅ Güvenli karşılaştırma
- ✅ Session token sistemi

---

## 📊 Monitoring

### Firebase Console

- **Analytics:** https://console.firebase.google.com/project/zamanli/analytics
- **Performance:** https://console.firebase.google.com/project/zamanli/performance
- **Crashlytics:** https://console.firebase.google.com/project/zamanli/crashlytics

### Logs

```bash
# Functions logs
firebase functions:log

# Gerçek zamanlı logs
firebase functions:log --only functionName
```

---

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit yapın (`git commit -m 'feat: add amazing feature'`)
4. Push yapın (`git push origin feature/amazing-feature`)
5. Pull Request açın

### Commit Convention

```
feat: Yeni özellik
fix: Bug düzeltme
docs: Dokümantasyon
style: Kod formatı
refactor: Refactoring
test: Test ekleme
chore: Bakım işleri
```

---

## 📄 License

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakın.

---

## 📞 İletişim

- **Email:** support@zamanli.com
- **Website:** https://zamanli.com
- **GitHub:** https://github.com/zamanli/zamanli-app

---

## 🙏 Teşekkürler

- [Firebase](https://firebase.google.com/) - Backend infrastructure
- [EmailJS](https://www.emailjs.com/) - Email service
- [Twilio](https://www.twilio.com/) - WhatsApp API
- [Stripe](https://stripe.com/) - Payment processing
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Lucide Icons](https://lucide.dev/) - Icons

---

## 📈 Status

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

**Made with ❤️ in Turkey**

