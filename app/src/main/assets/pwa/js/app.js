import { Icons, mountainBannerSvg } from './icons.js';
import {
  getUser,
  saveUser,
  logoutUser,
  getHikes,
  addHike,
  getActiveAscent,
  setActiveAscent,
  savePhoto,
  getPhoto,
  clearAllAppData,
  clearModelRecord,
  getDashboardStats
} from './storage.js';
import {
  WASTE_CLASSES,
  runYoloDetection,
  drawDetectionsOnCanvas,
  buildClassCounts,
  calculateTotals,
  getModelStatus,
  importOnnxFile
} from './yolo.js';

const state = {
  view: 'login', // 'login' | 'dashboard' | 'prep' | 'camera' | 'review' | 'result'
  tab: 'dashboard', // 'dashboard' | 'riwayat' | 'badge' | 'profil'
  authMode: 'login', // 'login' | 'register'
  showPassword: false,
  loginEmail: '',
  loginName: '',
  chartRange: '6m', // '6m' | 'all'
  docMode: 'naik', // 'naik' | 'turun'
  mountainName: '',
  facingMode: 'environment',
  torchOn: false,
  zoomLevel: 1,
  cameraStream: null,
  cameraError: null,
  capturedDataUrl: null,
  isDetecting: false,
  detectionResult: null,
  counts: buildClassCounts([], {}),
  modelStatus: { ready: false, source: 'checking' },
  isOnline: navigator.onLine,
  swReady: false,
  deferredInstallPrompt: null
};

const appEl = document.getElementById('app');
const toastRoot = document.getElementById('toast-root');
const modalRoot = document.getElementById('modal-root');

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatKg(kg) {
  return Number(kg || 0).toFixed(1).replace('.', ',');
}

function formatDateId(iso) {
  try {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return iso || '-';
  }
}

function showToast(message, type = 'dark') {
  const el = document.createElement('div');
  const bg =
    type === 'error'
      ? 'bg-[#B91C1C] text-white'
      : type === 'success'
      ? 'bg-[#1B3B2B] text-[#C5E898]'
      : 'bg-[#16261E] text-white';
  el.className = `${bg} px-4 py-3 rounded-2xl shadow-lg text-xs font-semibold flex items-center justify-between gap-2 pointer-events-auto view-enter`;
  el.innerHTML = `<span>${escapeHtml(message)}</span>`;
  toastRoot.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.2s ease';
    setTimeout(() => el.remove(), 220);
  }, 3000);
}

function closeModal() {
  modalRoot.classList.add('hidden');
  modalRoot.innerHTML = '';
}

function openModal(htmlContent) {
  modalRoot.innerHTML = `
    <div id="modal-backdrop" class="w-full h-full bg-black/45 flex items-end sm:items-center justify-center p-4">
      <div class="w-full max-w-[400px] bg-white rounded-3xl p-5 shadow-2xl view-enter max-h-[85vh] overflow-y-auto">
        ${htmlContent}
      </div>
    </div>
  `;
  modalRoot.classList.remove('hidden');
  const backdrop = document.getElementById('modal-backdrop');
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });
  modalRoot.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', closeModal);
  });
}

function stopCameraStream() {
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach((track) => track.stop());
    state.cameraStream = null;
  }
  state.torchOn = false;
}

function navigateTo(view, options = {}) {
  if (state.view === 'camera' && view !== 'camera') {
    stopCameraStream();
  }
  Object.assign(state, options);
  state.view = view;
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// Expose back handler for Android WebView BackHandler
window.huluNavigateBack = () => {
  if (!modalRoot.classList.contains('hidden')) {
    closeModal();
    return true;
  }
  if (state.view === 'result') {
    navigateTo('review');
    return true;
  }
  if (state.view === 'review') {
    navigateTo('prep');
    return true;
  }
  if (state.view === 'camera') {
    navigateTo('prep');
    return true;
  }
  if (state.view === 'prep') {
    navigateTo('dashboard');
    return true;
  }
  if (state.view === 'dashboard' && state.tab !== 'dashboard') {
    state.tab = 'dashboard';
    render();
    return true;
  }
  return false;
};

function renderStepper(activeStep) {
  const steps = [
    { num: 1, label: '1 Foto barang' },
    { num: 2, label: '2 Tinjau' },
    { num: 3, label: '3 Simpan' }
  ];
  return `
    <div class="grid grid-cols-3 gap-2 my-3">
      ${steps
        .map((s) => {
          const isActive = s.num === activeStep;
          const isDone = s.num < activeStep;
          return `
            <div class="h-9 rounded-full flex items-center justify-center text-[11px] font-semibold px-2 transition-colors ${
              isActive
                ? 'bg-[#1B3B2B] text-white shadow-sm'
                : isDone
                ? 'bg-[#C5E898]/55 text-[#1B3B2B]'
                : 'bg-[#EDF4E8] text-[#5C6B63]'
            }">
              <span class="truncate">${s.label}</span>
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}

/* ==================== 1. LOGIN VIEW ==================== */
function renderLoginView() {
  const isRegister = state.authMode === 'register';
  appEl.innerHTML = `
    <div class="flex-1 flex flex-col px-6 pt-5 pb-7 safe-top safe-bottom view-enter bg-[#F8FAF7]">
      <!-- Top Header -->
      <header class="flex items-start justify-between mb-4">
        <div>
          <h1 class="text-[22px] font-extrabold tracking-tight text-[#1B3B2B] leading-none">hulu guard</h1>
          <p class="text-[9px] font-semibold tracking-[0.12em] text-[#5C6B63] mt-1 uppercase">JAGA ALAM, JAGA LANGKAH.</p>
        </div>
        <span class="px-3 py-1 rounded-full bg-[#EDF4E8] border border-[#DCE7D6] text-[10px] font-bold tracking-wider text-[#5C6B63]">
          PENDAKI
        </span>
      </header>

      <!-- Mountain Illustration Banner -->
      <div class="w-full h-[152px] rounded-2xl overflow-hidden border border-[#E2EAE0] shadow-sm mb-6">
        ${mountainBannerSvg()}
      </div>

      <!-- Greeting -->
      <div class="mb-5">
        <h2 class="text-[22px] font-bold text-[#16261E] tracking-tight">
          ${isRegister ? 'Buat akun pendaki' : 'Selamat datang kembali'}
        </h2>
        <p class="text-[13px] text-[#5C6B63] mt-1 leading-relaxed">
          ${
            isRegister
              ? 'Daftar untuk mulai mencatat bawaan dan menjaga kebersihan jalur pendakian.'
              : 'Masuk dan mulai langkah baikmu untuk gunung yang lebih bersih.'
          }
        </p>
      </div>

      <!-- Auth Form -->
      <form id="login-form" class="flex flex-col gap-3.5">
        ${
          isRegister
            ? `
          <div>
            <label for="input-name" class="block text-xs font-semibold text-[#16261E] mb-1.5">Nama pendaki</label>
            <div class="relative flex items-center bg-white border border-[#DCE5DA] rounded-2xl px-3.5 h-12 focus-within:border-[#1B3B2B]">
              <span class="text-[#5C6B63] mr-2.5">${Icons.user('w-4 h-4')}</span>
              <input id="input-name" type="text" required placeholder="Masukkan nama lengkap"
                value="${escapeHtml(state.loginName)}"
                class="w-full bg-transparent text-sm text-[#16261E] placeholder-[#94A39B] outline-none" />
            </div>
          </div>`
            : ''
        }

        <div>
          <label for="input-email" class="block text-xs font-semibold text-[#16261E] mb-1.5">Email</label>
          <div class="relative flex items-center bg-white border border-[#DCE5DA] rounded-2xl px-3.5 h-12 focus-within:border-[#1B3B2B]">
            <span class="text-[#5C6B63] mr-2.5">${Icons.mail('w-4 h-4')}</span>
            <input id="input-email" type="email" required placeholder="Masukkan email kamu"
              value="${escapeHtml(state.loginEmail)}"
              class="w-full bg-transparent text-sm text-[#16261E] placeholder-[#94A39B] outline-none" />
          </div>
        </div>

        <div>
          <label for="input-password" class="block text-xs font-semibold text-[#16261E] mb-1.5">Kata sandi</label>
          <div class="relative flex items-center bg-white border border-[#DCE5DA] rounded-2xl px-3.5 h-12 focus-within:border-[#1B3B2B]">
            <span class="text-[#5C6B63] mr-2.5">${Icons.lock('w-4 h-4')}</span>
            <input id="input-password" type="${state.showPassword ? 'text' : 'password'}" required minlength="4"
              placeholder="Masukkan kata sandi"
              class="w-full bg-transparent text-sm text-[#16261E] placeholder-[#94A39B] outline-none" />
            <button type="button" id="toggle-password" aria-label="Tampilkan kata sandi"
              class="text-[#5C6B63] p-2 -mr-2 tap-target flex items-center justify-center">
              ${state.showPassword ? Icons.eyeOff('w-4 h-4') : Icons.eye('w-4 h-4')}
            </button>
          </div>
          ${
            !isRegister
              ? `<div class="flex justify-end mt-1.5">
                  <button type="button" id="forgot-password-btn" class="text-xs font-semibold text-[#1B3B2B] py-1">
                    Lupa kata sandi?
                  </button>
                </div>`
              : ''
          }
        </div>

        <button type="submit"
          class="mt-1 w-full h-13 py-3.5 rounded-2xl bg-[#1B3B2B] hover:bg-[#142C20] active:scale-[0.99] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all tap-target">
          <span>${isRegister ? 'Daftar & Masuk' : 'Masuk'}</span>
          ${Icons.arrowRight('w-4 h-4')}
        </button>
      </form>

      <div class="text-center mt-4 text-xs text-[#5C6B63]">
        ${isRegister ? 'Sudah punya akun?' : 'Belum punya akun?'}
        <button type="button" id="switch-auth-mode" class="font-bold text-[#1B3B2B] ml-1 py-1">
          ${isRegister ? 'Masuk di sini' : 'Daftar sekarang'}
        </button>
      </div>

      <!-- Footer -->
      <footer class="mt-auto pt-6 border-t border-[#E6ECE4] text-center">
        <p class="text-xs font-bold text-[#16261E]">Bawa turun sampahmu.</p>
        <p class="text-[11px] text-[#5C6B63] mt-0.5">Foto barangmu. Kenali sampahmu. Jaga gunungmu.</p>
      </footer>
    </div>
  `;

  document.getElementById('toggle-password')?.addEventListener('click', () => {
    state.showPassword = !state.showPassword;
    state.loginEmail = document.getElementById('input-email')?.value || '';
    state.loginName = document.getElementById('input-name')?.value || '';
    renderLoginView();
  });

  document.getElementById('switch-auth-mode')?.addEventListener('click', () => {
    state.authMode = isRegister ? 'login' : 'register';
    renderLoginView();
  });

  document.getElementById('forgot-password-btn')?.addEventListener('click', () => {
    showToast('Aplikasi ini berjalan offline di perangkatmu. Gunakan email untuk masuk.', 'success');
  });

  document.getElementById('login-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('input-email').value.trim();
    const nameInput = document.getElementById('input-name')?.value.trim();
    const derivedName =
      nameInput ||
      email
        .split('@')[0]
        .replace(/[._-]+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase()) ||
      'Pendaki Nusantara';

    saveUser({
      email,
      name: derivedName,
      loggedInAt: new Date().toISOString()
    });
    showToast(`Selamat datang, ${derivedName}!`, 'success');
    navigateTo('dashboard', { tab: 'dashboard' });
  });
}

/* ==================== 2. DASHBOARD + BOTTOM NAV ==================== */
function renderBottomNav() {
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: Icons.dashboard },
    { id: 'riwayat', label: 'Riwayat', icon: Icons.history },
    { id: 'badge', label: 'Badge', icon: Icons.badge },
    { id: 'profil', label: 'Profil', icon: Icons.user }
  ];

  return `
    <nav class="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white/95 backdrop-blur-md border-t border-[#E6ECE4] px-3 pt-2 pb-2 safe-bottom z-30">
      <div class="grid grid-cols-4 gap-1">
        ${items
          .map((item) => {
            const active = state.tab === item.id;
            return `
              <button type="button" data-nav-tab="${item.id}"
                class="flex flex-col items-center justify-center py-1.5 rounded-2xl transition-colors tap-target ${
                  active ? 'text-[#1B3B2B]' : 'text-[#73827A]'
                }">
                <div class="w-10 h-7 rounded-full flex items-center justify-center ${
                  active ? 'bg-[#EDF4E8]' : ''
                }">
                  ${item.icon('w-5 h-5')}
                </div>
                <span class="text-[11px] mt-0.5 ${active ? 'font-bold' : 'font-medium'}">${item.label}</span>
              </button>
            `;
          })
          .join('')}
      </div>
    </nav>
  `;
}

function renderDashboardHome(stats, activeAscent) {
  const maxBar = Math.max(3, ...stats.monthly.map((m) => m.count));

  return `
    <div class="px-5 pt-2 pb-28 view-enter">
      <!-- Headline -->
      <div class="mb-4">
        <h2 class="text-[21px] font-extrabold text-[#16261E] tracking-tight leading-snug">
          Jejak baikmu dimulai di sini.
        </h2>
        <p class="text-[13px] text-[#5C6B63] mt-0.5">Setiap langkah, berarti untuk alam.</p>
      </div>

      <!-- 2 Stat Cards -->
      <div class="grid grid-cols-2 gap-3 mb-4">
        <div class="bg-[#1B3B2B] text-white rounded-[22px] p-4 flex flex-col justify-between min-h-[112px] shadow-sm">
          <div class="flex items-center justify-between">
            <span class="text-[#C5E898]">${Icons.mountain('w-5 h-5')}</span>
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-[#C5E898]">2026</span>
          </div>
          <div class="mt-3 flex items-baseline gap-2">
            <span class="text-[32px] font-extrabold leading-none">${stats.totalHikes}</span>
            <span class="text-xs text-[#DCE7D6] font-medium">Pendakian</span>
          </div>
        </div>

        <div class="bg-[#EDF4E8] text-[#16261E] rounded-[22px] p-4 flex flex-col justify-between min-h-[112px] border border-[#DCE7D6]">
          <div class="flex items-center gap-1.5 text-[#1B3B2B]">
            ${Icons.trash('w-4 h-4')}
            <span class="text-[12px] font-semibold">Sampah terkumpul</span>
          </div>
          <div class="mt-3 flex items-baseline gap-1">
            <span class="text-[30px] font-extrabold leading-none">${formatKg(stats.totalWasteKg)}</span>
            <span class="text-sm font-bold text-[#5C6B63]">kg</span>
          </div>
        </div>
      </div>

      <!-- Bar Chart Card: Aktivitas pendakian (Jun - Nov 2026) -->
      <div class="bg-white rounded-[24px] p-4 border border-[#E6ECE4] shadow-sm mb-5">
        <div class="flex items-start justify-between mb-3">
          <div>
            <h3 class="text-[15px] font-bold text-[#16261E]">Aktivitas pendakian</h3>
            <p class="text-xs text-[#5C6B63] mt-0.5">${stats.totalHikes} pendakian &bull; Jun – Nov 2026</p>
          </div>
          <button type="button" id="chart-range-btn"
            class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#F3F6F1] border border-[#E2EAE0] text-[11px] font-semibold text-[#16261E]">
            <span>${state.chartRange === '6m' ? '6 bulan' : 'Semua'}</span>
            ${Icons.chevronDown('w-3.5 h-3.5')}
          </button>
        </div>

        <div class="flex items-end gap-2 pt-2">
          <!-- Y Axis -->
          <div class="flex flex-col justify-between h-[126px] pb-6 text-[10px] text-[#7D8C83] font-medium pr-1">
            <span>${maxBar}</span>
            <span>${Math.ceil(maxBar * 0.66)}</span>
            <span>${Math.max(1, Math.floor(maxBar * 0.33))}</span>
            <span>0</span>
          </div>

          <!-- Bars -->
          <div class="flex-1 grid grid-cols-6 gap-2 items-end h-[126px]">
            ${stats.monthly
              .map((m) => {
                const barHeightPx = m.count === 0 ? 6 : Math.max(16, Math.round((m.count / maxBar) * 86));
                const barColor =
                  m.count === 0
                    ? 'bg-[#EDF4E8]'
                    : m.isCurrent
                    ? 'bg-[#1B3B2B]'
                    : 'bg-[#BED7A7]';
                return `
                  <div class="flex flex-col items-center justify-end h-full">
                    <span class="text-[11px] font-bold ${m.count > 0 ? 'text-[#16261E]' : 'text-[#8C9B92]'} mb-1">${m.count}</span>
                    <div class="w-full max-w-[30px] rounded-t-xl ${barColor} transition-all duration-300" style="height:${barHeightPx}px"></div>
                    <span class="text-[11px] mt-1.5 ${m.isCurrent ? 'font-bold text-[#1B3B2B]' : 'text-[#5C6B63]'}">${m.label}</span>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>
      </div>

      <!-- Badge Kamu Carousel -->
      <div class="mb-5">
        <div class="flex items-center justify-between mb-2.5">
          <h3 class="text-[15px] font-bold text-[#16261E]">Badge kamu</h3>
          <button type="button" data-nav-tab="badge" class="text-xs font-semibold text-[#5C6B63]">
            ${stats.unlockedCount} diraih
          </button>
        </div>

        <div class="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
          ${stats.badges
            .map((b) => {
              const iconFn = Icons[b.icon] || Icons.badge;
              return `
                <div class="min-w-[116px] flex-shrink-0 rounded-2xl p-3 border text-center transition-all ${
                  b.unlocked
                    ? 'bg-white border-[#DCE7D6] shadow-sm'
                    : 'bg-[#F2F5F0] border-[#E6ECE4] opacity-75'
                }">
                  <div class="w-10 h-10 mx-auto rounded-full flex items-center justify-center mb-2 ${
                    b.unlocked ? 'bg-[#C5E898]/55 text-[#1B3B2B]' : 'bg-[#E2EAE0] text-[#5C6B63]'
                  }">
                    ${iconFn('w-5 h-5')}
                  </div>
                  <p class="text-xs font-bold text-[#16261E] truncate">${b.title}</p>
                  <p class="text-[10px] text-[#5C6B63] mt-0.5 truncate">${b.subtitle}</p>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>

      <!-- CTA Card -->
      <div class="bg-[#1B3B2B] rounded-[24px] p-5 text-white shadow-md">
        ${
          activeAscent
            ? `
              <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#C5E898]/20 text-[#C5E898] text-[10px] font-bold mb-2">
                <span class="w-1.5 h-1.5 rounded-full bg-[#C5E898] pulse-dot"></span>
                Sedang mendaki &bull; ${escapeHtml(activeAscent.mountainName || 'Gunung')}
              </div>
              <h3 class="text-[17px] font-bold leading-snug">Sudah turun gunung?</h3>
              <p class="text-xs text-[#D3E0D6] mt-1 mb-4">
                Foto ulang sampahmu untuk mencocokkan ${activeAscent.totalItems} item yang dibawa naik.
              </p>
            `
            : `
              <h3 class="text-[17px] font-bold leading-snug">Siap mendaki lagi?</h3>
              <p class="text-xs text-[#D3E0D6] mt-1 mb-4">Catat barang bawaan &amp; sampahmu sebelum berangkat.</p>
            `
        }
        <button type="button" id="cta-start-photo"
          class="w-full h-12 rounded-2xl bg-[#C5E898] hover:bg-[#b8e085] active:scale-[0.99] text-[#16261E] font-bold text-sm flex items-center justify-between px-4 transition-all tap-target">
          <span class="w-5"></span>
          <span class="inline-flex items-center gap-2">
            ${Icons.camera('w-4 h-4')}
            <span>Mulai foto</span>
          </span>
          ${Icons.arrowRight('w-4 h-4')}
        </button>
      </div>
    </div>
  `;
}

function renderHistoryTab(hikes, activeAscent) {
  return `
    <div class="px-5 pt-2 pb-28 view-enter">
      <div class="mb-4">
        <h2 class="text-[21px] font-extrabold text-[#16261E]">Riwayat pendakian</h2>
        <p class="text-xs text-[#5C6B63] mt-0.5">Rekam jejak bawaan naik &amp; verifikasi sampah turun.</p>
      </div>

      ${
        activeAscent
          ? `
            <div class="bg-[#1B3B2B] text-white rounded-2xl p-4 mb-4">
              <div class="flex items-center justify-between mb-1">
                <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#C5E898] text-[#16261E]">Aktif &bull; Naik</span>
                <span class="text-[11px] text-[#DCE7D6]">${formatDateId(activeAscent.dateIso)}</span>
              </div>
              <p class="text-sm font-bold mt-2">${escapeHtml(activeAscent.mountainName || 'Pendakian Aktif')}</p>
              <p class="text-xs text-[#DCE7D6] mt-0.5">${activeAscent.totalItems} item kemasan (${formatKg(activeAscent.totalWeightKg)} kg) tercatat naik.</p>
              <button type="button" id="resume-descent-btn"
                class="mt-3 w-full py-2.5 rounded-xl bg-[#C5E898] text-[#16261E] text-xs font-bold flex items-center justify-center gap-1.5 tap-target">
                ${Icons.camera('w-4 h-4')}
                <span>Verifikasi sampah turun</span>
              </button>
            </div>
          `
          : ''
      }

      ${
        hikes.length === 0
          ? `
            <div class="bg-white rounded-3xl p-8 border border-[#E6ECE4] text-center">
              <div class="w-12 h-12 rounded-2xl bg-[#EDF4E8] text-[#1B3B2B] flex items-center justify-center mx-auto mb-3">
                ${Icons.history('w-6 h-6')}
              </div>
              <p class="text-sm font-bold text-[#16261E]">Belum ada riwayat selesai</p>
              <p class="text-xs text-[#5C6B63] mt-1 mb-4">Mulai dokumentasi sebelum mendaki, lalu cocokkan saat turun gunung.</p>
              <button type="button" id="empty-start-btn"
                class="px-5 py-2.5 rounded-xl bg-[#1B3B2B] text-white text-xs font-semibold tap-target">
                Mulai dokumentasi
              </button>
            </div>
          `
          : `
            <div class="flex flex-col gap-3">
              ${hikes
                .map(
                  (h) => `
                  <button type="button" data-hike-detail="${escapeHtml(h.id)}"
                    class="w-full text-left bg-white rounded-2xl p-4 border border-[#E6ECE4] shadow-sm active:scale-[0.99] transition-all">
                    <div class="flex items-start justify-between gap-2">
                      <div>
                        <p class="text-sm font-bold text-[#16261E]">${escapeHtml(h.mountainName || 'Pendakian Gunung')}</p>
                        <p class="text-[11px] text-[#5C6B63] mt-0.5">${formatDateId(h.dateIso)}</p>
                      </div>
                      <span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        h.compliant
                          ? 'bg-[#C5E898]/60 text-[#1B3B2B]'
                          : 'bg-amber-100 text-amber-900'
                      }">
                        ${h.compliant ? '100% Dibawa Turun' : `${h.compliancePct}% Patuh`}
                      </span>
                    </div>
                    <div class="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-[#F0F4EE] text-center">
                      <div>
                        <p class="text-[10px] text-[#5C6B63]">Naik</p>
                        <p class="text-xs font-bold text-[#16261E]">${h.ascentTotalItems} item</p>
                      </div>
                      <div>
                        <p class="text-[10px] text-[#5C6B63]">Turun</p>
                        <p class="text-xs font-bold text-[#16261E]">${h.descentTotalItems} item</p>
                      </div>
                      <div>
                        <p class="text-[10px] text-[#5C6B63]">Estimasi</p>
                        <p class="text-xs font-bold text-[#1B3B2B]">${formatKg(h.descentWeightKg)} kg</p>
                      </div>
                    </div>
                  </button>
                `
                )
                .join('')}
            </div>
          `
      }
    </div>
  `;
}

function renderBadgesTab(stats) {
  return `
    <div class="px-5 pt-2 pb-28 view-enter">
      <div class="mb-4 flex items-end justify-between">
        <div>
          <h2 class="text-[21px] font-extrabold text-[#16261E]">Pencapaian &amp; Badge</h2>
          <p class="text-xs text-[#5C6B63] mt-0.5">${stats.unlockedCount} dari ${stats.badges.length} badge telah diraih.</p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-3">
        ${stats.badges
          .map((b) => {
            const iconFn = Icons[b.icon] || Icons.badge;
            return `
              <div class="bg-white rounded-2xl p-4 border ${
                b.unlocked ? 'border-[#C5E898]' : 'border-[#E6ECE4]'
              } shadow-sm flex items-center gap-3.5">
                <div class="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                  b.unlocked ? 'bg-[#1B3B2B] text-[#C5E898]' : 'bg-[#EDF4E8] text-[#5C6B63]'
                }">
                  ${iconFn('w-6 h-6')}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between gap-2">
                    <p class="text-sm font-bold text-[#16261E]">${b.title}</p>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      b.unlocked ? 'bg-[#C5E898] text-[#1B3B2B]' : 'bg-[#EDF4E8] text-[#5C6B63]'
                    }">
                      ${b.unlocked ? 'Diraih' : 'Terkunci'}
                    </span>
                  </div>
                  <p class="text-xs text-[#5C6B63] mt-0.5">${b.subtitle}</p>
                  <div class="w-full h-1.5 bg-[#EDF4E8] rounded-full overflow-hidden mt-2">
                    <div class="h-full bg-[#1B3B2B] rounded-full" style="width: ${b.progressPct}%"></div>
                  </div>
                  <p class="text-[10px] text-[#5C6B63] mt-1">${b.progressText}</p>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    </div>
  `;
}

function renderProfileTab(user, stats) {
  return `
    <div class="px-5 pt-2 pb-28 view-enter">
      <div class="bg-[#1B3B2B] text-white rounded-3xl p-5 mb-4 flex items-center gap-4">
        <div class="w-14 h-14 rounded-2xl bg-[#C5E898] text-[#16261E] font-extrabold text-xl flex items-center justify-center flex-shrink-0">
          ${escapeHtml((user?.name || 'P')[0].toUpperCase())}
        </div>
        <div class="min-w-0">
          <p class="text-base font-bold truncate">${escapeHtml(user?.name || 'Pendaki')}</p>
          <p class="text-xs text-[#DCE7D6] truncate">${escapeHtml(user?.email || '')}</p>
          <p class="text-[11px] text-[#C5E898] font-semibold mt-1">${stats.totalHikes} pendakian &bull; ${formatKg(stats.totalWasteKg)} kg sampah</p>
        </div>
      </div>

      <!-- Offline & YOLO11 Model Card -->
      <div class="bg-white rounded-2xl p-4 border border-[#E6ECE4] shadow-sm mb-3">
        <h3 class="text-sm font-bold text-[#16261E] mb-2">Mode Offline &amp; Model YOLO11</h3>
        <div class="flex items-center justify-between py-2 border-b border-[#F0F4EE] text-xs">
          <span class="text-[#5C6B63]">Status jaringan</span>
          <span class="font-bold ${state.isOnline ? 'text-[#1B3B2B]' : 'text-amber-700'}">
            ${state.isOnline ? 'Online (Siap sinkron cache)' : 'Offline (Mode Gunung)'}
          </span>
        </div>
        <div class="flex items-center justify-between py-2 border-b border-[#F0F4EE] text-xs">
          <span class="text-[#5C6B63]">Service Worker</span>
          <span class="font-bold text-[#1B3B2B]">${state.swReady ? 'Aktif (Cache siap)' : 'Memuat / WebView lokal'}</span>
        </div>
        <div class="flex items-center justify-between py-2 text-xs">
          <span class="text-[#5C6B63]">Model yolo11_huluguard.onnx</span>
          <span class="font-bold ${state.modelStatus.ready ? 'text-[#1B3B2B]' : 'text-amber-700'}">
            ${
              state.modelStatus.ready
                ? `Terpasang (${state.modelStatus.source === 'indexeddb' ? 'IndexedDB' : 'Bundled'})`
                : 'Belum dimuat'
            }
          </span>
        </div>

        <label class="mt-3 w-full h-11 rounded-xl bg-[#EDF4E8] text-[#1B3B2B] font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer tap-target">
          ${Icons.upload('w-4 h-4')}
          <span>${state.modelStatus.ready ? 'Ganti file yolo11_huluguard.onnx' : 'Muat file yolo11_huluguard.onnx'}</span>
          <input id="profile-onnx-input" type="file" accept=".onnx" class="hidden" />
        </label>
        ${
          state.modelStatus.ready && state.modelStatus.source === 'indexeddb'
            ? `<button type="button" id="clear-onnx-btn" class="mt-2 w-full py-2 text-xs font-semibold text-[#5C6B63]">Hapus cache model</button>`
            : ''
        }
      </div>

      ${
        state.deferredInstallPrompt
          ? `<button type="button" id="install-pwa-btn"
              class="w-full h-12 rounded-2xl bg-[#C5E898] text-[#16261E] font-bold text-sm mb-3 flex items-center justify-center gap-2 tap-target">
              <span>Pasang Hulu Guard ke Layar Utama</span>
            </button>`
          : ''
      }

      <div class="flex flex-col gap-2.5">
        <button type="button" id="reset-data-btn"
          class="w-full h-12 rounded-2xl bg-white border border-[#E2EAE0] text-[#16261E] font-semibold text-sm tap-target">
          Reset data pendakian lokal
        </button>
        <button type="button" id="logout-btn"
          class="w-full h-12 rounded-2xl bg-[#1B3B2B] text-white font-semibold text-sm tap-target">
          Keluar akun
        </button>
      </div>
    </div>
  `;
}

function renderDashboardView() {
  const user = getUser();
  const stats = getDashboardStats();
  const hikes = getHikes();
  const activeAscent = getActiveAscent();

  let bodyHtml = '';
  if (state.tab === 'dashboard') {
    bodyHtml = renderDashboardHome(stats, activeAscent);
  } else if (state.tab === 'riwayat') {
    bodyHtml = renderHistoryTab(hikes, activeAscent);
  } else if (state.tab === 'badge') {
    bodyHtml = renderBadgesTab(stats);
  } else {
    bodyHtml = renderProfileTab(user, stats);
  }

  appEl.innerHTML = `
    <div class="flex-1 flex flex-col bg-[#F8FAF7] min-h-dvh">
      <!-- Top Brand Header -->
      <header class="px-5 pt-5 pb-3 safe-top flex items-center justify-between">
        <div>
          <h1 class="text-[20px] font-extrabold tracking-tight text-[#1B3B2B] leading-none">hulu guard</h1>
          <p class="text-[9px] font-semibold tracking-[0.12em] text-[#5C6B63] mt-1 uppercase">JAGA ALAM, JAGA LANGKAH.</p>
        </div>
        <div class="flex items-center gap-2">
          ${
            !state.isOnline
              ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                  ${Icons.wifiOff('w-3 h-3')} Offline
                </span>`
              : ''
          }
          <button type="button" id="notif-bell-btn" aria-label="Notifikasi dan status offline"
            class="w-11 h-11 rounded-full bg-white border border-[#E2EAE0] flex items-center justify-center text-[#16261E] relative tap-target">
            ${Icons.bell('w-5 h-5')}
            ${activeAscent ? `<span class="w-2.5 h-2.5 rounded-full bg-[#C5E898] border-2 border-[#1B3B2B] absolute top-2.5 right-2.5"></span>` : ''}
          </button>
        </div>
      </header>

      ${bodyHtml}
      ${renderBottomNav()}
    </div>
  `;

  // Bottom navigation listeners
  appEl.querySelectorAll('[data-nav-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.tab = btn.getAttribute('data-nav-tab');
      renderDashboardView();
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  });

  document.getElementById('cta-start-photo')?.addEventListener('click', () => {
    const mode = activeAscent ? 'turun' : 'naik';
    navigateTo('prep', {
      docMode: mode,
      mountainName: activeAscent?.mountainName || ''
    });
  });

  document.getElementById('resume-descent-btn')?.addEventListener('click', () => {
    navigateTo('prep', {
      docMode: 'turun',
      mountainName: activeAscent?.mountainName || ''
    });
  });

  document.getElementById('empty-start-btn')?.addEventListener('click', () => {
    navigateTo('prep', { docMode: 'naik', mountainName: '' });
  });

  document.getElementById('chart-range-btn')?.addEventListener('click', () => {
    state.chartRange = state.chartRange === '6m' ? 'all' : '6m';
    renderDashboardView();
  });

  document.getElementById('notif-bell-btn')?.addEventListener('click', () => {
    openModal(`
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-base font-bold text-[#16261E]">Status Aplikasi &amp; Pengingat</h3>
        <button type="button" data-close-modal class="text-xs font-bold text-[#5C6B63] px-2 py-1">Tutup</button>
      </div>
      <div class="space-y-2.5 text-xs text-[#16261E]">
        <div class="p-3 rounded-2xl bg-[#EDF4E8]">
          <p class="font-bold text-[#1B3B2B]">Mode Gunung Offline</p>
          <p class="text-[#5C6B63] mt-0.5">Data pendakian, foto, dan inferensi ONNX berjalan 100% lokal di perangkat tanpa sinyal.</p>
        </div>
        ${
          activeAscent
            ? `<div class="p-3 rounded-2xl bg-[#1B3B2B] text-white">
                <p class="font-bold text-[#C5E898]">Pendakian Sedang Berjalan</p>
                <p class="mt-0.5">${escapeHtml(activeAscent.mountainName)} — ${activeAscent.totalItems} item kemasan perlu dibawa turun.</p>
              </div>`
            : `<div class="p-3 rounded-2xl bg-[#F8FAF7] border border-[#E6ECE4]">
                <p class="font-bold">Siap Berangkat</p>
                <p class="text-[#5C6B63] mt-0.5">Belum ada pendakian aktif. Tekan "Mulai foto" untuk mencatat bawaanmu.</p>
              </div>`
        }
      </div>
    `);
  });

  // Hike detail modal in Riwayat
  appEl.querySelectorAll('[data-hike-detail]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-hike-detail');
      const hike = hikes.find((h) => h.id === id);
      if (!hike) return;
      const [naikPhoto, turunPhoto] = await Promise.all([
        getPhoto(hike.ascentPhotoId),
        getPhoto(hike.descentPhotoId)
      ]);
      openModal(`
        <div class="flex items-center justify-between mb-3">
          <div>
            <h3 class="text-base font-bold text-[#16261E]">${escapeHtml(hike.mountainName)}</h3>
            <p class="text-[11px] text-[#5C6B63]">${formatDateId(hike.dateIso)}</p>
          </div>
          <button type="button" data-close-modal class="text-xs font-bold text-[#5C6B63] px-2 py-1">Tutup</button>
        </div>
        <div class="p-3 rounded-2xl mb-3 ${hike.compliant ? 'bg-[#EDF4E8] text-[#1B3B2B]' : 'bg-amber-50 text-amber-900'}">
          <p class="text-xs font-bold">${hike.compliant ? '100% Sampah Dibawa Turun' : `Kepatuhan ${hike.compliancePct}%`}</p>
          <p class="text-[11px] mt-0.5">Naik: ${hike.ascentTotalItems} item &bull; Turun: ${hike.descentTotalItems} item (${formatKg(hike.descentWeightKg)} kg)</p>
        </div>
        <div class="grid grid-cols-2 gap-2 mb-3">
          <div>
            <p class="text-[10px] font-bold text-[#5C6B63] mb-1">Sebelum mendaki</p>
            ${naikPhoto ? `<img src="${naikPhoto}" class="w-full h-28 object-cover rounded-xl border border-[#E2EAE0]" alt="Foto naik" />` : `<div class="w-full h-28 rounded-xl bg-[#F2F5F0] flex items-center justify-center text-[10px] text-[#5C6B63]">Tanpa foto</div>`}
          </div>
          <div>
            <p class="text-[10px] font-bold text-[#5C6B63] mb-1">Sesudah mendaki</p>
            ${turunPhoto ? `<img src="${turunPhoto}" class="w-full h-28 object-cover rounded-xl border border-[#E2EAE0]" alt="Foto turun" />` : `<div class="w-full h-28 rounded-xl bg-[#F2F5F0] flex items-center justify-center text-[10px] text-[#5C6B63]">Tanpa foto</div>`}
          </div>
        </div>
      `);
    });
  });

  // Profile actions
  document.getElementById('profile-onnx-input')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    showToast('Memuat model YOLO11 ke IndexedDB...', 'success');
    const res = await importOnnxFile(file);
    state.modelStatus = await getModelStatus();
    if (res.session) {
      showToast('Model yolo11_huluguard.onnx siap digunakan offline!', 'success');
    } else {
      showToast(res.error || 'Gagal membaca file ONNX', 'error');
    }
    renderDashboardView();
  });

  document.getElementById('clear-onnx-btn')?.addEventListener('click', async () => {
    await clearModelRecord();
    state.modelStatus = await getModelStatus();
    showToast('Cache model ONNX dihapus.');
    renderDashboardView();
  });

  document.getElementById('install-pwa-btn')?.addEventListener('click', async () => {
    if (!state.deferredInstallPrompt) return;
    state.deferredInstallPrompt.prompt();
    await state.deferredInstallPrompt.userChoice;
    state.deferredInstallPrompt = null;
    renderDashboardView();
  });

  document.getElementById('reset-data-btn')?.addEventListener('click', async () => {
    await clearAllAppData();
    showToast('Data pendakian lokal telah direset.');
    renderDashboardView();
  });

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    logoutUser();
    navigateTo('login');
  });
}

/* ==================== 3. PREP VIEW ==================== */
function renderPrepView() {
  const activeAscent = getActiveAscent();
  const isTurun = state.docMode === 'turun';

  appEl.innerHTML = `
    <div class="flex-1 flex flex-col px-5 pt-4 pb-6 safe-top safe-bottom bg-[#F8FAF7] view-enter">
      <!-- Top Bar -->
      <header class="flex items-center gap-3 mb-2">
        <button type="button" id="prep-back-btn" aria-label="Kembali"
          class="w-11 h-11 rounded-full bg-white border border-[#E2EAE0] flex items-center justify-center text-[#16261E] tap-target">
          ${Icons.arrowLeft('w-5 h-5')}
        </button>
        <div>
          <h1 class="text-base font-bold text-[#16261E] leading-tight">Dokumentasi</h1>
          <p class="text-xs text-[#5C6B63]">${isTurun ? 'Verifikasi turun gunung' : 'Pendakian baru'}</p>
        </div>
      </header>

      ${renderStepper(1)}

      <!-- Mode Toggle: Sebelum mendaki (Naik) vs Sesudah mendaki (Turun) -->
      <div class="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-[#EDF4E8] border border-[#DCE7D6] mb-4">
        <button type="button" data-mode="naik"
          class="py-2.5 rounded-xl text-xs font-bold transition-all ${
            !isTurun ? 'bg-[#1B3B2B] text-white shadow-sm' : 'text-[#5C6B63]'
          }">
          Sebelum mendaki
        </button>
        <button type="button" data-mode="turun"
          class="py-2.5 rounded-xl text-xs font-bold transition-all ${
            isTurun ? 'bg-[#1B3B2B] text-white shadow-sm' : 'text-[#5C6B63]'
          }">
          Sesudah mendaki
        </button>
      </div>

      <!-- Heading -->
      <div class="mb-3.5">
        <h2 class="text-[20px] font-extrabold text-[#16261E]">
          ${isTurun ? 'Cek sampah saat turun.' : 'Catat bawaanmu dulu.'}
        </h2>
        <p class="text-xs text-[#5C6B63] mt-1 leading-relaxed">
          ${
            isTurun
              ? 'Foto semua sampah kemasan yang kamu bawa turun untuk dicocokkan dengan catatan naik.'
              : 'Foto barang sebelum mendaki untuk membantu mencatat sampah yang perlu dibawa turun.'
          }
        </p>
      </div>

      <!-- Mountain Name Input -->
      <div class="mb-3.5">
        <label for="mountain-name-input" class="block text-[11px] font-semibold text-[#5C6B63] mb-1">Nama gunung / jalur</label>
        <input id="mountain-name-input" type="text"
          placeholder="Contoh: Gunung Gede Pangrango"
          value="${escapeHtml(state.mountainName || activeAscent?.mountainName || '')}"
          class="w-full h-11 px-3.5 rounded-xl bg-white border border-[#DCE5DA] text-xs font-semibold text-[#16261E] outline-none focus:border-[#1B3B2B]" />
      </div>

      <!-- Dark Forest Preview Card -->
      <div class="bg-[#1B3B2B] rounded-[24px] p-4 mb-4 text-white">
        <span class="inline-block px-3 py-1 rounded-full bg-[#C5E898] text-[#16261E] text-[11px] font-bold mb-3">
          ${isTurun ? 'Sesudah mendaki' : 'Sebelum mendaki'}
        </span>
        <div class="border border-dashed border-white/25 rounded-2xl py-8 px-4 flex flex-col items-center justify-center text-center">
          <div class="w-12 h-12 rounded-full bg-white/10 text-[#C5E898] flex items-center justify-center mb-3">
            ${Icons.camera('w-6 h-6')}
          </div>
          <p class="text-sm font-bold">Semua bawaan, satu foto.</p>
          <p class="text-xs text-[#D3E0D6] mt-1">Makanan, minuman, dan kemasannya.</p>
        </div>
      </div>

      <!-- Guide Card -->
      <div class="bg-white rounded-2xl p-4 border border-[#E6ECE4] mb-5">
        <p class="text-xs font-bold text-[#16261E] mb-3">Biar fotonya mudah dicek</p>
        <div class="flex items-start gap-3 mb-2.5">
          <span class="w-6 h-6 rounded-full bg-[#EDF4E8] text-[#1B3B2B] text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
          <div>
            <p class="text-xs font-bold text-[#16261E]">Susun semua barang</p>
            <p class="text-[11px] text-[#5C6B63]">Letakkan bawaan di permukaan datar.</p>
          </div>
        </div>
        <div class="flex items-start gap-3">
          <span class="w-6 h-6 rounded-full bg-[#EDF4E8] text-[#1B3B2B] text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
          <div>
            <p class="text-xs font-bold text-[#16261E]">Pastikan terlihat jelas</p>
            <p class="text-[11px] text-[#5C6B63]">Gunakan cahaya cukup, hindari tumpukan.</p>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="mt-auto flex flex-col gap-2">
        <button type="button" id="open-camera-btn"
          class="w-full h-12 rounded-2xl bg-[#C5E898] hover:bg-[#b8e085] text-[#16261E] font-bold text-sm flex items-center justify-center gap-2 shadow-sm tap-target">
          ${Icons.camera('w-4 h-4')}
          <span>Buka kamera</span>
        </button>

        <label class="w-full h-11 rounded-2xl bg-transparent text-[#16261E] font-bold text-xs flex items-center justify-center cursor-pointer tap-target">
          <span>Pilih dari galeri</span>
          <input id="prep-gallery-input" type="file" accept="image/*" class="hidden" />
        </label>
      </div>
    </div>
  `;

  document.getElementById('prep-back-btn')?.addEventListener('click', () => {
    navigateTo('dashboard');
  });

  appEl.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.docMode = btn.getAttribute('data-mode');
      state.mountainName = document.getElementById('mountain-name-input')?.value || state.mountainName;
      renderPrepView();
    });
  });

  document.getElementById('open-camera-btn')?.addEventListener('click', () => {
    state.mountainName =
      document.getElementById('mountain-name-input')?.value.trim() || 'Pendakian Gunung';
    navigateTo('camera', { cameraError: null });
  });

  document.getElementById('prep-gallery-input')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    state.mountainName =
      document.getElementById('mountain-name-input')?.value.trim() || 'Pendakian Gunung';
    readImageFileAndReview(file);
  });
}

function readImageFileAndReview(file) {
  const reader = new FileReader();
  reader.onload = () => {
    navigateTo('review', {
      capturedDataUrl: reader.result,
      detectionResult: null,
      counts: buildClassCounts([], {})
    });
  };
  reader.readAsDataURL(file);
}

/* ==================== 4. CAMERA VIEW ==================== */
async function startCameraFeed() {
  stopCameraStream();
  const videoEl = document.getElementById('camera-video');
  if (!videoEl) return;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    state.cameraError = 'Browser atau perangkat ini tidak mendukung akses kamera langsung.';
    renderCameraOverlayError();
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: state.facingMode },
        width: { ideal: 1280 },
        height: { ideal: 1280 }
      },
      audio: false
    });
    state.cameraStream = stream;
    state.cameraError = null;
    videoEl.srcObject = stream;
    await videoEl.play().catch(() => {});
  } catch (err) {
    state.cameraError =
      err?.name === 'NotAllowedError'
        ? 'Izin kamera ditolak. Aktifkan izin kamera atau pilih foto dari galeri.'
        : 'Kamera tidak tersedia di perangkat ini. Gunakan "Galeri" untuk memilih foto.';
    renderCameraOverlayError();
  }
}

function renderCameraOverlayError() {
  const container = document.getElementById('camera-error-box');
  if (!container) return;
  container.classList.remove('hidden');
  container.innerHTML = `
    <div class="text-center px-5">
      <p class="text-xs font-semibold text-white mb-3">${escapeHtml(state.cameraError)}</p>
      <label class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C5E898] text-[#16261E] text-xs font-bold cursor-pointer">
        ${Icons.gallery('w-4 h-4')}
        <span>Pilih dari galeri</span>
        <input id="camera-fallback-gallery" type="file" accept="image/*" class="hidden" />
      </label>
    </div>
  `;
  document.getElementById('camera-fallback-gallery')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) readImageFileAndReview(file);
  });
}

function renderCameraView() {
  const isTurun = state.docMode === 'turun';

  appEl.innerHTML = `
    <div class="flex-1 flex flex-col px-5 pt-4 pb-6 safe-top safe-bottom bg-[#F8FAF7] view-enter">
      <!-- Top Bar -->
      <header class="flex items-center gap-3 mb-3">
        <button type="button" id="cam-back-btn" aria-label="Kembali"
          class="w-11 h-11 rounded-full bg-white border border-[#E2EAE0] flex items-center justify-center text-[#16261E] tap-target">
          ${Icons.arrowLeft('w-5 h-5')}
        </button>
        <div>
          <h1 class="text-base font-bold text-[#16261E] leading-tight">Foto barang</h1>
          <p class="text-xs text-[#5C6B63]">${isTurun ? 'Sesudah mendaki' : 'Sebelum mendaki'}</p>
        </div>
      </header>

      <!-- Dark Rounded Viewfinder -->
      <div class="relative bg-[#1B3B2B] rounded-[28px] overflow-hidden viewfinder-frame flex flex-col justify-between p-4 shadow-md">
        <video id="camera-video" autoplay playsinline muted
          class="absolute inset-0 w-full h-full object-cover transition-transform duration-200"
          style="transform: scale(${state.zoomLevel}) ${state.facingMode === 'user' ? 'scaleX(-1)' : ''};"></video>

        <!-- 3x3 Grid Overlay -->
        <div class="absolute inset-6 pointer-events-none grid grid-cols-3 grid-rows-3 border border-white/10 rounded-xl overflow-hidden">
          <div class="border-r border-b border-white/15"></div>
          <div class="border-r border-b border-white/15"></div>
          <div class="border-b border-white/15"></div>
          <div class="border-r border-b border-white/15"></div>
          <div class="border-r border-b border-white/15"></div>
          <div class="border-b border-white/15"></div>
          <div class="border-r border-white/15"></div>
          <div class="border-r border-white/15"></div>
          <div></div>
        </div>

        <!-- Corner Green Brackets -->
        <div class="bracket bracket-tl"></div>
        <div class="bracket bracket-tr"></div>
        <div class="bracket bracket-bl"></div>
        <div class="bracket bracket-br"></div>

        <!-- Error fallback container -->
        <div id="camera-error-box" class="hidden absolute inset-0 bg-[#1B3B2B]/92 flex items-center justify-center z-10"></div>

        <!-- Top Overlay Controls -->
        <div class="relative z-20 flex items-center justify-between">
          <span class="px-3 py-1 rounded-full bg-[#C5E898] text-[#16261E] text-[11px] font-bold shadow-sm">
            ${isTurun ? 'Sesudah mendaki' : 'Sebelum mendaki'}
          </span>
          <button type="button" id="torch-btn" aria-label="Flash kamera"
            class="w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              state.torchOn ? 'bg-[#C5E898] text-[#16261E]' : 'bg-black/35 text-white border border-white/15'
            }">
            ${Icons.flash('w-4 h-4', state.torchOn)}
          </button>
        </div>

        <!-- Bottom Overlay Guide & Zoom -->
        <div class="relative z-20 flex flex-col items-center gap-2.5 pb-1">
          <p class="text-[11px] font-medium text-white/95 bg-black/35 px-3 py-1 rounded-full backdrop-blur-sm">
            Pastikan semua barang masuk bingkai
          </p>
          <button type="button" id="zoom-btn"
            class="w-10 h-10 rounded-full bg-black/45 border border-white/20 text-white text-xs font-bold flex items-center justify-center">
            ${state.zoomLevel}&times;
          </button>
        </div>
      </div>

      <!-- Bottom Camera Bar -->
      <div class="mt-auto pt-4 text-center">
        <p class="text-base font-bold text-[#16261E]">Ambil foto bawaanmu</p>
        <p class="text-xs text-[#5C6B63] mt-0.5 mb-4">Susun barang di tempat datar dan cukup cahaya.</p>

        <div class="flex items-center justify-around px-2">
          <!-- Gallery -->
          <label class="flex flex-col items-center gap-1 cursor-pointer tap-target justify-center">
            <div class="w-12 h-12 rounded-2xl bg-white border border-[#E2EAE0] flex items-center justify-center text-[#16261E]">
              ${Icons.gallery('w-5 h-5')}
            </div>
            <span class="text-[11px] font-medium text-[#5C6B63]">Galeri</span>
            <input id="cam-gallery-input" type="file" accept="image/*" class="hidden" />
          </label>

          <!-- Shutter -->
          <div class="flex flex-col items-center gap-1">
            <button type="button" id="shutter-btn" aria-label="Ambil foto"
              class="w-[72px] h-[72px] rounded-full p-1 border-[3px] border-[#1B3B2B] bg-white active:scale-95 transition-transform">
              <div class="w-full h-full rounded-full bg-[#C5E898]"></div>
            </button>
            <span class="text-[11px] font-bold text-[#16261E]">Ambil foto</span>
          </div>

          <!-- Flip Camera -->
          <button type="button" id="flip-cam-btn"
            class="flex flex-col items-center gap-1 tap-target justify-center">
            <div class="w-12 h-12 rounded-2xl bg-white border border-[#E2EAE0] flex items-center justify-center text-[#16261E]">
              ${Icons.flipCamera('w-5 h-5')}
            </div>
            <span class="text-[11px] font-medium text-[#5C6B63]">Balik</span>
          </button>
        </div>
      </div>
    </div>
  `;

  startCameraFeed();

  document.getElementById('cam-back-btn')?.addEventListener('click', () => {
    navigateTo('prep');
  });

  document.getElementById('torch-btn')?.addEventListener('click', async () => {
    const track = state.cameraStream?.getVideoTracks()?.[0];
    if (!track) return;
    try {
      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      if (!capabilities.torch) {
        showToast('Flash/Torch tidak didukung pada kamera ini.');
        return;
      }
      state.torchOn = !state.torchOn;
      await track.applyConstraints({ advanced: [{ torch: state.torchOn }] });
      const btn = document.getElementById('torch-btn');
      if (btn) {
        btn.className = `w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
          state.torchOn ? 'bg-[#C5E898] text-[#16261E]' : 'bg-black/35 text-white border border-white/15'
        }`;
        btn.innerHTML = Icons.flash('w-4 h-4', state.torchOn);
      }
    } catch {
      showToast('Tidak dapat mengaktifkan flash pada perangkat ini.');
    }
  });

  document.getElementById('zoom-btn')?.addEventListener('click', () => {
    const levels = [1, 1.5, 2];
    const nextIdx = (levels.indexOf(state.zoomLevel) + 1) % levels.length;
    state.zoomLevel = levels[nextIdx];
    const videoEl = document.getElementById('camera-video');
    if (videoEl) {
      videoEl.style.transform = `scale(${state.zoomLevel}) ${state.facingMode === 'user' ? 'scaleX(-1)' : ''}`;
    }
    const zBtn = document.getElementById('zoom-btn');
    if (zBtn) zBtn.innerHTML = `${state.zoomLevel}&times;`;
  });

  document.getElementById('flip-cam-btn')?.addEventListener('click', () => {
    state.facingMode = state.facingMode === 'environment' ? 'user' : 'environment';
    startCameraFeed();
  });

  document.getElementById('cam-gallery-input')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) readImageFileAndReview(file);
  });

  document.getElementById('shutter-btn')?.addEventListener('click', () => {
    const videoEl = document.getElementById('camera-video');
    if (!videoEl || !videoEl.videoWidth) {
      showToast('Kamera belum siap. Coba pilih foto dari galeri.', 'error');
      return;
    }
    const canvas = document.createElement('canvas');
    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext('2d');
    if (state.facingMode === 'user') {
      ctx.translate(vw, 0);
      ctx.scale(-1, 1);
    }
    // Apply zoom crop
    const cropW = vw / state.zoomLevel;
    const cropH = vh / state.zoomLevel;
    const sx = (vw - cropW) / 2;
    const sy = (vh - cropH) / 2;
    ctx.drawImage(videoEl, sx, sy, cropW, cropH, 0, 0, vw, vh);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    navigateTo('review', {
      capturedDataUrl: dataUrl,
      detectionResult: null,
      counts: buildClassCounts([], {})
    });
  });
}

/* ==================== 5. REVIEW VIEW (YOLO11 ONNX) ==================== */
async function executeReviewInference() {
  const canvas = document.getElementById('review-canvas');
  if (!canvas || !state.capturedDataUrl) return;

  const img = new Image();
  img.onload = async () => {
    drawDetectionsOnCanvas(canvas, img, []);
    state.isDetecting = true;
    updateReviewStatusPanel();

    const result = await runYoloDetection(img, 0.25);
    state.isDetecting = false;
    state.detectionResult = result;
    state.modelStatus = await getModelStatus();

    if (result.ok) {
      drawDetectionsOnCanvas(canvas, img, result.detections);
      state.counts = buildClassCounts(result.detections, {});
    }
    updateReviewStatusPanel();
  };
  img.src = state.capturedDataUrl;
}

function updateReviewStatusPanel() {
  const panel = document.getElementById('yolo-panel');
  if (!panel) return;

  const totals = calculateTotals(state.counts);
  const res = state.detectionResult;

  panel.innerHTML = `
    <div class="bg-white rounded-2xl p-4 border border-[#E6ECE4] shadow-sm">
      <div class="flex items-center justify-between gap-2 mb-2.5">
        <div>
          <h3 class="text-sm font-bold text-[#16261E]">Deteksi Kemasan (YOLO11 ONNX)</h3>
          <p class="text-[11px] text-[#5C6B63]">
            ${
              state.isDetecting
                ? 'Menjalankan inferensi 640x640 di perangkat...'
                : res?.ok
                ? `${res.detections.length} objek terdeteksi &bull; ${res.inferenceMs} ms`
                : 'Verifikasi jumlah kemasan bawaanmu'
            }
          </p>
        </div>
        <span class="px-2.5 py-1 rounded-full bg-[#EDF4E8] text-[#1B3B2B] text-[11px] font-bold">
          ${totals.totalItems} item &bull; ${formatKg(totals.totalWeightKg)} kg
        </span>
      </div>

      ${
        state.isDetecting
          ? `<div class="py-4 flex items-center justify-center gap-2 text-xs font-semibold text-[#1B3B2B]">
              <span class="w-4 h-4 rounded-full border-2 border-[#1B3B2B] border-t-transparent animate-spin"></span>
              <span>Menganalisis foto dengan onnxruntime-web...</span>
            </div>`
          : ''
      }

      ${
        !state.isDetecting && res && !res.ok
          ? `<div class="p-3 rounded-xl bg-amber-50 border border-amber-200 mb-3">
              <p class="text-xs font-bold text-amber-900">Model yolo11_huluguard.onnx belum terpasang</p>
              <p class="text-[11px] text-amber-800 mt-0.5">${escapeHtml(res.error || '')}</p>
              <label class="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B3B2B] text-white text-[11px] font-bold cursor-pointer">
                ${Icons.upload('w-3.5 h-3.5')}
                <span>Muat file .onnx sekarang</span>
                <input id="review-onnx-upload" type="file" accept=".onnx" class="hidden" />
              </label>
            </div>`
          : ''
      }

      <!-- Per-class breakdown + manual +/- adjustment -->
      <div class="grid grid-cols-1 gap-1.5 mt-2">
        ${WASTE_CLASSES.map((cls) => {
          const qty = state.counts[cls.id] || 0;
          return `
            <div class="flex items-center justify-between py-1.5 px-2.5 rounded-xl ${
              qty > 0 ? 'bg-[#EDF4E8]/70' : 'bg-[#F8FAF7]'
            }">
              <div class="flex items-center gap-2 min-w-0">
                <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background-color:${cls.color}"></span>
                <div class="min-w-0">
                  <p class="text-xs font-bold text-[#16261E] truncate">${cls.label}</p>
                  <p class="text-[10px] text-[#5C6B63] font-mono">${cls.id}</p>
                </div>
              </div>
              <div class="flex items-center gap-1.5">
                <button type="button" data-dec-cls="${cls.id}" aria-label="Kurangi ${cls.label}"
                  class="w-7 h-7 rounded-lg bg-white border border-[#DCE5DA] text-sm font-bold text-[#16261E] flex items-center justify-center">-</button>
                <span class="w-6 text-center text-xs font-extrabold text-[#1B3B2B]">${qty}</span>
                <button type="button" data-inc-cls="${cls.id}" aria-label="Tambah ${cls.label}"
                  class="w-7 h-7 rounded-lg bg-[#1B3B2B] text-sm font-bold text-white flex items-center justify-center">+</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  panel.querySelectorAll('[data-dec-cls]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-dec-cls');
      state.counts[id] = Math.max(0, (state.counts[id] || 0) - 1);
      updateReviewStatusPanel();
    });
  });

  panel.querySelectorAll('[data-inc-cls]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-inc-cls');
      state.counts[id] = (state.counts[id] || 0) + 1;
      updateReviewStatusPanel();
    });
  });

  document.getElementById('review-onnx-upload')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importOnnxFile(file);
    executeReviewInference();
  });
}

function renderReviewView() {
  const isTurun = state.docMode === 'turun';

  appEl.innerHTML = `
    <div class="flex-1 flex flex-col px-5 pt-4 pb-6 safe-top safe-bottom bg-[#F8FAF7] view-enter">
      <!-- Top Bar -->
      <header class="flex items-center gap-3 mb-2">
        <button type="button" id="review-back-btn" aria-label="Kembali"
          class="w-11 h-11 rounded-full bg-white border border-[#E2EAE0] flex items-center justify-center text-[#16261E] tap-target">
          ${Icons.arrowLeft('w-5 h-5')}
        </button>
        <div>
          <h1 class="text-base font-bold text-[#16261E] leading-tight">Tinjau foto</h1>
          <p class="text-xs text-[#5C6B63]">${isTurun ? 'Sesudah mendaki' : 'Sebelum mendaki'}</p>
        </div>
      </header>

      ${renderStepper(2)}

      <div class="mb-3">
        <h2 class="text-[20px] font-extrabold text-[#16261E]">Sudah terlihat jelas?</h2>
        <p class="text-xs text-[#5C6B63] mt-0.5 leading-relaxed">
          Cek fotomu sebelum melanjutkan. Pastikan semua barang dan kemasannya terlihat.
        </p>
      </div>

      <!-- Photo + Bounding Box Canvas Preview -->
      <div class="relative rounded-[24px] overflow-hidden border border-[#DCE5DA] bg-[#16261E] mb-4 shadow-sm">
        <span class="absolute top-3 left-3 z-10 px-3 py-1 rounded-full bg-[#C5E898] text-[#16261E] text-[11px] font-bold shadow">
          ${isTurun ? 'Sesudah mendaki' : 'Sebelum mendaki'}
        </span>
        <canvas id="review-canvas" class="w-full h-auto block max-h-[340px] object-contain mx-auto"></canvas>
      </div>

      <!-- YOLO Detection Summary Panel -->
      <div id="yolo-panel" class="mb-4"></div>

      <div class="mb-4">
        <p class="text-sm font-bold text-[#16261E]">Semua bawaan sudah masuk?</p>
        <p class="text-xs text-[#5C6B63] mt-0.5">Pastikan foto tidak buram dan tidak ada barang yang tertutup atau terpotong.</p>
      </div>

      <!-- Bottom Action Buttons -->
      <div class="mt-auto flex flex-col gap-2.5">
        <button type="button" id="use-photo-btn"
          class="w-full h-12 rounded-2xl bg-[#C5E898] hover:bg-[#b8e085] text-[#16261E] font-bold text-sm shadow-sm tap-target">
          Gunakan foto
        </button>
        <button type="button" id="retake-photo-btn"
          class="w-full h-12 rounded-2xl bg-white border border-[#E2EAE0] text-[#16261E] font-bold text-sm tap-target">
          Ambil ulang
        </button>
      </div>
    </div>
  `;

  updateReviewStatusPanel();
  executeReviewInference();

  document.getElementById('review-back-btn')?.addEventListener('click', () => {
    navigateTo('prep');
  });

  document.getElementById('retake-photo-btn')?.addEventListener('click', () => {
    navigateTo('camera');
  });

  document.getElementById('use-photo-btn')?.addEventListener('click', () => {
    const totals = calculateTotals(state.counts);
    if (totals.totalItems === 0) {
      showToast('Tambahkan minimal 1 item kemasan agar perbandingan dapat dihitung.', 'error');
      return;
    }
    // Export annotated canvas image
    const canvas = document.getElementById('review-canvas');
    if (canvas && canvas.width > 0) {
      state.annotatedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
    } else {
      state.annotatedDataUrl = state.capturedDataUrl;
    }
    navigateTo('result');
  });
}

/* ==================== 6. RESULT VIEW (STEPPER 3 SIMPAN) ==================== */
function renderResultView() {
  const isTurun = state.docMode === 'turun';
  const activeAscent = getActiveAscent();
  const totals = calculateTotals(state.counts);

  // Compute comparison if mode is Turun and an active Ascent exists
  let compliancePct = 100;
  let compliant = true;
  let comparisonRows = [];
  let missingTotal = 0;

  if (isTurun && activeAscent) {
    let matchedItems = 0;
    const naikTotal = Math.max(1, activeAscent.totalItems);

    comparisonRows = WASTE_CLASSES.map((cls) => {
      const naikQty = Number(activeAscent.counts?.[cls.id]) || 0;
      const turunQty = Number(state.counts[cls.id]) || 0;
      matchedItems += Math.min(naikQty, turunQty);
      const diff = turunQty - naikQty;
      if (diff < 0) missingTotal += Math.abs(diff);
      return { ...cls, naikQty, turunQty, diff };
    }).filter((r) => r.naikQty > 0 || r.turunQty > 0);

    compliancePct = Math.min(100, Math.round((matchedItems / naikTotal) * 100));
    compliant = missingTotal === 0;
  } else {
    comparisonRows = WASTE_CLASSES.map((cls) => ({
      ...cls,
      naikQty: Number(state.counts[cls.id]) || 0,
      turunQty: 0,
      diff: 0
    })).filter((r) => r.naikQty > 0);
  }

  appEl.innerHTML = `
    <div class="flex-1 flex flex-col px-5 pt-4 pb-6 safe-top safe-bottom bg-[#F8FAF7] view-enter">
      <!-- Top Bar -->
      <header class="flex items-center gap-3 mb-2">
        <button type="button" id="result-back-btn" aria-label="Kembali"
          class="w-11 h-11 rounded-full bg-white border border-[#E2EAE0] flex items-center justify-center text-[#16261E] tap-target">
          ${Icons.arrowLeft('w-5 h-5')}
        </button>
        <div>
          <h1 class="text-base font-bold text-[#16261E] leading-tight">
            ${isTurun ? 'Hasil verifikasi turun' : 'Ringkasan bawaan naik'}
          </h1>
          <p class="text-xs text-[#5C6B63]">${escapeHtml(state.mountainName || activeAscent?.mountainName || 'Pendakian Gunung')}</p>
        </div>
      </header>

      ${renderStepper(3)}

      <!-- Status Banner -->
      ${
        isTurun && activeAscent
          ? `
            <div class="rounded-[24px] p-5 mb-4 ${
              compliant ? 'bg-[#1B3B2B] text-white' : 'bg-amber-50 border border-amber-200 text-amber-950'
            }">
              <div class="flex items-center gap-2.5 mb-2">
                <div class="w-10 h-10 rounded-full flex items-center justify-center ${
                  compliant ? 'bg-[#C5E898] text-[#16261E]' : 'bg-amber-200 text-amber-900'
                }">
                  ${compliant ? Icons.checkCircle('w-5 h-5') : Icons.alertTriangle('w-5 h-5')}
                </div>
                <div>
                  <p class="text-base font-extrabold">
                    ${compliant ? '100% Sampah Dibawa Turun' : `${compliancePct}% Sampah Dibawa Turun`}
                  </p>
                  <p class="text-xs ${compliant ? 'text-[#C5E898]' : 'text-amber-800'}">
                    ${
                      compliant
                        ? 'Luar biasa! Semua kemasan yang dibawa naik berhasil dibawa kembali.'
                        : `Masih ada selisih ${missingTotal} item yang belum tercatat turun.`
                    }
                  </p>
                </div>
              </div>
            </div>
          `
          : `
            <div class="bg-[#1B3B2B] text-white rounded-[24px] p-5 mb-4">
              <span class="inline-block px-3 py-1 rounded-full bg-[#C5E898] text-[#16261E] text-[11px] font-bold mb-2">
                Catatan Naik Siap Disimpan
              </span>
              <h2 class="text-lg font-extrabold">${totals.totalItems} item kemasan (${formatKg(totals.totalWeightKg)} kg)</h2>
              <p class="text-xs text-[#D3E0D6] mt-1">
                Daftar ini akan menjadi acuan saat kamu turun gunung nanti.
              </p>
            </div>
          `
      }

      <!-- Comparison / Item Summary Card -->
      <div class="bg-white rounded-2xl p-4 border border-[#E6ECE4] shadow-sm mb-4">
        <div class="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#F0F4EE]">
          <span class="text-xs font-bold text-[#16261E]">Rincian per kelas</span>
          <span class="text-[11px] font-semibold text-[#5C6B63]">
            ${isTurun && activeAscent ? 'Naik vs Turun' : 'Jumlah Naik'}
          </span>
        </div>

        <div class="flex flex-col gap-2">
          ${comparisonRows
            .map((r) => {
              if (isTurun && activeAscent) {
                const ok = r.diff >= 0;
                return `
                  <div class="flex items-center justify-between text-xs py-1">
                    <div class="flex items-center gap-2">
                      <span class="w-2.5 h-2.5 rounded-full" style="background-color:${r.color}"></span>
                      <div>
                        <p class="font-bold text-[#16261E]">${r.label}</p>
                        <p class="text-[10px] font-mono text-[#5C6B63]">${r.id}</p>
                      </div>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-[#5C6B63]">${r.naikQty} &rarr; <strong class="text-[#16261E]">${r.turunQty}</strong></span>
                      <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        ok ? 'bg-[#EDF4E8] text-[#1B3B2B]' : 'bg-red-100 text-red-800'
                      }">
                        ${ok ? 'Lengkap' : `Kurang ${Math.abs(r.diff)}`}
                      </span>
                    </div>
                  </div>
                `;
              }
              return `
                <div class="flex items-center justify-between text-xs py-1">
                  <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full" style="background-color:${r.color}"></span>
                    <span class="font-bold text-[#16261E]">${r.label}</span>
                  </div>
                  <span class="font-extrabold text-[#1B3B2B]">${r.naikQty}x</span>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="mt-auto flex flex-col gap-2.5">
        <button type="button" id="save-result-btn"
          class="w-full h-12 rounded-2xl bg-[#1B3B2B] hover:bg-[#142C20] text-white font-bold text-sm shadow-sm tap-target">
          ${isTurun ? 'Simpan ke Riwayat' : 'Simpan & Mulai Pendakian'}
        </button>
        ${
          isTurun && !compliant
            ? `<button type="button" id="rescan-turun-btn"
                class="w-full h-11 rounded-2xl bg-[#EDF4E8] text-[#1B3B2B] font-bold text-xs tap-target">
                Foto ulang barang turun
              </button>`
            : ''
        }
      </div>
    </div>
  `;

  document.getElementById('result-back-btn')?.addEventListener('click', () => {
    navigateTo('review');
  });

  document.getElementById('rescan-turun-btn')?.addEventListener('click', () => {
    navigateTo('camera');
  });

  document.getElementById('save-result-btn')?.addEventListener('click', async () => {
    const nowIso = new Date().toISOString();
    const photoId = `photo_${Date.now()}`;
    await savePhoto(photoId, state.annotatedDataUrl || state.capturedDataUrl);

    if (!isTurun) {
      setActiveAscent({
        id: `ascent_${Date.now()}`,
        mountainName: state.mountainName || 'Pendakian Gunung',
        dateIso: nowIso,
        counts: { ...state.counts },
        totalItems: totals.totalItems,
        totalWeightKg: totals.totalWeightKg,
        photoId
      });
      showToast('Catatan bawaan naik tersimpan offline!', 'success');
      navigateTo('dashboard', { tab: 'dashboard' });
    } else {
      const baseline = activeAscent;
      addHike({
        id: `hike_${Date.now()}`,
        mountainName: state.mountainName || baseline?.mountainName || 'Pendakian Gunung',
        dateIso: nowIso,
        ascentCounts: baseline?.counts || state.counts,
        descentCounts: { ...state.counts },
        ascentTotalItems: baseline ? baseline.totalItems : totals.totalItems,
        descentTotalItems: totals.totalItems,
        ascentWeightKg: baseline ? baseline.totalWeightKg : totals.totalWeightKg,
        descentWeightKg: totals.totalWeightKg,
        compliancePct: baseline ? compliancePct : 100,
        compliant: baseline ? compliant : true,
        ascentPhotoId: baseline?.photoId || null,
        descentPhotoId: photoId
      });
      setActiveAscent(null);
      showToast(
        compliant
          ? 'Hebat! 100% sampah dibawa turun & disimpan ke riwayat.'
          : 'Pendakian disimpan ke riwayat.',
        'success'
      );
      navigateTo('dashboard', { tab: 'dashboard' });
    }
  });
}

function render() {
  switch (state.view) {
    case 'login':
      renderLoginView();
      break;
    case 'dashboard':
      renderDashboardView();
      break;
    case 'prep':
      renderPrepView();
      break;
    case 'camera':
      renderCameraView();
      break;
    case 'review':
      renderReviewView();
      break;
    case 'result':
      renderResultView();
      break;
    default:
      renderLoginView();
  }
}

async function init() {
  // Register Service Worker for offline mountain mode
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      state.swReady = Boolean(reg);
    } catch {
      state.swReady = false;
    }
  }

  window.addEventListener('online', () => {
    state.isOnline = true;
    if (state.view === 'dashboard') renderDashboardView();
  });

  window.addEventListener('offline', () => {
    state.isOnline = false;
    showToast('Mode offline aktif. Semua data tetap tersimpan lokal.');
    if (state.view === 'dashboard') renderDashboardView();
  });

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredInstallPrompt = e;
  });

  state.modelStatus = await getModelStatus();
  const user = getUser();
  state.view = user ? 'dashboard' : 'login';
  render();
}

init();
