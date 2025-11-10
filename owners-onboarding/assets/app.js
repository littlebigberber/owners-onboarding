
const DATA = {
  neighborhoods: {
    'Gueliz': {
      'Studio': { adr: 500, occ: 0.58 },
      '1BR': { adr: 650, occ: 0.60 },
      '2BR': { adr: 780, occ: 0.58 },
      '3BR': { adr: 980, occ: 0.55 },
    },
    'Hivernage': {
      'Studio': { adr: 560, occ: 0.62 },
      '1BR': { adr: 720, occ: 0.62 },
      '2BR': { adr: 880, occ: 0.60 },
      '3BR': { adr: 1100, occ: 0.58 },
    },
    'Medina': {
      'Studio': { adr: 480, occ: 0.55 },
      '1BR': { adr: 620, occ: 0.56 },
      '2BR': { adr: 760, occ: 0.54 },
      '3BR': { adr: 980, occ: 0.52 },
    }
  },
  perStayByUnit: { 'Studio':190, '1BR':235, '2BR':280, '3BR':335 },
  avgStayNights: 3.0,
  cohostFeePct: 0.22,
  leaseMarginPct: 0.12,  // + risk bump if many stops
  leaseOfferBuffer: 0.05,
  amortDefaults: { 'Studio':20000, '1BR':30000, '2BR':45000, '3BR':60000 },
  ops: [
    {key:'noise', label:'Noise‑sensitive building', dAdr:-0.05, dOcc:-0.05, addPerStay:0},
    {key:'stairs', label:'Stairs only (no elevator)', dAdr:0, dOcc:-0.04, addPerStay:0},
    {key:'parking', label:'Parking is difficult', dAdr:0, dOcc:-0.03, addPerStay:0},
    {key:'hoa', label:'Strict HOA / building rules', dAdr:0, dOcc:-0.03, addPerStay:10},
    {key:'access', label:'Gated/complex access (codes)', dAdr:0, dOcc:-0.01, addPerStay:12},
    {key:'address', label:'Hard‑to‑find address / maze‑like', dAdr:0, dOcc:-0.02, addPerStay:0},
    {key:'handoff', label:'No self check‑in (in‑person handoff)', dAdr:0, dOcc:0, addPerStay:25},
    {key:'delicate', label:'Delicate finishes (extra care)', dAdr:0, dOcc:0, addPerStay:15},
  ]
};

function fmt(n){ return (Math.round(n)).toLocaleString() }
function clamp(x,min,max){ return Math.max(min, Math.min(max, x)) }

function buildOps(container){
  container.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'ops-grid';
  DATA.ops.forEach(op=>{
    const wrap = document.createElement('div'); wrap.className='stop';
    const cb = document.createElement('input'); cb.type='checkbox'; cb.id = 'op_' + op.key;
    const lab = document.createElement('label'); lab.htmlFor = cb.id; lab.innerHTML = `<strong>${op.label}</strong><br><span class="muted">ADR ${op.dAdr?op.dAdr*100:''}%  • Occ ${op.dOcc?op.dOcc*100:''}%  ${op.addPerStay?(' • +' + op.addPerStay + ' MAD/stay'):''}</span>`;
    wrap.append(cb, lab); grid.appendChild(wrap);
  });
  container.appendChild(grid);
}

function baselineFor(nb, unit){
  const n = DATA.neighborhoods[nb] || DATA.neighborhoods['Gueliz'];
  return (n && n[unit]) ? n[unit] : { adr:500, occ:0.58 };
}

function applyOps(adr, occ, unit){
  let perStay = DATA.perStayByUnit[unit] || 200;
  let dAdr = 0, dOcc = 0;
  let activeCount = 0;
  DATA.ops.forEach(op=>{
    const el = document.getElementById('op_'+op.key);
    if(el && el.checked){ 
      dAdr += op.dAdr; dOcc += op.dOcc; perStay += op.addPerStay; activeCount++;
    }
  });
  // Clamp changes (never positive bumps)
  dAdr = Math.min(0, dAdr); dOcc = Math.min(0, dOcc);
  const adr2 = Math.max(0, adr * (1 + dAdr));
  const occ2 = clamp(occ * (1 + dOcc), 0, 0.95);
  const riskBump = activeCount >= 3 ? 0.02 : 0; // lease margin risk add
  return { adr: adr2, occ: occ2, perStay, riskBump };
}

function computeCommon(nb, unit){
  const base = baselineFor(nb, unit);
  const ops = applyOps(base.adr, base.occ, unit);
  const avgStay = DATA.avgStayNights;
  const nights = ops.occ * 30;
  const gross = ops.adr * nights;
  const stays = nights / avgStay;
  const varMonthly = ops.perStay * stays;
  return { base, ops, gross, stays, varMonthly, avgStay };
}

function setText(id, v){ const el = document.getElementById(id); if(el){ el.textContent = v } }

function initSelects(selectNB, selectUnit){
  const nb = selectNB, un = selectUnit;
  // neighborhoods
  nb.innerHTML = '';
  Object.keys(DATA.neighborhoods).forEach(k=>{
    const opt = document.createElement('option'); opt.value=k; opt.textContent=k; nb.appendChild(opt);
  });
  // units
  un.innerHTML = '';
  ['Studio','1BR','2BR','3BR'].forEach(k=>{
    const opt = document.createElement('option'); opt.value=k; opt.textContent=k; un.appendChild(opt);
  });
  nb.value = 'Gueliz'; un.value='Studio';
}

function hookCompact(){
  document.body.classList.add('compact');
}

export function initCohost(page){
  hookCompact();
  const nb = document.getElementById('nb');
  const unit = document.getElementById('unit');
  const opsBox = document.getElementById('opsBox');
  buildOps(opsBox); initSelects(nb, unit);
  const internet = document.getElementById('internet');
  const insurance = document.getElementById('insurance');
  const hoa = document.getElementById('hoa');
  const feePct = document.getElementById('feePct');
  feePct.value = 22;

  function run(){
    const c = computeCommon(nb.value, unit.value);
    const fee = (Number(feePct.value||22)/100) * c.gross;
    const fixed = (internet.checked? Number(document.getElementById('internetAmt').value||0):0) + \
                  (insurance.checked? Number(document.getElementById('insuranceAmt').value||0):0) + \
                  (hoa.checked? Number(document.getElementById('hoaAmt').value||0):0);
    const ownerNet = c.gross - c.varMonthly - fee - fixed;
    const baseGross = c.base.adr * (c.base.occ*30);
    const baseStays = (c.base.occ*30) / c.avgStay;
    const baseVar = (DATA.perStayByUnit[unit.value]||200) * baseStays;
    const baseFee = (Number(feePct.value||22)/100) * baseGross;
    const baseOwner = baseGross - baseVar - baseFee - fixed;
    // Render
    setText('kGross', fmt(c.gross));
    setText('kStays', (c.stays).toFixed(1));
    setText('kVar', fmt(c.varMonthly));
    setText('kFee', fmt(fee) + ` (${Number(feePct.value||22)}%)`);
    setText('kFixed', fmt(fixed));
    setText('kOwner', fmt(ownerNet));
    setText('kBaseOwner', fmt(baseOwner));
  }
  document.getElementById('calc').addEventListener('click', run);
  opsBox.addEventListener('change', run);
  [nb, unit, internet, insurance, hoa, feePct,
   document.getElementById('internetAmt'),
   document.getElementById('insuranceAmt'),
   document.getElementById('hoaAmt')].forEach(el=>el.addEventListener('input', run));
  run();
}

export function initLease(isUnfurnished){
  hookCompact();
  const nb = document.getElementById('nb');
  const unit = document.getElementById('unit');
  const opsBox = document.getElementById('opsBox');
  buildOps(opsBox); initSelects(nb, unit);

  const amortOn = document.getElementById('amortOn');
  const amortMonths = document.getElementById('amortMonths');
  const amortBudget = document.getElementById('amortBudget');
  function setDefaultBudget(){ amortBudget.value = DATA.amortDefaults[unit.value] || 30000 }
  setDefaultBudget();

  function run(){
    const c = computeCommon(nb.value, unit.value);
    let marginPct = DATA.leaseMarginPct + c.ops.riskBump; // add risk if many ops stops
    const margin = marginPct * c.gross;
    let amort = 0;
    if(isUnfurnished && amortOn.checked){
      const months = Math.max(1, Number(amortMonths.value||24));
      amort = (Number(amortBudget.value||0)) / months;
    }
    const rentCap = c.gross - c.varMonthly - margin - amort;
    // Monotonic: don't allow ops to raise rent vs baseline (same amort & margin baseline)
    const baseGross = c.base.adr * (c.base.occ*30);
    const baseStays = (c.base.occ*30) / c.avgStay;
    const baseVar = (DATA.perStayByUnit[unit.value]||200) * baseStays;
    const baseRentCap = baseGross - baseVar - (DATA.leaseMarginPct*baseGross) - amort; // amort same for comparison
    const offer = Math.min(rentCap, baseRentCap) * (1 - DATA.leaseOfferBuffer);

    // Render
    setText('kGross', fmt(c.gross));
    setText('kStays', (c.stays).toFixed(1));
    setText('kVar', fmt(c.varMonthly));
    setText('kFixed', '0'); // lease pages assume utilities by owner
    setText('kMargin', fmt(margin));
    setText('kRentCap', fmt(rentCap));
    setText('kAvgStay', c.avgStay.toFixed(1));
    setText('kOffer', fmt(Math.max(0, offer)));
  }

  document.getElementById('calc').addEventListener('click', run);
  opsBox.addEventListener('change', run);
  [nb, unit].forEach(el=>el.addEventListener('input', ()=>{setDefaultBudget(); run()}));
  if(isUnfurnished){
    [amortOn, amortMonths, amortBudget].forEach(el=>el.addEventListener('input', run));
  }
  run();
}
