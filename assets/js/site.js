// Shared interactions for Owners Onboarding
function $(sel,ctx){return (ctx||document).querySelector(sel)}
function $all(sel,ctx){return [...(ctx||document).querySelectorAll(sel)]}

function navActive(){
  const p = location.pathname.split('/').pop() || 'index.html';
  $all('nav .links a').forEach(a=>{
    const href = a.getAttribute('href');
    if(href === p){ a.style.opacity = '1'; a.style.textDecoration = 'underline'; }
  });
}

// Calculator
function calcEstimate(){
  const adr = parseFloat($('#adr')?.value || 600);
  const occ = parseFloat($('#occ')?.value || 60)/100;
  const fee = parseFloat($('#fee')?.value || 22)/100;
  const utils = parseFloat($('#utils')?.value || 1000);
  const nights = 30;
  const gross = Math.round(adr*occ*nights);
  const feeMAD = Math.round(gross*fee);
  const ownerNet = Math.round(gross - feeMAD - utils);
  const fmt = (n)=>n.toLocaleString('en-US');

  if($('#kpi-gross')) $('#kpi-gross').textContent = fmt(gross);
  if($('#kpi-fee')) $('#kpi-fee').textContent = fmt(feeMAD);
  if($('#kpi-owner')) $('#kpi-owner').textContent = fmt(ownerNet);
}

// Get Started form → mailto
function wireForm(){
  const form = $('#start-form');
  if(!form) return;
  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const subject = encodeURIComponent(`Owner Onboarding — ${data.fullname || 'New Lead'}`);
    const lines = [
      `Full name: ${data.fullname||''}`,
      `Email: ${data.email||''}`,
      `WhatsApp: ${data.whatsapp||''}`,
      `Property address: ${data.address||''}`,
      `City: ${data.city||''}`,
      `Unit type: ${data.unittype||''}`,
      `Bedrooms: ${data.bedrooms||''}`,
      `Elevator: ${data.elevator||''}`,
      `HOA: ${data.hoa||''}`,
      `Available from: ${data.available||''}`,
      `Notes: ${data.notes||''}`
    ];
    const body = encodeURIComponent(lines.join('\n'));
    // Default email; can be baked into a custom ZIP later.
    const to = 'owners@example.com';
    location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  });
}

window.addEventListener('DOMContentLoaded', ()=>{
  navActive();
  const calcBtn = $('#calc');
  if(calcBtn){ calcBtn.addEventListener('click', calcEstimate); calcEstimate(); }
  wireForm();
});
