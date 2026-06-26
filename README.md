# Anura - Landing Page

Marketing landing page for **Anura**, the AI-native practice management platform for Indian
High Court & District Court litigators. The site leads with **Agentic Mode** and the core
pain points of everyday practice (missed hearing dates, WhatsApp chaos, document sprawl,
lost billable hours).

## Preview

It's a single, self-contained file - no build step required.

```bash
# Option A: just open it
start index.html        # Windows

# Option B: serve it (matches the preview config)
python -m http.server 4321
# then visit http://localhost:4321
```

## Tech

- Single-file `index.html` (no bundler, no dependencies to install)
- [Tailwind CSS](https://tailwindcss.com) via CDN with a custom theme
- Fonts: Fraunces (display serif) + Plus Jakarta Sans (UI) + JetBrains Mono
- Inline SVG/HTML mockups - **zero image assets**, works offline
- Vanilla JS for scroll-reveal, count-up stats, mobile menu, FAQ accordion, and the
  animated Agentic Mode console

## Structure

| Section | Purpose |
|---|---|
| Hero | Agentic positioning + live cause-list dashboard mockup |
| Problem | The four things that eat a litigator's day |
| Agentic Mode | Animated agent console - the flagship differentiator |
| Platform | e-Courts sync, DMS, client portal, ops, billing |
| Digital Briefcase | Offline pre-hearing prep (tablet mockup) |
| WhatsApp alerts | Notification-first messaging |
| Security | DPDPA 2023, AES-256, India data residency, MFA |
| Pricing | Solo / Chambers / Firm tiers |
| FAQ + Demo | Conversion + lead capture |

## Notes

- Copy, pricing (₹), testimonials, and court names are **illustrative placeholders** -
  swap in real figures before going live.
- The demo form currently shows a client-side success message only; wire it to a real
  endpoint (Formspree, a backend, etc.) to capture leads.
