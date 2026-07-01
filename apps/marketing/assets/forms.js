/* ============================================================
   Anura - form delivery via FormSubmit.co (no backend required).
   Submissions are emailed to ANURA_FORM_PRIMARY and CC'd to ANURA_FORM_CC.

   ONE-TIME ACTIVATION: the very first submission makes FormSubmit send a
   confirmation link to ANURA_FORM_PRIMARY. Click it once; after that, every
   submission is delivered to both addresses below.

   To change recipients, edit the two constants. For a public repo you can
   hide the addresses by switching ANURA_FORM_ENDPOINT to the hashed form
   FormSubmit gives you after activation (https://formsubmit.co/ajax/<token>).
   ============================================================ */

const ANURA_FORM_PRIMARY = 'work.anujtiwari27@gmail.com';
const ANURA_FORM_CC      = 'mailtoramksharma@gmail.com';
const ANURA_FORM_ENDPOINT = 'https://formsubmit.co/ajax/' + ANURA_FORM_PRIMARY;

async function submitAnuraForm(form) {
  const btn       = form.querySelector('button[type="submit"]');
  const successEl = form.querySelector('[data-form-success]');
  const errorEl   = form.querySelector('[data-form-error]');
  successEl && successEl.classList.add('hidden');
  errorEl && errorEl.classList.add('hidden');

  const payload = Object.fromEntries(new FormData(form).entries());

  // Honeypot: if a bot filled the hidden field, silently stop.
  if (payload._honey) return false;
  delete payload._honey;

  payload._cc = ANURA_FORM_CC;
  payload._template = 'table';
  payload._captcha = 'false';
  if (!payload._subject) payload._subject = 'New enquiry from the Anura website';

  const label = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

  try {
    const res = await fetch(ANURA_FORM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && (json.success === true || json.success === 'true')) {
      form.reset();
      successEl && successEl.classList.remove('hidden');
    } else {
      throw new Error(json.message || 'Request failed');
    }
  } catch (err) {
    if (errorEl) errorEl.classList.remove('hidden');
    else alert('Sorry, that did not send. Please email us directly.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = label; }
  }
  return false;
}
