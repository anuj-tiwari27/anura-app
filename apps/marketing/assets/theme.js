/* ============================================================
   Anura - shared theme config, header/footer, and interactions.
   Load right AFTER the Tailwind CDN script:
     <script src="https://cdn.tailwindcss.com"></script>
     <script src="assets/theme.js"></script>
   Then place <div data-site-header></div> and <div data-site-footer></div>
   where the shared nav/footer should appear.
   ============================================================ */

/* ---- Tailwind theme (must run before Tailwind scans the page) ---- */
tailwind.config = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: { DEFAULT: '#0A0E1A', 900: '#0A0E1A', 800: '#0E1426', 700: '#151C32', 600: '#1E2843' },
        paper: { DEFAULT: '#F8F7F3', card: '#FFFFFF', warm: '#F2F0E9' },
        brand: { 50:'#EEF0FF',100:'#E0E3FF',200:'#C6CCFF',300:'#A3ABFF',400:'#7B82F8',500:'#5B5BE8',600:'#4A41D6',700:'#3E33B4',800:'#332C91',900:'#2C2873' },
        live: { 400: '#34D399', 500: '#10B981', 600: '#059669' },
        gold: '#D8A84E',
      },
      boxShadow: {
        'soft': '0 1px 2px rgba(10,14,26,0.04), 0 8px 24px -8px rgba(10,14,26,0.10)',
        'lift': '0 12px 40px -12px rgba(10,14,26,0.22)',
        'glow': '0 0 0 1px rgba(91,91,232,0.18), 0 18px 60px -20px rgba(91,91,232,0.55)',
      },
    }
  }
};

/* ---- Shared markup ---- */
function siteHeader() {
  return `
  <header id="nav" class="sticky top-0 z-50 transition-all duration-300">
    <div class="border-b border-ink/5 bg-paper/80 backdrop-blur-xl">
      <nav class="max-w-7xl mx-auto px-5 h-[68px] flex items-center justify-between">
        <a href="index.html" class="flex items-center gap-2.5 shrink-0">
          <span class="text-[22px] font-bold tracking-tight text-ink">Anura</span>
        </a>
        <div class="hidden lg:flex items-center gap-8 text-[15px] font-medium text-ink/70">
          <a href="index.html#agentic" class="nav-link hover:text-ink transition">Agentic Mode</a>
          <a href="index.html#features" class="nav-link hover:text-ink transition">Platform</a>
          <a href="index.html#briefcase" class="nav-link hover:text-ink transition">Digital Briefcase</a>
          <a href="security.html" class="nav-link hover:text-ink transition">Security</a>
          <a href="index.html#pricing" class="nav-link hover:text-ink transition">Pricing</a>
        </div>
        <div class="flex items-center gap-2 sm:gap-3">
          <a href="index.html#" class="hidden sm:inline-flex text-[15px] font-semibold text-ink/80 hover:text-ink px-3 py-2 transition">Log in</a>
          <a href="index.html#demo" class="inline-flex items-center gap-2 rounded-xl bg-ink text-white text-[15px] font-semibold px-4 sm:px-5 py-2.5 shadow-soft hover:bg-ink-700 transition-colors">Book a demo</a>
          <button id="menuBtn" class="lg:hidden grid place-items-center h-10 w-10 rounded-lg border border-ink/10 text-ink" aria-label="Open menu">
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16" stroke-linecap="round"/></svg>
          </button>
        </div>
      </nav>
    </div>
    <div id="mobileMenu" class="lg:hidden hidden border-b border-ink/5 bg-paper/95 backdrop-blur-xl">
      <div class="px-5 py-4 flex flex-col gap-1 text-[16px] font-medium">
        <a href="index.html#agentic" class="py-2.5 text-ink/80">Agentic Mode</a>
        <a href="index.html#features" class="py-2.5 text-ink/80">Platform</a>
        <a href="index.html#briefcase" class="py-2.5 text-ink/80">Digital Briefcase</a>
        <a href="security.html" class="py-2.5 text-ink/80">Security</a>
        <a href="index.html#pricing" class="py-2.5 text-ink/80">Pricing</a>
        <a href="index.html#demo" class="mt-2 text-center rounded-xl bg-ink text-white font-semibold py-3">Book a demo</a>
      </div>
    </div>
  </header>`;
}

function siteFooter() {
  return `
  <footer class="bg-ink-900 text-white/70 border-t border-white/10">
    <div class="max-w-7xl mx-auto px-5 py-14">
      <div class="grid md:grid-cols-2 lg:grid-cols-5 gap-10">
        <div class="lg:col-span-2 max-w-sm">
          <a href="index.html" class="flex items-center gap-2.5">
            <span class="text-[20px] font-bold text-white">Anura</span>
          </a>
          <p class="mt-4 text-[14px] leading-relaxed">The agentic practice platform built for Indian High Court &amp; District Court litigators. Sync the courts, draft the file, never miss a date.</p>
          <p class="mt-5 text-[13px] text-white/40">Made in India 🇮🇳 · Data resident in India</p>
        </div>
        <div>
          <p class="text-[13px] font-bold uppercase tracking-wider text-white/40 mb-4">Platform</p>
          <ul class="space-y-2.5 text-[14px]">
            <li><a href="index.html#agentic" class="hover:text-white transition">Agentic Mode</a></li>
            <li><a href="index.html#features" class="hover:text-white transition">e-Courts Sync</a></li>
            <li><a href="index.html#features" class="hover:text-white transition">Document Management</a></li>
            <li><a href="index.html#briefcase" class="hover:text-white transition">Digital Briefcase</a></li>
            <li><a href="index.html#features" class="hover:text-white transition">GST Billing</a></li>
          </ul>
        </div>
        <div>
          <p class="text-[13px] font-bold uppercase tracking-wider text-white/40 mb-4">Company</p>
          <ul class="space-y-2.5 text-[14px]">
            <li><a href="about.html" class="hover:text-white transition">About</a></li>
            <li><a href="security.html" class="hover:text-white transition">Security</a></li>
            <li><a href="index.html#pricing" class="hover:text-white transition">Pricing</a></li>
            <li><a href="careers.html" class="hover:text-white transition">Careers</a></li>
            <li><a href="contact.html" class="hover:text-white transition">Contact</a></li>
          </ul>
        </div>
        <div>
          <p class="text-[13px] font-bold uppercase tracking-wider text-white/40 mb-4">Legal</p>
          <ul class="space-y-2.5 text-[14px]">
            <li><a href="privacy.html" class="hover:text-white transition">Privacy Policy</a></li>
            <li><a href="terms.html" class="hover:text-white transition">Terms of Service</a></li>
            <li><a href="dpdpa.html" class="hover:text-white transition">DPDPA Compliance</a></li>
            <li><a href="data-residency.html" class="hover:text-white transition">Data Residency</a></li>
          </ul>
        </div>
      </div>
      <div class="mt-12 pt-7 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p class="text-[13px] text-white/40">© <span data-year>2026</span> Anura Technologies Pvt. Ltd. All rights reserved.</p>
        <div class="flex items-center gap-4 text-white/50">
          <a href="#" aria-label="LinkedIn" class="hover:text-white transition"><svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14zM8.3 18.3v-7H6v7h2.3zM7.1 10.2a1.3 1.3 0 100-2.6 1.3 1.3 0 000 2.6zM18 18.3v-3.8c0-2-.4-3.6-2.8-3.6-1.1 0-1.9.6-2.2 1.2v-1H10.8v7h2.3v-3.5c0-.9.2-1.8 1.3-1.8s1.3 1 1.3 1.9v3.4H18z"/></svg></a>
          <a href="#" aria-label="X" class="hover:text-white transition"><svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 3h3l-6.6 7.5L22 21h-6l-4.3-5.6L6.8 21H3.7l7-8L2 3h6.2l3.9 5.2L17.5 3zm-1 16h1.7L7.6 4.8H5.8L16.5 19z"/></svg></a>
          <a href="#" aria-label="YouTube" class="hover:text-white transition"><svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M23 12s0-3.4-.4-5a2.6 2.6 0 00-1.8-1.8C19 5 12 5 12 5s-7 0-8.8.4A2.6 2.6 0 001.4 7C1 8.6 1 12 1 12s0 3.4.4 5a2.6 2.6 0 001.8 1.8C5 19 12 19 12 19s7 0 8.8-.4A2.6 2.6 0 0022.6 17c.4-1.6.4-5 .4-5zM10 15.5v-7l6 3.5-6 3.5z"/></svg></a>
        </div>
      </div>
    </div>
  </footer>`;
}

/* ---- Inject + wire up once the DOM is ready ---- */
function initAnuraChrome() {
  document.querySelectorAll('[data-site-header]').forEach(el => { el.outerHTML = siteHeader(); });
  document.querySelectorAll('[data-site-footer]').forEach(el => { el.outerHTML = siteFooter(); });

  // Current year
  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = '2026'; });

  // Mobile menu
  const menuBtn = document.getElementById('menuBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  menuBtn?.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
  mobileMenu?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => mobileMenu.classList.add('hidden')));

  // Navbar shadow on scroll
  const nav = document.getElementById('nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('shadow-soft', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Reveal on scroll
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAnuraChrome);
} else {
  initAnuraChrome();
}
