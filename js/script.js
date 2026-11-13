/* =========================================================
   PEMUDA QORYAH BABAKAN — SCRIPT UTAMA
   ========================================================= */

const API_URL = 'https://script.google.com/macros/s/AKfycbxLT6af3_x6F0jLImDZW1YgjhHpffvcl1nPOz5-KErEi7cZhOSjY6hgfqPuzSh83yWF/exec';
const TZ = 'Asia/Jakarta';

const $ = (id) => document.getElementById(id);

function formatRupiah(value) {
    const number = Number(value) || 0;
    return new Intl.NumberFormat('id-ID', {
        style: 'currency', currency: 'IDR',
        maximumFractionDigits: 0
    }).format(number);
}

function formatTanggal(value) {
    if (!value) return '-';
    const s = String(value);
    // Tanggal API dapat berupa yyyy-mm-dd atau dd/mm/yyyy
    let d;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        const [y, m, day] = s.slice(0, 10).split('-').map(Number);
        d = new Date(y, m - 1, day);
    } else if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(s)) {
        const [day, m, y] = s.split(/[/-]/).map(Number);
        d = new Date(y, m - 1, day);
    } else {
        d = new Date(s);
    }
    if (Number.isNaN(d.getTime())) return s;
    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric'
    }).format(d);
}

function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
}

/* ---------- JSONP untuk Google Apps Script ---------- */
function requestAppsScript(type) {
    return new Promise((resolve, reject) => {
        const callbackName = `qoryahCallback_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const script = document.createElement('script');
        const timeout = setTimeout(() => finish(new Error('Waktu permintaan API habis.')), 15000);

        function finish(error, data) {
            clearTimeout(timeout);
            delete window[callbackName];
            script.remove();
            if (error) reject(error);
            else resolve(data);
        }

        window[callbackName] = (data) => finish(null, data);
        script.onerror = () => finish(new Error('Tidak dapat menghubungi Google Apps Script.'));
        script.src = `${API_URL}?type=${encodeURIComponent(type)}&callback=${callbackName}`;
        document.head.appendChild(script);
    });
}


/* ---------- Jadwal petugas ---------- */
async function loadJadwalPetugas() {
    const ids = {
        mc: 'petugas-mc',
        pembacaIkrar: 'petugas-ikrar',
        penerjemah: 'petugas-penerjemah',
        imam: 'petugas-imam',
        perelek: 'petugas-perelek',
        kencleng: 'petugas-kencleng'
    };

    try {
        const result = await requestAppsScript('jadwal');

        if (!result || result.success !== true) {
            throw new Error(result?.message || 'Respons jadwal tidak valid.');
        }

        const jadwal = result.data?.jadwal?.jadwal || result.data?.jadwal || {};

        const values = {
            mc: jadwal.mc,
            pembacaIkrar: jadwal.pembacaIkrar,
            penerjemah: jadwal.penerjemah,
            imam: jadwal.imam,
            perelek: jadwal.perelek,
            kencleng: jadwal.kencleng
        };

        Object.entries(ids).forEach(([key, id]) => {
            const value = values[key];

            setText(
                id,
                value && String(value).trim() !== ''
                    ? value
                    : 'Belum diisi'
            );
        });

    } catch (error) {
        console.error('Gagal memuat jadwal petugas:', error);

        Object.values(ids).forEach(id => {
            setText(id, 'Data belum dapat dimuat');
        });
    }
}



/* ---------- Transparansi kas ---------- */
async function loadKas() {
    const tbody = $('kas-riwayat');
    setText('kas-saldo-akhir', 'Memuat...');

    try {
        const result = await requestAppsScript('kas');

        if (!result || result.success !== true) {
            throw new Error(result?.message || 'Respons kas tidak valid.');
        }

        const kas = result.data?.kas || result.data || {};

        const saldoAkhir = Number(kas.saldoAkhir ?? 0);
        setText('kas-saldo-akhir', formatRupiah(saldoAkhir));

        const transaksi = Array.isArray(kas.transaksi) ? kas.transaksi : [];

        if (!tbody) return;

        if (transaksi.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="p-4 text-center text-ink/50">
                        Belum ada transaksi kas. Saldo awal ${formatRupiah(kas.saldoAwal ?? 0)}.
                    </td>
                </tr>`;
        } else {
            tbody.innerHTML = '';

            // Saldo berjalan dimulai dari saldo akhir
            let saldoBerjalan = saldoAkhir;

            // Data diasumsikan tersusun dari transaksi terbaru ke terlama
            const daftarTransaksi = transaksi.map(item => {
                const jenis = String(
                    item.jenis || item.jenisTransaksi || ''
                ).toLowerCase();

                const nominal = Number(item.nominal || 0);

                const masuk =
                    jenis.includes('masuk') ||
                        jenis.includes('pemasukan')
                        ? nominal : 0;

                const keluar =
                    jenis.includes('keluar') ||
                        jenis.includes('pengeluaran')
                        ? nominal : 0;

                // Saldo setelah transaksi ini
                const saldoHitung = saldoBerjalan;

                // Mundur ke saldo sebelum transaksi ini
                saldoBerjalan = saldoBerjalan - masuk + keluar;

                // Gunakan saldo dari API jika tersedia
                const saldoAPI = item.saldo ?? item.saldoKas;
                const saldoBaris =
                    saldoAPI !== undefined &&
                        saldoAPI !== null &&
                        saldoAPI !== ''
                        ? Number(saldoAPI)
                        : saldoHitung;

                return {
                    item,
                    masuk,
                    keluar,
                    saldoBaris
                };
            });

            daftarTransaksi.forEach(({ item, masuk, keluar, saldoBaris }) => {
                const keterangan =
                    item.keterangan ||
                    item.kategori ||
                    item.lainnya ||
                    '-';

                const tr = document.createElement('tr');

                tr.innerHTML = `
                    <td class="p-3 whitespace-nowrap">
                        ${formatTanggal(item.tanggal || item.tanggalTransaksi)}
                    </td>
                    <td class="p-3">
                        ${escapeHTML(keterangan)}
                    </td>
                    <td class="p-3 text-right whitespace-nowrap">
                        ${masuk ? formatRupiah(masuk) : '-'}
                    </td>
                    <td class="p-3 text-right whitespace-nowrap">
                        ${keluar ? formatRupiah(keluar) : '-'}
                    </td>
                    <td class="p-3 text-right whitespace-nowrap font-semibold">
                        ${formatRupiah(saldoBaris)}
                    </td>
                `;

                tbody.appendChild(tr);
            });
        }

        const updated = $('kas-updated');

        if (updated) {
            updated.textContent = result.updatedAt
                ? `Data diperbarui: ${new Date(result.updatedAt).toLocaleString('id-ID')}`
                : 'Data kas dimuat langsung dari Google Sheets.';
        }

    } catch (error) {
        console.error('Gagal memuat kas:', error);

        setText('kas-saldo-akhir', 'Belum tersedia');

        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="p-4 text-center text-red-600">
                        Gagal memuat laporan kas. Periksa koneksi API.
                    </td>
                </tr>`;
        }
    }
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}


/* ---------- Tanggal Masehi dan Hijriah ---------- */

function loadCalendarDate() {
    const now = new Date();

    // Tanggal Masehi menggunakan zona waktu Jakarta
    setText('masehi-date', new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Jakarta'
    }).format(now));

    try {
        // Ambil komponen kalender Hijriah
        const hijriFormatter = new Intl.DateTimeFormat(
            'en-US-u-ca-islamic-umalqura',
            {
                day: 'numeric',
                month: 'numeric',
                year: 'numeric',
                timeZone: 'Asia/Jakarta'
            }
        );

        // Pastikan browser benar-benar mendukung kalender Hijriah
        const calendar = hijriFormatter.resolvedOptions().calendar;

        if (calendar !== 'islamic-umalqura') {
            throw new Error('Kalender Hijriah tidak didukung browser.');
        }

        const parts = hijriFormatter.formatToParts(now);

        const day = Number(parts.find(p => p.type === 'day').value);
        const month = Number(parts.find(p => p.type === 'month').value);
        const year = parts.find(p => p.type === 'year').value;

        const namaBulanHijriah = [
            'Muharram',
            'Safar',
            'Rabiul Awal',
            'Rabiul Akhir',
            'Jumadil Awal',
            'Jumadil Akhir',
            'Rajab',
            'Syakban',
            'Ramadan',
            'Syawal',
            'Zulkaidah',
            'Zulhijah'
        ];

        const namaBulan = namaBulanHijriah[month - 1];

        if (!namaBulan || !day || !year) {
            throw new Error('Data tanggal Hijriah tidak valid.');
        }

        setText('hijri-date', `${day} ${namaBulan} ${year} H`);

    } catch (error) {
        console.error('Gagal memuat tanggal Hijriah:', error);
        setText('hijri-date', 'Tanggal Hijriah tidak tersedia');
    }
}


/* ---------- Menu navigasi mobile ---------- */
function setupMobileMenu() {
    const button = $('menu-btn');
    const menu = $('mobile-menu');
    if (!button || !menu) return;

    button.addEventListener('click', () => {
        const opened = !menu.classList.contains('hidden');
        menu.classList.toggle('hidden');
        button.setAttribute('aria-expanded', String(!opened));
    });

    menu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            menu.classList.add('hidden');
            button.setAttribute('aria-expanded', 'false');
        });
    });
}

/* ---------- Countdown acara rutin ---------- */
// Angka hari mengikuti JavaScript: Minggu=0, Senin=1, dst.
// Kegiatan Senin malam, Selasa malam, dan Kamis malam.
const routineSchedule = [
    { title: 'Tadarus Rutin', subtitle: "Senin Malam • Tadarus Al-Qur'an & Sunnah", day: 1, hour: 18, minute: 20 },
    { title: 'Ngobrolkeun Kangjeng Nabi', subtitle: 'Selasa Malam • Kajian Siroh Nabawiyah', day: 2, hour: 19, minute: 40 },
    { title: 'Bersih-bersih Masjid', subtitle: 'Kamis Malam • Gotong Royong', day: 4, hour: 19, minute: 40 }
];

function nextRoutine(from = new Date()) {
    let best = null;
    routineSchedule.forEach(event => {
        const target = new Date(from);
        let days = (event.day - from.getDay() + 7) % 7;
        target.setHours(event.hour, event.minute, 0, 0);
        if (days === 0 && target <= from) days = 7;
        target.setDate(target.getDate() + days);
        if (!best || target < best.target) best = { ...event, target };
    });
    return best;
}

let activeRoutine = null;
function updateCountdown() {
    const now = new Date();
    if (!activeRoutine || activeRoutine.target <= now) activeRoutine = nextRoutine(now);
    if (!activeRoutine) return;

    setText('cd-title', activeRoutine.title);
    setText('cd-subtitle', activeRoutine.subtitle);

    let ms = Math.max(0, activeRoutine.target - now);
    const days = Math.floor(ms / 86400000); ms %= 86400000;
    const hours = Math.floor(ms / 3600000); ms %= 3600000;
    const minutes = Math.floor(ms / 60000); ms %= 60000;
    const seconds = Math.floor(ms / 1000);

    setText('cd-days', String(days).padStart(2, '0'));
    setText('cd-hours', String(hours).padStart(2, '0'));
    setText('cd-minutes', String(minutes).padStart(2, '0'));
    setText('cd-seconds', String(seconds).padStart(2, '0'));
}

/* ---------- Galeri foto ---------- */
function setupGallerySlider() {
    const slides = [...document.querySelectorAll('#slider-container .slide')];
    const prev = $('prev-btn');
    const next = $('next-btn');
    if (!slides.length) return;

    let index = 0;
    function show() {
        slides.forEach((slide, i) => {
            slide.classList.toggle('opacity-100', i === index);
            slide.classList.toggle('opacity-0', i !== index);
            slide.classList.toggle('pointer-events-none', i !== index);
        });
    }
    next?.addEventListener('click', () => { index = (index + 1) % slides.length; show(); });
    prev?.addEventListener('click', () => { index = (index - 1 + slides.length) % slides.length; show(); });
    show();
    if (slides.length > 1) window.setInterval(() => {
        index = (index + 1) % slides.length;
        show();
    }, 5000);
}

/* ---------- Jadwal salat berdasarkan GPS ---------- */
function getPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error('Browser tidak mendukung GPS.'));
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true, timeout: 15000, maximumAge: 300000
        });
    });
}

function prayerDateString(date) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric'
    }).formatToParts(date);
    const get = type => parts.find(p => p.type === type)?.value;
    return `${get('day')}-${get('month')}-${get('year')}`;
}

function parseTime(value) {
    const match = String(value || '').match(/(\d{1,2}):(\d{2})/);
    return match ? `${match[1].padStart(2, '0')}:${match[2]}` : null;
}

async function fetchPrayerTimings(date, lat, lon) {
    const url = new URL(`https://api.aladhan.com/v1/timings/${prayerDateString(date)}`);
    url.searchParams.set('latitude', lat);
    url.searchParams.set('longitude', lon);
    const response = await fetch(url);
    if (!response.ok) throw new Error('API jadwal salat tidak merespons.');
    const json = await response.json();
    if (json.code !== 200 || !json.data?.timings) throw new Error('Data jadwal salat kosong.');
    return json.data.timings;
}

let prayerTimesToday = null;
let prayerTimeTomorrowFajr = null;

async function loadPrayerTimes() {
    const status = $('prayer-source');
    try {
        if (status) status.textContent = 'Meminta izin lokasi...';
        const position = await getPosition();
        const { latitude, longitude } = position.coords;
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (status) status.textContent = 'Mengambil jadwal salat...';
        const [todayData, tomorrowData] = await Promise.all([
            fetchPrayerTimings(today, latitude, longitude),
            fetchPrayerTimings(tomorrow, latitude, longitude)
        ]);

        prayerTimesToday = {
            Subuh: parseTime(todayData.Fajr),
            Dzuhur: parseTime(todayData.Dhuhr),
            Ashar: parseTime(todayData.Asr),
            Maghrib: parseTime(todayData.Maghrib),
            Isya: parseTime(todayData.Isha)
        };
        prayerTimeTomorrowFajr = parseTime(tomorrowData.Fajr);

        const ids = { Subuh: 'fajr', Dzuhur: 'dhuhr', Ashar: 'asr', Maghrib: 'maghrib', Isya: 'isha' };
        Object.entries(ids).forEach(([name, id]) => setText(id, prayerTimesToday[name] || '--:--'));

        if (status) status.textContent = 'Jadwal salat berdasarkan lokasi perangkat.';
        updateNextPrayer();
    } catch (error) {
        console.error('Jadwal salat:', error);
        if (status) status.textContent = error.code === 1
            ? 'Izin lokasi ditolak. Izinkan akses lokasi untuk melihat jadwal salat.'
            : 'Jadwal salat belum dapat dimuat. Periksa izin lokasi dan koneksi internet.';
    }
}

function updateNextPrayer() {
    if (!prayerTimesToday) return;
    const nowParts = new Intl.DateTimeFormat('en-GB', {
        timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date());
    const hour = Number(nowParts.find(p => p.type === 'hour').value);
    const minute = Number(nowParts.find(p => p.type === 'minute').value);
    const currentMinutes = hour * 60 + minute;

    const ordered = Object.entries(prayerTimesToday).map(([name, time]) => {
        const [h, m] = time.split(':').map(Number);
        return { name, time, minutes: h * 60 + m };
    }).filter(item => item.time).sort((a, b) => a.minutes - b.minutes);

    let next = ordered.find(item => item.minutes > currentMinutes);
    let target;
    if (next) {
        target = new Date();
        target.setHours(Number(next.time.slice(0, 2)), Number(next.time.slice(3)), 0, 0);
    } else if (prayerTimeTomorrowFajr) {
        next = { name: 'Subuh', time: prayerTimeTomorrowFajr };
        target = new Date();
        target.setDate(target.getDate() + 1);
        target.setHours(Number(next.time.slice(0, 2)), Number(next.time.slice(3)), 0, 0);
    }
    // Tidak ada elemen countdown salat khusus di HTML saat ini.
    // Jadwal waktu salat tetap ditampilkan pada lima kartu di atas.
}


/* =========================================
   GALERI 50 FOTO OTOMATIS
   ========================================= */

function buatGaleri() {
    const trackAtas = document.getElementById('gallery-track-1');
    const trackBawah = document.getElementById('gallery-track-2');

    if (!trackAtas || !trackBawah) return;

    function buatKelompok(mulai, selesai) {
        const grup = document.createElement('div');
        grup.className = 'gallery-group';

        for (let i = mulai; i <= selesai; i++) {
            const img = document.createElement('img');

            img.src = `./assets/image/galeri/kegiatan (${i}).jpg`;
            img.alt = `Dokumentasi Kegiatan ${i}`;
            img.loading = 'lazy';
            img.draggable = false;

            img.onerror = function () {
                console.warn(`Foto tidak ditemukan: ${img.src}`);
                img.classList.add('gallery-image-error');
            };

            grup.appendChild(img);
        }

        return grup;
    }

    // Baris pertama: foto 1 sampai 25
    const grupAtas = buatKelompok(1, 25);
    trackAtas.appendChild(grupAtas);
    trackAtas.appendChild(grupAtas.cloneNode(true));

    // Baris kedua: foto 26 sampai 50
    const grupBawah = buatKelompok(26, 50);
    trackBawah.appendChild(grupBawah);
    trackBawah.appendChild(grupBawah.cloneNode(true));
}

document.addEventListener('DOMContentLoaded', buatGaleri);

/* ---------- Jalankan semua fitur setelah HTML siap ---------- */
document.addEventListener('DOMContentLoaded', () => {
    setupMobileMenu();
    setupGallerySlider();
    loadCalendarDate();

    updateCountdown();
    window.setInterval(updateCountdown, 1000);

    loadJadwalPetugas();
    loadKas();
    loadPrayerTimes();
});
