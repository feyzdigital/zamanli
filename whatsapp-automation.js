// ============================================
// ZAMANLI - WhatsApp Otomasyon Modülü v1.0
// ============================================
// Dinamik mesaj şablonları ve wa.me link üretici
// ============================================

const WhatsAppManager = {
    
    // ==================== MESAJ ŞABLONLARI ====================
    templates: {
        
        // ----- MÜŞTERİYE GÖNDERİLECEK MESAJLAR -----
        
        // Randevu onaylandığında müşteriye
        appointmentConfirmed: (data) => `✅ *Randevunuz Onaylandı!*

Merhaba ${data.customerName},
*${data.salonName}* randevunuz onaylanmıştır.

📅 *Tarih:* ${data.date}
⏰ *Saat:* ${data.time}
✂️ *Hizmet:* ${data.service}
💰 *Ücret:* ${data.price} ₺

📍 *Adres:* ${data.address || 'Salon adresine ulaşın'}

🔗 *Randevu Detayı:*
${data.appointmentUrl}

_Görüşmek üzere!_ 💈`,

        // Randevu hatırlatma (24 saat önce)
        reminder24h: (data) => `⏰ *Randevu Hatırlatması*

Merhaba ${data.customerName},
Yarın *${data.salonName}* salonunda randevunuz var!

📅 *Tarih:* ${data.date}
⏰ *Saat:* ${data.time}
✂️ *Hizmet:* ${data.service}

✅ Geliyorum → ${data.confirmUrl}
❌ İptal Et → ${data.cancelUrl}

📍 *Konum:* ${data.mapsUrl || 'Salon adresine ulaşın'}

_Sizi bekliyoruz!_ 💈`,

        // Randevu hatırlatma (2 saat önce)
        reminder2h: (data) => `🔔 *Son Hatırlatma!*

${data.customerName}, randevunuza *2 saat* kaldı!

⏰ *Saat:* ${data.time}
📍 *Salon:* ${data.salonName}

✅ Yoldayım → ${data.confirmUrl}

_Görüşmek üzere!_`,

        // Randevu reddedildi/iptal edildi
        appointmentCancelled: (data) => `❌ *Randevunuz İptal Edildi*

Merhaba ${data.customerName},
Maalesef *${data.salonName}* salonundaki randevunuz iptal edilmiştir.

📅 *İptal Edilen:* ${data.date} - ${data.time}
📝 *Sebep:* ${data.reason || 'Belirtilmedi'}

Yeni randevu almak için:
${data.bookingUrl}

_Anlayışınız için teşekkür ederiz._`,

        // Randevu saati değişti
        appointmentRescheduled: (data) => `📅 *Randevu Saatiniz Değişti*

Merhaba ${data.customerName},
*${data.salonName}* randevunuz yeni bir saate alınmıştır.

❌ *Eski:* ${data.oldDate} - ${data.oldTime}
✅ *Yeni:* ${data.newDate} - ${data.newTime}

🔗 *Detaylar:*
${data.appointmentUrl}

_Anlayışınız için teşekkür ederiz._`,

        // Randevu sonrası yorum isteği
        reviewRequest: (data) => `⭐ *Nasıldı?*

Merhaba ${data.customerName},
*${data.salonName}* ziyaretiniz nasıldı?

Deneyiminizi paylaşarak diğer müşterilere yardımcı olabilirsiniz!

🔗 *Yorum Yap:*
${data.reviewUrl}

_Bizi tercih ettiğiniz için teşekkürler!_ 💈`,

        // ----- BERBERE GÖNDERİLECEK MESAJLAR -----

        // Yeni randevu bildirimi
        newAppointmentToSalon: (data) => `🆕 *Yeni Randevu!*

*${data.salonName}* için yeni randevu alındı.

👤 *Müşteri:* ${data.customerName}
📞 *Telefon:* ${data.customerPhone}
📅 *Tarih:* ${data.date}
⏰ *Saat:* ${data.time}
✂️ *Hizmet:* ${data.service}
💰 *Ücret:* ${data.price} ₺
${data.customerNote ? `📝 *Not:* ${data.customerNote}` : ''}

✅ *Onayla:* ${data.approveUrl}
❌ *Reddet:* ${data.rejectUrl}

🔗 *Yönetim Paneli:*
${data.panelUrl}`,

        // Müşteri "Geliyorum" dedi
        customerComing: (data) => `🚶 *Müşteri Yolda!*

*${data.customerName}* "${data.time}" randevusu için "Geliyorum" dedi!

📅 *Tarih:* ${data.date}
✂️ *Hizmet:* ${data.service}
📞 *Telefon:* ${data.customerPhone}

_Müşterinizi bekleyin._ 💈`,

        // Müşteri iptal etti
        customerCancelledToSalon: (data) => `❌ *Randevu İptali*

*${data.customerName}* randevusunu iptal etti.

📅 *İptal Edilen:* ${data.date} - ${data.time}
✂️ *Hizmet:* ${data.service}

📊 *Takvimi Güncelle:*
${data.panelUrl}`,

        // Günlük özet (sabah gönderilecek)
        dailySummary: (data) => `📊 *Günlük Randevu Özeti*

*${data.salonName}* - ${data.date}

📅 *Bugün ${data.totalAppointments} randevunuz var:*

${data.appointments.map((apt, i) => 
    `${i + 1}. ⏰ ${apt.time} - ${apt.customerName} (${apt.service})`
).join('\n')}

💰 *Tahmini Gelir:* ${data.totalRevenue} ₺

🔗 *Yönetim Paneli:*
${data.panelUrl}

_Başarılı bir gün dileriz!_ 💈`,

        // Yeni yorum bildirimi
        newReviewToSalon: (data) => `⭐ *Yeni Yorum!*

*${data.salonName}* için yeni bir yorum yapıldı.

👤 *Müşteri:* ${data.customerName}
⭐ *Puan:* ${'⭐'.repeat(data.rating)}
💬 *Yorum:* "${data.comment}"

🔗 *Tüm Yorumlar:*
${data.reviewsUrl}`
    },

    // ==================== URL OLUŞTURUCULAR ====================
    
    /**
     * WhatsApp mesaj linki oluşturur
     * @param {string} phone - Telefon numarası (başında 0 veya 90 olabilir)
     * @param {string} message - Gönderilecek mesaj
     * @returns {string} wa.me linki
     */
    createLink(phone, message) {
        // Telefon numarasını temizle
        let cleanPhone = phone.toString().replace(/\D/g, '');
        
        // Başındaki 0'ı kaldır ve 90 ekle
        if (cleanPhone.startsWith('0')) {
            cleanPhone = '90' + cleanPhone.slice(1);
        } else if (!cleanPhone.startsWith('90')) {
            cleanPhone = '90' + cleanPhone;
        }
        
        // Mesajı URL encode et
        const encodedMessage = encodeURIComponent(message);
        
        return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
    },

    /**
     * Randevu onay linki oluşturur (müşteriye gönderilecek)
     */
    createConfirmUrl(appointmentId) {
        return `${window.location.origin}/randevu/?id=${appointmentId}&action=confirm`;
    },

    /**
     * Randevu iptal linki oluşturur
     */
    createCancelUrl(appointmentId) {
        return `${window.location.origin}/randevu/?id=${appointmentId}&action=cancel`;
    },

    /**
     * Randevu detay linki oluşturur
     */
    createAppointmentUrl(appointmentId) {
        return `${window.location.origin}/randevu/?id=${appointmentId}`;
    },

    /**
     * Salon yönetim paneli linki
     */
    createPanelUrl(salonSlug) {
        return `${window.location.origin}/berber/salon/yonetim/?slug=${salonSlug}`;
    },

    /**
     * Salon sayfası linki (randevu almak için)
     */
    createBookingUrl(salonSlug) {
        return `${window.location.origin}/berber/salon/?slug=${salonSlug}`;
    },

    /**
     * Google Maps yol tarifi linki
     */
    createMapsUrl(address) {
        if (!address) return null;
        return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
    },

    // ==================== MESAJ GÖNDERİCİLER ====================

    /**
     * Müşteriye randevu onay mesajı gönder
     */
    sendAppointmentConfirmed(customerPhone, data) {
        const message = this.templates.appointmentConfirmed({
            ...data,
            appointmentUrl: this.createAppointmentUrl(data.appointmentId)
        });
        const url = this.createLink(customerPhone, message);
        window.open(url, '_blank');
        return url;
    },

    /**
     * Müşteriye hatırlatma mesajı gönder (24 saat)
     */
    sendReminder24h(customerPhone, data) {
        const message = this.templates.reminder24h({
            ...data,
            confirmUrl: this.createConfirmUrl(data.appointmentId),
            cancelUrl: this.createCancelUrl(data.appointmentId),
            mapsUrl: this.createMapsUrl(data.address)
        });
        const url = this.createLink(customerPhone, message);
        window.open(url, '_blank');
        return url;
    },

    /**
     * Müşteriye hatırlatma mesajı gönder (2 saat)
     */
    sendReminder2h(customerPhone, data) {
        const message = this.templates.reminder2h({
            ...data,
            confirmUrl: this.createConfirmUrl(data.appointmentId)
        });
        const url = this.createLink(customerPhone, message);
        window.open(url, '_blank');
        return url;
    },

    /**
     * Berbere yeni randevu bildirimi gönder
     */
    sendNewAppointmentToSalon(salonPhone, data) {
        const message = this.templates.newAppointmentToSalon({
            ...data,
            approveUrl: `${this.createPanelUrl(data.salonSlug)}#approve-${data.appointmentId}`,
            rejectUrl: `${this.createPanelUrl(data.salonSlug)}#reject-${data.appointmentId}`,
            panelUrl: this.createPanelUrl(data.salonSlug)
        });
        const url = this.createLink(salonPhone, message);
        window.open(url, '_blank');
        return url;
    },

    /**
     * Berbere "müşteri geliyor" bildirimi gönder
     */
    sendCustomerComingToSalon(salonPhone, data) {
        const message = this.templates.customerComing(data);
        const url = this.createLink(salonPhone, message);
        window.open(url, '_blank');
        return url;
    },

    /**
     * Berbere iptal bildirimi gönder
     */
    sendCustomerCancelledToSalon(salonPhone, data) {
        const message = this.templates.customerCancelledToSalon({
            ...data,
            panelUrl: this.createPanelUrl(data.salonSlug)
        });
        const url = this.createLink(salonPhone, message);
        window.open(url, '_blank');
        return url;
    },

    /**
     * Müşteriye yorum isteği gönder
     */
    sendReviewRequest(customerPhone, data) {
        const message = this.templates.reviewRequest({
            ...data,
            reviewUrl: `${this.createBookingUrl(data.salonSlug)}#reviews`
        });
        const url = this.createLink(customerPhone, message);
        window.open(url, '_blank');
        return url;
    },

    // ==================== YARDIMCI FONKSİYONLAR ====================

    /**
     * Tarih formatla
     */
    formatDate(dateStr) {
        const date = new Date(dateStr);
        const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
                       'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
        const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
        
        return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}, ${days[date.getDay()]}`;
    },

    /**
     * URL'yi panoya kopyala
     */
    async copyToClipboard(url) {
        try {
            await navigator.clipboard.writeText(url);
            return true;
        } catch (e) {
            console.error('Kopyalama hatası:', e);
            return false;
        }
    },

    /**
     * Mesajı sessizce oluştur (pencere açmadan)
     * Link'i döndürür, kullanıcı isterse açar
     */
    generateLink(templateName, phone, data) {
        if (!this.templates[templateName]) {
            console.error('Şablon bulunamadı:', templateName);
            return null;
        }
        
        const message = this.templates[templateName](data);
        return this.createLink(phone, message);
    },

    /**
     * Toplu mesaj linkleri oluştur
     * Hatırlatma göndermek için kullanılabilir
     */
    generateBulkLinks(appointments, templateName) {
        return appointments.map(apt => ({
            appointmentId: apt.id,
            customerName: apt.customerName,
            customerPhone: apt.customerPhone,
            whatsappUrl: this.generateLink(templateName, apt.customerPhone, apt)
        }));
    }
};

// Global'e ekle
window.WhatsAppManager = WhatsAppManager;

// Export (modül olarak kullanılırsa)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WhatsAppManager;
}

console.log('[WhatsApp] Otomasyon modülü yüklendi v1.0');
