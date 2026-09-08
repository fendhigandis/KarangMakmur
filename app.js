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
    sekretaris: 'Sekretaris BUMDes', bendahara: 'Bendahara BUMDes', foto: '1001578681.jpg', kodeAkses: '1234',
    kontakWA: '', alamat: 'Desa Karangdowo Kecamatan Weleri Kabupaten Kendal'
};

let historiTutupBukuData = [];

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
    db.collection("logs").add({ waktu: formatWaktu, waktuUnix: skrg.getTime(), user: namaUser, kategori: kategori, detail: detail }).catch(e => console.warn('Gagal mencatat log:', e.message));
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
// ================= 1. FUNGSI LOGIN PINTAR (AUTO-REGISTER) =================
async function prosesLogin(e) {
    e.preventDefault();
    
    let emailLogin = document.getElementById('login-username').value.trim();
    let p = document.getElementById('login-password').value;

    Swal.fire({ 
        title: 'Otentikasi...', 
        text: 'Menghubungkan ke server BUMDes...', 
        allowOutsideClick: false, 
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        // Langkah 1: Coba login normal ke Firebase
        await auth.signInWithEmailAndPassword(emailLogin, p);
        berhasilMasuk(emailLogin);
    } catch (error) {
        // Langkah 2: Jika ditolak karena belum terdaftar, lakukan Pendaftaran Otomatis
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
            try {
                await auth.createUserWithEmailAndPassword(emailLogin, p);
                berhasilMasuk(emailLogin); // Langsung masuk setelah berhasil daftar otomatis
            } catch (regError) {
                // Jika gagal mendaftar karena email sudah ada, berarti passwordnya yang salah
                if (regError.code === 'auth/email-already-in-use') {
                    Swal.fire({ icon: 'error', title: 'Akses Ditolak!', text: 'Password yang Anda masukkan salah.' });
                } else {
                    Swal.fire({ icon: 'error', title: 'Gagal Akses!', text: regError.message });
                }
            }
        } else {
            Swal.fire({ icon: 'error', title: 'Akses Ditolak!', text: error.message });
        }
    }
}

// ================= 2. FUNGSI BANTUAN MASUK DASHBOARD =================
function berhasilMasuk(emailLogin) {
    let roleUser = 'Pengelola Unit';
    let namaUnit = 'Unit Usaha';
    let namaTampil = 'PENGELOLA';

    // Pengecekan Hak Akses
    if (emailLogin.toLowerCase() === 'bumdes@karangmakmur.com') {
        roleUser = 'Super Admin';
        namaUnit = 'Semua';
        namaTampil = 'PENGURUS BUMDES';
    } else if (emailLogin.includes('@')) {
        namaTampil = emailLogin.split('@')[0].toUpperCase();
        namaUnit = namaTampil;
    }

    // Menyimpan sesi dan membuka UI
    currentUser = { name: namaTampil, role: roleUser, unit: namaUnit };
    sessionStorage.setItem('siak_bumdes_session', JSON.stringify(currentUser));
    catatLog('Autentikasi Login', `User '${currentUser.name}' berhasil masuk.`);
    
    Swal.close();
    inisialisasiSistemAkses();
    Toast.fire({ icon: 'success', title: `Selamat datang, ${currentUser.name}!` });
}



// ================= 2b. FUNGSI LOGOUT & LUPA PASSWORD =================
async function prosesLogout() {
    let konfirmasi = await Swal.fire({
        icon: 'warning', title: 'Keluar dari Aplikasi?', text: 'Anda harus login kembali untuk mengakses sistem.',
        showCancelButton: true, confirmButtonText: 'Ya, Keluar', cancelButtonText: 'Batal',
        confirmButtonColor: '#ef4444'
    });
    if (!konfirmasi.isConfirmed) return;
    try { await auth.signOut(); } catch (e) { console.warn(e); }
    catatLog('Autentikasi Logout', `User '${currentUser ? currentUser.name : '-'}' keluar dari sistem.`);
    currentUser = null;
    sessionStorage.removeItem('siak_bumdes_session');
    inisialisasiSistemAkses();
    Toast.fire({ icon: 'info', title: 'Anda telah keluar.' });
}

async function mintaResetPasswordWA() {
    let emailLogin = document.getElementById('login-username').value.trim();
    if (!emailLogin || !emailLogin.includes('@')) {
        Swal.fire({ icon: 'warning', title: 'Isi Email Terlebih Dahulu', text: 'Ketikkan email/username Anda pada kolom login, lalu klik "Lupa Password?" kembali.' });
        return;
    }
    // Coba kirim link reset resmi via Firebase (jika akun terdaftar berbasis email valid)
    try { await auth.sendPasswordResetEmail(emailLogin); } catch (e) { /* diamkan, tetap arahkan ke WA admin */ }

    let noWA = (profilBUMDes.kontakWA || '').replace(/[^0-9]/g, '');
    let pesan = encodeURIComponent(`Assalamualaikum, saya ingin mengajukan reset password akun SIAK BUMDes atas email: ${emailLogin}`);
    if (noWA) {
        window.open(`https://wa.me/${noWA}?text=${pesan}`, '_blank');
        Toast.fire({ icon: 'info', title: 'Membuka WhatsApp admin...' });
    } else {
        Swal.fire({ icon: 'info', title: 'Hubungi Admin', text: 'Nomor WhatsApp admin belum diatur. Silakan hubungi pengurus BUMDes secara langsung untuk reset password, atau cek email Anda jika akun terdaftar via email valid.' });
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
    hitungLabaRugi(); renderNeraca(); renderModalPades(); renderArusKas();
    renderRasioFinansial(); renderLogAktivitas(); renderHistoriTutupBuku(); renderCalkRingkasan();
    buatGrafik();
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
    let menuKhususAdmin = ['tab-unit-usaha', 'tab-bukubesar', 'tab-neraca-saldo', 'tab-aset', 'tab-modal-pades', 'tab-labarugi', 'tab-neraca', 'tab-aruskas', 'tab-calk', 'tab-rasio', 'tab-audit-tahunan', 'tab-log-aktivitas', 'tab-profil-bumdes', 'tab-pengaturan', 'tab-lpj'];

    if (currentUser && currentUser.role !== 'Super Admin' && menuKhususAdmin.includes(idTab)) {
        Swal.fire({ icon: 'error', title: 'Akses Ditolak', text: 'Hanya Admin yang dapat mengakses menu ini.' }); return;
    }

    let menuTerkunci = ['tab-profil-bumdes', 'tab-unit-usaha', 'tab-pengaturan', 'tab-audit-tahunan'];
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
        <div class="modal fade" id="modalTambahModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content border-0 shadow-lg rounded-4"><div class="modal-header border-bottom"><h6 class="modal-title fw-bold">Setor Penyertaan Modal</h6><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form onsubmit="simpanModalDesaBaru(event)"><div class="mb-3"><label class="form-label small fw-bold">Tahun Anggaran</label><input type="number" class="form-control" id="add-tahun-modal" value="2026" required></div><div class="mb-3"><label class="form-label small fw-bold">Sumber Dana</label><input type="text" class="form-control" id="add-sumber-modal" required></div><div class="mb-3"><label class="form-label small fw-bold">Keterangan</label><input type="text" class="form-control" id="add-keterangan-modal" placeholder="Contoh: Penyertaan Modal APBDes"></div><div class="mb-3"><label class="form-label small fw-bold">Nominal (Rp)</label><input type="text" class="form-control input-rupiah" id="add-nominal-modal" required></div><button type="submit" class="btn text-white w-100 fw-bold py-2 shadow-sm" style="background: var(--accent-teal);">Simpan Setoran</button></form></div></div></div></div>
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
        renderNeraca(); renderArusKas(); renderRasioFinansial(); renderCalkRingkasan(); renderHistoriTutupBuku();
    });

    db.collection("units").onSnapshot((snapshot) => {
        unitUsahaData = []; snapshot.forEach((doc) => { unitUsahaData.push({ docId: doc.id, ...doc.data() }); });
        renderUnitUsaha();
    });

    db.collection("asets").onSnapshot((snapshot) => {
        asetTetapData = []; snapshot.forEach((doc) => { asetTetapData.push({ docId: doc.id, ...doc.data() }); });
        renderAsetTetap(); hitungLabaRugi(); renderArusKas(); renderRasioFinansial(); renderCalkRingkasan();
    });

    db.collection("settings").doc("profil").onSnapshot((doc) => {
        if (doc.exists) { profilBUMDes = Object.assign({}, profilBUMDes, doc.data()); renderProfilBUMDes(); }
    });

    db.collection("modals").orderBy("tahun", "desc").onSnapshot((snapshot) => {
        historiModalData = []; snapshot.forEach((doc) => { historiModalData.push({ docId: doc.id, ...doc.data() }); });
        renderModalPades(); renderNeraca(); renderArusKas(); hitungLabaRugi();
    });

    db.collection("logs").orderBy("waktuUnix", "desc").limit(150).onSnapshot((snapshot) => {
        logAktivitasData = []; snapshot.forEach((doc) => { logAktivitasData.push({ docId: doc.id, ...doc.data() }); });
        renderLogAktivitas();
    });

    db.collection("settings").doc("calk").onSnapshot((doc) => {
        let area = document.getElementById('calk-textarea');
        if (doc.exists && area && !area.dataset.dirty) { area.value = doc.data().isi || area.value; }
    });

    db.collection("tutupbuku").orderBy("tahun", "desc").onSnapshot((snapshot) => {
        historiTutupBukuData = []; snapshot.forEach((doc) => { historiTutupBukuData.push({ docId: doc.id, ...doc.data() }); });
        renderHistoriTutupBuku();
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

    let dataFiltered = dataManual || ((currentUser && currentUser.role !== 'Super Admin') ? riwayatJurnal.filter(i => i.unitUsaha === currentUser.unit) : riwayatJurnal);
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

    let unitFilter = document.getElementById('filter-unit-bukubesar')?.value || 'Semua';
    let akunFilter = document.getElementById('filter-akun-bukubesar')?.value || 'Semua';

    let dataBase = (currentUser && currentUser.role !== 'Super Admin') ? riwayatJurnal.filter(i => i.unitUsaha === currentUser.unit) : riwayatJurnal;
    if (unitFilter !== 'Semua') dataBase = dataBase.filter(i => i.unitUsaha === unitFilter);
    if (akunFilter !== 'Semua') dataBase = dataBase.filter(i => i.namaKategori === akunFilter);

    let sortedData = [...dataBase].sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
    
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
    let tPop = 0, tPnon = 0, tBop = 0, tBnon = 0, tPiutang = 0, tHutang = 0;
    let dataFiltered = (currentUser && currentUser.role !== 'Super Admin') ? riwayatJurnal.filter(i => i.unitUsaha === currentUser.unit) : riwayatJurnal;
    dataFiltered.forEach(i => {
        if (i.namaKategori === 'Pendapatan Operasional') tPop += i.nominal;
        else if (i.namaKategori === 'Pendapatan Non-Operasional') tPnon += i.nominal;
        else if (i.namaKategori === 'Beban Operasional') tBop += i.nominal;
        else if (i.namaKategori === 'Beban Non-Operasional') tBnon += i.nominal;
        else if (i.namaKategori === 'Piutang Usaha') tPiutang += i.nominal;
        else if (i.namaKategori === 'Hutang Usaha') tHutang += i.nominal;
    });

    let tBebanKasOperasional = tBop; // beban operasional murni tunai (tanpa penyusutan), dipakai utk Kas & Arus Kas

    // Tambah susut aset ke beban (untuk kebutuhan Laba Rugi akrual)
    let totalSusutTahunIni = 0;
    let dataAsetFiltered = (currentUser && currentUser.role !== 'Super Admin') ? asetTetapData.filter(a => a.unit === currentUser.unit) : asetTetapData;
    dataAsetFiltered.forEach(aset => { totalSusutTahunIni += (aset.susutPerTahun || Math.round(aset.harga / (aset.masaManfaat || 4))); });
    tBop += totalSusutTahunIni;

    let tPendapatan = tPop + tPnon;
    let tBeban = tBop + tBnon;
    let laba = tPendapatan - tBeban;

    // Update UI - Laporan Laba Rugi
    let set = (id, val) => { let el = document.getElementById(id); if (el) el.innerText = val; };
    set('total-pendapatan-op', "Rp " + formatRupiah(tPop));
    set('total-pendapatan-non', "Rp " + formatRupiah(tPnon));
    set('total-pendapatan', "Rp " + formatRupiah(tPendapatan));
    set('total-beban-op', "(Rp " + formatRupiah(tBop) + ")");
    set('total-beban-non', "(Rp " + formatRupiah(tBnon) + ")");
    set('total-beban', "(Rp " + formatRupiah(tBeban) + ")");
    set('laba-bersih', (laba < 0 ? "-Rp " : "Rp ") + formatRupiah(Math.abs(laba)));
    set('dash-laba-bersih', (laba < 0 ? "-Rp " : "Rp ") + formatRupiah(Math.abs(laba)));

    // Update Kartu Dashboard Ringkasan (Kas & Bank, Piutang, Hutang)
    let totalPembelianAset = 0;
    dataAsetFiltered.forEach(a => totalPembelianAset += (a.harga || 0));
    let totalModalTahunIni = 0;
    let tahunIni = new Date().getFullYear();
    (historiModalData || []).forEach(m => { if (parseInt(m.tahun) === tahunIni) totalModalTahunIni += (m.nominal || 0); });

    let kasBank = (tPop + tPnon + tHutang + totalModalTahunIni) - (tBebanKasOperasional + tBnon + tPiutang + totalPembelianAset);
    set('dash-kas-bank', "Rp " + formatRupiah(kasBank));
    set('dash-piutang', "Rp " + formatRupiah(tPiutang));
    set('dash-hutang', "Rp " + formatRupiah(tHutang));

    buatGrafik();
    return { tPop, tPnon, tBop, tBnon, tBebanKasOperasional, tPiutang, tHutang, tPendapatan, tBeban, laba, totalPembelianAset, totalSusutTahunIni };
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
    siapkanKontenLPJ();
    let namaFile = `LPJ_BUMDes_${profilBUMDes.nama.replace(/\s+/g,'_')}_${new Date().getFullYear()}.pdf`;
    const opt = { margin: 0, filename: namaFile, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css', 'legacy'] } };
    Swal.fire({ title: 'Menyusun LPJ...', text: 'Sistem sedang merender dokumen PDF, mohon tunggu...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    setTimeout(() => {
        html2pdf().set(opt).from(element).save().then(() => {
            Swal.close();
            catatLog('Cetak LPJ', `Mengunduh Laporan Pertanggungjawaban tahun ${new Date().getFullYear()}.`);
            Toast.fire({ icon: 'success', title: 'LPJ PDF berhasil diunduh!' });
        }).catch((e) => {
            Swal.fire({ icon: 'error', title: 'Gagal Membuat PDF', text: e.message });
        });
    }, 600);
}

// Profil Rendering
function renderProfilBUMDes() {
    document.querySelectorAll('.lbl-nama-bumdes').forEach(el => el.innerText = "BUMDES " + profilBUMDes.nama);
    let loginNama = document.getElementById('login-nama-bumdes'); if(loginNama) loginNama.innerText = "BUMDES " + profilBUMDes.nama;
    isiFormProfilDariState();
    renderOrgChart();
}

// Membuka UI Modal
function bukaModalTambahUnit() { new bootstrap.Modal(document.getElementById('modalTambahUnit')).show(); }
function bukaModalTambahAset() { new bootstrap.Modal(document.getElementById('modalTambahAset')).show(); }
function bukaModalTambahModal() { new bootstrap.Modal(document.getElementById('modalTambahModal')).show(); }
// =========================================================================
// 7. FUNGSI RENDER TAMPILAN TAMBAHAN (SEBELUMNYA TERPOTONG)
// =========================================================================

function renderUnitUsaha() {
    let container = document.getElementById('container-unit-usaha');
    let selectForm = document.getElementById('input-unit-usaha');
    let selectAset = document.getElementById('add-unit-aset');
    let selectsLaporanFilter = document.querySelectorAll('.filter-laporan-unit');

    // 1. Menggambar kartu unit usaha
    if (container) {
        let htmlString = '';
        if(unitUsahaData.length === 0) {
            htmlString = `<div class="col-12 text-center text-muted py-5 border rounded-3 bg-light">Belum ada unit usaha. Silakan tambahkan unit baru.</div>`;
        } else {
            unitUsahaData.forEach(unit => {
                htmlString += `
                    <div class="col-12 col-md-6 col-lg-4">
                        <div class="card-unit bg-serat-card p-3 h-100 d-flex flex-column justify-content-between">
                            <div>
                                <div class="d-flex align-items-center mb-3">
                                    <div class="rounded-3 p-3 me-3 text-white shadow-sm" style="background: linear-gradient(135deg, var(--accent-teal), #047857);">
                                        <i class="fas ${escapeHtml(unit.icon || 'fa-store')} fa-xl"></i>
                                    </div>
                                    <div>
                                        <h6 class="fw-bold mb-0 text-dark">${escapeHtml(unit.nama)}</h6>
                                        <small class="text-muted" style="font-size:0.72rem;">Unit Usaha BUMDes</small>
                                    </div>
                                </div>
                                <div class="p-3 bg-light rounded-3 mb-3 border">
                                    <small class="text-muted d-block fw-bold" style="font-size:0.68rem;">PENGELOLA UTAMA</small>
                                    <span class="fw-bold text-dark d-block mb-1">${escapeHtml(unit.pengelola)}</span>
                                    <span class="badge bg-opacity-10 text-teal border" style="color: var(--accent-teal); background-color: rgba(13,148,136,0.1); font-size:0.68rem;">${escapeHtml(unit.jabatan)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
        }
        container.innerHTML = htmlString;
    }

    // 2. Memperbarui dropdown (pilihan) unit di form input
    if (selectForm) {
        let htmlSel = '';
        if (currentUser && currentUser.role !== 'Super Admin') {
            htmlSel = `<option value="${escapeHtml(currentUser.unit)}">${escapeHtml(currentUser.unit)}</option>`;
        } else {
            if(unitUsahaData.length === 0) htmlSel = `<option value="">Belum ada unit</option>`;
            unitUsahaData.forEach(u => htmlSel += `<option value="${escapeHtml(u.nama)}">${escapeHtml(u.nama)}</option>`);
        }
        selectForm.innerHTML = htmlSel;
    }

    if (selectAset) {
        let htmlAset = '';
        unitUsahaData.forEach(u => htmlAset += `<option value="${escapeHtml(u.nama)}">${escapeHtml(u.nama)}</option>`);
        selectAset.innerHTML = htmlAset;
    }

    // 3. Memperbarui filter laporan
    selectsLaporanFilter.forEach(sel => {
        let currentVal = sel.value; 
        let htmlFilter = '<option value="Semua">-- Konsolidasi Semua Unit --</option>';
        unitUsahaData.forEach(u => htmlFilter += `<option value="${escapeHtml(u.nama)}">${escapeHtml(u.nama)}</option>`);
        sel.innerHTML = htmlFilter;
        sel.value = currentVal || "Semua";
    });
}

function renderNeracaSaldo() {
    let tbody = document.getElementById('tabel-neraca-saldo');
    if (!tbody) return;

    let totalPendapatanOp = 0, totalPendapatanNon = 0, totalBebanOp = 0, totalBebanNon = 0, totalModal = 0, totalKasLalu = 0;
    let dataFiltered = (currentUser && currentUser.role !== 'Super Admin') ? riwayatJurnal.filter(item => item.unitUsaha === currentUser.unit) : riwayatJurnal;

    dataFiltered.forEach(item => {
        if (item.namaKategori === 'Pendapatan Operasional') totalPendapatanOp += item.nominal;
        else if (item.namaKategori === 'Pendapatan Non-Operasional') totalPendapatanNon += item.nominal;
        else if (item.namaKategori === 'Beban Operasional') totalBebanOp += item.nominal;
        else if (item.namaKategori === 'Beban Non-Operasional') totalBebanNon += item.nominal;
        else if (item.namaKategori === 'Modal & Pendanaan') totalModal += item.nominal;
        else if (item.namaKategori === 'Kas Tahun Sebelumnya') totalKasLalu += item.nominal;
    });

    let totalDebit = totalBebanOp + totalBebanNon + totalKasLalu;
    let totalKredit = totalPendapatanOp + totalPendapatanNon + totalModal;

    tbody.innerHTML = `
        <tr><td class="fw-bold">1. Pendapatan Operasional Unit Usaha</td><td class="text-end text-muted">-</td><td class="text-end fw-bold">Rp ${formatRupiah(totalPendapatanOp)}</td></tr>
        <tr><td class="fw-bold">2. Pendapatan Non-Operasional</td><td class="text-end text-muted">-</td><td class="text-end fw-bold">Rp ${formatRupiah(totalPendapatanNon)}</td></tr>
        <tr><td class="fw-bold">3. Beban Operasional & Admin</td><td class="text-end fw-bold">Rp ${formatRupiah(totalBebanOp)}</td><td class="text-end text-muted">-</td></tr>
        <tr><td class="fw-bold">4. Beban Non-Operasional</td><td class="text-end fw-bold">Rp ${formatRupiah(totalBebanNon)}</td><td class="text-end text-muted">-</td></tr>
        <tr><td class="fw-bold">5. Penyertaan Modal & Pendanaan</td><td class="text-end text-muted">-</td><td class="text-end fw-bold">Rp ${formatRupiah(totalModal)}</td></tr>
        <tr><td class="fw-bold">6. Penambahan Kas Tahun Sebelumnya</td><td class="text-end fw-bold">Rp ${formatRupiah(totalKasLalu)}</td><td class="text-end text-muted">-</td></tr>
        <tr class="baris-total fs-6"><td style="color: var(--accent-teal);">TOTAL NERACA SALDO</td><td class="text-end" style="color: var(--accent-teal);">Rp ${formatRupiah(totalDebit)}</td><td class="text-end" style="color: var(--accent-teal);">Rp ${formatRupiah(totalKredit)}</td></tr>
    `;
}

function renderAsetTetap() {
    let tbody = document.getElementById('tabel-aset-tetap');
    if (!tbody) return;

    let dataFiltered = (currentUser && currentUser.role !== 'Super Admin') ? asetTetapData.filter(i => i.unit === currentUser.unit) : asetTetapData;
    let htmlString = '';
    let totalNilaiSisa = 0;
    let tahunSekarang = new Date().getFullYear();

    if (dataFiltered.length === 0) {
        htmlString = `<tr><td colspan="7" class="text-center text-muted py-4">Belum ada daftar inventaris / aset tetap.</td></tr>`;
    } else {
        dataFiltered.forEach(item => {
            let masaManfaat = item.masaManfaat || 4;
            let susutThn = item.susutPerTahun || Math.round(item.harga / masaManfaat);
            let usiaAset = Math.max(0, tahunSekarang - item.tahun);
            let totalPenyusutan = Math.min(item.harga, usiaAset * susutThn);
            let nilaiSisa = Math.max(0, item.harga - totalPenyusutan);
            totalNilaiSisa += nilaiSisa;

            htmlString += `
                <tr>
                    <td class="fw-bold text-dark">${escapeHtml(item.nama)}</td>
                    <td><span class="badge bg-info bg-opacity-10 text-dark border">${escapeHtml(item.unit)}</span></td>
                    <td>${item.tahun}</td>
                    <td class="text-end">Rp ${formatRupiah(item.harga)}</td>
                    <td class="text-center">${masaManfaat} Thn</td>
                    <td class="text-end text-danger">(Rp ${formatRupiah(susutThn)})</td>
                    <td class="text-end fw-bold text-success">Rp ${formatRupiah(nilaiSisa)}</td>
                </tr>
            `;
        });
    }
    tbody.innerHTML = htmlString;
    let neracaAset = document.getElementById('neraca-aset-tetap'); if(neracaAset) neracaAset.innerText = "Rp " + formatRupiah(totalNilaiSisa);
    renderNeraca();
}

// =========================================================================
// 8. POSISI KEUANGAN (NERACA) & FUNGSI SIMPAN DATA YANG SEBELUMNYA HILANG
// =========================================================================
function renderNeraca() {
    let hasil = hitungNilaiLaporanUntukNeraca();
    let set = (id, val) => { let el = document.getElementById(id); if (el) el.innerText = val; };
    set('neraca-kas-bank', formatRupiah(hasil.kasBank));
    set('neraca-piutang-usaha', formatRupiah(hasil.tPiutang));
    set('neraca-hutang-usaha', formatRupiah(hasil.tHutang));
    set('neraca-modal-disetor', formatRupiah(hasil.totalModalKumulatif));
    set('neraca-laba-berjalan', formatRupiah(hasil.laba));
    set('total-aset', formatRupiah(hasil.totalAset));
    set('total-pasiva', formatRupiah(hasil.totalPasiva));
}

function hitungNilaiLaporanUntukNeraca() {
    let tPop = 0, tPnon = 0, tBopKas = 0, tBnon = 0, tPiutang = 0, tHutang = 0;
    let dataFiltered = (currentUser && currentUser.role !== 'Super Admin') ? riwayatJurnal.filter(i => i.unitUsaha === currentUser.unit) : riwayatJurnal;
    dataFiltered.forEach(i => {
        if (i.namaKategori === 'Pendapatan Operasional') tPop += i.nominal;
        else if (i.namaKategori === 'Pendapatan Non-Operasional') tPnon += i.nominal;
        else if (i.namaKategori === 'Beban Operasional') tBopKas += i.nominal;
        else if (i.namaKategori === 'Beban Non-Operasional') tBnon += i.nominal;
        else if (i.namaKategori === 'Piutang Usaha') tPiutang += i.nominal;
        else if (i.namaKategori === 'Hutang Usaha') tHutang += i.nominal;
    });

    let dataAsetFiltered = (currentUser && currentUser.role !== 'Super Admin') ? asetTetapData.filter(a => a.unit === currentUser.unit) : asetTetapData;
    let totalSusut = 0, totalPembelianAset = 0, nilaiSisaAsetTotal = 0;
    let tahunSekarang = new Date().getFullYear();
    dataAsetFiltered.forEach(a => {
        let masaManfaat = a.masaManfaat || 4;
        let susutThn = a.susutPerTahun || Math.round(a.harga / masaManfaat);
        totalSusut += susutThn;
        totalPembelianAset += (a.harga || 0);
        let usiaAset = Math.max(0, tahunSekarang - a.tahun);
        let totalPenyusutan = Math.min(a.harga, usiaAset * susutThn);
        nilaiSisaAsetTotal += Math.max(0, a.harga - totalPenyusutan);
    });

    let totalModalKumulatif = 0, totalModalTahunIni = 0;
    (historiModalData || []).forEach(m => {
        totalModalKumulatif += (m.nominal || 0);
        if (parseInt(m.tahun) === tahunSekarang) totalModalTahunIni += (m.nominal || 0);
    });

    let tPendapatan = tPop + tPnon;
    let tBebanAkrual = (tBopKas + totalSusut) + tBnon;
    let laba = tPendapatan - tBebanAkrual;

    let kasBank = (tPop + tPnon + tHutang + totalModalTahunIni) - (tBopKas + tBnon + tPiutang + totalPembelianAset);

    let totalAset = kasBank + tPiutang + nilaiSisaAsetTotal;
    let totalPasiva = tHutang + totalModalKumulatif + laba;

    return { tPop, tPnon, tBopKas, tBnon, tPiutang, tHutang, totalSusut, totalPembelianAset, nilaiSisaAsetTotal, totalModalKumulatif, totalModalTahunIni, tPendapatan, tBebanAkrual, laba, kasBank, totalAset, totalPasiva };
}

// ================= MODAL DESA & PADes =================
function renderModalPades() {
    let totalEl = document.getElementById('val-total-modal-desa');
    let listSimulasi = document.getElementById('list-simulasi-pades');
    let tabelHistori = document.getElementById('tabel-histori-modal');
    if (!totalEl && !listSimulasi && !tabelHistori) return;

    let totalModal = (historiModalData || []).reduce((a, b) => a + (b.nominal || 0), 0);
    let hasil = hitungNilaiLaporanUntukNeraca();
    let dasarSimulasi = Math.max(0, hasil.laba);

    if (totalEl) totalEl.innerText = "Rp " + formatRupiah(totalModal);

    if (listSimulasi) {
        if (padesConfigList.length === 0) {
            listSimulasi.innerHTML = `<li class="list-group-item text-muted text-center small">Belum ada konfigurasi alokasi PADes.</li>`;
        } else {
            listSimulasi.innerHTML = padesConfigList.map(p => `
                <li class="list-group-item d-flex justify-content-between align-items-center px-0">
                    <span class="${p.warna}"><i class="fas fa-circle me-2" style="font-size:0.5rem;"></i>${escapeHtml(p.ket)} (${p.persen}%)</span>
                    <span class="fw-bold text-dark">Rp ${formatRupiah(Math.round(dasarSimulasi * p.persen / 100))}</span>
                </li>
            `).join('');
        }
    }

    if (tabelHistori) {
        if (!historiModalData || historiModalData.length === 0) {
            tabelHistori.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">Belum ada histori setoran modal.</td></tr>`;
        } else {
            tabelHistori.innerHTML = historiModalData.map(m => `
                <tr>
                    <td>${escapeHtml(String(m.tahun))}</td>
                    <td>${escapeHtml(m.sumber || '-')}</td>
                    <td>${escapeHtml(m.keterangan || '-')}</td>
                    <td class="text-end fw-bold text-success">Rp ${formatRupiah(m.nominal || 0)}</td>
                </tr>
            `).join('');
        }
    }
}

function bukaModalEditPADes() {
    let htmlForm = padesConfigList.map((p, idx) => `
        <div class="row g-2 mb-2 align-items-center">
            <div class="col-7"><input type="text" class="form-control form-control-sm" value="${escapeHtml(p.ket)}" data-idx="${idx}" data-field="ket"></div>
            <div class="col-5"><div class="input-group input-group-sm"><input type="number" min="0" max="100" class="form-control" value="${p.persen}" data-idx="${idx}" data-field="persen"><span class="input-group-text">%</span></div></div>
        </div>
    `).join('');

    Swal.fire({
        title: 'Edit Alokasi Simulasi PADes', html: `<div id="form-edit-pades" class="text-start">${htmlForm}</div><small class="text-muted d-block mt-2">Total persentase sebaiknya berjumlah 100%.</small>`,
        showCancelButton: true, confirmButtonText: 'Simpan Alokasi', confirmButtonColor: '#0d9488',
        preConfirm: () => {
            let inputs = document.querySelectorAll('#form-edit-pades input');
            let dataBaru = JSON.parse(JSON.stringify(padesConfigList));
            inputs.forEach(inp => {
                let idx = parseInt(inp.dataset.idx);
                if (inp.dataset.field === 'ket') dataBaru[idx].ket = inp.value;
                else dataBaru[idx].persen = parseFloat(inp.value) || 0;
            });
            return dataBaru;
        }
    }).then(res => {
        if (res.isConfirmed) {
            padesConfigList = res.value;
            localStorage.setItem('siak_pades_list', JSON.stringify(padesConfigList));
            renderModalPades();
            catatLog('Konfigurasi PADes', 'Mengubah alokasi persentase simulasi PADes.');
            Toast.fire({ icon: 'success', title: 'Alokasi PADes disimpan!' });
        }
    });
}

async function simpanUnitUsahaBaru(event) {
    event.preventDefault();
    let nama = document.getElementById('add-nama-unit').value.trim();
    let pengelola = document.getElementById('add-pengelola-unit').value.trim();
    let jabatan = document.getElementById('add-jabatan-unit').value.trim();
    if (!nama || !pengelola) { Toast.fire({ icon: 'warning', title: 'Nama unit & pengelola wajib diisi.' }); return; }
    await db.collection("units").add({ nama, pengelola, jabatan: jabatan || 'Pengelola Unit', icon: 'fa-store' });
    catatLog('Unit Usaha', `Menambahkan unit usaha baru: ${nama}`);
    let modalEl = document.getElementById('modalTambahUnit');
    if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
    event.target.reset();
    Toast.fire({ icon: 'success', title: 'Unit usaha berhasil ditambahkan!' });
}

async function simpanAsetBaru(event) {
    event.preventDefault();
    let nama = document.getElementById('add-nama-aset').value.trim();
    let unit = document.getElementById('add-unit-aset').value;
    let tahun = parseInt(document.getElementById('add-tahun-aset').value);
    let harga = ambilAngka(document.getElementById('add-harga-aset').value);
    let masaManfaat = parseInt(document.getElementById('add-manfaat-aset')?.value) || 4;
    if (!nama || !harga) { Toast.fire({ icon: 'warning', title: 'Nama & harga aset wajib diisi.' }); return; }
    let susutPerTahun = Math.round(harga / masaManfaat);
    await db.collection("asets").add({ nama, unit, tahun, harga, masaManfaat, susutPerTahun });
    catatLog('Aset Tetap', `Menambahkan aset '${nama}' senilai Rp ${formatRupiah(harga)} untuk ${unit}`);
    let modalEl = document.getElementById('modalTambahAset');
    if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
    event.target.reset();
    Toast.fire({ icon: 'success', title: 'Aset berhasil ditambahkan!' });
}

async function simpanModalDesaBaru(event) {
    event.preventDefault();
    let tahun = parseInt(document.getElementById('add-tahun-modal').value);
    let sumber = document.getElementById('add-sumber-modal').value.trim();
    let keterangan = document.getElementById('add-keterangan-modal').value.trim();
    let nominal = ambilAngka(document.getElementById('add-nominal-modal').value);
    if (!tahun || !nominal) { Toast.fire({ icon: 'warning', title: 'Tahun & nominal wajib diisi.' }); return; }
    await db.collection("modals").add({ tahun, sumber: sumber || 'Pemerintah Desa', keterangan: keterangan || '-', nominal });
    catatLog('Modal Desa', `Setoran modal desa Rp ${formatRupiah(nominal)} tahun ${tahun}`);
    let modalEl = document.getElementById('modalTambahModal');
    if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
    event.target.reset();
    Toast.fire({ icon: 'success', title: 'Setoran modal berhasil dicatat!' });
}

// ================= FILTER & EKSPOR JURNAL =================
function ambilDataJurnalTerfilter() {
    let unitFilter = document.getElementById('filter-unit-jurnal')?.value || 'Semua';
    let tglMulai = document.getElementById('filter-tgl-mulai')?.value || '';
    let tglSelesai = document.getElementById('filter-tgl-selesai')?.value || '';

    let data = (currentUser && currentUser.role !== 'Super Admin') ? riwayatJurnal.filter(i => i.unitUsaha === currentUser.unit) : [...riwayatJurnal];
    if (unitFilter && unitFilter !== 'Semua') data = data.filter(i => i.unitUsaha === unitFilter);
    if (tglMulai) data = data.filter(i => i.tanggal >= tglMulai);
    if (tglSelesai) data = data.filter(i => i.tanggal <= tglSelesai);
    return data;
}

function filterJurnalTanggal() { renderJurnalUmum(ambilDataJurnalTerfilter()); }

function resetFilterTanggal() {
    let u = document.getElementById('filter-unit-jurnal'); if (u) u.value = 'Semua';
    let a = document.getElementById('filter-tgl-mulai'); if (a) a.value = '';
    let b = document.getElementById('filter-tgl-selesai'); if (b) b.value = '';
    renderJurnalUmum();
}

function eksporJurnalKeCSV() {
    let data = ambilDataJurnalTerfilter();
    if (data.length === 0) { Toast.fire({ icon: 'warning', title: 'Tidak ada data untuk diekspor.' }); return; }

    let header = ['Tanggal', 'Unit Usaha', 'Keterangan', 'No. Akun', 'Nama Akun', 'Debit', 'Kredit'];
    let baris = data.map(item => {
        let akun = getAkunInfo(item.namaKategori);
        let debit = akun.arus === 'Pemasukan' ? item.nominal : 0;
        let kredit = akun.arus === 'Pengeluaran' ? item.nominal : 0;
        return [formatTanggalIndo(item.tanggal), item.unitUsaha, item.keterangan.replace(/,/g, ';'), akun.no, akun.nama, debit, kredit].join(',');
    });
    let csvContent = "data:text/csv;charset=utf-8," + [header.join(','), ...baris].join('\n');
    let link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Jurnal_Umum_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    catatLog('Ekspor Data', `Mengekspor Jurnal Umum (${data.length} baris) ke CSV.`);
    Toast.fire({ icon: 'success', title: 'File CSV berhasil diunduh!' });
}

// ================= LAPORAN ARUS KAS =================
function renderArusKas() {
    let table = document.getElementById('ak-op-masuk');
    if (!table) return;

    let unitFilter = document.getElementById('filter-unit-aruskas')?.value || 'Semua';
    let dataJurnal = (currentUser && currentUser.role !== 'Super Admin') ? riwayatJurnal.filter(i => i.unitUsaha === currentUser.unit) : riwayatJurnal;
    if (unitFilter !== 'Semua') dataJurnal = dataJurnal.filter(i => i.unitUsaha === unitFilter);

    let masukOp = 0, keluarOp = 0;
    dataJurnal.forEach(i => {
        if (i.namaKategori === 'Pendapatan Operasional' || i.namaKategori === 'Pendapatan Non-Operasional' || i.namaKategori === 'Hutang Usaha') masukOp += i.nominal;
        else if (i.namaKategori === 'Beban Operasional' || i.namaKategori === 'Beban Non-Operasional' || i.namaKategori === 'Piutang Usaha') keluarOp += i.nominal;
    });
    let bersihOp = masukOp - keluarOp;

    let dataAset = (currentUser && currentUser.role !== 'Super Admin') ? asetTetapData.filter(a => a.unit === currentUser.unit) : asetTetapData;
    if (unitFilter !== 'Semua') dataAset = dataAset.filter(a => a.unit === unitFilter);
    let investasi = dataAset.reduce((a, b) => a + (b.harga || 0), 0);

    let tahunIni = new Date().getFullYear();
    let pendanaan = (historiModalData || []).filter(m => parseInt(m.tahun) === tahunIni).reduce((a, b) => a + (b.nominal || 0), 0);

    let kenaikanBersih = bersihOp - investasi + pendanaan;
    let saldoAwal = (dataJurnal.filter(i => i.namaKategori === 'Kas Tahun Sebelumnya').reduce((a, b) => a + b.nominal, 0));
    let saldoAkhir = saldoAwal + kenaikanBersih;

    let set = (id, val) => { let el = document.getElementById(id); if (el) el.innerText = val; };
    set('ak-op-masuk', "Rp " + formatRupiah(masukOp));
    set('ak-op-keluar', "(Rp " + formatRupiah(keluarOp) + ")");
    set('ak-op-bersih', (bersihOp < 0 ? "-Rp " : "Rp ") + formatRupiah(Math.abs(bersihOp)));
    set('ak-investasi', "(Rp " + formatRupiah(investasi) + ")");
    set('ak-pendanaan', "Rp " + formatRupiah(pendanaan));
    set('ak-kenaikan-bersih', (kenaikanBersih < 0 ? "-Rp " : "Rp ") + formatRupiah(Math.abs(kenaikanBersih)));
    set('ak-saldo-awal', "Rp " + formatRupiah(saldoAwal));
    set('ak-saldo-akhir', "Rp " + formatRupiah(saldoAkhir));
}

// ================= CATATAN ATAS LAPORAN KEUANGAN (CaLK) =================
function renderCalkRingkasan() {
    let box = document.getElementById('calk-ringkasan-otomatis');
    if (!box) return;
    let hasil = hitungNilaiLaporanUntukNeraca();
    let jumlahUnit = unitUsahaData.length;
    let jumlahTransaksi = riwayatJurnal.length;
    let jumlahAset = asetTetapData.length;
    box.innerHTML = `
        <div class="d-flex justify-content-between border-bottom py-1"><span>Jumlah Unit Usaha Aktif</span><strong>${jumlahUnit} unit</strong></div>
        <div class="d-flex justify-content-between border-bottom py-1"><span>Jumlah Transaksi Tercatat</span><strong>${jumlahTransaksi} transaksi</strong></div>
        <div class="d-flex justify-content-between border-bottom py-1"><span>Jumlah Aset Tetap Terdaftar</span><strong>${jumlahAset} unit</strong></div>
        <div class="d-flex justify-content-between border-bottom py-1"><span>Total Pendapatan Berjalan</span><strong>Rp ${formatRupiah(hasil.tPendapatan)}</strong></div>
        <div class="d-flex justify-content-between border-bottom py-1"><span>Total Beban Berjalan</span><strong>Rp ${formatRupiah(hasil.tBebanAkrual)}</strong></div>
        <div class="d-flex justify-content-between py-1"><span>Laba Bersih Berjalan</span><strong class="text-teal">Rp ${formatRupiah(hasil.laba)}</strong></div>
    `;
}

function simpanCalk() {
    let area = document.getElementById('calk-textarea');
    if (!area) return;
    db.collection("settings").doc("calk").set({ isi: area.value }).then(() => {
        area.dataset.dirty = "";
        catatLog('Catatan Laporan', 'Memperbarui Catatan Atas Laporan Keuangan (CaLK).');
        Toast.fire({ icon: 'success', title: 'Catatan berhasil disimpan!' });
    });
}

// ================= ANALISIS RASIO FINANSIAL =================
function renderRasioFinansial() {
    let elMargin = document.getElementById('rasio-margin');
    if (!elMargin) return;
    let hasil = hitungNilaiLaporanUntukNeraca();

    let marginLaba = hasil.tPendapatan > 0 ? (hasil.laba / hasil.tPendapatan) * 100 : 0;
    let efisiensiBeban = hasil.tPendapatan > 0 ? (hasil.tBebanAkrual / hasil.tPendapatan) * 100 : 0;
    let rataBebanBulanan = (hasil.tBopKas + hasil.tBnon) / (new Date().getMonth() + 1 || 1);
    let rasioKas = rataBebanBulanan > 0 ? (hasil.kasBank / rataBebanBulanan) : 0;
    let kontribusiAset = hasil.totalAset > 0 ? (hasil.nilaiSisaAsetTotal / hasil.totalAset) * 100 : 0;

    let set = (id, val) => { let el = document.getElementById(id); if (el) el.innerText = val; };
    set('rasio-margin', marginLaba.toFixed(1) + '%');
    set('rasio-efisiensi', efisiensiBeban.toFixed(1) + '%');
    set('rasio-kas', rasioKas.toFixed(1) + 'x');
    set('rasio-pertumbuhan-aset', kontribusiAset.toFixed(1) + '%');

    let kesimpulan = document.getElementById('rasio-kesimpulan');
    if (kesimpulan) {
        let teks;
        if (hasil.tPendapatan === 0) teks = 'Belum ada data pendapatan yang cukup untuk menghitung kesimpulan rasio.';
        else if (marginLaba >= 20) teks = `Kinerja keuangan BUMDes tergolong <strong>sehat</strong> dengan margin laba bersih sebesar ${marginLaba.toFixed(1)}%.`;
        else if (marginLaba >= 0) teks = `Kinerja keuangan BUMDes <strong>cukup stabil</strong>, namun margin laba bersih (${marginLaba.toFixed(1)}%) masih dapat ditingkatkan melalui efisiensi beban operasional.`;
        else teks = `<strong>Perhatian:</strong> BUMDes mengalami kerugian pada periode berjalan. Disarankan meninjau kembali struktur beban dan strategi unit usaha.`;
        kesimpulan.innerHTML = `<i class="fas fa-circle-info me-2 text-info"></i>${teks}`;
    }
}

// ================= LOG AKTIVITAS =================
function renderLogAktivitas() {
    let tbody = document.getElementById('tabel-log-aktivitas');
    if (!tbody) return;
    if (!logAktivitasData || logAktivitasData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">Belum ada aktivitas tercatat.</td></tr>`;
        return;
    }
    tbody.innerHTML = logAktivitasData.map(log => `
        <tr>
            <td><small>${escapeHtml(log.waktu || '-')}</small></td>
            <td class="fw-bold">${escapeHtml(log.user || '-')}</td>
            <td><span class="badge bg-secondary bg-opacity-75">${escapeHtml(log.kategori || '-')}</span></td>
            <td class="small">${escapeHtml(log.detail || '-')}</td>
        </tr>
    `).join('');
}

// ================= TUTUP BUKU TAHUNAN =================
function renderHistoriTutupBuku() {
    let elTahun = document.getElementById('tutup-tahun-berjalan');
    if (elTahun) elTahun.innerText = new Date().getFullYear();

    let hasil = hitungNilaiLaporanUntukNeraca();
    let set = (id, val) => { let el = document.getElementById(id); if (el) el.innerText = val; };
    set('tutup-total-pendapatan', "Rp " + formatRupiah(hasil.tPendapatan));
    set('tutup-total-beban', "Rp " + formatRupiah(hasil.tBebanAkrual));
    set('tutup-saldo-akhir', "Rp " + formatRupiah(hasil.kasBank));

    let tbody = document.getElementById('tabel-histori-tutup-buku');
    if (!tbody) return;
    if (!historiTutupBukuData || historiTutupBukuData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Belum ada riwayat tutup buku.</td></tr>`;
        return;
    }
    tbody.innerHTML = historiTutupBukuData.map(h => `
        <tr>
            <td class="fw-bold">${h.tahun}</td>
            <td class="text-end text-success">Rp ${formatRupiah(h.totalPendapatan || 0)}</td>
            <td class="text-end text-danger">Rp ${formatRupiah(h.totalBeban || 0)}</td>
            <td class="text-end fw-bold text-teal">Rp ${formatRupiah(h.saldoDibawa || 0)}</td>
            <td><small>${escapeHtml(h.waktuProses || '-')}</small></td>
        </tr>
    `).join('');
}

async function prosesTutupBukuTahunan() {
    let hasil = hitungNilaiLaporanUntukNeraca();
    let tahunBerjalan = new Date().getFullYear();

    let konfirmasi = await Swal.fire({
        icon: 'warning', title: `Tutup Buku Tahun ${tahunBerjalan}?`,
        html: `Saldo kas akhir sebesar <strong>Rp ${formatRupiah(hasil.kasBank)}</strong> akan dibawa sebagai Saldo Awal tahun ${tahunBerjalan + 1}. Proses ini tidak dapat dibatalkan.`,
        showCancelButton: true, confirmButtonText: 'Ya, Tutup Buku', confirmButtonColor: '#ef4444', cancelButtonText: 'Batal'
    });
    if (!konfirmasi.isConfirmed) return;

    let skrg = new Date();
    let waktuProses = skrg.toLocaleString('id-ID');

    await db.collection("tutupbuku").add({
        tahun: tahunBerjalan, totalPendapatan: hasil.tPendapatan, totalBeban: hasil.tBebanAkrual,
        saldoDibawa: hasil.kasBank, waktuProses
    });

    await db.collection("jurnal").add({
        tanggal: `${tahunBerjalan + 1}-01-01`, unitUsaha: 'Semua', keterangan: `Saldo Awal Bawaan Tutup Buku Tahun ${tahunBerjalan}`,
        namaKategori: 'Kas Tahun Sebelumnya', nominal: Math.max(0, hasil.kasBank)
    });

    catatLog('Tutup Buku Tahunan', `Tutup buku tahun ${tahunBerjalan} dengan saldo dibawa Rp ${formatRupiah(hasil.kasBank)}.`);
    Toast.fire({ icon: 'success', title: 'Tutup buku tahunan berhasil diproses!' });
}

// ================= PROFIL BUMDES & STRUKTUR ORGANISASI =================
function isiFormProfilDariState() {
    let map = { 'pf-nama': 'nama', 'pf-sk': 'sk', 'pf-jabatan-awal': 'jabatanAwal', 'pf-jabatan-akhir': 'jabatanAkhir', 'pf-penasihat': 'penasihat', 'pf-pengawas': 'pengawas', 'pf-direktur': 'direktur', 'pf-sekretaris': 'sekretaris', 'pf-bendahara': 'bendahara', 'pf-kontak-wa': 'kontakWA', 'pf-kode-akses': 'kodeAkses' };
    Object.keys(map).forEach(id => { let el = document.getElementById(id); if (el && document.activeElement !== el) el.value = profilBUMDes[map[id]] || ''; });
}

function renderOrgChart() {
    let container = document.getElementById('org-chart-container');
    if (!container) return;
    container.innerHTML = `
        <ul>
            <li>
                <div class="org-node" style="background: var(--accent-teal); color:#fff;">${escapeHtml(profilBUMDes.penasihat)}<br><small>Penasihat</small></div>
                <ul>
                    <li><div class="org-node">${escapeHtml(profilBUMDes.pengawas)}<br><small>Pengawas</small></div></li>
                    <li>
                        <div class="org-node" style="background:#0f172a; color:#fff;">${escapeHtml(profilBUMDes.direktur)}<br><small>Direktur</small></div>
                        <ul>
                            <li><div class="org-node">${escapeHtml(profilBUMDes.sekretaris)}<br><small>Sekretaris</small></div></li>
                            <li><div class="org-node">${escapeHtml(profilBUMDes.bendahara)}<br><small>Bendahara</small></div></li>
                        </ul>
                    </li>
                </ul>
            </li>
        </ul>
    `;
}

async function simpanProfilBUMDes(event) {
    event.preventDefault();
    let dataBaru = {
        nama: document.getElementById('pf-nama').value.trim(),
        sk: document.getElementById('pf-sk').value.trim(),
        jabatanAwal: document.getElementById('pf-jabatan-awal').value.trim(),
        jabatanAkhir: document.getElementById('pf-jabatan-akhir').value.trim(),
        penasihat: document.getElementById('pf-penasihat').value.trim(),
        pengawas: document.getElementById('pf-pengawas').value.trim(),
        direktur: document.getElementById('pf-direktur').value.trim(),
        sekretaris: document.getElementById('pf-sekretaris').value.trim(),
        bendahara: document.getElementById('pf-bendahara').value.trim(),
        kontakWA: document.getElementById('pf-kontak-wa').value.trim(),
        kodeAkses: document.getElementById('pf-kode-akses').value.trim() || '1234'
    };
    await db.collection("settings").doc("profil").set(dataBaru, { merge: true });
    catatLog('Profil BUMDes', 'Memperbarui data profil & struktur kepengurusan BUMDes.');
    Toast.fire({ icon: 'success', title: 'Profil berhasil diperbarui!' });
}

// ================= BACKUP & RESTORE (EXCEL / XLSX) =================
function backupDatabaseExcel() {
    try {
        let wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(riwayatJurnal.map(({docId, ...r}) => r)), "Jurnal");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(unitUsahaData.map(({docId, ...r}) => r)), "UnitUsaha");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(asetTetapData.map(({docId, ...r}) => r)), "AsetTetap");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((historiModalData || []).map(({docId, ...r}) => r)), "ModalDesa");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([profilBUMDes]), "ProfilBUMDes");
        XLSX.writeFile(wb, `Backup_SIAK_BUMDes_${new Date().toISOString().slice(0,10)}.xlsx`);
        catatLog('Backup Database', 'Mengunduh cadangan seluruh data ke file Excel.');
        Toast.fire({ icon: 'success', title: 'Backup berhasil diunduh!' });
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Gagal Backup', text: e.message });
    }
}

function restoreDatabaseExcel() {
    let fileInput = document.getElementById('input-file-restore');
    let file = fileInput?.files?.[0];
    if (!file) { Toast.fire({ icon: 'warning', title: 'Pilih file backup terlebih dahulu.' }); return; }

    Swal.fire({
        icon: 'warning', title: 'Pulihkan Data?', text: 'Data dari file akan ditambahkan ke database cloud saat ini.',
        showCancelButton: true, confirmButtonText: 'Ya, Pulihkan', confirmButtonColor: '#ef4444'
    }).then(async (konfirmasi) => {
        if (!konfirmasi.isConfirmed) return;
        Swal.fire({ title: 'Memulihkan Data...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            let data = await file.arrayBuffer();
            let wb = XLSX.read(data);
            let batch = db.batch();
            let jumlahTotal = 0;

            const prosesSheet = (namaSheet, namaKoleksi) => {
                if (!wb.Sheets[namaSheet]) return 0;
                let rows = XLSX.utils.sheet_to_json(wb.Sheets[namaSheet]);
                rows.forEach(row => { batch.set(db.collection(namaKoleksi).doc(), row); });
                return rows.length;
            };

            jumlahTotal += prosesSheet("Jurnal", "jurnal");
            jumlahTotal += prosesSheet("UnitUsaha", "units");
            jumlahTotal += prosesSheet("AsetTetap", "asets");
            jumlahTotal += prosesSheet("ModalDesa", "modals");

            await batch.commit();
            catatLog('Restore Database', `Memulihkan ${jumlahTotal} baris data dari file backup Excel.`);
            Swal.fire({ icon: 'success', title: 'Restore Berhasil!', text: `${jumlahTotal} baris data telah dipulihkan.` });
            if (fileInput) fileInput.value = '';
        } catch (e) {
            Swal.fire({ icon: 'error', title: 'Gagal Restore', text: e.message });
        }
    });
}

// =========================================================================
// 9. LAPORAN PERTANGGUNGJAWABAN (LPJ) - PENYUSUNAN KONTEN SEBELUM CETAK
// =========================================================================
function siapkanKontenLPJ() {
    let tahunIni = new Date().getFullYear();
    let hasil = hitungNilaiLaporanUntukNeraca();

    let set = (id, val) => { let el = document.getElementById(id); if (el) el.innerText = val; };
    set('lpj-cover-nama', "BUMDES " + profilBUMDes.nama);
    set('lpj-cover-tahun', tahunIni);
    set('lpj-cover-alamat', profilBUMDes.alamat || '');

    let tabelPengurus = document.getElementById('lpj-tabel-pengurus');
    if (tabelPengurus) {
        tabelPengurus.innerHTML = `
            <tr><td style="width:40%;">Dasar Hukum</td><td>: ${escapeHtml(profilBUMDes.sk)}</td></tr>
            <tr><td>Masa Bakti Kepengurusan</td><td>: ${escapeHtml(profilBUMDes.jabatanAwal)} - ${escapeHtml(profilBUMDes.jabatanAkhir)}</td></tr>
            <tr><td>Penasihat</td><td>: ${escapeHtml(profilBUMDes.penasihat)}</td></tr>
            <tr><td>Pengawas</td><td>: ${escapeHtml(profilBUMDes.pengawas)}</td></tr>
            <tr><td>Direktur</td><td>: ${escapeHtml(profilBUMDes.direktur)}</td></tr>
            <tr><td>Sekretaris</td><td>: ${escapeHtml(profilBUMDes.sekretaris)}</td></tr>
            <tr><td>Bendahara</td><td>: ${escapeHtml(profilBUMDes.bendahara)}</td></tr>
            <tr><td>Jumlah Unit Usaha</td><td>: ${unitUsahaData.length} unit</td></tr>
        `;
    }

    let tabelLabaRugi = document.getElementById('lpj-tabel-labarugi');
    if (tabelLabaRugi) {
        tabelLabaRugi.innerHTML = `
            <tr><td colspan="2" style="font-weight:bold; background:#f1f5f9;">PENDAPATAN</td></tr>
            <tr><td>Pendapatan Operasional</td><td class="text-end">Rp ${formatRupiah(hasil.tPop)}</td></tr>
            <tr><td>Pendapatan Non-Operasional</td><td class="text-end">Rp ${formatRupiah(hasil.tPnon)}</td></tr>
            <tr style="font-weight:bold;"><td>Total Pendapatan</td><td class="text-end">Rp ${formatRupiah(hasil.tPendapatan)}</td></tr>
            <tr><td colspan="2" style="font-weight:bold; background:#f1f5f9;">BEBAN</td></tr>
            <tr><td>Beban Operasional & Penyusutan</td><td class="text-end">(Rp ${formatRupiah(hasil.tBopKas + hasil.totalSusut)})</td></tr>
            <tr><td>Beban Non-Operasional</td><td class="text-end">(Rp ${formatRupiah(hasil.tBnon)})</td></tr>
            <tr style="font-weight:bold;"><td>Total Beban</td><td class="text-end">(Rp ${formatRupiah(hasil.tBebanAkrual)})</td></tr>
            <tr style="font-weight:bold; border-top:2px solid #0f172a;"><td>LABA / (RUGI) BERSIH</td><td class="text-end">Rp ${formatRupiah(hasil.laba)}</td></tr>
        `;
    }

    let tabelNeraca = document.getElementById('lpj-tabel-neraca');
    if (tabelNeraca) {
        tabelNeraca.innerHTML = `
            <tr><td colspan="2" style="font-weight:bold; background:#f1f5f9;">ASET</td></tr>
            <tr><td>Kas & Bank</td><td class="text-end">Rp ${formatRupiah(hasil.kasBank)}</td></tr>
            <tr><td>Piutang Usaha</td><td class="text-end">Rp ${formatRupiah(hasil.tPiutang)}</td></tr>
            <tr><td>Aset Tetap (Nilai Buku)</td><td class="text-end">Rp ${formatRupiah(hasil.nilaiSisaAsetTotal)}</td></tr>
            <tr style="font-weight:bold;"><td>TOTAL ASET</td><td class="text-end">Rp ${formatRupiah(hasil.totalAset)}</td></tr>
            <tr><td colspan="2" style="font-weight:bold; background:#f1f5f9;">KEWAJIBAN & EKUITAS</td></tr>
            <tr><td>Hutang Usaha</td><td class="text-end">Rp ${formatRupiah(hasil.tHutang)}</td></tr>
            <tr><td>Modal Disetor (Kumulatif)</td><td class="text-end">Rp ${formatRupiah(hasil.totalModalKumulatif)}</td></tr>
            <tr><td>Laba Ditahan Berjalan</td><td class="text-end">Rp ${formatRupiah(hasil.laba)}</td></tr>
            <tr style="font-weight:bold; border-top:2px solid #0f172a;"><td>TOTAL KEWAJIBAN & EKUITAS</td><td class="text-end">Rp ${formatRupiah(hasil.totalPasiva)}</td></tr>
        `;
    }

    let tabelAK = document.getElementById('lpj-tabel-aruskas');
    if (tabelAK) {
        let masukOp = hasil.tPop + hasil.tPnon + hasil.tHutang;
        let keluarOp = hasil.tBopKas + hasil.tBnon + hasil.tPiutang;
        tabelAK.innerHTML = `
            <tr><td colspan="2" style="font-weight:bold; background:#f1f5f9;">AKTIVITAS OPERASIONAL</td></tr>
            <tr><td>Penerimaan Kas Operasional</td><td class="text-end">Rp ${formatRupiah(masukOp)}</td></tr>
            <tr><td>Pengeluaran Kas Operasional</td><td class="text-end">(Rp ${formatRupiah(keluarOp)})</td></tr>
            <tr><td colspan="2" style="font-weight:bold; background:#f1f5f9;">AKTIVITAS INVESTASI</td></tr>
            <tr><td>Pembelian Aset Tetap</td><td class="text-end">(Rp ${formatRupiah(hasil.totalPembelianAset)})</td></tr>
            <tr><td colspan="2" style="font-weight:bold; background:#f1f5f9;">AKTIVITAS PENDANAAN</td></tr>
            <tr><td>Penyertaan Modal Desa (Tahun Ini)</td><td class="text-end">Rp ${formatRupiah(hasil.totalModalTahunIni)}</td></tr>
            <tr style="font-weight:bold; border-top:2px solid #0f172a;"><td>SALDO KAS AKHIR PERIODE</td><td class="text-end">Rp ${formatRupiah(hasil.kasBank)}</td></tr>
        `;
    }

    let tabelAset = document.getElementById('lpj-tabel-aset');
    if (tabelAset) {
        if (asetTetapData.length === 0) {
            tabelAset.innerHTML = `<tr><td colspan="4" class="text-center">Tidak ada aset tetap tercatat.</td></tr>`;
        } else {
            let baris = asetTetapData.map(a => `<tr><td>${escapeHtml(a.nama)}</td><td>${escapeHtml(a.unit)}</td><td class="text-end">Rp ${formatRupiah(a.harga)}</td><td class="text-end">${a.tahun}</td></tr>`).join('');
            tabelAset.innerHTML = `<tr style="font-weight:bold; background:#f1f5f9;"><td>Nama Aset</td><td>Unit</td><td class="text-end">Nilai Perolehan</td><td class="text-end">Tahun</td></tr>` + baris;
        }
    }

    let ttdArea = document.getElementById('lpj-ttd-area');
    if (ttdArea) {
        ttdArea.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-top:60px; text-align:center;">
                <div style="width:45%;"><p>Mengetahui,<br>Penasihat / Kepala Desa</p><div style="height:70px;"></div><p style="font-weight:bold; text-decoration:underline;">${escapeHtml(profilBUMDes.penasihat)}</p></div>
                <div style="width:45%;"><p>${escapeHtml(profilBUMDes.alamat ? profilBUMDes.alamat.split(' ')[1] || '' : '')}, ${new Date().toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' })}<br>Direktur BUMDes</p><div style="height:70px;"></div><p style="font-weight:bold; text-decoration:underline;">${escapeHtml(profilBUMDes.direktur)}</p></div>
            </div>
        `;
    }
}

// =========================================================================
// INIT SAAT HALAMAN DIMUAT
// =========================================================================
window.onload = function() {
    injectModals();
    inisialisasiFirebaseRealtimeListeners(); 
    inisialisasiSistemAkses();
    document.querySelectorAll('.input-rupiah').forEach(inp => { inp.addEventListener('input', formatInputRupiah); });
};
