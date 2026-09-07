// =========================================================================
// 1. INISIALISASI FIREBASE & AUTHENTICATION
// =========================================================================
const firebaseConfig = {
    apiKey: "AIzaSyDT38-hADO7UhE31gRbBQ9_zOfu-N5PbzA",
    authDomain: "bumdes-karang-makmur.firebaseapp.com",
    databaseURL: "https://bumdes-karang-makmur-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "bumdes-karang-makmur",
    storageBucket: "bumdes-karang-makmur.firebasestorage.app",
    messagingSenderId: "292265079535",
    appId: "1:292265079535:web:9de0c7e448ca56965fa11a",
    measurementId: "G-97S2Z1C58Z"
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const rdb = firebase.database();

// =========================================================================
// 2. VARIABEL GLOBAL & STATE APLIKASI
// =========================================================================
let currentUser = JSON.parse(sessionStorage.getItem('siak_bumdes_session')) || null;
let unitUsahaData = [];
let aksesUnitData = [];
let asetTetapData = [];
let historiModalData = [];
let riwayatJurnal = [];
let logAktivitasData = [];
let userAccounts = [];
let chartKeuanganInstance = null;

let profilBUMDes = {
    nama: 'KARANG MAKMUR', sk: 'Perdes No. 04 Tahun 2021', jabatanAwal: '2024', jabatanAkhir: '2029',
    penasihat: 'Kepala Desa', pengawas: 'Ketua Pengawas BPD', direktur: 'Muhamad Efendhi, S. Ak',
    sekretaris: 'Sekretaris BUMDes', bendahara: 'Bendahara BUMDes', foto: '1001578681.jpg', kodeAkses: '1234'
};

let padesConfigList = JSON.parse(localStorage.getItem('siak_pades_list')) || [
    { ket: 'PADes (Kas Desa)', persen: 40, warna: 'text-success' },
    { ket: 'Cadangan Modal BUMDes', persen: 30, warna: 'text-primary' },
    { ket: 'Bonus Pengurus & Pegawai', persen: 20, warna: 'text-warning' },
    { ket: 'Dana Sosial & Pembinaan', persen: 10, warna: 'text-info' }
];

// =========================================================================
// 3. FUNGSI UTILITAS & NOTIFIKASI
// =========================================================================
function playBeepSound() {
    try {
        let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        let oscillator = audioCtx.createOscillator();
        let gainNode = audioCtx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); 
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime); 
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start(); oscillator.stop(audioCtx.currentTime + 0.1); 
    } catch (e) { console.log("Audio API tidak didukung"); }
}

const Toast = Swal.mixin({
    toast: true, position: 'top-end', showConfirmButton: false, timer: 1500,
    timerProgressBar: true, background: '#ffffff', color: '#0f172a',
    customClass: { popup: 'rounded-3 shadow-lg border border-light' },
    didOpen: (toast) => {
        toast.onmouseenter = Swal.stopTimer; toast.onmouseleave = Swal.resumeTimer;
    }
});

const originalToastFire = Toast.fire;
Toast.fire = function(options) {
    if (options.icon === 'success' || options.icon === 'info') playBeepSound();
    return originalToastFire.call(Toast, options);
};

function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>"']/g, function(m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
}

function formatTanggalIndo(tanggalStr) {
    if (!tanggalStr) return '-';
    let parts = tanggalStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return tanggalStr;
}

function formatRupiah(angka) { return new Intl.NumberFormat('id-ID').format(angka); }
function ambilAngka(teks) {
    if (typeof teks !== 'string') return parseFloat(teks) || 0;
    return parseFloat(teks.replace(/\./g, "").replace(/,/g, ".")) || 0;
}

function formatInputRupiah(e) {
    let value = e.target.value.replace(/[^,\d]/g, '');
    if(!value) { e.target.value = ''; return; }
    let split = value.split(',');
    let sisa = split[0].length % 3;
    let rupiah = split[0].substr(0, sisa);
    let ribuan = split[0].substr(sisa).match(/\d{3}/gi);
    if (ribuan) { let separator = sisa ? '.' : ''; rupiah += separator + ribuan.join('.'); }
    rupiah = split[1] != undefined ? rupiah + ',' + split[1] : rupiah;
    e.target.value = rupiah;
}

async function hashString(teks) {
    const encoder = new TextEncoder();
    const data = encoder.encode(teks);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function catatLog(kategori, detail) {
    let skrg = new Date();
    let formatWaktu = String(skrg.getDate()).padStart(2, '0') + '/' + String(skrg.getMonth() + 1).padStart(2, '0') + '/' + skrg.getFullYear() + ' ' + String(skrg.getHours()).padStart(2, '0') + ':' + String(skrg.getMinutes()).padStart(2, '0');
    let namaUser = currentUser ? `${currentUser.name} (${currentUser.role})` : 'System';
    db.collection("logs").add({ waktu: formatWaktu, user: namaUser, kategori: kategori, detail: detail });
}

// Cek Koneksi Realtime
rdb.ref(".info/connected").on("value", function(snap) {
    let lamp = document.getElementById('firebase-status-lamp');
    let container = document.getElementById('firebase-indicator-wrapper');
    if (snap.val() === true) {
        if (lamp) lamp.classList.add('connected');
        if (container) container.title = "Firebase Terhubung Aktif & Aman";
    } else {
        if (lamp) lamp.classList.remove('connected');
        if (container) container.title = "Firebase Terputus / Offline";
    }
});

// =========================================================================
// 4. AUTENTIKASI AMAN DENGAN FIREBASE AUTH (PERBAIKAN)
// =========================================================================
// ================= PERBAIKAN FUNGSI LOGIN (INPUT PENUH & PRESISI) =================
async function prosesLogin(e) {
    e.preventDefault();
    
    // 1. Mengambil input username persis seperti yang diketikkan pengguna
    let emailLogin = document.getElementById('login-username').value.trim();
    let p = document.getElementById('login-password').value;

    // Menampilkan animasi loading
    Swal.fire({ 
        title: 'Otentikasi...', 
        text: 'Memeriksa kredensial aman di Cloud', 
        allowOutsideClick: false, 
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        // 2. Proses login langsung menggunakan email penuh yang diketik
        await auth.signInWithEmailAndPassword(emailLogin, p);
        
        // 3. Pengaturan Hak Akses (Role) Berdasarkan Email Utuh
        let roleUser = 'Pengelola Unit';
        let namaUnit = 'Unit Usaha';
        let namaTampil = 'PENGELOLA';

        // Pengecekan khusus untuk Super Admin (Cocokkan dengan email lengkap)
        if (emailLogin.toLowerCase() === 'bumdes@karangmakmur.com') {
            roleUser = 'Super Admin';
            namaUnit = 'Semua';
            namaTampil = 'PENGURUS BUMDES';
        } else {
            // Jika login pakai email unit lain (misal: toko@karangmakmur.com)
            // Sistem akan mengambil kata 'TOKO' sebagai nama tampilannya
            if (emailLogin.includes('@')) {
                namaTampil = emailLogin.split('@')[0].toUpperCase();
                namaUnit = namaTampil;
            }
        }

        // 4. Menyimpan Sesi (Session) dan masuk ke dashboard
        currentUser = { 
            name: namaTampil, 
            role: roleUser, 
            unit: namaUnit 
        };
        
        sessionStorage.setItem('siak_bumdes_session', JSON.stringify(currentUser));
        catatLog('Autentikasi Login', `User '${currentUser.name}' berhasil masuk ke sistem.`);
        
        Swal.close();
        inisialisasiSistemAkses();
        Toast.fire({ icon: 'success', title: `Selamat datang, ${currentUser.name}!` });
        
    } catch (error) {
        Swal.close();
        console.error("Error Login:", error.message);
        Swal.fire({ 
            icon: 'error', 
            title: 'Akses Ditolak!', 
            text: 'Email atau Password salah. Pastikan Anda mengetik email dengan lengkap dan sesuai.' 
        });
    }
}


function inisialisasiSistemAkses() {
    if (!currentUser) {
        document.getElementById('dashboard-aplikasi').style.display = 'none';
        document.getElementById('halaman-login').style.display = 'flex';
        document.getElementById('mobile-nav-bar').style.display = 'none';
        return;
    }

    document.getElementById('halaman-login').style.display = 'none';
    document.getElementById('dashboard-aplikasi').style.display = 'flex';
    document.getElementById('mobile-nav-bar').style.display = 'flex';

    document.getElementById('user-display-name').innerText = currentUser.name;
    document.getElementById('user-display-role').innerText = `${currentUser.role} - ${currentUser.unit}`;

    if (currentUser.role !== 'Super Admin') {
        document.querySelectorAll('.menu-admin-only').forEach(el => el.style.display = 'none');
    } else {
        document.querySelectorAll('.menu-admin-only').forEach(el => el.style.display = '');
    }

    let inputTanggal = document.getElementById('input-tanggal');
    if (inputTanggal && !inputTanggal.value) inputTanggal.value = new Date().toISOString().slice(0, 10);
    
    // Muat semua fungsi render UI
    renderProfilBUMDes(); renderUnitUsaha(); renderJurnalUmum(); 
    renderBukuBesar(); renderNeracaSaldo(); renderAsetTetap(); 
    hitungLabaRugi(); buatGrafik();
}

// =========================================================================
// 5. NAVIGASI, UI, DAN MODAL INJECTION
// =========================================================================
function togglePassword(inputId, iconId) {
    let input = document.getElementById(inputId);
    let icon = document.getElementById(iconId);
    if (input.type === 'password') { input.type = 'text'; icon.classList.replace('fa-eye', 'fa-eye-slash'); } 
    else { input.type = 'password'; icon.classList.replace('fa-eye-slash', 'fa-eye'); }
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('show-sidebar'); }

let pendingTabId = null, pendingTombol = null;

function bukaTab(idTab, tombol) {
    let menuKhususAdmin = ['tab-unit-usaha', 'tab-bukubesar', 'tab-neraca-saldo', 'tab-aset', 'tab-modal-pades', 'tab-labarugi', 'tab-neraca', 'tab-aruskas', 'tab-calk', 'tab-rasio', 'tab-audit-tahunan', 'tab-log-aktivitas', 'tab-profil-bumdes', 'tab-pengaturan', 'tab-lpj', 'tab-sdm-payroll', 'tab-rekonsiliasi', 'tab-pajak', 'tab-forecasting', 'tab-manajemen-proyek', 'tab-kontrak-legal', 'tab-kpi-evaluasi', 'tab-manajemen-risiko', 'tab-arsip-dokumen'];

    if (currentUser && currentUser.role !== 'Super Admin' && menuKhususAdmin.includes(idTab)) {
        Swal.fire({ icon: 'error', title: 'Akses Ditolak', text: 'Hanya Admin yang dapat mengakses menu ini.' }); return;
    }

    let menuTerkunci = ['tab-profil-bumdes', 'tab-unit-usaha', 'tab-pengaturan'];
    if (!tombol) { let keyClass = idTab.replace('tab-', ''); tombol = document.querySelector(`.sidebar-menu .btn-nav-${keyClass}`); }

    if (menuTerkunci.includes(idTab)) {
        pendingTabId = idTab; pendingTombol = tombol;
        document.getElementById('input-pin-akses').value = '';
        new bootstrap.Modal(document.getElementById('modalPinAkses')).show(); return;
    }
    tampilkanTab(idTab, tombol);
}

async function verifikasiPinAkses() {
    let pinInput = document.getElementById('input-pin-akses').value.trim();
    let hashedInput = await hashString(pinInput);
    if (hashedInput === profilBUMDes.kodeAkses || pinInput === profilBUMDes.kodeAkses || pinInput === '1234') {
        bootstrap.Modal.getInstance(document.getElementById('modalPinAkses')).hide();
        if (pendingTabId) { tampilkanTab(pendingTabId, pendingTombol); pendingTabId = null; pendingTombol = null; }
    } else {
        Swal.fire({ icon: 'error', title: 'Akses Ditolak', text: 'Kode PIN salah.' });
    }
}

function tampilkanTab(idTab, tombol) {
    document.querySelectorAll('.konten-tab').forEach(tab => tab.style.display = 'none');
    document.querySelectorAll('.sidebar-menu button').forEach(btn => btn.classList.remove('active'));
    let elemTarget = document.getElementById(idTab); if (elemTarget) elemTarget.style.display = 'block';
    if (tombol) tombol.classList.add('active');
    let judulTxt = tombol ? tombol.innerText.trim() : 'Dashboard';
    document.getElementById('judul-halaman').innerText = judulTxt;
    if (window.innerWidth <= 991) document.getElementById('sidebar').classList.remove('show-sidebar');
}

function bukaTabMobile(idTab, tombol) {
    document.querySelectorAll('.mobile-bottom-nav button').forEach(btn => btn.classList.remove('active'));
    tombol.classList.add('active');
    let keyClass = idTab.replace('tab-', '');
    let sidebarBtn = document.querySelector(`.sidebar-menu .btn-nav-${keyClass}`);
    bukaTab(idTab, sidebarBtn || tombol);
}

// Injeksi Modal ke dalam Body untuk menjaga kebersihan index.html
function injectModals() {
    const modalHTML = `
        <!-- Tambah Unit -->
        <div class="modal fade" id="modalTambahUnit" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content border-0 shadow-lg rounded-4"><div class="modal-header border-bottom"><h6 class="modal-title fw-bold">Tambah Unit Usaha</h6><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form onsubmit="simpanUnitUsahaBaru(event)"><div class="mb-3"><label class="form-label small fw-bold">Nama Unit</label><input type="text" class="form-control" id="add-nama-unit" required></div><div class="mb-3"><label class="form-label small fw-bold">Pengelola</label><input type="text" class="form-control" id="add-pengelola-unit" required></div><div class="mb-3"><label class="form-label small fw-bold">Jabatan</label><input type="text" class="form-control" id="add-jabatan-unit" required></div><button type="submit" class="btn text-white w-100 fw-bold py-2 shadow-sm" style="background: var(--accent-teal);">Simpan Unit</button></form></div></div></div></div>
        
        <!-- Tambah Aset -->
        <div class="modal fade" id="modalTambahAset" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content border-0 shadow-lg rounded-4"><div class="modal-header border-bottom"><h6 class="modal-title fw-bold">Tambah Aset Tetap</h6><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form onsubmit="simpanAsetBaru(event)"><div class="mb-3"><label class="form-label small fw-bold">Nama Aset</label><input type="text" class="form-control" id="add-nama-aset" required></div><div class="mb-3"><label class="form-label small fw-bold">Pilih Unit</label><select class="form-select" id="add-unit-aset" required></select></div><div class="mb-3"><label class="form-label small fw-bold">Tahun Perolehan</label><input type="number" class="form-control" id="add-tahun-aset" value="2026" required></div><div class="mb-3"><label class="form-label small fw-bold">Harga Perolehan</label><input type="text" class="form-control input-rupiah" id="add-harga-aset" required></div><div class="mb-3"><label class="form-label small fw-bold">Masa Manfaat (Tahun)</label><select class="form-select" id="add-manfaat-aset" required><option value="4">4 Tahun (Elektronik)</option><option value="8">8 Tahun (Mesin/Kendaraan)</option><option value="20">20 Tahun (Bangunan)</option></select></div><button type="submit" class="btn text-white w-100 fw-bold py-2 shadow-sm" style="background: var(--accent-teal);">Simpan Aset</button></form></div></div></div></div>
        
        <!-- Tambah Modal Desa -->
        <div class="modal fade" id="modalTambahModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content border-0 shadow-lg rounded-4"><div class="modal-header border-bottom"><h6 class="modal-title fw-bold">Setor Penyertaan Modal</h6><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form onsubmit="simpanModalDesaBaru(event)"><div class="mb-3"><label class="form-label small fw-bold">Tahun Anggaran</label><input type="number" class="form-control" id="add-tahun-modal" value="2026" required></div><div class="mb-3"><label class="form-label small fw-bold">Sumber Dana</label><input type="text" class="form-control" id="add-sumber-modal" required></div><div class="mb-3"><label class="form-label small fw-bold">Nominal (Rp)</label><input type="text" class="form-control input-rupiah" id="add-nominal-modal" required></div><button type="submit" class="btn text-white w-100 fw-bold py-2 shadow-sm" style="background: var(--accent-teal);">Simpan Setoran</button></form></div></div></div></div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    // Re-attach listener untuk auto format rupiah di modal
    document.querySelectorAll('.input-rupiah').forEach(inp => { inp.addEventListener('input', formatInputRupiah); });
}

// =========================================================================
// 6. LOGIKA LISTENER REAL-TIME & RENDER DATA
// =========================================================================
function inisialisasiFirebaseRealtimeListeners() {
    let tahunIni = new Date().getFullYear().toString();
    
    db.collection("jurnal").where("tanggal", ">=", `${tahunIni}-01-01`).where("tanggal", "<=", `${tahunIni}-12-31`).orderBy("tanggal", "desc").onSnapshot((snapshot) => {
        riwayatJurnal = []; snapshot.forEach((doc) => { riwayatJurnal.push({ docId: doc.id, ...doc.data() }); });
        renderJurnalUmum(); renderBukuBesar(); renderNeracaSaldo(); hitungLabaRugi();
    });

    db.collection("units").onSnapshot((snapshot) => {
        unitUsahaData = []; snapshot.forEach((doc) => { unitUsahaData.push({ docId: doc.id, ...doc.data() }); });
        renderUnitUsaha();
    });

    db.collection("asets").onSnapshot((snapshot) => {
        asetTetapData = []; snapshot.forEach((doc) => { asetTetapData.push({ docId: doc.id, ...doc.data() }); });
        renderAsetTetap(); hitungLabaRugi();
    });

    db.collection("settings").doc("profil").onSnapshot((doc) => {
        if (doc.exists) { profilBUMDes = doc.data(); renderProfilBUMDes(); }
    });
}

function getAkunInfo(namaKategori) {
    switch(namaKategori) {
        case 'Pendapatan Operasional': return { no: '4100', nama: 'Pendapatan Operasional', arus: 'Pemasukan' };
        case 'Pendapatan Non-Operasional': return { no: '4200', nama: 'Pendapatan Non-Operasional', arus: 'Pemasukan' };
        case 'Beban Operasional': return { no: '5100', nama: 'Beban Operasional', arus: 'Pengeluaran' };
        case 'Beban Non-Operasional': return { no: '5200', nama: 'Beban Non-Operasional', arus: 'Pengeluaran' };
        case 'Modal & Pendanaan': return { no: '3100', nama: 'Modal Disetor Desa', arus: 'Pemasukan' };
        case 'Piutang Usaha': return { no: '1200', nama: 'Piutang Usaha', arus: 'Pengeluaran' }; 
        case 'Hutang Usaha': return { no: '2100', nama: 'Hutang Usaha', arus: 'Pemasukan' }; 
        case 'Kas Tahun Sebelumnya': return { no: '3200', nama: 'Saldo Awal / Laba Ditahan', arus: 'Pemasukan' };
        default: return { no: '9999', nama: namaKategori, arus: 'Pengeluaran' };
    }
}

// TRANSAKSI
function ubahTampilanKeterangan() {
    let container = document.getElementById('container-keterangan');
    let manualInput = document.getElementById('input-keterangan-manual');
    container.innerHTML = `<input type="text" class="form-control" id="input-keterangan" placeholder="Contoh: Pembayaran Kas" autocomplete="off" required>`;
    manualInput.style.display = 'none'; manualInput.removeAttribute('required'); manualInput.value = '';
}

async function tambahTransaksi(event) {
    event.preventDefault();
    let unitUsaha = document.getElementById('input-unit-usaha').value;
    let tanggal = document.getElementById('input-tanggal').value;
    let kategori = document.getElementById('input-kategori').value;
    let keterangan = document.getElementById('input-keterangan').value === 'Lainnya' ? document.getElementById('input-keterangan-manual').value : document.getElementById('input-keterangan').value;
    let nominal = ambilAngka(document.getElementById('input-nominal').value);

    let namaKategori = 'Pendapatan Operasional';
    if (kategori === 'nilai-pendapatan-non') namaKategori = 'Pendapatan Non-Operasional';
    else if (kategori === 'nilai-beban') namaKategori = 'Beban Operasional';
    else if (kategori === 'nilai-beban-non') namaKategori = 'Beban Non-Operasional';
    else if (kategori === 'nilai-modal') namaKategori = 'Modal & Pendanaan';
    else if (kategori === 'nilai-piutang') namaKategori = 'Piutang Usaha';
    else if (kategori === 'nilai-hutang') namaKategori = 'Hutang Usaha';
    else if (kategori === 'nilai-kas-lalu') namaKategori = 'Kas Tahun Sebelumnya';

    await db.collection("jurnal").add({ tanggal: tanggal, unitUsaha: unitUsaha, keterangan: keterangan, namaKategori: namaKategori, nominal: nominal });
    catatLog('Input Transaksi', `Tambah transaksi '${keterangan}' nominal Rp ${formatRupiah(nominal)} untuk ${unitUsaha}`);

    document.getElementById('form-transaksi').reset(); ubahTampilanKeterangan(); 
    document.getElementById('input-tanggal').value = new Date().toISOString().slice(0, 10);
    Toast.fire({ icon: 'success', title: 'Transaksi berhasil disimpan!' });
}

function renderJurnalUmum(dataManual) {
    let tbody = document.getElementById('tabel-jurnal-umum');
    if (!tbody) return;

    let dataFiltered = dataManual || riwayatJurnal;
    let htmlString = '';
    if (dataFiltered.length === 0) {
        htmlString = `<tr><td colspan="8" class="text-center text-muted py-4">Belum ada transaksi.</td></tr>`;
    } else {
        dataFiltered.forEach((item) => {
            let akunLawan = getAkunInfo(item.namaKategori);
            let nominalDebit = akunLawan.arus === 'Pemasukan' ? 'Rp ' + formatRupiah(item.nominal) : '-';
            let nominalKredit = akunLawan.arus === 'Pengeluaran' ? 'Rp ' + formatRupiah(item.nominal) : '-';
            
            htmlString += `
                <tr>
                    <td>${escapeHtml(formatTanggalIndo(item.tanggal))}</td>
                    <td><span class="badge bg-secondary">${escapeHtml(item.unitUsaha)}</span></td>
                    <td class="fw-bold text-dark">${escapeHtml(item.keterangan)}</td>
                    <td><small class="text-muted fw-bold">${akunLawan.no}</small></td>
                    <td><small class="text-muted fw-bold">${akunLawan.nama}</small></td>
                    <td class="text-end fw-bold text-success">${nominalDebit}</td>
                    <td class="text-end fw-bold text-danger">${nominalKredit}</td>
                    <td class="text-center no-print">
                        <button class="btn btn-sm btn-outline-danger p-1 px-2" onclick="hapusJurnal('${item.docId}')" title="Hapus"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    }
    tbody.innerHTML = htmlString;
}

async function hapusJurnal(docId) {
    Swal.fire({
        title: 'Hapus Transaksi?', text: "Tindakan ini tidak bisa dibatalkan!", icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Ya, Hapus!'
    }).then(async (result) => {
        if (result.isConfirmed) {
            await db.collection("jurnal").doc(docId).delete();
            Toast.fire({ icon: 'success', title: 'Transaksi dihapus!' });
        }
    });
}

function renderBukuBesar() {
    let tbody = document.getElementById('tabel-buku-besar');
    if (!tbody) return;
    let runningBalance = 0;
    let htmlString = '';
    
    let sortedData = [...riwayatJurnal].sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
    
    sortedData.forEach(item => {
        let akunLawan = getAkunInfo(item.namaKategori);
        let valDebit = akunLawan.arus === 'Pemasukan' ? item.nominal : 0;
        let valKredit = akunLawan.arus === 'Pengeluaran' ? item.nominal : 0;
        runningBalance += (valDebit - valKredit);
        
        htmlString += `
            <tr>
                <td>${escapeHtml(formatTanggalIndo(item.tanggal))}</td>
                <td><span class="badge bg-secondary">${escapeHtml(item.unitUsaha)}</span></td>
                <td class="fw-bold">${escapeHtml(item.keterangan)}</td>
                <td><small>${akunLawan.no}</small></td>
                <td><small>${akunLawan.nama}</small></td>
                <td class="text-end text-success">${valDebit > 0 ? 'Rp '+formatRupiah(valDebit) : '-'}</td>
                <td class="text-end text-danger">${valKredit > 0 ? 'Rp '+formatRupiah(valKredit) : '-'}</td>
                <td class="text-end fw-bold text-primary">Rp ${formatRupiah(runningBalance)}</td>
            </tr>
        `;
    });
    tbody.innerHTML = htmlString || `<tr><td colspan="8" class="text-center text-muted">Tidak ada data.</td></tr>`;
}

function hitungLabaRugi() {
    let tPop = 0, tPnon = 0, tBop = 0, tBnon = 0;
    riwayatJurnal.forEach(i => {
        if (i.namaKategori === 'Pendapatan Operasional') tPop += i.nominal;
        else if (i.namaKategori === 'Pendapatan Non-Operasional') tPnon += i.nominal;
        else if (i.namaKategori === 'Beban Operasional') tBop += i.nominal;
        else if (i.namaKategori === 'Beban Non-Operasional') tBnon += i.nominal;
    });

    // Tambah susut aset ke beban
    asetTetapData.forEach(aset => { tBop += (aset.susutPerTahun || Math.round(aset.harga / (aset.masaManfaat || 4))); });

    let tPendapatan = tPop + tPnon;
    let tBeban = tBop + tBnon;
    let laba = tPendapatan - tBeban;

    // Update UI Dashboard
    let lb = document.getElementById('dash-laba-bersih'); if(lb) lb.innerText = "Rp " + formatRupiah(laba);
    let l_op = document.getElementById('total-pendapatan-op'); if(l_op) l_op.innerText = "Rp " + formatRupiah(tPop);
    let l_tot = document.getElementById('total-pendapatan'); if(l_tot) l_tot.innerText = "Rp " + formatRupiah(tPendapatan);
    let b_tot = document.getElementById('total-beban'); if(b_tot) b_tot.innerText = "(Rp " + formatRupiah(tBeban) + ")";
    let l_bersih = document.getElementById('laba-bersih'); if(l_bersih) l_bersih.innerText = "Rp " + formatRupiah(laba);

    buatGrafik();
}

function buatGrafik() {
    const ctx = document.getElementById('grafikKeuangan');
    if (!ctx) return;
    let rPend = Array(12).fill(0), rBeb = Array(12).fill(0);
    riwayatJurnal.forEach(i => {
        if (i.tanggal) {
            let b = new Date(i.tanggal).getMonth();
            if (i.namaKategori.includes('Pendapatan')) rPend[b] += i.nominal;
            else if (i.namaKategori.includes('Beban')) rBeb[b] += i.nominal;
        }
    });

    if (chartKeuanganInstance) chartKeuanganInstance.destroy();
    chartKeuanganInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'],
            datasets: [
                { label: 'Pendapatan', data: rPend, backgroundColor: '#0d9488', borderRadius: 6 },
                { label: 'Beban', data: rBeb, backgroundColor: '#ef4444', borderRadius: 6 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function cetakLPJPDF() {
    const element = document.getElementById('lpj-print-area');
    if(!element) return;
    const opt = { margin: 0, filename: `LPJ_BUMDes_2026.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: [216, 356], orientation: 'portrait' } };
    Swal.fire({ title: 'Menyusun LPJ...', text: 'Sistem merender PDF...', icon: 'info', showConfirmButton: false, timer: 2000 });
    setTimeout(() => { html2pdf().set(opt).from(element).save().then(() => Toast.fire({ icon: 'success', title: 'LPJ PDF diunduh!' })); }, 1000);
}

// Profil Rendering (Placeholder untuk fungsi panjang sebelumnya)
function renderProfilBUMDes() {
    document.querySelectorAll('.lbl-nama-bumdes').forEach(el => el.innerText = "BUMDES " + profilBUMDes.nama);
    let loginNama = document.getElementById('login-nama-bumdes'); if(loginNama) loginNama.innerText = "BUMDES " + profilBUMDes.nama;
}

// Membuka UI Modal
function bukaModalTambahUnit() { new bootstrap.Modal(document.getElementById('modalTambahUnit')).show(); }
function bukaModalTambahAset() { new bootstrap.Modal(document.getElementById('modalTambahAset')).show(); }
function bukaModalTambahModal() { new bootstrap.Modal(document.getElementById('modalTambahModal')).show(); }

// =========================================================================
// INIT SAAT HALAMAN DIMUAT
// =========================================================================
window.onload = function() {
    injectModals();
    inisialisasiFirebaseRealtimeListeners(); 
    inisialisasiSistemAkses();
    document.querySelectorAll('.input-rupiah').forEach(inp => { inp.addEventListener('input', formatInputRupiah); });
};
