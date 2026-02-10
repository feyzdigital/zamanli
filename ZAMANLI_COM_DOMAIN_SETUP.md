# 🌐 ZAMANLI.COM CUSTOM DOMAIN KURULUMU

**Tarih:** 10 Şubat 2026  
**Domain:** zamanli.com  
**Hosting:** Firebase Hosting

---

## 📋 ADIM ADIM KURULUM

### 1. Firebase Console'da Custom Domain Ekle

#### A. Firebase Console'a Git
```
https://console.firebase.google.com/project/zamanli/hosting/sites
```

#### B. Custom Domain Ekle
1. **Hosting** sekmesine tıkla
2. **Add custom domain** butonuna tıkla
3. Domain adını gir: `zamanli.com`
4. **Continue** tıkla

#### C. Ownership Verification (Domain Sahipliği Doğrulama)
Firebase size bir TXT kaydı verecek:

```
Hostname: zamanli.com (veya @)
Type: TXT
Value: firebase-hosting-XXXXXXXXXXXXXXXXXXXXX
```

### 2. Domain Registrar Ayarları (GoDaddy/Namecheap/HostGator vb.)

#### A. DNS Yönetimine Git
Domain sağlayıcınızın DNS yönetim paneline girin.

#### B. TXT Kaydı Ekle (Doğrulama İçin)
```
Type: TXT
Host: @ (veya zamanli.com)
Value: firebase-hosting-XXXXXXXXXXXXXXXXXXXXX
TTL: 3600 (1 saat)
```

#### C. A Kayıtları Ekle (Firebase IP'leri)
```
Type: A
Host: @ (veya zamanli.com)
Value: 199.36.158.100
TTL: 3600

Type: A
Host: @
Value: 199.36.158.101
TTL: 3600
```

**Not:** Firebase iki A kaydı kullanır (load balancing için).

#### D. WWW Subdomain (Opsiyonel ama Önerilen)
```
Type: CNAME
Host: www
Value: zamanli.web.app
TTL: 3600
```

Bu sayede `www.zamanli.com` otomatik olarak `zamanli.com`'a yönlendirilir.

### 3. DNS Yayılımını Bekle
- **Süre:** 15 dakika - 48 saat (genellikle 1-2 saat)
- **Kontrol:** https://www.whatsmydns.net/#A/zamanli.com

### 4. Firebase'de SSL Sertifikası Otomatik Oluşur
- Firebase otomatik olarak Let's Encrypt SSL sertifikası oluşturur
- **HTTPS otomatik aktif olur**
- **HTTP → HTTPS yönlendirmesi otomatik yapılır**

---

## 🔧 FIREBASE CLI İLE DOMAIN EKLEME (Alternatif)

```bash
# Firebase CLI ile domain ekle
firebase hosting:sites:list

# Custom domain ekle (interactive)
firebase hosting:channel:list

# Veya doğrudan Console kullan (Önerilen)
# https://console.firebase.google.com/project/zamanli/hosting/sites
```

---

## ✅ DOĞRULAMA ADIMLARI

### 1. DNS Kayıtlarını Kontrol Et
```bash
# A kayıtlarını kontrol et
nslookup zamanli.com

# TXT kaydını kontrol et
nslookup -type=TXT zamanli.com

# CNAME (www) kontrol et
nslookup www.zamanli.com
```

### 2. Firebase Console'da Durum Kontrol
```
https://console.firebase.google.com/project/zamanli/hosting/sites

Status:
- ⏳ Pending → DNS kayıtlarını bekleniyor
- ⚠️ Needs Setup → DNS kayıtları eksik/yanlış
- ✅ Connected → Domain aktif!
```

### 3. Browser'da Test Et
```
1. http://zamanli.com → HTTPS'e yönlendirilmeli
2. https://zamanli.com → Site açılmalı
3. https://www.zamanli.com → zamanli.com'a yönlenmeli
4. SSL sertifikası geçerli olmalı (yeşil kilit)
```

---

## 📊 DNS KAYITLARI ÖZET

### Gerekli DNS Kayıtları:

```dns
# TXT Kaydı (Doğrulama - Sadece ilk kurulumda)
Type: TXT
Host: @
Value: firebase-hosting-XXXXX... (Firebase'den alacaksınız)
TTL: 3600

# A Kayıtları (Ana Domain)
Type: A
Host: @
Value: 199.36.158.100
TTL: 3600

Type: A
Host: @
Value: 199.36.158.101
TTL: 3600

# CNAME Kaydı (WWW Subdomain)
Type: CNAME
Host: www
Value: zamanli.web.app
TTL: 3600
```

---

## 🚨 SAĞLAYICIYA ÖZEL NOTLAR

### GoDaddy
- DNS Management → My Products → Domains → zamanli.com → DNS
- **Host:** @ kullan (zamanli.com yerine)
- **TTL:** Custom → 3600 veya 1 Hour

### Namecheap
- Dashboard → Domain List → Manage → Advanced DNS
- **Host:** @ kullan
- **TTL:** Automatic

### HostGator
- cPanel → Zone Editor
- **Name:** zamanli.com. (nokta ile biter)
- **TTL:** 14400 (default)

### Cloudflare (Eğer kullanıyorsanız)
```
⚠️ ÖNEMLİ: Cloudflare proxy'sini KAPAT!

DNS Records:
Type: A
Name: @
Value: 199.36.158.100
Proxy Status: DNS Only (gri bulut) ❌ Proxied olmasın!

Type: A
Name: @
Value: 199.36.158.101
Proxy Status: DNS Only
```

**Neden?** Firebase kendi SSL'ini yönetemez, Cloudflare proxy açıksa.

---

## 🔒 SSL/HTTPS KURULUMU

### Otomatik SSL (Firebase)
- Firebase otomatik Let's Encrypt sertifikası oluşturur
- **Ücretsiz** ve **otomatik yenilenir** (90 günde bir)
- **Kurulum gerekmez**, Firebase halleder

### SSL Durumu Kontrol
```
1. Firebase Console → Hosting → Custom Domains
2. Domain'inizi bulun
3. SSL Status: 
   - ⏳ Provisioning SSL → Oluşturuluyor (15-30 dk)
   - ✅ Active → SSL aktif!
```

### SSL Test
```
https://www.ssllabs.com/ssltest/analyze.html?d=zamanli.com

Beklenen Sonuç: A veya A+ rating
```

---

## 📱 HTTPS YÖNLENDIRME (Otomatik)

Firebase otomatik olarak tüm HTTP trafiğini HTTPS'e yönlendirir:

```
http://zamanli.com → https://zamanli.com ✅
http://www.zamanli.com → https://zamanli.com ✅
```

Ekstra ayar gerekmez!

---

## 🎯 DOMAIN BAĞLANDIKTAN SONRA

### 1. Tüm İç Linkleri Güncelle (Opsiyonel)
Kodda `zamanli.web.app` referansları varsa `zamanli.com` olarak değiştir.

```bash
# Tüm dosyalarda zamanli.web.app bul
grep -r "zamanli.web.app" .

# Değiştir (manuel veya script ile)
# zamanli.web.app → zamanli.com
```

### 2. Google Search Console Ekle
```
https://search.google.com/search-console

1. Property Ekle: zamanli.com
2. Ownership Doğrula (DNS TXT kaydı ile)
3. Sitemap Gönder: https://zamanli.com/sitemap.xml
```

### 3. Google Analytics Güncelle
```
Google Analytics → Admin → Property Settings
Default URL: https://zamanli.com
```

### 4. Social Media Paylaşım Kartları Test Et
```
# Facebook Debugger
https://developers.facebook.com/tools/debug/?q=https://zamanli.com

# Twitter Card Validator
https://cards-dev.twitter.com/validator

# LinkedIn Inspector
https://www.linkedin.com/post-inspector/
```

---

## 🛠️ SORUN GİDERME

### DNS Yayılmadı
**Belirti:** Site açılmıyor, DNS_PROBE_FINISHED_NXDOMAIN hatası

**Çözüm:**
1. DNS kayıtlarını kontrol et (nslookup)
2. TTL süresini bekle (1 saat - 48 saat)
3. DNS cache temizle:
   ```bash
   # Windows
   ipconfig /flushdns
   
   # macOS
   sudo dscacheutil -flushcache
   
   # Linux
   sudo systemd-resolve --flush-caches
   ```

### SSL Sertifikası Oluşmuyor
**Belirti:** "Your connection is not private" hatası

**Çözüm:**
1. Firebase Console'da SSL Status kontrol et
2. 15-30 dakika bekle (SSL provisioning süresi)
3. DNS kayıtlarının doğru olduğundan emin ol
4. Cloudflare proxy kapalı olmalı

### WWW Yönlendirmesi Çalışmıyor
**Belirti:** www.zamanli.com açılmıyor

**Çözüm:**
1. CNAME kaydını kontrol et:
   ```
   Host: www
   Value: zamanli.web.app
   ```
2. Firebase Console'da "www.zamanli.com" subdomain'i de ekle

---

## 📞 YARDIM KAYNAKLARI

### Firebase Dokümantasyon
- **Custom Domains:** https://firebase.google.com/docs/hosting/custom-domain
- **SSL Certificates:** https://firebase.google.com/docs/hosting/custom-domain#ssl

### DNS Kontrol Araçları
- **WhatsMyDNS:** https://www.whatsmydns.net/
- **DNS Checker:** https://dnschecker.org/
- **MXToolbox:** https://mxtoolbox.com/DNSLookup.aspx

### SSL Test Araçları
- **SSL Labs:** https://www.ssllabs.com/ssltest/
- **SSL Checker:** https://www.sslshopper.com/ssl-checker.html

---

## ✅ KURULUM CHECKLIST

### Adım 1: Firebase Console
- [ ] Custom domain ekle (zamanli.com)
- [ ] TXT doğrulama kaydını not al

### Adım 2: Domain Registrar
- [ ] TXT kaydı ekle (doğrulama)
- [ ] A kaydı ekle (199.36.158.100)
- [ ] A kaydı ekle (199.36.158.101)
- [ ] CNAME kaydı ekle (www → zamanli.web.app)

### Adım 3: Doğrulama
- [ ] DNS yayılımını bekle (1-48 saat)
- [ ] nslookup ile kontrol et
- [ ] Firebase Console'da "Connected" durumu görün

### Adım 4: SSL
- [ ] SSL provisioning'i bekle (15-30 dk)
- [ ] https://zamanli.com açılıyor mu test et
- [ ] SSL sertifikası geçerli mi kontrol et

### Adım 5: Final Test
- [ ] http://zamanli.com → https://zamanli.com yönlendirmesi
- [ ] https://www.zamanli.com → https://zamanli.com yönlendirmesi
- [ ] Tüm sayfalar açılıyor (KVKK, Gizlilik, vs.)
- [ ] Mobil uyumlu
- [ ] SSL A+ rating

---

## 🚀 HIZLI BAŞLANGIÇ

### EN HIZLI YOL (5 Dakika):

```bash
1. Firebase Console'a git:
   https://console.firebase.google.com/project/zamanli/hosting/sites

2. "Add custom domain" tıkla

3. "zamanli.com" yaz, Continue

4. Firebase'in verdiği kayıtları domain sağlayıcına ekle:
   - TXT kaydı (doğrulama)
   - 2x A kaydı (IP'ler)
   - CNAME kaydı (www)

5. 1-2 saat bekle

6. https://zamanli.com açıldı mı test et!
```

---

**Hazırlayan:** AI Assistant  
**Güncelleme:** 10 Şubat 2026  
**Durum:** 📝 Talimatlar Hazır - Domain Registrar Ayarları Bekleniyor

🌐 **zamanli.com aktif olunca tüm güncellemeler otomatik yansıyacak!**
