// ============================================
// ZAMANLI - Finans Dashboard Modülü v1.0
// ============================================
// Chart.js ile gelişmiş grafikler ve raporlama
// ============================================

const FinanceDashboard = {
    charts: {},
    currentPeriod: 'week',
    appointments: [],
    
    // Renk paleti
    colors: {
        primary: '#10B981',
        primaryLight: 'rgba(16, 185, 129, 0.1)',
        success: '#10b981',
        successLight: 'rgba(16, 185, 129, 0.1)',
        warning: '#f59e0b',
        warningLight: 'rgba(245, 158, 11, 0.1)',
        danger: '#ef4444',
        dangerLight: 'rgba(239, 68, 68, 0.1)',
        purple: '#C5A065',
        pink: '#ec4899',
        cyan: '#06b6d4',
        slate: '#64748b',
        chartColors: [
            '#10B981', '#C5A065', '#f59e0b', '#ef4444', 
            '#6366f1', '#ec4899', '#06b6d4', '#84cc16'
        ],
        gradientStart: 'rgba(16, 185, 129, 0.3)',
        gradientEnd: 'rgba(16, 185, 129, 0.0)'
    },

    /**
     * Dashboard'u başlat
     */
    init(appointments = []) {
        this.appointments = appointments;
        console.log('[Finance] Dashboard başlatılıyor...');
        
        // Chart.js yüklü mü kontrol et
        if (typeof Chart === 'undefined') {
            console.warn('[Finance] Chart.js yüklenmemiş, yükleniyor...');
            this.loadChartJS().then(() => this.render());
        } else {
            this.render();
        }
    },

    /**
     * Chart.js'i dinamik olarak yükle
     */
    loadChartJS() {
        return new Promise((resolve, reject) => {
            if (typeof Chart !== 'undefined') {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
            script.onload = () => {
                console.log('[Finance] Chart.js yüklendi');
                resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },

    /**
     * Tüm dashboard'u render et
     */
    render() {
        const container = document.getElementById('financeChartsContainer');
        if (!container) {
            console.warn('[Finance] Container bulunamadı');
            return;
        }
        
        // Filtrelenmiş randevuları al
        const filteredAppointments = this.filterByPeriod(this.appointments);
        
        // İstatistikleri hesapla
        const stats = this.calculateStats(filteredAppointments);
        
        // Grafikleri oluştur
        this.renderRevenueChart(filteredAppointments);
        this.renderServicesChart(filteredAppointments);
        this.renderHourlyChart(filteredAppointments);
        this.renderComparisonStats(stats);
        
        console.log('[Finance] Dashboard render edildi');
    },

    /**
     * Döneme göre filtrele
     */
    filterByPeriod(appointments) {
        const now = new Date();
        let startDate;
        
        switch(this.currentPeriod) {
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'week':
                startDate = new Date(now);
                startDate.setDate(now.getDate() - 7);
                break;
            case 'month':
                startDate = new Date(now);
                startDate.setMonth(now.getMonth() - 1);
                break;
            case 'year':
                startDate = new Date(now);
                startDate.setFullYear(now.getFullYear() - 1);
                break;
            default:
                startDate = new Date(now);
                startDate.setDate(now.getDate() - 7);
        }
        
        const startDateStr = startDate.toISOString().split('T')[0];
        return appointments.filter(a => a.date >= startDateStr);
    },

    /**
     * İstatistikleri hesapla
     */
    calculateStats(appointments) {
        const completed = appointments.filter(a => a.status === 'completed' || a.status === 'confirmed');
        const cancelled = appointments.filter(a => a.status === 'cancelled');
        
        const totalRevenue = completed.reduce((sum, a) => sum + (a.servicePrice || 0), 0);
        const avgRevenue = completed.length > 0 ? totalRevenue / completed.length : 0;
        
        // Önceki dönem ile karşılaştırma
        const prevPeriodStats = this.getPreviousPeriodStats();
        
        return {
            totalAppointments: appointments.length,
            completedAppointments: completed.length,
            cancelledAppointments: cancelled.length,
            totalRevenue: totalRevenue,
            avgRevenue: avgRevenue,
            completionRate: appointments.length > 0 ? (completed.length / appointments.length * 100) : 0,
            prevPeriod: prevPeriodStats
        };
    },

    /**
     * Önceki dönem istatistikleri (karşılaştırma için)
     */
    getPreviousPeriodStats() {
        const now = new Date();
        let startDate, endDate;
        
        switch(this.currentPeriod) {
            case 'week':
                endDate = new Date(now);
                endDate.setDate(now.getDate() - 7);
                startDate = new Date(endDate);
                startDate.setDate(endDate.getDate() - 7);
                break;
            case 'month':
                endDate = new Date(now);
                endDate.setMonth(now.getMonth() - 1);
                startDate = new Date(endDate);
                startDate.setMonth(endDate.getMonth() - 1);
                break;
            default:
                return { revenue: 0, appointments: 0 };
        }
        
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];
        
        const prevAppointments = this.appointments.filter(a => 
            a.date >= startStr && a.date < endStr && 
            (a.status === 'completed' || a.status === 'confirmed')
        );
        
        return {
            revenue: prevAppointments.reduce((sum, a) => sum + (a.servicePrice || 0), 0),
            appointments: prevAppointments.length
        };
    },

    /**
     * Ciro grafiği (Çizgi grafik)
     */
    renderRevenueChart(appointments) {
        const canvas = document.getElementById('revenueChart');
        if (!canvas) return;
        
        // Mevcut chart'ı yok et
        if (this.charts.revenue) {
            this.charts.revenue.destroy();
        }
        
        // Günlük ciro verilerini hazırla
        const dailyData = this.getDailyRevenueData(appointments);
        
        const ctx = canvas.getContext('2d');
        
        // Gradient oluştur
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, this.colors.gradientStart);
        gradient.addColorStop(1, this.colors.gradientEnd);
        
        this.charts.revenue = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dailyData.labels,
                datasets: [{
                    label: 'Günlük Ciro (₺)',
                    data: dailyData.values,
                    borderColor: this.colors.primary,
                    backgroundColor: gradient,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: this.colors.primary,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: { size: 14, weight: 'bold' },
                        bodyFont: { size: 13 },
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => `Ciro: ${context.raw.toLocaleString('tr-TR')} ₺`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: this.colors.slate }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        ticks: {
                            color: this.colors.slate,
                            callback: (value) => value.toLocaleString('tr-TR') + ' ₺'
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    },

    /**
     * Günlük ciro verileri
     */
    getDailyRevenueData(appointments) {
        const days = this.currentPeriod === 'month' ? 30 : (this.currentPeriod === 'year' ? 12 : 7);
        const isYearly = this.currentPeriod === 'year';
        
        const labels = [];
        const values = [];
        const now = new Date();
        
        if (isYearly) {
            // Aylık görünüm
            const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
            for (let i = 11; i >= 0; i--) {
                const month = new Date(now);
                month.setMonth(now.getMonth() - i);
                const monthStr = month.toISOString().slice(0, 7); // YYYY-MM
                
                labels.push(monthNames[month.getMonth()]);
                
                const monthRevenue = appointments
                    .filter(a => a.date && a.date.startsWith(monthStr) && (a.status === 'completed' || a.status === 'confirmed'))
                    .reduce((sum, a) => sum + (a.servicePrice || 0), 0);
                
                values.push(monthRevenue);
            }
        } else {
            // Günlük görünüm
            const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
            for (let i = days - 1; i >= 0; i--) {
                const date = new Date(now);
                date.setDate(now.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                
                if (days <= 7) {
                    labels.push(dayNames[date.getDay()]);
                } else {
                    labels.push(`${date.getDate()}/${date.getMonth() + 1}`);
                }
                
                const dayRevenue = appointments
                    .filter(a => a.date === dateStr && (a.status === 'completed' || a.status === 'confirmed'))
                    .reduce((sum, a) => sum + (a.servicePrice || 0), 0);
                
                values.push(dayRevenue);
            }
        }
        
        return { labels, values };
    },

    /**
     * Hizmet dağılımı (Pasta/Doughnut grafik)
     */
    renderServicesChart(appointments) {
        const canvas = document.getElementById('servicesChart');
        if (!canvas) return;
        
        if (this.charts.services) {
            this.charts.services.destroy();
        }
        
        // Hizmet istatistikleri
        const serviceStats = {};
        appointments.forEach(apt => {
            const name = apt.service || apt.serviceName || 'Diğer';
            if (!serviceStats[name]) {
                serviceStats[name] = { count: 0, revenue: 0 };
            }
            serviceStats[name].count++;
            if (apt.status === 'completed' || apt.status === 'confirmed') {
                serviceStats[name].revenue += (apt.servicePrice || 0);
            }
        });
        
        const sortedServices = Object.entries(serviceStats)
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .slice(0, 6);
        
        if (sortedServices.length === 0) {
            canvas.parentElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:200px;color:#64748b;">Veri bulunamadı</div>';
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
        this.charts.services = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: sortedServices.map(([name]) => name),
                datasets: [{
                    data: sortedServices.map(([, stats]) => stats.revenue),
                    backgroundColor: this.colors.chartColors.slice(0, sortedServices.length),
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            padding: 15,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            font: { size: 12 }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => {
                                const service = sortedServices[context.dataIndex];
                                return [
                                    `Ciro: ${service[1].revenue.toLocaleString('tr-TR')} ₺`,
                                    `Randevu: ${service[1].count}`
                                ];
                            }
                        }
                    }
                },
                cutout: '65%'
            }
        });
    },

    /**
     * Saatlik dağılım (Bar grafik)
     */
    renderHourlyChart(appointments) {
        const canvas = document.getElementById('hourlyChart');
        if (!canvas) return;
        
        if (this.charts.hourly) {
            this.charts.hourly.destroy();
        }
        
        // Saatlik dağılım
        const hourlyData = new Array(12).fill(0); // 09:00 - 20:00
        appointments.forEach(apt => {
            if (apt.time) {
                const hour = parseInt(apt.time.split(':')[0]);
                if (hour >= 9 && hour <= 20) {
                    hourlyData[hour - 9]++;
                }
            }
        });
        
        const labels = [];
        for (let i = 9; i <= 20; i++) {
            labels.push(`${i}:00`);
        }
        
        const ctx = canvas.getContext('2d');
        
        this.charts.hourly = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Randevu Sayısı',
                    data: hourlyData,
                    backgroundColor: hourlyData.map((val, idx) => {
                        const maxVal = Math.max(...hourlyData);
                        const intensity = maxVal > 0 ? val / maxVal : 0;
                        return `rgba(99, 102, 241, ${0.3 + intensity * 0.7})`;
                    }),
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            title: (items) => `Saat: ${items[0].label}`,
                            label: (context) => `${context.raw} randevu`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: this.colors.slate, font: { size: 10 } }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        ticks: {
                            color: this.colors.slate,
                            stepSize: 1
                        }
                    }
                }
            }
        });
    },

    /**
     * Karşılaştırmalı istatistikler
     */
    renderComparisonStats(stats) {
        const container = document.getElementById('comparisonStats');
        if (!container) return;
        
        // Değişim yüzdeleri
        let revenueChange = 0;
        let appointmentChange = 0;
        
        if (stats.prevPeriod.revenue > 0) {
            revenueChange = ((stats.totalRevenue - stats.prevPeriod.revenue) / stats.prevPeriod.revenue * 100).toFixed(1);
        }
        if (stats.prevPeriod.appointments > 0) {
            appointmentChange = ((stats.completedAppointments - stats.prevPeriod.appointments) / stats.prevPeriod.appointments * 100).toFixed(1);
        }
        
        const revenueIcon = revenueChange >= 0 ? '📈' : '📉';
        const revenueColor = revenueChange >= 0 ? 'var(--success)' : 'var(--danger)';
        const appointmentIcon = appointmentChange >= 0 ? '📈' : '📉';
        const appointmentColor = appointmentChange >= 0 ? 'var(--success)' : 'var(--danger)';
        
        container.innerHTML = `
            <div class="comparison-item">
                <span class="comparison-label">Önceki döneme göre ciro</span>
                <span class="comparison-value" style="color: ${revenueColor}">
                    ${revenueIcon} ${revenueChange >= 0 ? '+' : ''}${revenueChange}%
                </span>
            </div>
            <div class="comparison-item">
                <span class="comparison-label">Önceki döneme göre randevu</span>
                <span class="comparison-value" style="color: ${appointmentColor}">
                    ${appointmentIcon} ${appointmentChange >= 0 ? '+' : ''}${appointmentChange}%
                </span>
            </div>
            <div class="comparison-item">
                <span class="comparison-label">Ortalama randevu tutarı</span>
                <span class="comparison-value" style="color: var(--primary)">
                    💰 ${stats.avgRevenue.toLocaleString('tr-TR', {maximumFractionDigits: 0})} ₺
                </span>
            </div>
            <div class="comparison-item">
                <span class="comparison-label">Tamamlanma oranı</span>
                <span class="comparison-value" style="color: ${stats.completionRate >= 80 ? 'var(--success)' : 'var(--warning)'}">
                    ✅ %${stats.completionRate.toFixed(1)}
                </span>
            </div>
        `;
    },

    /**
     * Dönem değiştir
     */
    changePeriod(period) {
        this.currentPeriod = period;
        
        // Buton stillerini güncelle
        document.querySelectorAll('.finance-period-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.period === period);
        });
        
        this.render();
    },

    /**
     * Verileri güncelle
     */
    updateData(appointments) {
        this.appointments = appointments;
        this.render();
    },

    /**
     * Grafikleri temizle
     */
    destroy() {
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        this.charts = {};
    }
};

// Global'e ekle
window.FinanceDashboard = FinanceDashboard;

console.log('[Finance] Dashboard modülü yüklendi v1.0');
