// ============================================
// ZAMANLI - AI Öneri Sistemi v1.0
// ============================================
// Müşteri randevu geçmişine dayalı akıllı öneri
// Ağırlıklı Hareketli Ortalama (WMA) algoritması
// ============================================

const AIRecommendation = {
    
    // Minimum geçmiş randevu sayısı (öneri için)
    MIN_HISTORY: 2,
    
    // Varsayılan randevu aralığı (gün) - yeterli veri yoksa
    DEFAULT_INTERVAL: 21, // 3 hafta
    
    /**
     * Müşteri için randevu önerisi oluştur
     * @param {Array} appointments - Müşterinin geçmiş randevuları
     * @param {Object} salon - Salon bilgileri (çalışma saatleri)
     * @param {Array} allAppointments - Tüm randevular (müsaitlik kontrolü için)
     * @returns {Object} Öneri sonucu
     */
    generateRecommendation(customerAppointments, salon, allAppointments = []) {
        console.log('[AI] Öneri oluşturuluyor...');
        
        // Tamamlanmış randevuları tarihe göre sırala
        const completedAppointments = customerAppointments
            .filter(a => a.status === 'completed' || a.status === 'confirmed')
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        
        if (completedAppointments.length < this.MIN_HISTORY) {
            return {
                success: false,
                message: 'Öneri için yeterli randevu geçmişi yok',
                fallback: this.getFallbackRecommendation(salon, allAppointments)
            };
        }
        
        // Tahmini aralığı hesapla
        const predictedInterval = this.calculateWeightedInterval(completedAppointments);
        
        // Tahmini tarihi hesapla
        const lastAppointment = completedAppointments[completedAppointments.length - 1];
        const lastDate = new Date(lastAppointment.date);
        const predictedDate = new Date(lastDate);
        predictedDate.setDate(lastDate.getDate() + Math.round(predictedInterval));
        
        // Eğer tahmin edilen tarih geçmişte kaldıysa, bugünden itibaren hesapla
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (predictedDate < today) {
            predictedDate.setTime(today.getTime());
            predictedDate.setDate(today.getDate() + 1); // Yarından itibaren
        }
        
        // Çalışma günü kontrolü ve ayarlama
        const adjustedDate = this.findNextWorkingDay(predictedDate, salon);
        
        // Tercih edilen saat dilimini bul
        const preferredTime = this.findPreferredTime(completedAppointments);
        
        // En çok tercih edilen personeli bul (müşteri geçmişinden - en yoğun kullandığı)
        const preferredStaff = this.findPreferredStaff(completedAppointments);
        
        // Personel müsaitliğine göre randevuları filtrele
        const staffAppointments = preferredStaff 
            ? allAppointments.filter(a => a.staffId === preferredStaff.id || a.staffName === preferredStaff.name)
            : allAppointments;
        
        // En uygun slotu bul (hizmet süresi ve personel müsaitliği dahil)
        const bestSlot = this.findBestSlot(
            adjustedDate, 
            preferredTime, 
            salon, 
            staffAppointments,
            lastAppointment.serviceDuration || 30
        );
        
        // En çok tercih edilen hizmeti bul
        const preferredService = this.findPreferredService(completedAppointments);
        
        return {
            success: true,
            prediction: {
                date: bestSlot.date,
                time: bestSlot.time,
                staffId: preferredStaff?.id || preferredStaff?.name,
                staffName: preferredStaff?.name,
                dateFormatted: this.formatDate(bestSlot.date),
                dayName: this.getDayName(bestSlot.date),
                intervalDays: Math.round(predictedInterval),
                confidence: this.calculateConfidence(completedAppointments)
            },
            preferredService: preferredService,
            analysis: {
                totalAppointments: completedAppointments.length,
                averageInterval: Math.round(predictedInterval),
                preferredTimeSlot: preferredTime,
                lastVisit: this.formatDate(lastAppointment.date),
                daysSinceLastVisit: Math.floor((today - lastDate) / (1000 * 60 * 60 * 24))
            },
            pastAppointments: completedAppointments.slice(-5).reverse().map(a => ({
                date: this.formatDate(a.date),
                service: a.service || a.serviceName,
                staff: a.staffName
            })),
            message: this.generateMessage(bestSlot, preferredService, Math.round(predictedInterval))
        };
    },
    
    /**
     * Ağırlıklı Hareketli Ortalama ile aralık hesapla
     * Son randevulara daha fazla ağırlık verir
     */
    calculateWeightedInterval(appointments) {
        if (appointments.length < 2) return this.DEFAULT_INTERVAL;
        
        const intervals = [];
        for (let i = 1; i < appointments.length; i++) {
            const current = new Date(appointments[i].date);
            const previous = new Date(appointments[i - 1].date);
            const daysDiff = Math.floor((current - previous) / (1000 * 60 * 60 * 24));
            intervals.push(daysDiff);
        }
        
        // Ağırlıklı ortalama: Son aralıklara daha fazla ağırlık
        let weightedSum = 0;
        let weightSum = 0;
        
        intervals.forEach((interval, index) => {
            const weight = index + 1; // Lineer artan ağırlık
            weightedSum += interval * weight;
            weightSum += weight;
        });
        
        const weightedAverage = weightedSum / weightSum;
        
        // Aşırı uç değerleri sınırla (7-90 gün arası)
        return Math.max(7, Math.min(90, weightedAverage));
    },
    
    /**
     * Tercih edilen saat dilimini bul
     */
    findPreferredTime(appointments) {
        const timeSlots = {};
        
        appointments.forEach(apt => {
            if (apt.time) {
                const hour = parseInt(apt.time.split(':')[0]);
                // Saat dilimlerine ayır: sabah (9-12), öğlen (12-15), akşam (15-20)
                let slot;
                if (hour < 12) slot = 'morning';
                else if (hour < 15) slot = 'afternoon';
                else slot = 'evening';
                
                timeSlots[slot] = (timeSlots[slot] || 0) + 1;
            }
        });
        
        // En çok tercih edilen dilimi bul
        let maxCount = 0;
        let preferredSlot = 'morning';
        
        Object.entries(timeSlots).forEach(([slot, count]) => {
            if (count > maxCount) {
                maxCount = count;
                preferredSlot = slot;
            }
        });
        
        // Dilime göre varsayılan saat
        const slotDefaults = {
            morning: '10:00',
            afternoon: '13:00',
            evening: '17:00'
        };
        
        return slotDefaults[preferredSlot];
    },
    
    /**
     * En çok tercih edilen personeli bul (müşteri geçmişinden)
     */
    findPreferredStaff(appointments) {
        const staffCounts = {};
        appointments.forEach(apt => {
            const staffId = apt.staffId || apt.staffName;
            if (staffId) {
                staffCounts[staffId] = (staffCounts[staffId] || 0) + 1;
            }
        });
        let maxCount = 0;
        let preferredId = null;
        Object.entries(staffCounts).forEach(([id, count]) => {
            if (count > maxCount) {
                maxCount = count;
                preferredId = id;
            }
        });
        if (!preferredId) return null;
        const apt = appointments.find(a => (a.staffId || a.staffName) === preferredId);
        return apt ? { id: apt.staffId || apt.staffName, name: apt.staffName || apt.staffId || preferredId } : null;
    },
    
    /**
     * En çok tercih edilen hizmeti bul
     */
    findPreferredService(appointments) {
        const services = {};
        
        appointments.forEach(apt => {
            const service = apt.service || apt.serviceName;
            if (service) {
                if (!services[service]) {
                    services[service] = {
                        count: 0,
                        price: apt.servicePrice || 0,
                        duration: apt.serviceDuration || 30
                    };
                }
                services[service].count++;
            }
        });
        
        let maxCount = 0;
        let preferred = null;
        
        Object.entries(services).forEach(([name, data]) => {
            if (data.count > maxCount) {
                maxCount = data.count;
                preferred = { name, ...data };
            }
        });
        
        return preferred;
    },
    
    /**
     * Sonraki çalışma gününü bul
     * Salon workingHours: { sun: {open, close, closed}, mon: {...}, ... }
     */
    findNextWorkingDay(date, salon) {
        const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const workingHours = salon?.workingHours || {};
        const maxAttempts = 14;
        
        let currentDate = new Date(date);
        
        for (let i = 0; i < maxAttempts; i++) {
            const dayKey = DAY_KEYS[currentDate.getDay()];
            const hours = workingHours[dayKey];
            const isOpen = !hours?.closed && (hours?.open || hours?.close);
            if (isOpen || (!hours || Object.keys(workingHours).length === 0)) {
                return currentDate;
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        return date;
    },
    
    /**
     * En uygun boş slotu bul
     */
    findBestSlot(date, preferredTime, salon, allAppointments, duration) {
        const dateStr = date.toISOString().split('T')[0];
        const preferredHour = parseInt(preferredTime.split(':')[0]);
        
        // O güne ait randevuları al
        const dayAppointments = allAppointments
            .filter(a => a.date === dateStr && a.status !== 'cancelled')
            .map(a => ({
                start: this.timeToMinutes(a.time),
                end: this.timeToMinutes(a.time) + (a.serviceDuration || 30)
            }))
            .sort((a, b) => a.start - b.start);
        
        // Çalışma saatleri - salon workingHours'tan al
        const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const dayKey = DAY_KEYS[date.getDay()];
        const dayHours = salon?.workingHours?.[dayKey];
        if (dayHours?.closed) {
            const nextDate = new Date(date);
            nextDate.setDate(date.getDate() + 1);
            const adjustedNext = this.findNextWorkingDay(nextDate, salon);
            return {
                date: adjustedNext.toISOString().split('T')[0],
                time: preferredTime,
                alternative: true
            };
        }
        const [startH, startM] = (dayHours?.open || '09:00').split(':').map(Number);
        const [endH, endM] = (dayHours?.close || '19:00').split(':').map(Number);
        const dayStart = startH * 60 + startM;
        const dayEnd = endH * 60 + endM;
        
        // Tercih edilen saate en yakın boş slotu bul
        const preferredMinutes = preferredHour * 60;
        let bestSlot = null;
        let minDistance = Infinity;
        
        // 15 dakika aralıklarla kontrol et
        for (let time = dayStart; time <= dayEnd - duration; time += 15) {
            const slotEnd = time + duration;
            
            // Çakışma kontrolü
            const hasConflict = dayAppointments.some(apt => 
                (time >= apt.start && time < apt.end) || 
                (slotEnd > apt.start && slotEnd <= apt.end) ||
                (time <= apt.start && slotEnd >= apt.end)
            );
            
            if (!hasConflict) {
                const distance = Math.abs(time - preferredMinutes);
                if (distance < minDistance) {
                    minDistance = distance;
                    bestSlot = time;
                }
            }
        }
        
        // Eğer o gün slot bulunamazsa sonraki günlere bak
        if (bestSlot === null) {
            const nextDate = new Date(date);
            nextDate.setDate(date.getDate() + 1);
            const adjustedNextDate = this.findNextWorkingDay(nextDate, salon);
            
            return {
                date: adjustedNextDate.toISOString().split('T')[0],
                time: preferredTime,
                alternative: true
            };
        }
        
        return {
            date: dateStr,
            time: this.minutesToTime(bestSlot),
            alternative: false
        };
    },
    
    /**
     * Güven skoru hesapla (veri kalitesine göre)
     */
    calculateConfidence(appointments) {
        const count = appointments.length;
        
        if (count >= 10) return 95;
        if (count >= 5) return 85;
        if (count >= 3) return 70;
        return 50;
    },
    
    /**
     * Kullanıcıya gösterilecek mesajı oluştur
     */
    generateMessage(slot, service, interval) {
        const dateFormatted = this.formatDate(slot.date);
        const dayName = this.getDayName(slot.date);
        
        let message = `📅 Tahmini randevu tarihiniz: **${dateFormatted}, ${dayName} ${slot.time}**`;
        
        if (service) {
            message += `\n✂️ Tercih ettiğiniz hizmet: **${service.name}** (${service.price} ₺)`;
        }
        
        message += `\n📊 Ortalama ziyaret aralığınız: **${interval} gün**`;
        
        if (slot.alternative) {
            message += `\n⚠️ Tercih ettiğiniz saat dolu olduğu için alternatif önerildi.`;
        }
        
        return message;
    },
    
    /**
     * Yeterli veri yoksa varsayılan öneri
     */
    getFallbackRecommendation(salon, allAppointments) {
        const today = new Date();
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);
        
        const adjustedDate = this.findNextWorkingDay(nextWeek, salon);
        
        return {
            date: adjustedDate.toISOString().split('T')[0],
            time: '10:00',
            staffId: null,
            dateFormatted: this.formatDate(adjustedDate),
            dayName: this.getDayName(adjustedDate),
            message: 'Henüz yeterli randevu geçmişiniz yok. Size uygun bir tarih önerdik.'
        };
    },
    
    // ========== YARDIMCI FONKSİYONLAR ==========
    
    timeToMinutes(time) {
        if (!time) return 0;
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + (minutes || 0);
    },
    
    minutesToTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    },
    
    formatDate(dateStr) {
        const date = new Date(dateStr);
        const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
                       'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
        return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
    },
    
    getDayName(dateStr) {
        const date = new Date(dateStr);
        const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
        return days[date.getDay()];
    },
    
    /**
     * Telefon numarasına göre müşteri randevularını getir
     */
    async getCustomerAppointments(db, phone) {
        const cleanPhone = phone.replace(/\D/g, '').slice(-10);
        
        try {
            const snapshot = await db.collection('appointments')
                .where('customerPhone', '>=', cleanPhone)
                .where('customerPhone', '<=', cleanPhone + '\uf8ff')
                .get();
            
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) {
            console.error('[AI] Randevu getirme hatası:', e);
            return [];
        }
    }
};

// ========== UI ENTEGRASYONU ==========

/**
 * Öneri popup'ını göster
 */
function showAIRecommendationPopup(recommendation) {
    // Mevcut popup varsa kaldır
    const existingPopup = document.getElementById('aiRecommendationPopup');
    if (existingPopup) existingPopup.remove();
    
    const popup = document.createElement('div');
    popup.id = 'aiRecommendationPopup';
    popup.className = 'ai-popup-overlay';
    
    if (recommendation.success) {
        const pred = recommendation.prediction;
        popup.innerHTML = `
            <div class="ai-popup">
                <div class="ai-popup-header">
                    <span class="ai-popup-icon">🤖</span>
                    <h3>Akıllı Öneri</h3>
                    <button class="ai-popup-close" onclick="closeAIPopup()">✕</button>
                </div>
                <div class="ai-popup-content">
                    <div class="ai-prediction-card">
                        <div class="ai-prediction-date">
                            <span class="ai-date-day">${pred.dayName}</span>
                            <span class="ai-date-full">${pred.dateFormatted}</span>
                            <span class="ai-date-time">${pred.time}</span>
                        </div>
                        <div class="ai-confidence">
                            <div class="ai-confidence-bar">
                                <div class="ai-confidence-fill" style="width: ${pred.confidence}%"></div>
                            </div>
                            <span>%${pred.confidence} güven</span>
                        </div>
                    </div>
                    
                    ${(recommendation.prediction.staffName || recommendation.preferredStaff?.name) ? `
                    <div class="ai-service-suggestion">
                        <span>👤 Önerilen personel:</span>
                        <strong>${recommendation.prediction.staffName || recommendation.preferredStaff?.name}</strong>
                    </div>
                    ` : ''}
                    ${recommendation.preferredService ? `
                    <div class="ai-service-suggestion">
                        <span>✂️ Tercih ettiğiniz hizmet:</span>
                        <strong>${recommendation.preferredService.name}</strong>
                        <span class="ai-service-price">${recommendation.preferredService.price} ₺</span>
                    </div>
                    ` : ''}
                    
                    ${(recommendation.pastAppointments && recommendation.pastAppointments.length) ? `
                    <div class="ai-past-section">
                        <div class="ai-past-title">📋 Son Randevularınız</div>
                        ${recommendation.pastAppointments.map(a => `
                            <div class="ai-past-item">${a.date} - ${a.service || '-'} ${a.staff ? '(' + a.staff + ')' : ''}</div>
                        `).join('')}
                    </div>
                    ` : ''}
                    <div class="ai-analysis">
                        <div class="ai-analysis-item">
                            <span>📊 Ortalama ziyaret aralığı</span>
                            <strong>${recommendation.analysis.averageInterval} gün</strong>
                        </div>
                        <div class="ai-analysis-item">
                            <span>📅 Son ziyaretiniz</span>
                            <strong>${recommendation.analysis.daysSinceLastVisit} gün önce</strong>
                        </div>
                        <div class="ai-analysis-item">
                            <span>📈 Toplam randevunuz</span>
                            <strong>${recommendation.analysis.totalAppointments}</strong>
                        </div>
                    </div>
                </div>
                <div class="ai-popup-actions">
                    <button class="ai-btn ai-btn-primary" onclick="applyAIRecommendation('${pred.date}', '${pred.time}', '${(pred.staffId || '').replace(/'/g, "\\'")}')">
                        ✓ Bu Tarihi Seç
                    </button>
                    <button class="ai-btn ai-btn-secondary" onclick="closeAIPopup()">
                        Farklı Tarih Seç
                    </button>
                </div>
            </div>
        `;
    } else {
        const fallback = recommendation.fallback;
        popup.innerHTML = `
            <div class="ai-popup">
                <div class="ai-popup-header">
                    <span class="ai-popup-icon">📅</span>
                    <h3>Randevu Önerisi</h3>
                    <button class="ai-popup-close" onclick="closeAIPopup()">✕</button>
                </div>
                <div class="ai-popup-content">
                    <p style="text-align: center; color: #64748b; margin-bottom: 1rem;">
                        ${recommendation.message}
                    </p>
                    <div class="ai-prediction-card">
                        <div class="ai-prediction-date">
                            <span class="ai-date-day">${fallback.dayName}</span>
                            <span class="ai-date-full">${fallback.dateFormatted}</span>
                            <span class="ai-date-time">${fallback.time}</span>
                        </div>
                    </div>
                </div>
                <div class="ai-popup-actions">
                    <button class="ai-btn ai-btn-primary" onclick="applyAIRecommendation('${fallback.date}', '${fallback.time}', '')">
                        ✓ Bu Tarihi Seç
                    </button>
                    <button class="ai-btn ai-btn-secondary" onclick="closeAIPopup()">
                        Farklı Tarih Seç
                    </button>
                </div>
            </div>
        `;
    }
    
    document.body.appendChild(popup);
    
    // Animasyon için timeout
    setTimeout(() => popup.classList.add('active'), 10);
}

function closeAIPopup() {
    const popup = document.getElementById('aiRecommendationPopup');
    if (popup) {
        popup.classList.remove('active');
        setTimeout(() => popup.remove(), 300);
    }
}

function applyAIRecommendation(date, time) {
    if (typeof window.applyAIRecommendation === 'function') {
        window.applyAIRecommendation(date, time);
        return;
    }
    const dateInput = document.getElementById('appointmentDate') || document.querySelector('input[type="date"]');
    if (dateInput) {
        dateInput.value = (date || '').split('T')[0];
        dateInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    setTimeout(() => {
        const timeSlot = document.querySelector(`[data-time="${time}"]`) || document.querySelector(`.time-slot[data-time="${time}"]`);
        if (timeSlot) timeSlot.click();
    }, 500);
    closeAIPopup();
    if (typeof showToast === 'function') showToast('Önerilen tarih seçildi!', 'success');
}

// CSS Stilleri ekle
const aiStyles = document.createElement('style');
aiStyles.textContent = `
    .ai-popup-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.3s;
    }
    
    .ai-popup-overlay.active {
        opacity: 1;
    }
    
    .ai-popup {
        background: white;
        border-radius: 16px;
        width: 100%;
        max-width: 400px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        transform: scale(0.9);
        transition: transform 0.3s;
    }
    
    .ai-popup-overlay.active .ai-popup {
        transform: scale(1);
    }
    
    .ai-popup-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 1.25rem;
        border-bottom: 1px solid #e2e8f0;
    }
    
    .ai-popup-icon {
        font-size: 1.5rem;
    }
    
    .ai-popup-header h3 {
        flex: 1;
        margin: 0;
        font-size: 1.1rem;
        font-weight: 600;
    }
    
    .ai-popup-close {
        background: none;
        border: none;
        font-size: 1.25rem;
        cursor: pointer;
        color: #64748b;
        padding: 0.25rem;
    }
    
    .ai-popup-content {
        padding: 1.25rem;
    }
    
    .ai-prediction-card {
        background: linear-gradient(135deg, #10B981, #0EA371);
        border-radius: 12px;
        padding: 1.5rem;
        color: white;
        text-align: center;
        margin-bottom: 1rem;
    }
    
    .ai-prediction-date {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    
    .ai-date-day {
        font-size: 0.9rem;
        opacity: 0.9;
    }
    
    .ai-date-full {
        font-size: 1.25rem;
        font-weight: 700;
    }
    
    .ai-date-time {
        font-size: 2rem;
        font-weight: 800;
        margin-top: 0.5rem;
    }
    
    .ai-confidence {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-top: 1rem;
        font-size: 0.85rem;
        opacity: 0.9;
    }
    
    .ai-confidence-bar {
        flex: 1;
        height: 6px;
        background: rgba(255,255,255,0.3);
        border-radius: 3px;
        overflow: hidden;
    }
    
    .ai-confidence-fill {
        height: 100%;
        background: white;
        border-radius: 3px;
    }
    
    .ai-service-suggestion {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem;
        background: #f1f5f9;
        border-radius: 8px;
        margin-bottom: 1rem;
        font-size: 0.9rem;
    }
    
    .ai-service-price {
        margin-left: auto;
        color: #10b981;
        font-weight: 600;
    }
    
    .ai-analysis {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    
    .ai-analysis-item {
        display: flex;
        justify-content: space-between;
        padding: 0.5rem 0;
        border-bottom: 1px solid #f1f5f9;
        font-size: 0.9rem;
    }
    
    .ai-analysis-item:last-child {
        border-bottom: none;
    }
    
    .ai-analysis-item span {
        color: #64748b;
    }
    
    .ai-past-section {
        background: #f8fafc;
        border-radius: 8px;
        padding: 0.75rem;
        margin-bottom: 1rem;
    }
    .ai-past-title { font-size: 0.8rem; font-weight: 600; color: #475569; margin-bottom: 0.5rem; }
    .ai-past-item { font-size: 0.85rem; color: #64748b; padding: 0.25rem 0; }
    
    .ai-popup-actions {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 1.25rem;
        border-top: 1px solid #e2e8f0;
    }
    
    .ai-btn {
        padding: 0.875rem 1.5rem;
        border-radius: 10px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
    }
    
    .ai-btn-primary {
        background: linear-gradient(135deg, #10B981, #0EA371);
        color: white;
    }
    
    .ai-btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
    }
    
    .ai-btn-secondary {
        background: #f1f5f9;
        color: #475569;
    }
    
    .ai-btn-secondary:hover {
        background: #e2e8f0;
    }
    
    /* Akıllı Öneri Butonu */
    .ai-suggest-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        background: linear-gradient(135deg, #10B981, #0EA371);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 0.85rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
    }
    
    .ai-suggest-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
    }
    
    .ai-suggest-btn .ai-icon {
        font-size: 1rem;
    }
`;
document.head.appendChild(aiStyles);

// Global'e ekle
window.AIRecommendation = AIRecommendation;
window.showAIRecommendationPopup = showAIRecommendationPopup;
window.closeAIPopup = closeAIPopup;
window.applyAIRecommendation = applyAIRecommendation;

console.log('[AI] Öneri sistemi yüklendi v1.0');
