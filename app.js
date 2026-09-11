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
// PENAMBAHAN: Firebase Storage untuk menyimpan berkas legal BUMDes (AD/ART/SK/Perdes/NPWP/dll)
const storageBumdes = firebase.storage();



// Instance Firebase kedua khusus untuk membuat akun baru (unit usaha)

// tanpa membuat sesi Admin yang sedang login ikut ter-logout/tergantikan.

function getSecondaryAuth() {

    let secondaryApp;

    try {

        secondaryApp = firebase.app("SecondaryAuthApp");

    } catch (e) {

        secondaryApp = firebase.initializeApp(firebaseConfig, "SecondaryAuthApp");

    }

    return secondaryApp.auth();

}



// =========================================================================

// 2. VARIABEL GLOBAL & STATE APLIKASI

// =========================================================================

let currentUser = JSON.parse(sessionStorage.getItem('siak_bumdes_session')) || null;

let unitUsahaData = [];

let aksesUnitData = []; // Menyimpan daftar akun akses per unit usaha (dari koleksi "unitAccounts")

let editUnitDocId = null; // ID unit usaha yang sedang diedit lewat modal Edit Unit

let asetTetapData = [];

let historiModalData = [];

let riwayatJurnal = [];

let logAktivitasData = [];

let userAccounts = [];

let chartKeuanganInstance = null;
let dokumenLegalData = []; // Menyimpan daftar berkas legal BUMDes (AD/ART/SK/Perdes/NPWP/dll) dari koleksi "dokumenLegal"



let profilBUMDes = {

    nama: 'KARANG MAKMUR', sk: 'Perdes No. 04 Tahun 2021', jabatanAwal: '2024', jabatanAkhir: '2029',

    penasihat: 'Kepala Desa', pengawas: 'Ketua Pengawas BPD', direktur: 'Muhamad Efendhi, S. Ak',

    sekretaris: 'Sekretaris BUMDes', bendahara: 'Bendahara BUMDes', foto: 'logo.png', kodeAkses: '1234',

    kontakWA: '', alamat: 'Desa Karangdowo Kecamatan Weleri Kabupaten Kendal', anggotaLain: [],

    // PENAMBAHAN: nama pejabat pengesahan LPJ (Kepala Desa & Ketua BPD), terpisah dari struktur internal pengurus BUMDes
    kepalaDesa: '', ketuaBPD: ''

};



let historiTutupBukuData = [];
// PERBAIKAN: penanda agar listener realtime Firestore hanya dipasang sekali per sesi
let listenerRealtimeAktif = false;

// PENAMBAHAN: state untuk fitur Laporan Perubahan Ekuitas, Data Pembanding Tahun Lalu, & Catatan Pengawasan
let riwayatJurnalTahunLalu = []; // Data jurnal tahun sebelumnya (khusus kolom pembanding pada Laba Rugi/Neraca/Arus Kas)
let pengawasanData = []; // Catatan hasil pengawasan Badan Pengawas (koleksi "pengawasan")
let jurnalSortDir = 'asc'; // Arah sortir kolom Tanggal pada tabel Jurnal Umum ('asc' / 'desc')



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



    let emailLower = emailLogin.toLowerCase();



    try {

        // Langkah 1: Coba login normal ke Firebase

        await auth.signInWithEmailAndPassword(emailLogin, p);

        await berhasilMasuk(emailLogin);

    } catch (error) {

        // Langkah 2: Jika belum terdaftar, hanya izinkan pendaftaran otomatis untuk

        // akun Super Admin ATAU akun yang memang sudah dibuatkan admin di menu

        // "Unit Usaha & Hak Akses" (tercatat di koleksi unitAccounts).

        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {

            try {

                let isAdmin = emailLower === 'bumdes@karangmakmur.com';

                let akunTerdaftar = isAdmin;

                if (!isAdmin) {

                    let cekDoc = await db.collection("unitAccounts").doc(emailLower).get();

                    akunTerdaftar = cekDoc.exists;

                }



                if (!akunTerdaftar) {

                    Swal.fire({ icon: 'error', title: 'Akun Tidak Terdaftar', text: 'Username ini belum memiliki akses. Hubungi admin BUMDes untuk dibuatkan akun pada menu Unit Usaha & Hak Akses.' });

                    return;

                }



                await auth.createUserWithEmailAndPassword(emailLogin, p);

                await berhasilMasuk(emailLogin); // Langsung masuk setelah berhasil daftar otomatis

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

async function berhasilMasuk(emailLogin) {

    let emailLower = emailLogin.toLowerCase();

    let roleUser = 'Pengelola Unit';

    let namaUnit = 'Unit Usaha';

    let namaTampil = 'PENGELOLA';



    // Pengecekan Hak Akses

    if (emailLower === 'bumdes@karangmakmur.com') {

        roleUser = 'Super Admin';

        namaUnit = 'Semua';

        namaTampil = 'PENGURUS BUMDES';

    } else {

        try {

            // Ambil data unit dari akun resmi yang dibuat admin (koleksi unitAccounts)

            let akunDoc = await db.collection("unitAccounts").doc(emailLower).get();

            if (akunDoc.exists) {

                let dataAkun = akunDoc.data();

                if (dataAkun.aktif === false) {

                    Swal.fire({ icon: 'error', title: 'Akses Dinonaktifkan', text: 'Akun ini telah dinonaktifkan oleh admin BUMDes. Silakan hubungi pengurus untuk info lebih lanjut.' });

                    try { await auth.signOut(); } catch (e) {}

                    return;

                }

                namaUnit = dataAkun.unitNama || namaUnit;

                namaTampil = (dataAkun.unitNama || namaTampil).toUpperCase();

            } else if (emailLogin.includes('@')) {

                // Fallback untuk akun lama yang dibuat sebelum fitur ini ada

                namaTampil = emailLogin.split('@')[0].toUpperCase();

                namaUnit = namaTampil;

            }

        } catch (e) {

            if (emailLogin.includes('@')) { namaTampil = emailLogin.split('@')[0].toUpperCase(); namaUnit = namaTampil; }

        }

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

    // PERBAIKAN: aktifkan listener realtime Firestore hanya sekali agar seluruh data (jurnal,
    // unit usaha, aset, modal desa, profil, dll) benar-benar termuat & terupdate otomatis setelah login.
    if (!listenerRealtimeAktif) {
        inisialisasiFirebaseRealtimeListeners();
        listenerRealtimeAktif = true;
    }

    // Muat semua fungsi render UI

    renderProfilBUMDes(); renderUnitUsaha(); renderJurnalUmum(); 

    renderBukuBesar(); renderNeracaSaldo(); renderAsetTetap(); 

    hitungLabaRugi(); renderNeraca(); renderModalPades(); renderArusKas();

    renderRasioFinansial(); renderLogAktivitas(); renderHistoriTutupBuku(); renderCalkRingkasan();
    renderDokumenLegal();

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

    let menuKhususAdmin = ['tab-unit-usaha', 'tab-bukubesar', 'tab-neraca-saldo', 'tab-aset', 'tab-modal-pades', 'tab-labarugi', 'tab-neraca', 'tab-aruskas', 'tab-calk', 'tab-rasio', 'tab-audit-tahunan', 'tab-log-aktivitas', 'tab-profil-bumdes', 'tab-pengaturan', 'tab-lpj', 'tab-perubahan-ekuitas', 'tab-pengawasan'];



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



        <!-- Edit Unit -->

        <div class="modal fade" id="modalEditUnit" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content border-0 shadow-lg rounded-4"><div class="modal-header border-bottom"><h6 class="modal-title fw-bold">Edit Unit Usaha</h6><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form onsubmit="simpanEditUnit(event)"><div class="mb-3"><label class="form-label small fw-bold">Nama Unit</label><input type="text" class="form-control" id="edit-nama-unit" required></div><div class="mb-3"><label class="form-label small fw-bold">Pengelola</label><input type="text" class="form-control" id="edit-pengelola-unit" required></div><div class="mb-3"><label class="form-label small fw-bold">Jabatan</label><input type="text" class="form-control" id="edit-jabatan-unit"></div><button type="submit" class="btn text-white w-100 fw-bold py-2 shadow-sm" style="background: var(--accent-teal);">Simpan Perubahan</button></form></div></div></div></div>



        <!-- Tambah Akun Akses Unit -->

        <div class="modal fade" id="modalTambahAkunUnit" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content border-0 shadow-lg rounded-4"><div class="modal-header border-bottom"><h6 class="modal-title fw-bold">Buat Akun Akses Unit</h6><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form onsubmit="simpanAkunUnitBaru(event)"><div class="mb-3"><label class="form-label small fw-bold">Pilih Unit Usaha</label><select class="form-select" id="add-unit-akun" required></select></div><div class="mb-3"><label class="form-label small fw-bold">Username (format email)</label><input type="email" class="form-control" id="add-username-akun" placeholder="contoh: warungdesa@bumdes.id" required></div><div class="mb-3"><label class="form-label small fw-bold">Password</label><div class="input-group"><input type="password" class="form-control" id="add-password-akun" minlength="6" required autocomplete="new-password"><span class="input-group-text" style="cursor:pointer;" onclick="togglePassword('add-password-akun','toggle-icon-akun')"><i class="fas fa-eye text-muted" id="toggle-icon-akun"></i></span></div><small class="text-muted">Minimal 6 karakter. Akun ini hanya bisa melihat & input data untuk unitnya sendiri.</small></div><button type="submit" class="btn text-white w-100 fw-bold py-2 shadow-sm" style="background: var(--accent-teal);">Buat Akun</button></form></div></div></div></div>

        

        <!-- Tambah Aset -->

        <div class="modal fade" id="modalTambahAset" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content border-0 shadow-lg rounded-4"><div class="modal-header border-bottom"><h6 class="modal-title fw-bold">Tambah Aset Tetap</h6><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form onsubmit="simpanAsetBaru(event)"><div class="mb-3"><label class="form-label small fw-bold">Nama Aset</label><input type="text" class="form-control" id="add-nama-aset" required></div><div class="mb-3"><label class="form-label small fw-bold">Jumlah Barang</label><input type="number" class="form-control" id="add-jumlah-aset" min="1" value="1" required></div><div class="mb-3"><label class="form-label small fw-bold">Pilih Unit</label><select class="form-select" id="add-unit-aset" required></select></div><div class="mb-3"><label class="form-label small fw-bold">Tahun Perolehan</label><input type="number" class="form-control" id="add-tahun-aset" value="2026" required></div><div class="mb-3"><label class="form-label small fw-bold">Harga Perolehan</label><input type="text" class="form-control input-rupiah" id="add-harga-aset" required></div><div class="mb-3"><label class="form-label small fw-bold">Masa Manfaat (Tahun)</label><select class="form-select" id="add-manfaat-aset" required><option value="4">4 Tahun (Elektronik)</option><option value="8">8 Tahun (Mesin/Kendaraan)</option><option value="20">20 Tahun (Bangunan)</option></select></div><button type="submit" class="btn text-white w-100 fw-bold py-2 shadow-sm" style="background: var(--accent-teal);">Simpan Aset</button></form></div></div></div></div>

        

        <!-- Tambah Modal Desa -->

        <div class="modal fade" id="modalTambahModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content border-0 shadow-lg rounded-4"><div class="modal-header border-bottom"><h6 class="modal-title fw-bold">Setor Penyertaan Modal</h6><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form onsubmit="simpanModalDesaBaru(event)"><div class="mb-3"><label class="form-label small fw-bold">Tahun Anggaran</label><input type="number" class="form-control" id="add-tahun-modal" value="2026" required></div><div class="mb-3"><label class="form-label small fw-bold">Sumber Dana</label><input type="text" class="form-control" id="add-sumber-modal" required></div><div class="mb-3"><label class="form-label small fw-bold">Keterangan</label><input type="text" class="form-control" id="add-keterangan-modal" placeholder="Contoh: Penyertaan Modal APBDes"></div><div class="mb-3"><label class="form-label small fw-bold">Nominal (Rp)</label><input type="text" class="form-control input-rupiah" id="add-nominal-modal" required></div><button type="submit" class="btn text-white w-100 fw-bold py-2 shadow-sm" style="background: var(--accent-teal);">Simpan Setoran</button></form></div></div></div></div>

        <!-- Tambah / Edit Anggota Pengurus Tambahan (Bagan Struktur) -->
        <div class="modal fade" id="modalAnggotaPengurus" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content border-0 shadow-lg rounded-4"><div class="modal-header border-bottom"><h6 class="modal-title fw-bold" id="judul-modal-anggota">Tambah Anggota Pengurus</h6><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form onsubmit="simpanAnggotaPengurus(event)"><input type="hidden" id="anggota-index" value=""><div class="mb-3"><label class="form-label small fw-bold">Nama Lengkap</label><input type="text" class="form-control" id="anggota-nama" placeholder="Contoh: Siti Aminah" required></div><div class="mb-3"><label class="form-label small fw-bold">Jabatan / Posisi</label><input type="text" class="form-control" id="anggota-jabatan" placeholder="Contoh: Staf Administrasi / Karyawan Unit Usaha" required></div><button type="submit" class="btn text-white w-100 fw-bold py-2 shadow-sm" style="background: var(--accent-teal);"><i class="fas fa-save me-1"></i> Simpan Anggota</button></form></div></div></div></div>

        <!-- PENAMBAHAN: Tambah Catatan Pengawasan (Badan Pengawas) -->
        <div class="modal fade" id="modalTambahPengawasan" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content border-0 shadow-lg rounded-4"><div class="modal-header border-bottom"><h6 class="modal-title fw-bold"><i class="fas fa-user-shield me-1"></i> Tambah Catatan Pengawasan</h6><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form id="form-pengawasan" onsubmit="simpanPengawasanBaru(event)"><div class="mb-3"><label class="form-label small fw-bold">Tanggal Pengawasan</label><input type="date" class="form-control" id="pengawasan-tanggal" required></div><div class="mb-3"><label class="form-label small fw-bold">Catatan / Temuan Pengawasan</label><textarea class="form-control" id="pengawasan-catatan" rows="3" placeholder="Contoh: Pemeriksaan kas unit usaha telah sesuai dengan jurnal tercatat." required></textarea></div><div class="mb-3"><label class="form-label small fw-bold">Rekomendasi (opsional)</label><textarea class="form-control" id="pengawasan-rekomendasi" rows="2" placeholder="Contoh: Tingkatkan ketertiban penyimpanan bukti transaksi."></textarea></div><button type="submit" class="btn text-white w-100 fw-bold py-2 shadow-sm" style="background: var(--accent-teal);"><i class="fas fa-save me-1"></i> Simpan Catatan</button></form></div></div></div></div>

        <!-- PENAMBAHAN: Edit Transaksi dari Buku Besar -->
        <div class="modal fade" id="modalEditJurnal" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content border-0 shadow-lg rounded-4"><div class="modal-header border-bottom"><h6 class="modal-title fw-bold"><i class="fas fa-edit me-1"></i> Edit Transaksi (Buku Besar)</h6><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form onsubmit="simpanEditJurnal(event)"><input type="hidden" id="edit-jurnal-docid" value=""><div class="mb-3"><label class="form-label small fw-bold">Tanggal Transaksi</label><input type="date" class="form-control" id="edit-jurnal-tanggal" required></div><div class="mb-3"><label class="form-label small fw-bold">Unit Usaha</label><select class="form-select" id="edit-jurnal-unit" required></select></div><div class="mb-3"><label class="form-label small fw-bold">Kategori Akun Transaksi</label><select class="form-select" id="edit-jurnal-kategori" required><option value="nilai-pendapatan">1. Pendapatan Operasional Unit Usaha</option><option value="nilai-pendapatan-non">2. Pendapatan Non-Operasional / Lain-Lain</option><option value="nilai-beban">3. Beban Operasional & Administrasi Umum</option><option value="nilai-beban-non">4. Beban Non-Operasional / Lain-Lain</option><option value="nilai-piutang">5. Piutang Usaha (Penambahan)</option><option value="nilai-hutang">6. Hutang Usaha (Penambahan)</option><option value="nilai-pelunasan-piutang">7. Pelunasan Piutang Usaha (Kas Masuk)</option><option value="nilai-pelunasan-hutang">8. Pelunasan Hutang Usaha (Kas Keluar)</option><option value="nilai-kas-lalu">9. Penambahan Kas Tahun Sebelumnya (Saldo Awal)</option></select></div><div class="mb-3"><label class="form-label small fw-bold">Keterangan Transaksi</label><input type="text" class="form-control" id="edit-jurnal-keterangan" required></div><div class="mb-3"><label class="form-label small fw-bold">Nominal (Rp)</label><input type="text" class="form-control input-rupiah" id="edit-jurnal-nominal" required></div><button type="submit" class="btn text-white w-100 fw-bold py-2 shadow-sm" style="background: var(--accent-teal);"><i class="fas fa-save me-1"></i> Simpan Perubahan</button></form></div></div></div></div>

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

        // PENAMBAHAN: perbarui opsi filter Bulan pada Jurnal Umum & laporan tambahan (Pembanding Tahun Lalu, Perubahan Ekuitas)
        perbaruiOpsiBulanJurnal(); renderPembandingTahunLalu(); renderPerubahanEkuitas();

    });



    db.collection("units").onSnapshot((snapshot) => {

        unitUsahaData = []; snapshot.forEach((doc) => { unitUsahaData.push({ docId: doc.id, ...doc.data() }); });

        renderUnitUsaha();

    });



    db.collection("unitAccounts").onSnapshot((snapshot) => {

        aksesUnitData = []; snapshot.forEach((doc) => { aksesUnitData.push({ docId: doc.id, ...doc.data() }); });

        renderTabelAksesUnit();

    });



    db.collection("asets").onSnapshot((snapshot) => {

        asetTetapData = []; snapshot.forEach((doc) => { asetTetapData.push({ docId: doc.id, ...doc.data() }); });

        renderAsetTetap(); hitungLabaRugi(); renderArusKas(); renderRasioFinansial(); renderCalkRingkasan();

        renderPembandingTahunLalu(); renderPerubahanEkuitas(); // PENAMBAHAN

    });



    db.collection("settings").doc("profil").onSnapshot((doc) => {

        if (doc.exists) { profilBUMDes = Object.assign({}, profilBUMDes, doc.data()); renderProfilBUMDes(); }

    });



    db.collection("modals").orderBy("tahun", "desc").onSnapshot((snapshot) => {

        historiModalData = []; snapshot.forEach((doc) => { historiModalData.push({ docId: doc.id, ...doc.data() }); });

        renderModalPades(); renderNeraca(); renderArusKas(); hitungLabaRugi();

        renderPembandingTahunLalu(); renderPerubahanEkuitas(); // PENAMBAHAN

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

        renderHistoriTutupBuku(); renderPerubahanEkuitas(); // PENAMBAHAN: laba ditahan tahun lalu memengaruhi Perubahan Ekuitas

    });

    db.collection("dokumenLegal").orderBy("waktuUnix", "desc").onSnapshot((snapshot) => {
        dokumenLegalData = []; snapshot.forEach((doc) => { dokumenLegalData.push({ docId: doc.id, ...doc.data() }); });
        renderDokumenLegal();
    }, (err) => { console.warn('Gagal memuat dokumen legal:', err.message); });

    // PENAMBAHAN: Data Jurnal Tahun Lalu, dipakai khusus untuk kolom pembanding "Tahun Lalu"
    // pada Laporan Laba Rugi, Neraca, & Arus Kas, tanpa mengubah query/listener tahun berjalan di atas.
    let tahunLaluQuery = (new Date().getFullYear() - 1).toString();
    db.collection("jurnal").where("tanggal", ">=", `${tahunLaluQuery}-01-01`).where("tanggal", "<=", `${tahunLaluQuery}-12-31`).orderBy("tanggal", "desc").onSnapshot((snapshot) => {
        riwayatJurnalTahunLalu = []; snapshot.forEach((doc) => { riwayatJurnalTahunLalu.push({ docId: doc.id, ...doc.data() }); });
        renderPembandingTahunLalu();
    }, (err) => { console.warn('Gagal memuat data jurnal tahun lalu:', err.message); });

    // PENAMBAHAN: Catatan Hasil Pengawasan Badan Pengawas (Laporan Pengawasan Internal BUMDes)
    db.collection("pengawasan").orderBy("tanggal", "desc").onSnapshot((snapshot) => {
        pengawasanData = []; snapshot.forEach((doc) => { pengawasanData.push({ docId: doc.id, ...doc.data() }); });
        renderCatatanPengawasan();
    }, (err) => { console.warn('Gagal memuat catatan pengawasan:', err.message); });

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

        case 'Pelunasan Piutang Usaha': return { no: '1200', nama: 'Piutang Usaha (Pelunasan)', arus: 'Pemasukan' };

        case 'Pelunasan Hutang Usaha': return { no: '2100', nama: 'Hutang Usaha (Pelunasan)', arus: 'Pengeluaran' };

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

    else if (kategori === 'nilai-pelunasan-piutang') namaKategori = 'Pelunasan Piutang Usaha';

    else if (kategori === 'nilai-pelunasan-hutang') namaKategori = 'Pelunasan Hutang Usaha';

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



    // PENAMBAHAN: Data dasar (mengikuti hak akses & filter unit) dipakai untuk menghitung SALDO KAS BERJALAN
    // yang akurat (kas bulan sebelumnya & total/kas akhir bulan), terlepas dari filter tanggal/arus yang
    // sedang aktif pada tampilan, agar saldo yang ditampilkan tetap benar secara akuntansi.
    let unitFilterJurnalEl = document.getElementById('filter-unit-jurnal');

    let unitFilterJurnal = unitFilterJurnalEl ? unitFilterJurnalEl.value : 'Semua';

    let baseData = (currentUser && currentUser.role !== 'Super Admin') ? riwayatJurnal.filter(i => i.unitUsaha === currentUser.unit) : [...riwayatJurnal];

    if (unitFilterJurnal && unitFilterJurnal !== 'Semua') baseData = baseData.filter(i => i.unitUsaha === unitFilterJurnal);

    baseData.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));



    // PENAMBAHAN: Hitung ringkasan Kas Awal Bulan, Total Pendapatan, Total Pengeluaran, dan Kas Akhir Bulan
    // per bulan (berjalan/kumulatif), berdasarkan seluruh data dasar (baseData) agar saldo selalu akurat.

    const namaBulanArr = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

    let monthStats = new Map();

    let saldoBerjalan = 0;

    baseData.forEach(item => {

        let d = new Date(item.tanggal);

        let key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');

        if (!monthStats.has(key)) {

            monthStats.set(key, { label: namaBulanArr[d.getMonth()] + ' ' + d.getFullYear(), saldoAwal: saldoBerjalan, totalDebit: 0, totalKredit: 0, saldoAkhir: saldoBerjalan });

        }

        let stat = monthStats.get(key);

        let akun = getAkunInfo(item.namaKategori);

        if (akun.arus === 'Pemasukan') { stat.totalDebit += item.nominal; saldoBerjalan += item.nominal; }

        else { stat.totalKredit += item.nominal; saldoBerjalan -= item.nominal; }

        stat.saldoAkhir = saldoBerjalan;

    });



    // Data yang benar-benar ditampilkan: mengikuti filter tanggal (dataManual) jika ada, lalu disortir per Arus (Pendapatan/Pengeluaran) jika dipilih.

    let dataTampil = dataManual || baseData;

    let arusFilterEl = document.getElementById('filter-arus-jurnal');

    let arusFilter = arusFilterEl ? arusFilterEl.value : 'Semua';

    // PENAMBAHAN: arah sortir kolom Tanggal (asc/desc) khusus untuk urutan TAMPILAN saja;
    // baseData & monthStats di atas tetap dihitung ascending agar saldo berjalan per bulan selalu akurat.
    let arahSortir = (jurnalSortDir === 'desc') ? -1 : 1;

    let dataTampilUrut = [...dataTampil].sort((a, b) => (new Date(a.tanggal) - new Date(b.tanggal)) * arahSortir);

    if (arusFilter === 'Pendapatan') dataTampilUrut = dataTampilUrut.filter(i => getAkunInfo(i.namaKategori).arus === 'Pemasukan');

    else if (arusFilter === 'Pengeluaran') dataTampilUrut = dataTampilUrut.filter(i => getAkunInfo(i.namaKategori).arus === 'Pengeluaran');



    let htmlString = '';

    if (dataTampilUrut.length === 0) {

        htmlString = `<tr><td colspan="8" class="text-center text-muted py-4">Belum ada transaksi.</td></tr>`;

    } else {

        let bulanKeyAktif = null;

        dataTampilUrut.forEach((item, idx) => {

            let d = new Date(item.tanggal);

            let bulanKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');

            let stat = monthStats.get(bulanKey) || { label: namaBulanArr[d.getMonth()] + ' ' + d.getFullYear(), saldoAwal: 0, totalDebit: 0, totalKredit: 0, saldoAkhir: 0 };



            if (bulanKey !== bulanKeyAktif) {

                bulanKeyAktif = bulanKey;

                htmlString += `
                <tr class="table-light no-print-border"><td colspan="8" class="fw-bold" style="background:#eef6ff; color:#0d6efd;">
                    <i class="fas fa-calendar-alt me-1"></i> ${stat.label} &mdash; Kas Bulan Sebelumnya: Rp ${formatRupiah(stat.saldoAwal)}
                </td></tr>`;

            }



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

                        <button class="btn btn-sm btn-outline-primary p-1 px-2 me-1" onclick="bukaEditJurnal('${item.docId}')" title="Edit Transaksi"><i class="fas fa-edit"></i></button>

                        <button class="btn btn-sm btn-outline-danger p-1 px-2" onclick="hapusJurnal('${item.docId}')" title="Hapus"><i class="fas fa-trash"></i></button>

                    </td>

                </tr>

            `;



            let itemBerikut = dataTampilUrut[idx + 1];

            let bulanKeyBerikut = itemBerikut ? (new Date(itemBerikut.tanggal).getFullYear() + '-' + String(new Date(itemBerikut.tanggal).getMonth() + 1).padStart(2, '0')) : null;

            if (bulanKeyBerikut !== bulanKey) {

                htmlString += `
                <tr class="fw-bold" style="background:#f8f9fa;">
                    <td colspan="5" class="text-end">Total ${stat.label}:</td>
                    <td class="text-end text-success">Rp ${formatRupiah(stat.totalDebit)}</td>
                    <td class="text-end text-danger">Rp ${formatRupiah(stat.totalKredit)}</td>
                    <td class="no-print"></td>
                </tr>
                <tr class="fw-bold" style="background:#e6f7f0;">
                    <td colspan="8" style="color:#0d9488;"><i class="fas fa-wallet me-1"></i> Kas Akhir Bulan ${stat.label}: Rp ${formatRupiah(stat.saldoAkhir)}</td>
                </tr>`;

            }

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

                <td class="text-center no-print"><button class="btn btn-sm btn-outline-primary p-1 px-2" onclick="bukaEditJurnal('${item.docId}')" title="Edit Transaksi"><i class="fas fa-edit"></i></button></td>

            </tr>

        `;

    });

    tbody.innerHTML = htmlString || `<tr><td colspan="9" class="text-center text-muted">Tidak ada data.</td></tr>`;

}



// PENAMBAHAN: Pemetaan nilai <option> kategori (form input transaksi) <-> nama kategori akuntansi tersimpan,
// dipakai bersama oleh form Tambah Transaksi maupun modal Edit Transaksi (Buku Besar) agar konsisten.
function kategoriValueToNamaKategori(kategori) {

    let namaKategori = 'Pendapatan Operasional';

    if (kategori === 'nilai-pendapatan-non') namaKategori = 'Pendapatan Non-Operasional';

    else if (kategori === 'nilai-beban') namaKategori = 'Beban Operasional';

    else if (kategori === 'nilai-beban-non') namaKategori = 'Beban Non-Operasional';

    else if (kategori === 'nilai-modal') namaKategori = 'Modal & Pendanaan';

    else if (kategori === 'nilai-piutang') namaKategori = 'Piutang Usaha';

    else if (kategori === 'nilai-hutang') namaKategori = 'Hutang Usaha';

    else if (kategori === 'nilai-pelunasan-piutang') namaKategori = 'Pelunasan Piutang Usaha';

    else if (kategori === 'nilai-pelunasan-hutang') namaKategori = 'Pelunasan Hutang Usaha';

    else if (kategori === 'nilai-kas-lalu') namaKategori = 'Kas Tahun Sebelumnya';

    return namaKategori;

}



function namaKategoriToKategoriValue(namaKategori) {

    switch (namaKategori) {

        case 'Pendapatan Non-Operasional': return 'nilai-pendapatan-non';

        case 'Beban Operasional': return 'nilai-beban';

        case 'Beban Non-Operasional': return 'nilai-beban-non';

        case 'Modal & Pendanaan': return 'nilai-modal';

        case 'Piutang Usaha': return 'nilai-piutang';

        case 'Hutang Usaha': return 'nilai-hutang';

        case 'Pelunasan Piutang Usaha': return 'nilai-pelunasan-piutang';

        case 'Pelunasan Hutang Usaha': return 'nilai-pelunasan-hutang';

        case 'Kas Tahun Sebelumnya': return 'nilai-kas-lalu';

        default: return 'nilai-pendapatan';

    }

}



// PENAMBAHAN: Tombol "Edit" pada Buku Besar membuka modal ini untuk mengoreksi transaksi yang sudah tercatat.
function bukaEditJurnal(docId) {

    let item = riwayatJurnal.find(i => i.docId === docId);

    if (!item) { Swal.fire({ icon: 'error', title: 'Data Tidak Ditemukan', text: 'Transaksi mungkin sudah dihapus atau berubah. Silakan muat ulang.' }); return; }



    let selUnit = document.getElementById('edit-jurnal-unit');

    if (selUnit) {

        let htmlSel = '';

        if (currentUser && currentUser.role !== 'Super Admin') {

            htmlSel = `<option value="${escapeHtml(currentUser.unit)}">${escapeHtml(currentUser.unit)}</option>`;

        } else {

            unitUsahaData.forEach(u => htmlSel += `<option value="${escapeHtml(u.nama)}">${escapeHtml(u.nama)}</option>`);

            if (!unitUsahaData.some(u => u.nama === item.unitUsaha)) htmlSel += `<option value="${escapeHtml(item.unitUsaha)}">${escapeHtml(item.unitUsaha)}</option>`;

        }

        selUnit.innerHTML = htmlSel;

        selUnit.value = item.unitUsaha;

    }



    document.getElementById('edit-jurnal-docid').value = docId;

    document.getElementById('edit-jurnal-tanggal').value = item.tanggal || '';

    document.getElementById('edit-jurnal-kategori').value = namaKategoriToKategoriValue(item.namaKategori);

    document.getElementById('edit-jurnal-keterangan').value = item.keterangan || '';

    document.getElementById('edit-jurnal-nominal').value = formatRupiah(item.nominal || 0);



    new bootstrap.Modal(document.getElementById('modalEditJurnal')).show();

}



async function simpanEditJurnal(event) {

    event.preventDefault();

    let docId = document.getElementById('edit-jurnal-docid').value;

    if (!docId) { Toast.fire({ icon: 'error', title: 'ID transaksi tidak valid.' }); return; }



    let tanggal = document.getElementById('edit-jurnal-tanggal').value;

    let unitUsaha = document.getElementById('edit-jurnal-unit').value;

    let kategori = document.getElementById('edit-jurnal-kategori').value;

    let keterangan = document.getElementById('edit-jurnal-keterangan').value.trim();

    let nominal = ambilAngka(document.getElementById('edit-jurnal-nominal').value);



    if (!tanggal || !unitUsaha || !keterangan || !(nominal > 0)) {

        Toast.fire({ icon: 'warning', title: 'Lengkapi semua data dengan benar (nominal harus lebih dari 0).' });

        return;

    }



    let namaKategori = kategoriValueToNamaKategori(kategori);



    try {

        await db.collection("jurnal").doc(docId).update({ tanggal, unitUsaha, keterangan, namaKategori, nominal });

        catatLog('Edit Transaksi', `Mengubah transaksi '${keterangan}' menjadi Rp ${formatRupiah(nominal)} (${namaKategori}) untuk ${unitUsaha}.`);

        let modalEl = document.getElementById('modalEditJurnal');

        if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();

        Toast.fire({ icon: 'success', title: 'Transaksi berhasil diperbarui!' });

    } catch (err) {

        Swal.fire({ icon: 'error', title: 'Gagal Memperbarui Transaksi', text: err.message });

    }

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

        else if (i.namaKategori === 'Pelunasan Piutang Usaha') tPiutang -= i.nominal;

        else if (i.namaKategori === 'Pelunasan Hutang Usaha') tHutang -= i.nominal;

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



// =========================================================================
// PENAMBAHAN: DATA PEMBANDING TAHUN LALU (Laba Rugi, Neraca, & Arus Kas)
// =========================================================================
// Menghitung ringkasan Laba Rugi & Arus Kas untuk sembarang dataset/tahun (dipakai khusus untuk kolom
// pembanding "Tahun Lalu"), tanpa mengubah sedikit pun logika hitungLabaRugi()/hitungNilaiLaporanUntukNeraca()
// yang sudah berjalan untuk tahun berjalan.
function hitungRingkasanPeriodeLain(dataJurnalPeriode, tahunTarget) {
    let tPop = 0, tPnon = 0, tBop = 0, tBnon = 0, tPiutang = 0, tHutang = 0;
    (dataJurnalPeriode || []).forEach(i => {
        if (i.namaKategori === 'Pendapatan Operasional') tPop += i.nominal;
        else if (i.namaKategori === 'Pendapatan Non-Operasional') tPnon += i.nominal;
        else if (i.namaKategori === 'Beban Operasional') tBop += i.nominal;
        else if (i.namaKategori === 'Beban Non-Operasional') tBnon += i.nominal;
        else if (i.namaKategori === 'Piutang Usaha') tPiutang += i.nominal;
        else if (i.namaKategori === 'Hutang Usaha') tHutang += i.nominal;
        else if (i.namaKategori === 'Pelunasan Piutang Usaha') tPiutang -= i.nominal;
        else if (i.namaKategori === 'Pelunasan Hutang Usaha') tHutang -= i.nominal;
    });

    let totalSusutTahun = 0, investasiTahun = 0;
    (asetTetapData || []).forEach(a => {
        let masaManfaat = a.masaManfaat || 4;
        let susutThn = a.susutPerTahun || Math.round((a.harga || 0) / masaManfaat);
        if (parseInt(a.tahun) <= tahunTarget) totalSusutTahun += susutThn;
        if (parseInt(a.tahun) === tahunTarget) investasiTahun += (a.harga || 0);
    });

    let pendanaanTahun = 0;
    (historiModalData || []).forEach(m => { if (parseInt(m.tahun) === tahunTarget) pendanaanTahun += (m.nominal || 0); });

    let tPendapatan = tPop + tPnon;
    let tBebanAkrual = (tBop + totalSusutTahun) + tBnon;
    let laba = tPendapatan - tBebanAkrual;

    let masukOp = tPop + tPnon + tHutang;
    let keluarOp = tBop + tBnon + tPiutang;
    let bersihOp = masukOp - keluarOp;
    let kenaikanBersih = bersihOp - investasiTahun + pendanaanTahun;

    return { tPop, tPnon, tBop, tBnon, tPiutang, tHutang, tPendapatan, tBebanAkrual, laba, masukOp, keluarOp, bersihOp, investasiTahun, pendanaanTahun, kenaikanBersih };
}

// Merender kolom pembanding "Tahun Lalu" pada tabel Laba Rugi, Arus Kas, dan Neraca (jika elemen tersedia di HTML).
function renderPembandingTahunLalu() {
    let set = (id, val) => { let el = document.getElementById(id); if (el) el.innerText = val; };
    let tahunSekarang = new Date().getFullYear();
    let tahunLalu = tahunSekarang - 1;

    set('label-tahun-lalu-labarugi', tahunLalu);
    set('label-tahun-lalu-aruskas', tahunLalu);
    set('label-tahun-lalu-neraca', tahunLalu);

    // --- Laba Rugi & Arus Kas Tahun Lalu: dihitung langsung dari transaksi riil tahun lalu (data flow, valid tanpa histori kumulatif) ---
    let dataLaluFiltered = (currentUser && currentUser.role !== 'Super Admin') ? riwayatJurnalTahunLalu.filter(i => i.unitUsaha === currentUser.unit) : riwayatJurnalTahunLalu;
    let hasilLalu = hitungRingkasanPeriodeLain(dataLaluFiltered, tahunLalu);

    set('lalu-pendapatan-op', "Rp " + formatRupiah(hasilLalu.tPop));
    set('lalu-pendapatan-non', "Rp " + formatRupiah(hasilLalu.tPnon));
    set('lalu-total-pendapatan', "Rp " + formatRupiah(hasilLalu.tPendapatan));
    set('lalu-beban-op', "(Rp " + formatRupiah(hasilLalu.tBop) + ")");
    set('lalu-beban-non', "(Rp " + formatRupiah(hasilLalu.tBnon) + ")");
    set('lalu-total-beban', "(Rp " + formatRupiah(hasilLalu.tBebanAkrual) + ")");
    set('lalu-laba-bersih', (hasilLalu.laba < 0 ? "-Rp " : "Rp ") + formatRupiah(Math.abs(hasilLalu.laba)));

    set('lalu-ak-op-masuk', "Rp " + formatRupiah(hasilLalu.masukOp));
    set('lalu-ak-op-keluar', "(Rp " + formatRupiah(hasilLalu.keluarOp) + ")");
    set('lalu-ak-op-bersih', (hasilLalu.bersihOp < 0 ? "-Rp " : "Rp ") + formatRupiah(Math.abs(hasilLalu.bersihOp)));
    set('lalu-ak-investasi', "(Rp " + formatRupiah(hasilLalu.investasiTahun) + ")");
    set('lalu-ak-pendanaan', "Rp " + formatRupiah(hasilLalu.pendanaanTahun));
    set('lalu-ak-kenaikan-bersih', (hasilLalu.kenaikanBersih < 0 ? "-Rp " : "Rp ") + formatRupiah(Math.abs(hasilLalu.kenaikanBersih)));

    // --- Neraca Tahun Lalu: HANYA akurat memakai catatan resmi Tutup Buku Tahunan (snapshot akhir tahun) ---
    let riwayatTutupLalu = (historiTutupBukuData || []).find(h => parseInt(h.tahun) === tahunLalu);
    if (riwayatTutupLalu) {
        set('lalu-neraca-kas-bank', "Rp " + formatRupiah(riwayatTutupLalu.saldoDibawa || 0));
        set('lalu-neraca-laba-berjalan', "Rp " + formatRupiah((riwayatTutupLalu.totalPendapatan || 0) - (riwayatTutupLalu.totalBeban || 0)));
    } else {
        set('lalu-neraca-kas-bank', 'Tutup buku belum dilakukan');
        set('lalu-neraca-laba-berjalan', 'Tutup buku belum dilakukan');
    }
}



// =========================================================================
// PENAMBAHAN: LAPORAN PERUBAHAN EKUITAS
// =========================================================================
// Komponen ke-3 dari 5 laporan keuangan standar (Neraca, Laba Rugi, Perubahan Ekuitas, Arus Kas, & CaLK),
// dihitung murni dari data yang sudah tercatat di sistem: Ekuitas Awal = Modal Disetor s.d. akhir tahun lalu
// + akumulasi Laba Ditahan dari riwayat Tutup Buku Tahunan. Ekuitas Akhir = Ekuitas Awal + Penyertaan Modal
// Tahun Ini + Laba Bersih Tahun Berjalan.
function renderPerubahanEkuitas() {
    let tbody = document.getElementById('tabel-perubahan-ekuitas');
    if (!tbody) return;

    let tahunSekarang = new Date().getFullYear();

    let modalSebelumTahunIni = 0, modalTahunIni = 0;
    (historiModalData || []).forEach(m => {
        let t = parseInt(m.tahun);
        if (t < tahunSekarang) modalSebelumTahunIni += (m.nominal || 0);
        else if (t === tahunSekarang) modalTahunIni += (m.nominal || 0);
    });

    let labaDitahanSebelumnya = 0;
    (historiTutupBukuData || []).forEach(h => {
        if (parseInt(h.tahun) < tahunSekarang) labaDitahanSebelumnya += ((h.totalPendapatan || 0) - (h.totalBeban || 0));
    });

    let ekuitasAwal = modalSebelumTahunIni + labaDitahanSebelumnya;

    let hasilTahunIni = hitungNilaiLaporanUntukNeraca();
    let labaTahunIni = hasilTahunIni.laba || 0;

    let ekuitasAkhir = ekuitasAwal + modalTahunIni + labaTahunIni;

    let fmt = (n) => (n < 0 ? '-Rp ' : 'Rp ') + formatRupiah(Math.abs(n));
    let baris = (label, nilai, tebal, indent) => `
        <tr class="${tebal ? 'fw-bold bg-light' : ''}">
            <td${indent ? ' style="padding-left:32px;"' : ''}>${label}</td>
            <td class="text-end">${fmt(nilai)}</td>
        </tr>`;

    tbody.innerHTML = `
        ${baris(`Ekuitas Awal per 1 Januari ${tahunSekarang}`, ekuitasAwal, true, false)}
        ${baris('Modal Disetor s.d. Akhir Tahun Lalu', modalSebelumTahunIni, false, true)}
        ${baris('Laba Ditahan Akumulasi Tahun Lalu (Riwayat Tutup Buku)', labaDitahanSebelumnya, false, true)}
        ${baris('(+) Penyertaan Modal Desa Tahun Ini', modalTahunIni, false, false)}
        ${baris(`(+/-) Laba (Rugi) Bersih Tahun Berjalan ${tahunSekarang}`, labaTahunIni, false, false)}
        <tr class="baris-total fs-6"><td class="text-teal fw-bold">EKUITAS AKHIR PERIODE (${tahunSekarang})</td><td class="text-end text-teal fw-bold">${fmt(ekuitasAkhir)}</td></tr>
    `;

    let elCatatan = document.getElementById('catatan-perubahan-ekuitas');
    if (elCatatan) {
        if ((historiTutupBukuData || []).length === 0 && modalSebelumTahunIni === 0) {
            elCatatan.innerHTML = `<i class="fas fa-circle-info me-1"></i> Ekuitas Awal bernilai Rp 0 karena belum ada riwayat Tutup Buku Tahunan maupun Modal Desa dari tahun-tahun sebelumnya.`;
        } else {
            elCatatan.innerHTML = `<i class="fas fa-circle-info me-1"></i> Ekuitas Awal dihitung dari akumulasi Modal Desa & Laba Ditahan sebelum tahun ${tahunSekarang}. Lakukan "Tutup Buku Tahunan" di akhir periode agar Laba Ditahan tahun ini ikut terhitung pada Ekuitas Awal tahun depan.`;
        }
    }
}



// =========================================================================
// PENAMBAHAN: CATATAN HASIL PENGAWASAN (BADAN PENGAWAS)
// =========================================================================
function bukaModalTambahPengawasan() {
    let f = document.getElementById('form-pengawasan'); if (f) f.reset();
    let t = document.getElementById('pengawasan-tanggal'); if (t) t.value = new Date().toISOString().slice(0, 10);
    new bootstrap.Modal(document.getElementById('modalTambahPengawasan')).show();
}

async function simpanPengawasanBaru(event) {
    event.preventDefault();
    let tanggal = document.getElementById('pengawasan-tanggal').value;
    let catatan = document.getElementById('pengawasan-catatan').value.trim();
    let rekomendasi = document.getElementById('pengawasan-rekomendasi').value.trim();
    if (!tanggal || !catatan) { Toast.fire({ icon: 'warning', title: 'Tanggal & catatan pengawasan wajib diisi.' }); return; }

    let namaPengawas = (currentUser && currentUser.nama) ? currentUser.nama : (profilBUMDes.pengawas || 'Badan Pengawas');
    try {
        await db.collection("pengawasan").add({ tanggal, catatan, rekomendasi: rekomendasi || '-', pengawas: namaPengawas });
        catatLog('Catatan Pengawasan', `Menambahkan catatan pengawasan tanggal ${formatTanggalIndo(tanggal)}.`);
        let modalEl = document.getElementById('modalTambahPengawasan');
        if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
        Toast.fire({ icon: 'success', title: 'Catatan pengawasan berhasil disimpan!' });
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Gagal Menyimpan Catatan', text: err.message });
    }
}

function renderCatatanPengawasan() {
    let tbody = document.getElementById('tabel-pengawasan');
    if (!tbody) return;
    if (!pengawasanData || pengawasanData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">Belum ada catatan pengawasan.</td></tr>`;
        return;
    }
    tbody.innerHTML = pengawasanData.map(p => `
        <tr>
            <td>${escapeHtml(formatTanggalIndo(p.tanggal))}</td>
            <td>${escapeHtml(p.catatan)}</td>
            <td>${escapeHtml(p.rekomendasi || '-')}</td>
            <td class="text-center no-print"><button class="btn btn-sm btn-outline-danger p-1 px-2" onclick="hapusPengawasan('${p.docId}')" title="Hapus"><i class="fas fa-trash"></i></button></td>
        </tr>
    `).join('');
}

async function hapusPengawasan(docId) {
    let konfirmasi = await Swal.fire({ title: 'Hapus Catatan Pengawasan?', text: 'Tindakan ini tidak bisa dibatalkan!', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Ya, Hapus!' });
    if (!konfirmasi.isConfirmed) return;
    await db.collection("pengawasan").doc(docId).delete();
    catatLog('Catatan Pengawasan', 'Menghapus satu catatan pengawasan.');
    Toast.fire({ icon: 'success', title: 'Catatan pengawasan dihapus.' });
}



// =========================================================================
// PERBAIKAN KRITIS: siapkanKontenLPJ() dipanggil oleh cetakLPJPDF() namun SEBELUMNYA TIDAK PERNAH
// didefinisikan di manapun pada file ini -- akibatnya tombol "Generate & Unduh LPJ" selalu gagal
// total (JavaScript ReferenceError) dan TIDAK PERNAH berhasil menghasilkan file PDF apapun.
// Fungsi ini mengisi seluruh bagian template LPJ (Sampul, Profil Pengurus, Laba Rugi, Neraca, Arus Kas,
// Daftar Aset, & Lembar Pengesahan/Tanda Tangan) dengan data terkini sebelum dirender menjadi PDF.
// =========================================================================
function siapkanKontenLPJ() {
    let tahunSekarang = new Date().getFullYear();

    let setTxt = (id, val) => { let el = document.getElementById(id); if (el) el.innerText = val; };
    setTxt('lpj-cover-nama', 'BUMDES ' + (profilBUMDes.nama || '-'));
    setTxt('lpj-cover-tahun', tahunSekarang);
    setTxt('lpj-cover-alamat', profilBUMDes.alamat || '-');

    // Tabel Profil Kepengurusan
    let anggotaLain = Array.isArray(profilBUMDes.anggotaLain) ? profilBUMDes.anggotaLain : [];
    let pengurusInti = [
        ['Penasihat', profilBUMDes.penasihat], ['Pengawas', profilBUMDes.pengawas],
        ['Direktur', profilBUMDes.direktur], ['Sekretaris', profilBUMDes.sekretaris], ['Bendahara', profilBUMDes.bendahara]
    ];
    let elPengurus = document.getElementById('lpj-tabel-pengurus');
    if (elPengurus) {
        let baris = pengurusInti.map(([jab, nama]) => `<tr><td style="width:35%;"><strong>${escapeHtml(jab)}</strong></td><td>${escapeHtml(nama || '-')}</td></tr>`).join('');
        baris += anggotaLain.map(a => `<tr><td>${escapeHtml(a.jabatan || '-')}</td><td>${escapeHtml(a.nama || '-')}</td></tr>`).join('');
        elPengurus.innerHTML = `<tr><th style="width:35%;">Jabatan</th><th>Nama</th></tr>${baris}`;
    }

    // Tabel Laba Rugi
    let hasilLR = hitungLabaRugi();
    let elLR = document.getElementById('lpj-tabel-labarugi');
    if (elLR) {
        elLR.innerHTML = `
            <tr><th colspan="2">1. PENDAPATAN</th></tr>
            <tr><td>Pendapatan Operasional</td><td class="text-end">Rp ${formatRupiah(hasilLR.tPop)}</td></tr>
            <tr><td>Pendapatan Non-Operasional</td><td class="text-end">Rp ${formatRupiah(hasilLR.tPnon)}</td></tr>
            <tr class="fw-bold"><td>TOTAL PENDAPATAN</td><td class="text-end">Rp ${formatRupiah(hasilLR.tPendapatan)}</td></tr>
            <tr><th colspan="2">2. BEBAN</th></tr>
            <tr><td>Beban Operasional & Penyusutan</td><td class="text-end">(Rp ${formatRupiah(hasilLR.tBop)})</td></tr>
            <tr><td>Beban Non-Operasional</td><td class="text-end">(Rp ${formatRupiah(hasilLR.tBnon)})</td></tr>
            <tr class="fw-bold"><td>TOTAL BEBAN</td><td class="text-end">(Rp ${formatRupiah(hasilLR.tBeban)})</td></tr>
            <tr class="fw-bold fs-6"><td>LABA BERSIH</td><td class="text-end">${hasilLR.laba < 0 ? '-Rp ' : 'Rp '}${formatRupiah(Math.abs(hasilLR.laba))}</td></tr>
        `;
    }

    // Tabel Neraca
    let hasilNeraca = hitungNilaiLaporanUntukNeraca();
    let elNeraca = document.getElementById('lpj-tabel-neraca');
    if (elNeraca) {
        elNeraca.innerHTML = `
            <tr><th colspan="2">ASET</th><th colspan="2">KEWAJIBAN & MODAL</th></tr>
            <tr><td>Kas & Bank</td><td class="text-end">Rp ${formatRupiah(hasilNeraca.kasBank)}</td><td>Hutang Usaha</td><td class="text-end">Rp ${formatRupiah(hasilNeraca.tHutang)}</td></tr>
            <tr><td>Piutang Usaha</td><td class="text-end">Rp ${formatRupiah(hasilNeraca.tPiutang)}</td><td>Modal Disetor</td><td class="text-end">Rp ${formatRupiah(hasilNeraca.totalModalKumulatif)}</td></tr>
            <tr><td>Peralatan & Inventaris (Nilai Sisa)</td><td class="text-end">Rp ${formatRupiah(hasilNeraca.nilaiSisaAsetTotal)}</td><td>Laba Berjalan</td><td class="text-end">Rp ${formatRupiah(hasilNeraca.laba)}</td></tr>
            <tr class="fw-bold"><td>TOTAL ASET</td><td class="text-end">Rp ${formatRupiah(hasilNeraca.totalAset)}</td><td>TOTAL PASIVA</td><td class="text-end">Rp ${formatRupiah(hasilNeraca.totalPasiva)}</td></tr>
        `;
    }

    // Tabel Arus Kas (memakai ulang tampilan tab Arus Kas yang sudah dirender oleh renderArusKas())
    renderArusKas();
    let elAK = document.getElementById('lpj-tabel-aruskas');
    if (elAK) {
        let ambil = (id) => document.getElementById(id)?.innerText || '-';
        elAK.innerHTML = `
            <tr><th colspan="2">A. AKTIVITAS OPERASIONAL</th></tr>
            <tr><td>Penerimaan Kas dari Pendapatan Usaha</td><td class="text-end">${ambil('ak-op-masuk')}</td></tr>
            <tr><td>Pembayaran Kas untuk Beban Operasional</td><td class="text-end">${ambil('ak-op-keluar')}</td></tr>
            <tr class="fw-bold"><td>Arus Kas Bersih Operasional</td><td class="text-end">${ambil('ak-op-bersih')}</td></tr>
            <tr><th colspan="2">B. AKTIVITAS INVESTASI</th></tr>
            <tr class="fw-bold"><td>Pembelian Aset Tetap</td><td class="text-end">${ambil('ak-investasi')}</td></tr>
            <tr><th colspan="2">C. AKTIVITAS PENDANAAN</th></tr>
            <tr class="fw-bold"><td>Penyertaan Modal Desa</td><td class="text-end">${ambil('ak-pendanaan')}</td></tr>
            <tr class="fw-bold"><td>Kenaikan (Penurunan) Kas Bersih</td><td class="text-end">${ambil('ak-kenaikan-bersih')}</td></tr>
            <tr><td>Saldo Kas Awal Periode</td><td class="text-end">${ambil('ak-saldo-awal')}</td></tr>
            <tr class="fw-bold fs-6"><td>SALDO KAS AKHIR PERIODE</td><td class="text-end">${ambil('ak-saldo-akhir')}</td></tr>
        `;
    }

    // Tabel Daftar Aset
    let elAset = document.getElementById('lpj-tabel-aset');
    if (elAset) {
        let barisAset = (asetTetapData || []).map(a => {
            let masaManfaat = a.masaManfaat || 4;
            let susutThn = a.susutPerTahun || Math.round((a.harga || 0) / masaManfaat);
            let usiaAset = Math.max(0, tahunSekarang - a.tahun);
            let nilaiSisa = Math.max(0, (a.harga || 0) - Math.min(a.harga || 0, usiaAset * susutThn));
            return `<tr><td>${escapeHtml(a.nama)}</td><td class="text-center">${a.jumlah || 1}</td><td>${escapeHtml(a.unit || '-')}</td><td class="text-center">${a.tahun || '-'}</td><td class="text-end">Rp ${formatRupiah(a.harga || 0)}</td><td class="text-end">Rp ${formatRupiah(nilaiSisa)}</td></tr>`;
        }).join('');
        elAset.innerHTML = `<tr><th>Nama Aset</th><th>Jml</th><th>Unit</th><th>Tahun</th><th class="text-end">Harga Beli</th><th class="text-end">Nilai Sisa</th></tr>${barisAset || '<tr><td colspan="6" class="text-center text-muted">Tidak ada data aset.</td></tr>'}`;
    }

    // Blok Tanda Tangan Pengurus + Lembar Pengesahan Pemerintah Desa & BPD (PENAMBAHAN)
    let elTtd = document.getElementById('lpj-ttd-area');
    if (elTtd) {
        let tglSekarang = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        elTtd.innerHTML = `
            <p style="margin-top:20px;">${escapeHtml((profilBUMDes.alamat || '').split(',')[0] || 'Desa')}, ${tglSekarang}</p>
            <div style="display:flex; justify-content:space-between; margin-top:20px; text-align:center; gap:16px;">
                <div style="flex:1;"><p>Direktur BUMDes</p><div style="height:60px;"></div><p><strong>${escapeHtml(profilBUMDes.direktur || '-')}</strong></p></div>
                <div style="flex:1;"><p>Sekretaris</p><div style="height:60px;"></div><p><strong>${escapeHtml(profilBUMDes.sekretaris || '-')}</strong></p></div>
                <div style="flex:1;"><p>Bendahara</p><div style="height:60px;"></div><p><strong>${escapeHtml(profilBUMDes.bendahara || '-')}</strong></p></div>
            </div>
            <h4 style="margin-top:40px;">Lembar Pengesahan</h4>
            <p>Laporan Pertanggungjawaban ini telah diperiksa dan disahkan oleh:</p>
            <div style="display:flex; justify-content:space-between; margin-top:20px; text-align:center; gap:16px;">
                <div style="flex:1;"><p>Kepala Desa</p><div style="height:60px;"></div><p><strong>${escapeHtml(profilBUMDes.kepalaDesa || '-')}</strong></p></div>
                <div style="flex:1;"><p>Ketua BPD</p><div style="height:60px;"></div><p><strong>${escapeHtml(profilBUMDes.ketuaBPD || '-')}</strong></p></div>
                <div style="flex:1;"><p>Ketua Pengawas</p><div style="height:60px;"></div><p><strong>${escapeHtml(profilBUMDes.pengawas || '-')}</strong></p></div>
            </div>
        `;
    }
}



// =========================================================================
// PERBAIKAN TOTAL & MENDASAR: mesin cetak PDF diganti dari "screenshot HTML" (html2canvas)
// menjadi "gambar langsung dari data" (jsPDF + AutoTable murni vektor teks/tabel).
// =========================================================================
// AKAR MASALAH SEBELUMNYA: html2canvas bekerja dengan cara memotret tampilan visual sebuah elemen
// DOM. Cara ini SANGAT rapuh -- kalau elemen (atau leluhurnya) sedang "display:none" karena aturan
// CSS responsif (mis. class Bootstrap "d-none d-md-flex" yang dipakai di area cetak LPJ & kop surat
// resmi aplikasi ini), atau CSS lain yang tidak didukung penuh oleh html2canvas, hasil tangkapannya
// diam-diam KOSONG tanpa memunculkan pesan error apapun. Sudah dicoba ditambal berkali-kali dengan
// memaksa elemen tampil sementara, namun tetap tidak konsisten di berbagai perangkat/browser.
//
// SOLUSI PROFESIONAL & 100% ANDAL: PDF sekarang digambar LANGSUNG dari data aplikasi (bukan dari
// tampilan layar), memakai jsPDF (pembuat dokumen PDF) + AutoTable (penggambar tabel). Cara ini tidak
// pernah bergantung pada apakah sebuah elemen sedang terlihat di layar atau tidak, tidak peduli lebar
// layar perangkat, dan tidak pernah menghasilkan file kosong -- karena yang digambar adalah teks &
// angka dari variabel data itu sendiri, bukan hasil "foto" tampilan HTML.
// =========================================================================

// Menuliskan kop surat resmi + judul laporan di bagian atas setiap halaman PDF, mengembalikan posisi Y
// (dalam mm) tempat konten tabel boleh mulai digambar.
function tulisKopSuratPDF(doc, judulLaporan) {
    let lebar = doc.internal.pageSize.getWidth();

    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text('BUMDES ' + (profilBUMDes.nama || '-').toUpperCase(), lebar / 2, 14, { align: 'center' });

    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(profilBUMDes.alamat || '-', lebar / 2, 19.5, { align: 'center' });

    doc.setLineWidth(0.6);
    doc.line(12, 23, lebar - 12, 23);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text(judulLaporan.toUpperCase(), lebar / 2, 32, { align: 'center' });

    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(110, 110, 110);
    doc.text('Dicetak: ' + new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }), lebar - 12, 37, { align: 'right' });
    doc.setTextColor(0, 0, 0);

    return 42;
}

// PENAMBAHAN: memastikan library jsPDF + plugin AutoTable sudah termuat sebelum mencetak, dan
// menampilkan pesan yang jelas (bukan gagal diam-diam) jika koneksi internet pengguna bermasalah
// saat memuat library dari CDN.
function pastikanMesinPdfSiap() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        Swal.fire({ icon: 'error', title: 'Modul PDF Belum Siap', text: 'Library pembuat PDF gagal dimuat. Pastikan koneksi internet aktif, lalu muat ulang (refresh) halaman ini dan coba lagi.' });
        return null;
    }
    let ujiDoc = new window.jspdf.jsPDF();
    if (typeof ujiDoc.autoTable !== 'function') {
        Swal.fire({ icon: 'error', title: 'Modul Tabel PDF Belum Siap', text: 'Komponen tabel PDF (AutoTable) gagal dimuat. Pastikan koneksi internet aktif, lalu muat ulang (refresh) halaman ini dan coba lagi.' });
        return null;
    }
    return window.jspdf.jsPDF;
}

// =========================================================================
// CETAK UNIVERSAL: menghasilkan berkas PDF asli untuk laporan/tab APAPUN yang sedang aktif dilihat
// pengguna, dengan cara mengekstrak TEKS dari tabel yang sedang tampil di layar (bukan memotretnya
// sebagai gambar), lalu menggambarnya ulang sebagai tabel PDF yang rapi & profesional.
// =========================================================================
function ekstrakTabelUntukPDF(container) {
    let hasil = [];
    container.querySelectorAll('table').forEach(table => {
        if (table.closest('.no-print')) return;

        let head = [];
        let theadRow = table.querySelector('thead tr');
        if (theadRow) head = Array.from(theadRow.children).map(th => th.innerText.trim());

        let body = [];
        table.querySelectorAll('tbody tr').forEach(tr => {
            if (tr.classList.contains('no-print')) return;
            let cells = Array.from(tr.children).map(td => td.innerText.trim());
            if (cells.some(c => c !== '')) body.push(cells);
        });

        if (body.length > 0) hasil.push({ head, body });
    });
    return hasil;
}

function cetakLaporanAktif() {
    let tabAktif = null;
    document.querySelectorAll('.konten-tab').forEach(tab => { if (tab.style.display !== 'none') tabAktif = tab; });
    if (!tabAktif) { Toast.fire({ icon: 'info', title: 'Tidak ada laporan yang sedang aktif untuk dicetak.' }); return; }

    // Tab LPJ memiliki generator PDF multi-halaman (dengan sampul) miliknya sendiri -> arahkan ke sana.
    if (tabAktif.id === 'tab-lpj') { cetakLPJPDF(); return; }

    let jsPDFClass = pastikanMesinPdfSiap();
    if (!jsPDFClass) return;

    let judul = (document.getElementById('judul-halaman')?.innerText || 'Laporan').trim();

    let tabelDitemukan = ekstrakTabelUntukPDF(tabAktif);

    // Tampung juga teks bebas non-tabel yang relevan (mis. Catatan atas Laporan Keuangan berupa <textarea>)
    let teksBebas = [];
    tabAktif.querySelectorAll('textarea').forEach(ta => { if (ta.value && ta.value.trim()) teksBebas.push(ta.value.trim()); });

    if (tabelDitemukan.length === 0 && teksBebas.length === 0) {
        Swal.fire({ icon: 'info', title: 'Belum Ada Data', text: `Laporan "${judul}" belum memiliki data untuk dicetak.` });
        return;
    }

    Swal.fire({ title: 'Menyiapkan Berkas PDF...', text: 'Sistem sedang menyusun berkas PDF, mohon tunggu...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    setTimeout(() => {
        try {
            let butuhLandscape = tabelDitemukan.some(t => t.head.length > 5);
            let doc = new jsPDFClass({ orientation: butuhLandscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });

            let y = tulisKopSuratPDF(doc, judul);

            tabelDitemukan.forEach(t => {
                doc.autoTable({
                    startY: y,
                    head: t.head.length ? [t.head] : undefined,
                    body: t.body,
                    theme: 'grid',
                    styles: { fontSize: 8.5, cellPadding: 2.2, overflow: 'linebreak', textColor: [30, 30, 30] },
                    headStyles: { fillColor: [13, 148, 136], textColor: 255, fontStyle: 'bold' },
                    alternateRowStyles: { fillColor: [246, 250, 249] },
                    margin: { left: 12, right: 12 },
                    didDrawPage: () => { tulisKopSuratPDF(doc, judul); }
                });
                y = doc.lastAutoTable.finalY + 10;
            });

            teksBebas.forEach(txt => {
                let lebar = doc.internal.pageSize.getWidth();
                let barisTeks = doc.splitTextToSize(txt, lebar - 24);
                doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
                if (y + (barisTeks.length * 4.5) > doc.internal.pageSize.getHeight() - 15) { doc.addPage(); y = tulisKopSuratPDF(doc, judul); }
                doc.text(barisTeks, 12, y);
                y += barisTeks.length * 4.5 + 8;
            });

            let namaFile = `${judul.replace(/[^a-zA-Z0-9]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`;
            doc.save(namaFile);

            Swal.close();
            catatLog('Cetak Laporan', `Mengunduh berkas PDF untuk laporan: ${judul}.`);
            Toast.fire({ icon: 'success', title: 'Berkas PDF berhasil diunduh!' });
        } catch (e) {
            Swal.fire({ icon: 'error', title: 'Gagal Membuat Berkas PDF', text: e.message });
        }
    }, 150);
}



// =========================================================================
// GENERATOR LPJ FORMAL: dokumen resmi multi-halaman (sampul, profil pengurus, laba rugi, neraca,
// arus kas, daftar aset, & lembar pengesahan) -- digambar penuh dari data, sehingga selalu terisi
// dengan benar apapun ukuran layar/perangkat yang dipakai untuk mengunduhnya.
// =========================================================================
function cetakLPJPDF() {
    let jsPDFClass = pastikanMesinPdfSiap();
    if (!jsPDFClass) return;

    // Tetap dipanggil agar pratinjau LPJ di layar (bila sedang tampil di perangkat lebar) tetap sinkron.
    siapkanKontenLPJ();

    let tahunSekarang = new Date().getFullYear();

    Swal.fire({ title: 'Menyusun LPJ...', text: 'Sistem sedang menyusun dokumen PDF, mohon tunggu...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    setTimeout(() => {
        try {
            let doc = new jsPDFClass({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            let lebar = doc.internal.pageSize.getWidth();

            // ---------- HALAMAN SAMPUL ----------
            doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
            doc.text('LAPORAN PERTANGGUNGJAWABAN (LPJ)', lebar / 2, 90, { align: 'center' });
            doc.setFontSize(18);
            doc.text('BUMDES ' + (profilBUMDes.nama || '-').toUpperCase(), lebar / 2, 105, { align: 'center' });
            doc.setFontSize(13);
            doc.text('TAHUN BUKU ' + tahunSekarang, lebar / 2, 115, { align: 'center' });
            doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
            doc.text(profilBUMDes.alamat || '-', lebar / 2, 260, { align: 'center' });

            // ---------- PROFIL KEPENGURUSAN ----------
            doc.addPage();
            let y = tulisKopSuratPDF(doc, 'Profil Kepengurusan');
            let anggotaLain = Array.isArray(profilBUMDes.anggotaLain) ? profilBUMDes.anggotaLain : [];
            let barisPengurus = [
                ['Penasihat', profilBUMDes.penasihat || '-'], ['Pengawas', profilBUMDes.pengawas || '-'],
                ['Direktur', profilBUMDes.direktur || '-'], ['Sekretaris', profilBUMDes.sekretaris || '-'],
                ['Bendahara', profilBUMDes.bendahara || '-'],
                ...anggotaLain.map(a => [a.jabatan || '-', a.nama || '-'])
            ];
            doc.autoTable({ startY: y, head: [['Jabatan', 'Nama']], body: barisPengurus, theme: 'grid', styles: { fontSize: 10, cellPadding: 3 }, headStyles: { fillColor: [13, 148, 136] }, margin: { left: 15, right: 15 } });

            // ---------- LABA RUGI ----------
            doc.addPage();
            y = tulisKopSuratPDF(doc, 'Laporan Laba Rugi');
            let hasilLR = hitungLabaRugi();
            doc.autoTable({
                startY: y, theme: 'grid', styles: { fontSize: 10, cellPadding: 3 }, headStyles: { fillColor: [13, 148, 136] },
                margin: { left: 15, right: 15 },
                head: [['Uraian', 'Nominal (Rp)']],
                body: [
                    ['Pendapatan Operasional', formatRupiah(hasilLR.tPop)],
                    ['Pendapatan Non-Operasional', formatRupiah(hasilLR.tPnon)],
                    [{ content: 'TOTAL PENDAPATAN', styles: { fontStyle: 'bold' } }, { content: formatRupiah(hasilLR.tPendapatan), styles: { fontStyle: 'bold' } }],
                    ['Beban Operasional & Penyusutan', '(' + formatRupiah(hasilLR.tBop) + ')'],
                    ['Beban Non-Operasional', '(' + formatRupiah(hasilLR.tBnon) + ')'],
                    [{ content: 'TOTAL BEBAN', styles: { fontStyle: 'bold' } }, { content: '(' + formatRupiah(hasilLR.tBeban) + ')', styles: { fontStyle: 'bold' } }],
                    [{ content: 'LABA BERSIH', styles: { fontStyle: 'bold', fillColor: [214, 237, 234] } }, { content: (hasilLR.laba < 0 ? '-Rp ' : 'Rp ') + formatRupiah(Math.abs(hasilLR.laba)), styles: { fontStyle: 'bold', fillColor: [214, 237, 234] } }]
                ]
            });

            // ---------- NERACA ----------
            doc.addPage();
            y = tulisKopSuratPDF(doc, 'Neraca Posisi Keuangan');
            let hasilNer = hitungNilaiLaporanUntukNeraca();
            doc.autoTable({
                startY: y, theme: 'grid', styles: { fontSize: 9.5, cellPadding: 3 }, headStyles: { fillColor: [13, 148, 136] },
                margin: { left: 15, right: 15 },
                head: [['ASET', 'Nominal (Rp)', 'KEWAJIBAN & MODAL', 'Nominal (Rp)']],
                body: [
                    ['Kas & Bank', formatRupiah(hasilNer.kasBank), 'Hutang Usaha', formatRupiah(hasilNer.tHutang)],
                    ['Piutang Usaha', formatRupiah(hasilNer.tPiutang), 'Modal Disetor', formatRupiah(hasilNer.totalModalKumulatif)],
                    ['Peralatan & Inventaris', formatRupiah(hasilNer.nilaiSisaAsetTotal), 'Laba Berjalan', formatRupiah(hasilNer.laba)],
                    [{ content: 'TOTAL ASET', styles: { fontStyle: 'bold' } }, { content: formatRupiah(hasilNer.totalAset), styles: { fontStyle: 'bold' } }, { content: 'TOTAL PASIVA', styles: { fontStyle: 'bold' } }, { content: formatRupiah(hasilNer.totalPasiva), styles: { fontStyle: 'bold' } }]
                ]
            });

            // ---------- ARUS KAS (memakai ulang hasil renderArusKas() yang sudah tampil di layar, murni sebagai teks) ----------
            doc.addPage();
            y = tulisKopSuratPDF(doc, 'Laporan Arus Kas');
            renderArusKas();
            let ambilTeks = (id) => document.getElementById(id)?.innerText || '-';
            doc.autoTable({
                startY: y, theme: 'grid', styles: { fontSize: 9.5, cellPadding: 3 }, headStyles: { fillColor: [13, 148, 136] },
                margin: { left: 15, right: 15 },
                head: [['Uraian', 'Nominal']],
                body: [
                    [{ content: 'A. AKTIVITAS OPERASIONAL', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }],
                    ['Penerimaan Kas dari Pendapatan Usaha', ambilTeks('ak-op-masuk')],
                    ['Pembayaran Kas untuk Beban Operasional', ambilTeks('ak-op-keluar')],
                    [{ content: 'Arus Kas Bersih Operasional', styles: { fontStyle: 'bold' } }, { content: ambilTeks('ak-op-bersih'), styles: { fontStyle: 'bold' } }],
                    [{ content: 'B. AKTIVITAS INVESTASI', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }],
                    [{ content: 'Pembelian Aset Tetap', styles: { fontStyle: 'bold' } }, { content: ambilTeks('ak-investasi'), styles: { fontStyle: 'bold' } }],
                    [{ content: 'C. AKTIVITAS PENDANAAN', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }],
                    [{ content: 'Penyertaan Modal Desa', styles: { fontStyle: 'bold' } }, { content: ambilTeks('ak-pendanaan'), styles: { fontStyle: 'bold' } }],
                    [{ content: 'Kenaikan (Penurunan) Kas Bersih', styles: { fontStyle: 'bold' } }, { content: ambilTeks('ak-kenaikan-bersih'), styles: { fontStyle: 'bold' } }],
                    ['Saldo Kas Awal Periode', ambilTeks('ak-saldo-awal')],
                    [{ content: 'SALDO KAS AKHIR PERIODE', styles: { fontStyle: 'bold', fillColor: [214, 237, 234] } }, { content: ambilTeks('ak-saldo-akhir'), styles: { fontStyle: 'bold', fillColor: [214, 237, 234] } }]
                ]
            });

            // ---------- DAFTAR ASET ----------
            doc.addPage();
            y = tulisKopSuratPDF(doc, 'Daftar Aset Tetap');
            let barisAset = (asetTetapData || []).map(a => {
                let masaManfaat = a.masaManfaat || 4;
                let susutThn = a.susutPerTahun || Math.round((a.harga || 0) / masaManfaat);
                let usiaAset = Math.max(0, tahunSekarang - a.tahun);
                let nilaiSisa = Math.max(0, (a.harga || 0) - Math.min(a.harga || 0, usiaAset * susutThn));
                return [a.nama, String(a.jumlah || 1), a.unit || '-', String(a.tahun || '-'), formatRupiah(a.harga || 0), formatRupiah(nilaiSisa)];
            });
            doc.autoTable({
                startY: y, theme: 'grid', styles: { fontSize: 9, cellPadding: 2.5 }, headStyles: { fillColor: [13, 148, 136] },
                margin: { left: 15, right: 15 },
                head: [['Nama Aset', 'Jml', 'Unit', 'Tahun', 'Harga Beli', 'Nilai Sisa']],
                body: barisAset.length ? barisAset : [[{ content: 'Tidak ada data aset tetap tercatat.', colSpan: 6, styles: { halign: 'center', textColor: 150 } }]]
            });

            // ---------- LEMBAR PENGESAHAN & TANDA TANGAN ----------
            doc.addPage();
            y = tulisKopSuratPDF(doc, 'Lembar Pengesahan');
            doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
            let tglIndo = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            doc.text(`${(profilBUMDes.alamat || 'Desa').split(',')[0]}, ${tglIndo}`, lebar - 15, y, { align: 'right' });
            y += 22;

            let kolomTtd = (label, nama, x) => {
                doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
                doc.text(label, x, y, { align: 'center' });
                doc.line(x - 27, y + 26, x + 27, y + 26);
                doc.setFont('helvetica', 'bold');
                doc.text(nama || '-', x, y + 31, { align: 'center', maxWidth: 58 });
            };
            let titikTengah = [lebar * 0.18, lebar * 0.5, lebar * 0.82];
            doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
            doc.text('Disusun oleh Pengurus BUMDes:', 15, y - 6);
            kolomTtd('Direktur BUMDes', profilBUMDes.direktur, titikTengah[0]);
            kolomTtd('Sekretaris', profilBUMDes.sekretaris, titikTengah[1]);
            kolomTtd('Bendahara', profilBUMDes.bendahara, titikTengah[2]);

            y += 48;
            doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
            doc.text('Mengetahui & Mengesahkan:', 15, y);
            y += 8;
            kolomTtd('Kepala Desa', profilBUMDes.kepalaDesa, titikTengah[0]);
            kolomTtd('Ketua BPD', profilBUMDes.ketuaBPD, titikTengah[1]);
            kolomTtd('Ketua Pengawas', profilBUMDes.pengawas, titikTengah[2]);

            let namaFile = `LPJ_BUMDes_${(profilBUMDes.nama || 'BUMDes').replace(/\s+/g, '_')}_${tahunSekarang}.pdf`;
            doc.save(namaFile);

            Swal.close();
            catatLog('Cetak LPJ', `Mengunduh Laporan Pertanggungjawaban tahun ${tahunSekarang}.`);
            Toast.fire({ icon: 'success', title: 'LPJ PDF berhasil diunduh!' });
        } catch (e) {
            Swal.fire({ icon: 'error', title: 'Gagal Membuat PDF', text: e.message });
        }
    }, 300);
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

                                <div class="d-flex align-items-start justify-content-between mb-3">

                                    <div class="d-flex align-items-center">

                                        <div class="rounded-3 p-3 me-3 text-white shadow-sm" style="background: linear-gradient(135deg, var(--accent-teal), #047857);">

                                            <i class="fas ${escapeHtml(unit.icon || 'fa-store')} fa-xl"></i>

                                        </div>

                                        <div>

                                            <h6 class="fw-bold mb-0 text-dark">${escapeHtml(unit.nama)}</h6>

                                            <small class="text-muted" style="font-size:0.72rem;">Unit Usaha BUMDes</small>

                                        </div>

                                    </div>

                                    <div class="d-flex gap-1">

                                        <button class="btn btn-sm btn-light border" onclick="bukaModalEditUnit('${unit.docId}')" title="Edit Unit"><i class="fas fa-pen text-primary" style="font-size:0.75rem;"></i></button>

                                        <button class="btn btn-sm btn-light border" onclick="hapusUnitUsaha('${unit.docId}')" title="Hapus Unit"><i class="fas fa-trash text-danger" style="font-size:0.75rem;"></i></button>

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

        htmlString = `<tr><td colspan="9" class="text-center text-muted py-4">Belum ada daftar inventaris / aset tetap.</td></tr>`;

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

                    <td class="text-center">${item.jumlah || 1} Unit</td>

                    <td><span class="badge bg-info bg-opacity-10 text-dark border">${escapeHtml(item.unit)}</span></td>

                    <td>${item.tahun}</td>

                    <td class="text-end">Rp ${formatRupiah(item.harga)}</td>

                    <td class="text-center">${masaManfaat} Thn</td>

                    <td class="text-end text-danger">(Rp ${formatRupiah(susutThn)})</td>

                    <td class="text-end fw-bold text-success">Rp ${formatRupiah(nilaiSisa)}</td>

                    <td class="text-center no-print"><button class="btn btn-sm btn-outline-danger p-1 px-2" onclick="hapusAsetTetap('${item.docId}')" title="Hapus Aset"><i class="fas fa-trash"></i></button></td>

                </tr>

            `;

        });

    }

    tbody.innerHTML = htmlString;

    let neracaAset = document.getElementById('neraca-aset-tetap'); if(neracaAset) neracaAset.innerText = "Rp " + formatRupiah(totalNilaiSisa);

    renderNeraca();

}



// PENAMBAHAN: Fitur hapus data pada menu Inventaris & Aset Tetap.
async function hapusAsetTetap(docId) {

    let item = asetTetapData.find(a => a.docId === docId);

    let nama = item ? item.nama : 'aset ini';

    let konfirmasi = await Swal.fire({

        icon: 'warning', title: 'Hapus Aset Tetap?',

        html: `Aset <b>${escapeHtml(nama)}</b> akan dihapus permanen dari daftar inventaris.<br><small class="text-muted">Nilai penyusutan & neraca akan otomatis diperbarui setelah dihapus.</small>`,

        showCancelButton: true, confirmButtonText: 'Ya, Hapus', cancelButtonText: 'Batal', confirmButtonColor: '#ef4444'

    });

    if (!konfirmasi.isConfirmed) return;



    try {

        await db.collection("asets").doc(docId).delete();

        catatLog('Aset Tetap', `Menghapus aset '${nama}' dari daftar inventaris.`);

        Toast.fire({ icon: 'success', title: 'Aset berhasil dihapus.' });

    } catch (err) {

        Swal.fire({ icon: 'error', title: 'Gagal Menghapus Aset', text: err.message });

    }

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

        else if (i.namaKategori === 'Pelunasan Piutang Usaha') tPiutang -= i.nominal;

        else if (i.namaKategori === 'Pelunasan Hutang Usaha') tHutang -= i.nominal;

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



function bukaModalEditUnit(docId) {
    let unit = unitUsahaData.find(u => u.docId === docId);
    if (!unit) return;
    editUnitDocId = docId;
    document.getElementById('edit-nama-unit').value = unit.nama || '';
    document.getElementById('edit-pengelola-unit').value = unit.pengelola || '';
    document.getElementById('edit-jabatan-unit').value = unit.jabatan || '';
    new bootstrap.Modal(document.getElementById('modalEditUnit')).show();
}

async function simpanEditUnit(event) {
    event.preventDefault();
    if (!editUnitDocId) return;
    let nama = document.getElementById('edit-nama-unit').value.trim();
    let pengelola = document.getElementById('edit-pengelola-unit').value.trim();
    let jabatan = document.getElementById('edit-jabatan-unit').value.trim();
    if (!nama || !pengelola) { Toast.fire({ icon: 'warning', title: 'Nama unit & pengelola wajib diisi.' }); return; }

    await db.collection("units").doc(editUnitDocId).update({ nama, pengelola, jabatan: jabatan || 'Pengelola Unit' });
    catatLog('Unit Usaha', `Memperbarui data unit usaha: ${nama}`);
    let modalEl = document.getElementById('modalEditUnit');
    if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
    editUnitDocId = null;
    Toast.fire({ icon: 'success', title: 'Unit usaha berhasil diperbarui!' });
}

async function hapusUnitUsaha(docId) {
    let unit = unitUsahaData.find(u => u.docId === docId);
    let nama = unit ? unit.nama : 'unit ini';
    let konfirmasi = await Swal.fire({
        icon: 'warning', title: 'Hapus Unit Usaha?',
        html: `Unit <b>${escapeHtml(nama)}</b> akan dihapus dari daftar.<br><small class="text-muted">Data transaksi/aset yang sudah tercatat atas nama unit ini tidak akan otomatis terhapus.</small>`,
        showCancelButton: true, confirmButtonText: 'Ya, Hapus', cancelButtonText: 'Batal', confirmButtonColor: '#ef4444'
    });
    if (!konfirmasi.isConfirmed) return;
    await db.collection("units").doc(docId).delete();
    catatLog('Unit Usaha', `Menghapus unit usaha: ${nama}`);
    Toast.fire({ icon: 'success', title: 'Unit usaha telah dihapus.' });
}

// =========================================================================
// 6b. KELOLA AKUN AKSES PENANGGUNG JAWAB UNIT USAHA
// =========================================================================
function bukaModalTambahAkunUnit() {
    let selectUnit = document.getElementById('add-unit-akun');
    if (selectUnit) {
        let html = '<option value="">-- Pilih Unit Usaha --</option>';
        unitUsahaData.forEach(u => html += `<option value="${escapeHtml(u.nama)}">${escapeHtml(u.nama)}</option>`);
        selectUnit.innerHTML = html;
    }
    if (unitUsahaData.length === 0) {
        Toast.fire({ icon: 'warning', title: 'Tambahkan unit usaha terlebih dahulu sebelum membuat akun.' });
        return;
    }
    new bootstrap.Modal(document.getElementById('modalTambahAkunUnit')).show();
}

async function simpanAkunUnitBaru(event) {
    event.preventDefault();
    let unitNama = document.getElementById('add-unit-akun').value;
    let email = document.getElementById('add-username-akun').value.trim().toLowerCase();
    let pass = document.getElementById('add-password-akun').value;

    if (!unitNama) { Toast.fire({ icon: 'warning', title: 'Pilih unit usaha terlebih dahulu.' }); return; }
    if (!email || !email.includes('@')) { Toast.fire({ icon: 'warning', title: 'Username harus berupa format email, contoh: warungdesa@bumdes.id' }); return; }
    if (!pass || pass.length < 6) { Toast.fire({ icon: 'warning', title: 'Password minimal 6 karakter.' }); return; }
    if (email === 'bumdes@karangmakmur.com') { Toast.fire({ icon: 'warning', title: 'Username tersebut dipakai untuk akun Super Admin.' }); return; }

    Swal.fire({ title: 'Membuat Akun...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {
        let cekDoc = await db.collection("unitAccounts").doc(email).get();
        if (cekDoc.exists) {
            Swal.fire({ icon: 'error', title: 'Gagal', text: 'Username tersebut sudah terdaftar.' });
            return;
        }

        // Buat akun di Firebase Auth lewat instance kedua agar sesi Admin tidak terganggu
        let secAuth = getSecondaryAuth();
        await secAuth.createUserWithEmailAndPassword(email, pass);
        await secAuth.signOut();

        await db.collection("unitAccounts").doc(email).set({
            email: email, unitNama: unitNama, aktif: true, dibuatPada: new Date().toISOString()
        });

        catatLog('Hak Akses Unit', `Membuat akun akses untuk unit '${unitNama}' dengan username ${email}`);
        let modalEl = document.getElementById('modalTambahAkunUnit');
        if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
        event.target.reset();
        Swal.fire({ icon: 'success', title: 'Akun Berhasil Dibuat!', html: `Beritahukan Username <b>${escapeHtml(email)}</b> dan password kepada penanggung jawab unit <b>${escapeHtml(unitNama)}</b>.` });
    } catch (err) {
        let pesan = err.code === 'auth/email-already-in-use' ? 'Username tersebut sudah terdaftar di sistem otentikasi.' : err.message;
        Swal.fire({ icon: 'error', title: 'Gagal Membuat Akun', text: pesan });
    }
}

function renderTabelAksesUnit() {
    let tbody = document.getElementById('tabel-akses-unit');
    if (!tbody) return;
    if (aksesUnitData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Belum ada akun akses unit yang dibuat.</td></tr>`;
        return;
    }
    let html = '';
    aksesUnitData.forEach(akun => {
        let statusAktif = akun.aktif !== false;
        html += `
            <tr>
                <td class="fw-bold">${escapeHtml(akun.unitNama || '-')}</td>
                <td>${escapeHtml(akun.email || akun.docId)}</td>
                <td><span class="badge bg-success bg-opacity-10 text-success border">Input Laporan</span></td>
                <td>
                    <span class="badge ${statusAktif ? 'bg-success' : 'bg-secondary'}" style="cursor:pointer;" onclick="toggleStatusAksesUnit('${akun.docId}', ${!statusAktif})" title="Klik untuk ubah status">
                        ${statusAktif ? 'Aktif' : 'Nonaktif'}
                    </span>
                </td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-danger" onclick="hapusAksesUnit('${akun.docId}')" title="Hapus Akses"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

async function toggleStatusAksesUnit(docId, statusBaru) {
    await db.collection("unitAccounts").doc(docId).update({ aktif: statusBaru });
    catatLog('Hak Akses Unit', `Mengubah status akses akun '${docId}' menjadi ${statusBaru ? 'Aktif' : 'Nonaktif'}.`);
    Toast.fire({ icon: 'success', title: `Status akses diubah menjadi ${statusBaru ? 'Aktif' : 'Nonaktif'}.` });
}

async function hapusAksesUnit(docId) {
    let konfirmasi = await Swal.fire({
        icon: 'warning', title: 'Hapus Akses Akun?',
        html: `Akun <b>${escapeHtml(docId)}</b> tidak akan bisa login lagi ke sistem.<br><small class="text-muted">Catatan: akun otentikasinya sendiri tetap ada di Firebase (bila ingin dihapus total, hapus manual lewat Firebase Console &gt; Authentication).</small>`,
        showCancelButton: true, confirmButtonText: 'Ya, Hapus', cancelButtonText: 'Batal', confirmButtonColor: '#ef4444'
    });
    if (!konfirmasi.isConfirmed) return;
    await db.collection("unitAccounts").doc(docId).delete();
    catatLog('Hak Akses Unit', `Menghapus akses akun '${docId}'.`);
    Toast.fire({ icon: 'success', title: 'Akses akun telah dihapus.' });
}

async function simpanAsetBaru(event) {

    event.preventDefault();

    let nama = document.getElementById('add-nama-aset').value.trim();

    let unit = document.getElementById('add-unit-aset').value;

    let tahun = parseInt(document.getElementById('add-tahun-aset').value);

    let harga = ambilAngka(document.getElementById('add-harga-aset').value);

    let masaManfaat = parseInt(document.getElementById('add-manfaat-aset')?.value) || 4;

    let jumlah = parseInt(document.getElementById('add-jumlah-aset')?.value) || 1;

    if (!nama || !harga) { Toast.fire({ icon: 'warning', title: 'Nama & harga aset wajib diisi.' }); return; }

    let susutPerTahun = Math.round(harga / masaManfaat);

    await db.collection("asets").add({ nama, unit, tahun, harga, masaManfaat, susutPerTahun, jumlah });

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

    // PENAMBAHAN: filter sortir Pendapatan / Pengeluaran pada Jurnal Umum (juga berlaku saat ekspor CSV)
    let arusFilter = document.getElementById('filter-arus-jurnal')?.value || 'Semua';

    // PENAMBAHAN: filter cepat per Bulan (format value "YYYY-MM"), juga berlaku saat ekspor CSV
    let bulanFilter = document.getElementById('filter-bulan-jurnal')?.value || 'Semua';



    let data = (currentUser && currentUser.role !== 'Super Admin') ? riwayatJurnal.filter(i => i.unitUsaha === currentUser.unit) : [...riwayatJurnal];

    if (unitFilter && unitFilter !== 'Semua') data = data.filter(i => i.unitUsaha === unitFilter);

    if (tglMulai) data = data.filter(i => i.tanggal >= tglMulai);

    if (tglSelesai) data = data.filter(i => i.tanggal <= tglSelesai);

    if (bulanFilter && bulanFilter !== 'Semua') data = data.filter(i => (i.tanggal || '').slice(0, 7) === bulanFilter);

    if (arusFilter === 'Pendapatan') data = data.filter(i => getAkunInfo(i.namaKategori).arus === 'Pemasukan');

    else if (arusFilter === 'Pengeluaran') data = data.filter(i => getAkunInfo(i.namaKategori).arus === 'Pengeluaran');

    return data;

}



function filterJurnalTanggal() { renderJurnalUmum(ambilDataJurnalTerfilter()); }



// PENAMBAHAN: isi ulang opsi dropdown "Bulan" pada Jurnal Umum berdasarkan bulan-bulan yang benar-benar
// memiliki transaksi, agar sortir/filter per bulan selalu relevan dengan data yang ada.
function perbaruiOpsiBulanJurnal() {
    let sel = document.getElementById('filter-bulan-jurnal');
    if (!sel) return;
    let nilaiSaatIni = sel.value || 'Semua';
    const namaBulanArr = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    let setBulan = new Set();
    riwayatJurnal.forEach(i => { if (i.tanggal) setBulan.add(i.tanggal.slice(0, 7)); });
    let daftarBulan = Array.from(setBulan).sort().reverse();
    let html = '<option value="Semua">-- Semua Bulan --</option>';
    daftarBulan.forEach(key => {
        let [thn, bln] = key.split('-');
        let label = `${namaBulanArr[parseInt(bln, 10) - 1]} ${thn}`;
        html += `<option value="${key}">${escapeHtml(label)}</option>`;
    });
    sel.innerHTML = html;
    if (daftarBulan.includes(nilaiSaatIni) || nilaiSaatIni === 'Semua') sel.value = nilaiSaatIni;
}



// PENAMBAHAN: klik header kolom "Tanggal" pada tabel Jurnal Umum untuk membalik arah sortir (menaik/menurun)
function toggleSortJurnalTanggal() {
    jurnalSortDir = (jurnalSortDir === 'asc') ? 'desc' : 'asc';
    let ikon = document.getElementById('ikon-sort-jurnal');
    if (ikon) ikon.className = jurnalSortDir === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
    renderJurnalUmum(ambilDataJurnalTerfilter());
}



function resetFilterTanggal() {

    let u = document.getElementById('filter-unit-jurnal'); if (u) u.value = 'Semua';

    let a = document.getElementById('filter-tgl-mulai'); if (a) a.value = '';

    let b = document.getElementById('filter-tgl-selesai'); if (b) b.value = '';

    let c = document.getElementById('filter-arus-jurnal'); if (c) c.value = 'Semua';

    let d = document.getElementById('filter-bulan-jurnal'); if (d) d.value = 'Semua';

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

    let map = { 'pf-nama': 'nama', 'pf-sk': 'sk', 'pf-jabatan-awal': 'jabatanAwal', 'pf-jabatan-akhir': 'jabatanAkhir', 'pf-penasihat': 'penasihat', 'pf-pengawas': 'pengawas', 'pf-direktur': 'direktur', 'pf-sekretaris': 'sekretaris', 'pf-bendahara': 'bendahara', 'pf-kontak-wa': 'kontakWA', 'pf-kode-akses': 'kodeAkses', 'pf-kepala-desa': 'kepalaDesa', 'pf-ketua-bpd': 'ketuaBPD' };

    Object.keys(map).forEach(id => { let el = document.getElementById(id); if (el && document.activeElement !== el) el.value = profilBUMDes[map[id]] || ''; });

}



// Mengambil inisial (1-2 huruf) dari sebuah nama, untuk ditampilkan pada avatar bagan struktur
function getInisialNama(nama) {
    let bersih = (nama || '').trim();
    if (!bersih) return '?';
    let bagian = bersih.split(/\s+/).filter(Boolean);
    let inisial = bagian.slice(0, 2).map(k => k.charAt(0)).join('');
    return escapeHtml(inisial.toUpperCase() || '?');
}

// Membuat markup satu kartu/kotak pada bagan struktur kepengurusan.
// opts.tambahan = true akan menampilkan tombol Edit & Hapus (khusus anggota tambahan, bukan struktur inti).
function buatNodeOrgChart(nama, jabatan, opts) {
    opts = opts || {};
    let gaya = opts.gayaNode || '';
    let gayaAvatar = opts.gayaAvatar || '';
    let gayaTeks = opts.gayaTeks || '';
    let aksi = '';
    if (opts.tambahan) {
        aksi = `<div class="org-actions no-print">
                    <button type="button" title="Edit Anggota" onclick="bukaModalEditAnggota(${opts.index})"><i class="fas fa-pen text-primary"></i></button>
                    <button type="button" title="Hapus Anggota" onclick="hapusAnggotaPengurus(${opts.index})"><i class="fas fa-xmark text-danger"></i></button>
                </div>`;
    }
    return `<div class="org-node${opts.tambahan ? ' org-node-tambahan' : ''}" style="${gaya}">
                ${aksi}
                <div class="org-avatar" style="${gayaAvatar}">${getInisialNama(nama)}</div>
                <div class="org-name" style="${gayaTeks}">${escapeHtml(nama || '-')}</div>
                <div class="org-title">${escapeHtml(jabatan)}</div>
            </div>`;
}

function renderOrgChart() {

    let container = document.getElementById('org-chart-container');

    if (!container) return;

    let anggotaLain = Array.isArray(profilBUMDes.anggotaLain) ? profilBUMDes.anggotaLain : [];

    let liAnggotaLain = anggotaLain.map((a, idx) => `<li>${buatNodeOrgChart(a.nama, a.jabatan, { tambahan: true, index: idx })}</li>`).join('');

    container.innerHTML = `

        <ul>

            <li>

                ${buatNodeOrgChart(profilBUMDes.penasihat, 'Penasihat', {
                    gayaNode: 'background: linear-gradient(135deg, var(--accent-teal), var(--accent-teal-hover)); color:#fff;',
                    gayaAvatar: 'background: rgba(255,255,255,.25); color:#fff;',
                    gayaTeks: 'color:#fff;'
                })}

                <ul>

                    <li>${buatNodeOrgChart(profilBUMDes.pengawas, 'Pengawas')}</li>

                    <li>

                        ${buatNodeOrgChart(profilBUMDes.direktur, 'Direktur', {
                            gayaNode: 'background: var(--primary-dark); color:#fff;',
                            gayaAvatar: 'background: var(--accent-gold); color:#fff;',
                            gayaTeks: 'color:#fff;'
                        })}

                        <ul>

                            <li>${buatNodeOrgChart(profilBUMDes.sekretaris, 'Sekretaris')}</li>

                            <li>${buatNodeOrgChart(profilBUMDes.bendahara, 'Bendahara')}</li>

                            ${liAnggotaLain}

                        </ul>

                    </li>

                </ul>

            </li>

        </ul>

    `;

}

// ================= MANAJEMEN ANGGOTA PENGURUS TAMBAHAN (BAGAN STRUKTUR) =================
function bukaModalTambahAnggota() {
    document.getElementById('judul-modal-anggota').innerText = 'Tambah Anggota Pengurus';
    document.getElementById('anggota-index').value = '';
    document.getElementById('anggota-nama').value = '';
    document.getElementById('anggota-jabatan').value = '';
    new bootstrap.Modal(document.getElementById('modalAnggotaPengurus')).show();
}

function bukaModalEditAnggota(index) {
    let anggotaLain = Array.isArray(profilBUMDes.anggotaLain) ? profilBUMDes.anggotaLain : [];
    let data = anggotaLain[index];
    if (!data) return;
    document.getElementById('judul-modal-anggota').innerText = 'Edit Anggota Pengurus';
    document.getElementById('anggota-index').value = index;
    document.getElementById('anggota-nama').value = data.nama || '';
    document.getElementById('anggota-jabatan').value = data.jabatan || '';
    new bootstrap.Modal(document.getElementById('modalAnggotaPengurus')).show();
}

async function simpanAnggotaPengurus(event) {
    event.preventDefault();
    let indexRaw = document.getElementById('anggota-index').value;
    let nama = document.getElementById('anggota-nama').value.trim();
    let jabatan = document.getElementById('anggota-jabatan').value.trim();
    if (!nama || !jabatan) return;

    let anggotaLain = Array.isArray(profilBUMDes.anggotaLain) ? [...profilBUMDes.anggotaLain] : [];
    if (indexRaw === '') {
        anggotaLain.push({ nama, jabatan });
    } else {
        let idx = parseInt(indexRaw, 10);
        anggotaLain[idx] = { nama, jabatan };
    }

    profilBUMDes.anggotaLain = anggotaLain; // update tampilan secara instan (optimistic UI)
    renderOrgChart();

    let modalEl = document.getElementById('modalAnggotaPengurus');
    let modalInstance = bootstrap.Modal.getInstance(modalEl); if (modalInstance) modalInstance.hide();

    await db.collection("settings").doc("profil").set({ anggotaLain: anggotaLain }, { merge: true });
    catatLog('Profil BUMDes', `Menyimpan data anggota pengurus tambahan: ${nama} (${jabatan}).`);
    Toast.fire({ icon: 'success', title: 'Anggota pengurus berhasil disimpan!' });
}

async function hapusAnggotaPengurus(index) {
    let anggotaLain = Array.isArray(profilBUMDes.anggotaLain) ? profilBUMDes.anggotaLain : [];
    let data = anggotaLain[index];
    if (!data) return;

    let konfirmasi = await Swal.fire({
        icon: 'warning', title: 'Hapus Anggota?', text: `Hapus "${data.nama}" (${data.jabatan}) dari bagan struktur kepengurusan?`,
        showCancelButton: true, confirmButtonText: 'Ya, Hapus', cancelButtonText: 'Batal', confirmButtonColor: '#ef4444'
    });
    if (!konfirmasi.isConfirmed) return;

    let anggotaBaru = anggotaLain.filter((_, i) => i !== index);
    profilBUMDes.anggotaLain = anggotaBaru;
    renderOrgChart();

    await db.collection("settings").doc("profil").set({ anggotaLain: anggotaBaru }, { merge: true });
    catatLog('Profil BUMDes', `Menghapus anggota pengurus tambahan: ${data.nama}.`);
    Toast.fire({ icon: 'success', title: 'Anggota pengurus dihapus.' });
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

        kodeAkses: document.getElementById('pf-kode-akses').value.trim() || '1234',

        // PENAMBAHAN: pejabat Lembar Pengesahan LPJ
        kepalaDesa: document.getElementById('pf-kepala-desa')?.value.trim() || '',

        ketuaBPD: document.getElementById('pf-ketua-bpd')?.value.trim() || ''

    };

    await db.collection("settings").doc("profil").set(dataBaru, { merge: true });

    catatLog('Profil BUMDes', 'Memperbarui data profil & struktur kepengurusan BUMDes.');

    Toast.fire({ icon: 'success', title: 'Profil berhasil diperbarui!' });

}



// ================= DOKUMEN LEGAL BUMDES (AD / ART / SK / PERDES / NPWP / LAINNYA) =================
// Ikon & warna badge per kategori dokumen, dipakai saat merender daftar arsip berkas.
const KATEGORI_DOKUMEN_INFO = {
    'AD':      { warna: '#0d9488', label: 'Anggaran Dasar' },
    'ART':     { warna: '#0f766e', label: 'Anggaran Rumah Tangga' },
    'SK':      { warna: '#d97706', label: 'Surat Keputusan' },
    'Perdes':  { warna: '#7c3aed', label: 'Peraturan Desa' },
    'NPWP':    { warna: '#2563eb', label: 'NPWP / Legalitas' },
    'Lainnya': { warna: '#64748b', label: 'Dokumen Lainnya' }
};

function ikonTipeFile(namaFile) {
    let ext = (namaFile || '').split('.').pop().toLowerCase();
    if (ext === 'pdf') return 'fa-file-pdf';
    if (['doc', 'docx'].includes(ext)) return 'fa-file-word';
    if (['jpg', 'jpeg', 'png'].includes(ext)) return 'fa-file-image';
    return 'fa-file-lines';
}

function formatUkuranFile(bytes) {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function uploadDokumenBUMDes(event) {
    event.preventDefault();
    let kategori = document.getElementById('dok-kategori').value;
    let judul = document.getElementById('dok-judul').value.trim();
    let fileInput = document.getElementById('dok-file');
    let file = fileInput.files[0];

    if (!file) { Swal.fire({ icon: 'warning', title: 'Pilih Berkas', text: 'Silakan pilih file yang akan diunggah.' }); return; }
    if (file.size > 5 * 1024 * 1024) { Swal.fire({ icon: 'error', title: 'Ukuran Terlalu Besar', text: 'Ukuran berkas maksimal 5MB.' }); return; }

    let tombolSubmit = document.getElementById('btn-upload-dokumen');
    let teksAsli = tombolSubmit.innerHTML;
    tombolSubmit.disabled = true;
    tombolSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Mengunggah...';

    try {
        let namaAman = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        let storagePath = `dokumen-legal/${Date.now()}_${namaAman}`;
        let ref = storageBumdes.ref().child(storagePath);
        await ref.put(file);
        let url = await ref.getDownloadURL();

        await db.collection("dokumenLegal").add({
            kategori: kategori,
            judul: judul || file.name,
            namaFile: file.name,
            ukuran: file.size,
            url: url,
            storagePath: storagePath,
            uploadedBy: currentUser ? currentUser.name : '-',
            waktu: new Date().toLocaleString('id-ID'),
            waktuUnix: Date.now()
        });

        catatLog('Dokumen Legal', `Mengunggah berkas "${judul || file.name}" (${kategori}).`);
        Toast.fire({ icon: 'success', title: 'Berkas berhasil diunggah!' });
        event.target.reset();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Gagal Mengunggah', text: err.message });
    } finally {
        tombolSubmit.disabled = false;
        tombolSubmit.innerHTML = teksAsli;
    }
}

function renderDokumenLegal() {
    let container = document.getElementById('container-dokumen-legal');
    if (!container) return;

    let filterKategori = document.getElementById('filter-kategori-dokumen');
    let kategoriTerpilih = filterKategori ? filterKategori.value : 'Semua';

    let dataTampil = kategoriTerpilih === 'Semua' ? dokumenLegalData : dokumenLegalData.filter(d => d.kategori === kategoriTerpilih);
    let isAdmin = currentUser && currentUser.role === 'Super Admin';

    if (dataTampil.length === 0) {
        container.innerHTML = `<div class="col-12 text-center text-muted py-5"><i class="fas fa-folder-open fa-2x mb-2 d-block"></i>Belum ada berkas yang diunggah${kategoriTerpilih !== 'Semua' ? ' pada kategori ini' : ''}.</div>`;
        return;
    }

    container.innerHTML = dataTampil.map(d => {
        let info = KATEGORI_DOKUMEN_INFO[d.kategori] || KATEGORI_DOKUMEN_INFO['Lainnya'];
        let tombolHapus = isAdmin ? `<button type="button" class="btn btn-sm btn-outline-danger" title="Hapus" onclick="hapusDokumenLegal('${d.docId}', '${(d.storagePath || '').replace(/'/g, "\\'")}', '${escapeHtml(d.judul).replace(/'/g, "\\'")}')"><i class="fas fa-trash"></i></button>` : '';
        return `
            <div class="col-12 col-md-6">
                <div class="dokumen-card h-100">
                    <div class="dokumen-icon" style="background:${info.warna};"><i class="fas ${ikonTipeFile(d.namaFile)}"></i></div>
                    <div class="flex-grow-1" style="min-width:0;">
                        <span class="dokumen-badge-kategori text-white mb-1 d-inline-block" style="background:${info.warna};">${escapeHtml(info.label)}</span>
                        <div class="fw-bold text-dark text-truncate" title="${escapeHtml(d.judul)}">${escapeHtml(d.judul)}</div>
                        <small class="text-muted d-block text-truncate">${escapeHtml(d.namaFile)} &bull; ${formatUkuranFile(d.ukuran)}</small>
                        <small class="text-muted d-block" style="font-size:0.68rem;">Diunggah: ${escapeHtml(d.waktu || '-')}</small>
                    </div>
                    <div class="d-flex flex-column gap-1 no-print">
                        <a href="${d.url}" target="_blank" rel="noopener" class="btn btn-sm btn-success" title="Unduh / Lihat Berkas"><i class="fas fa-download"></i></a>
                        ${tombolHapus}
                    </div>
                </div>
            </div>`;
    }).join('');
}

async function hapusDokumenLegal(docId, storagePath, judul) {
    let konfirmasi = await Swal.fire({
        icon: 'warning', title: 'Hapus Berkas?', text: `Berkas "${judul}" akan dihapus permanen dari arsip BUMDes.`,
        showCancelButton: true, confirmButtonText: 'Ya, Hapus', cancelButtonText: 'Batal', confirmButtonColor: '#ef4444'
    });
    if (!konfirmasi.isConfirmed) return;

    try {
        await db.collection("dokumenLegal").doc(docId).delete();
        if (storagePath) { try { await storageBumdes.ref().child(storagePath).delete(); } catch (e) { console.warn('Gagal hapus file di storage:', e.message); } }
        catatLog('Dokumen Legal', `Menghapus berkas "${judul}".`);
        Toast.fire({ icon: 'success', title: 'Berkas berhasil dihapus.' });
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Gagal Menghapus', text: err.message });
    }
}

// ================= BACKUP & RESTORE (EXCEL / XLSX) =================

function backupDatabaseExcel() {

    try {

        let wb = XLSX.utils.book_new();

        let sheetJurnal = riwayatJurnal.map(j => ({
            tanggal: j.tanggal || '', unitUsaha: j.unitUsaha || '', keterangan: j.keterangan || '',
            namaKategori: j.namaKategori || '', nominal: j.nominal || 0
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetJurnal), "Jurnal Umum");

        let sheetUnit = unitUsahaData.map(u => ({
            nama: u.nama || '', pengelola: u.pengelola || '', jabatan: u.jabatan || 'Pengelola Unit', icon: u.icon || 'fa-store'
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetUnit), "Unit Usaha");

        let sheetAset = asetTetapData.map(a => ({
            nama: a.nama || '', jumlah: a.jumlah || 1, unit: a.unit || '', tahun: a.tahun || '', harga: a.harga || 0,
            masaManfaat: a.masaManfaat || 0, susutPerTahun: a.susutPerTahun || 0
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetAset), "Aset Tetap");

        let sheetModal = historiModalData.map(m => ({
            tahun: m.tahun || '', sumber: m.sumber || '', keterangan: m.keterangan || '', nominal: m.nominal || 0
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetModal), "Modal Desa");

        let sheetProfil = [{
            nama: profilBUMDes.nama || '', sk: profilBUMDes.sk || '',
            jabatanAwal: profilBUMDes.jabatanAwal || '', jabatanAkhir: profilBUMDes.jabatanAkhir || '',
            penasihat: profilBUMDes.penasihat || '', pengawas: profilBUMDes.pengawas || '',
            direktur: profilBUMDes.direktur || '', sekretaris: profilBUMDes.sekretaris || '',
            bendahara: profilBUMDes.bendahara || '', kontakWA: profilBUMDes.kontakWA || '',
            alamat: profilBUMDes.alamat || '', kodeAkses: profilBUMDes.kodeAkses || ''
        }];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetProfil), "Profil BUMDes");

        let tglFile = new Date().toISOString().slice(0, 10);
        let namaFile = `Backup_SIAK_BUMDes_${(profilBUMDes.nama || 'Data').replace(/[^a-zA-Z0-9]/g, '_')}_${tglFile}.xlsx`;
        XLSX.writeFile(wb, namaFile);

        catatLog('Backup Database', `Mengunduh backup seluruh data BUMDes (${namaFile}).`);
        Toast.fire({ icon: 'success', title: 'Backup berhasil diunduh!' });

    } catch (err) {

        Swal.fire({ icon: 'error', title: 'Gagal Membuat Backup', text: err.message });

    }

}

// ================= RESTORE DATABASE (EXCEL / XLSX) =================
async function restoreDatabaseExcel() {

    let inputFile = document.getElementById('input-file-restore');
    let file = inputFile && inputFile.files && inputFile.files[0];

    if (!file) {
        Swal.fire({ icon: 'warning', title: 'Belum Ada File', text: 'Silakan pilih file backup Excel (.xlsx) terlebih dahulu.' });
        return;
    }

    let konfirmasi = await Swal.fire({
        icon: 'warning', title: 'Pulihkan Data dari Backup?',
        text: 'Seluruh data pada file akan ditambahkan ke database cloud. Pastikan file backup ini valid dan berasal dari SIAK BUMDes.',
        showCancelButton: true, confirmButtonText: 'Ya, Pulihkan', cancelButtonText: 'Batal', confirmButtonColor: '#ef4444'
    });
    if (!konfirmasi.isConfirmed) return;

    Swal.fire({ title: 'Memulihkan Data...', text: 'Mohon tunggu, sedang memproses file backup...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {

        let data = await file.arrayBuffer();
        let workbook = XLSX.read(data, { type: 'array' });
        let totalDipulihkan = 0;

        if (workbook.SheetNames.includes('Jurnal Umum')) {
            let rows = XLSX.utils.sheet_to_json(workbook.Sheets['Jurnal Umum']);
            for (let r of rows) {
                if (!r.tanggal || !r.namaKategori) continue;
                await db.collection("jurnal").add({
                    tanggal: String(r.tanggal), unitUsaha: r.unitUsaha || 'Semua',
                    keterangan: r.keterangan || '-', namaKategori: r.namaKategori,
                    nominal: parseFloat(r.nominal) || 0
                });
                totalDipulihkan++;
            }
        }

        if (workbook.SheetNames.includes('Unit Usaha')) {
            let rows = XLSX.utils.sheet_to_json(workbook.Sheets['Unit Usaha']);
            for (let r of rows) {
                if (!r.nama) continue;
                await db.collection("units").add({
                    nama: r.nama, pengelola: r.pengelola || '-',
                    jabatan: r.jabatan || 'Pengelola Unit', icon: r.icon || 'fa-store'
                });
                totalDipulihkan++;
            }
        }

        if (workbook.SheetNames.includes('Aset Tetap')) {
            let rows = XLSX.utils.sheet_to_json(workbook.Sheets['Aset Tetap']);
            for (let r of rows) {
                if (!r.nama) continue;
                await db.collection("asets").add({
                    nama: r.nama, unit: r.unit || 'Semua', tahun: r.tahun || '',
                    harga: parseFloat(r.harga) || 0, masaManfaat: parseFloat(r.masaManfaat) || 0,
                    susutPerTahun: parseFloat(r.susutPerTahun) || 0, jumlah: parseInt(r.jumlah) || 1
                });
                totalDipulihkan++;
            }
        }

        if (workbook.SheetNames.includes('Modal Desa')) {
            let rows = XLSX.utils.sheet_to_json(workbook.Sheets['Modal Desa']);
            for (let r of rows) {
                if (!r.tahun) continue;
                await db.collection("modals").add({
                    tahun: r.tahun, sumber: r.sumber || 'Pemerintah Desa',
                    keterangan: r.keterangan || '-', nominal: parseFloat(r.nominal) || 0
                });
                totalDipulihkan++;
            }
        }

        if (workbook.SheetNames.includes('Profil BUMDes')) {
            let rows = XLSX.utils.sheet_to_json(workbook.Sheets['Profil BUMDes']);
            if (rows.length > 0) {
                let p = rows[0];
                let dataProfil = {};
                ['nama','sk','jabatanAwal','jabatanAkhir','penasihat','pengawas','direktur','sekretaris','bendahara','kontakWA','alamat','kodeAkses'].forEach(k => {
                    if (p[k] !== undefined && p[k] !== '') dataProfil[k] = String(p[k]);
                });
                if (Object.keys(dataProfil).length > 0) {
                    await db.collection("settings").doc("profil").set(dataProfil, { merge: true });
                }
            }
        }

        catatLog('Restore Database', `Memulihkan ${totalDipulihkan} data dari file backup Excel (${file.name}).`);
        Swal.fire({ icon: 'success', title: 'Restore Berhasil!', text: `${totalDipulihkan} data berhasil dipulihkan ke database.` });
        inputFile.value = '';

    } catch (err) {

        Swal.fire({ icon: 'error', title: 'Gagal Memulihkan Data', text: err.message });

    }

}

// =========================================================================
// 7. INISIALISASI APLIKASI SAAT HALAMAN DIMUAT (PERBAIKAN SESI LOGIN)
// =========================================================================
// PERBAIKAN: fungsi injectModals() (lihat bagian atas file) sebelumnya sudah
// didefinisikan tapi TIDAK PERNAH DIPANGGIL di mana pun, sehingga 6 modal
// (Tambah Unit Usaha, Edit Unit, Tambah Akun Akses Unit, Tambah Aset Tetap,
// Setor Modal Desa, Tambah/Edit Anggota Pengurus) tidak pernah ada di DOM
// dan tombolnya selalu gagal saat diklik. Ini juga membuat listener auto-format
// ribuan pada semua input ".input-rupiah" (termasuk input nominal transaksi
// utama) tidak pernah terpasang. Baris ini mengaktifkannya sejak awal.
injectModals();

// PERBAIKAN: Sebelumnya, sesi yang tersimpan di sessionStorage (variabel currentUser)
// tidak pernah diterapkan ke tampilan saat halaman dibuka/di-refresh, sehingga layar
// login selalu tampil ulang meski pengguna sudah pernah berhasil masuk. Baris berikut
// memastikan status login/logout langsung sinkron dengan tampilan sejak awal.
inisialisasiSistemAkses();
