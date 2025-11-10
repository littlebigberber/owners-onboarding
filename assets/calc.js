
const BASELINES = {
  neighborhoods: ["Gueliz"],
  units: ["Studio", "1BR", "2BR", "3BR"],
  adr: {
    "Gueliz": { "Studio": 500, "1BR": 600, "2BR": 750, "3BR": 950 }
  },
  occ: {
    "Gueliz": { "Studio": 0.58, "1BR": 0.60, "2BR": 0.55, "3BR": 0.52 }
  },
  avgStay: 3.0,
  perStay: { "Studio": 190, "1BR": 235, "2BR": 280, "3BR": 335 }, // cleaning + restock + linen
  furnishBudget: { "Studio": 20000, "1BR": 30000, "2BR": 45000, "3BR": 60000 }
};

const OPS = [
  {id:"noise",    occMult:0.95,  adrMult:1.00,  perStayAdd:0},
  {id:"stairs",   occMult:0.98,  adrMult:0.995, perStayAdd:0},
  {id:"parking",  occMult:0.97,  adrMult:1.00,  perStayAdd:0},
  {id:"hoa",      occMult:0.98,  adrMult:1.00,  perStayAdd:0},
  {id:"gated",    occMult:0.99,  adrMult:1.00,  perStayAdd:10},
  {id:"maze",     occMult:0.99,  adrMult:1.00,  perStayAdd:10},
  {id:"noself",   occMult:0.99,  adrMult:1.00,  perStayAdd:15},
  {id:"delicate", occMult:1.00,  adrMult:1.00,  perStayAdd:20},
];

function fmt(n){ return Number(n).toLocaleString(undefined,{maximumFractionDigits:0}); }
function fmt1(n){ return Number(n).toLocaleString(undefined,{maximumFractionDigits:1}); }
function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }
function getBaselineADR(nei, unit){ return BASELINES.adr[nei][unit]; }
function getBaselineOcc(nei, unit){ return BASELINES.occ[nei][unit]; }
function getPerStay(unit){ return BASELINES.perStay[unit]; }
function getBudget(unit){ return BASELINES.furnishBudget[unit]; }
function fractionalStays(occ, avgStay){ return (occ * 30.0) / avgStay; }

function applyOps(adr, occ, perStay, checked){
  let a=adr, o=occ, p=perStay, c=0;
  checked.forEach(id=>{
    const op = OPS.find(x=>x.id===id); if(!op) return;
    a*=op.adrMult; o*=op.occMult; p+=op.perStayAdd; c++;
  });
  a=clamp(a,0,adr); o=clamp(o,0,occ);
  return {adr:a, occ:o, perStay:p, count:c};
}

function cohostCalc({nei, unit, adrInput, occInput, avgStay, fixeds, feeBasePct, feeBumpsPct, opsChecked}){
  const baseADR = getBaselineADR(nei, unit);
  const baseOcc = getBaselineOcc(nei, unit);
  const basePer = getPerStay(unit);
  const adj = applyOps(adrInput, occInput, basePer, opsChecked);
  const stays = Math.round(fractionalStays(adj.occ, avgStay));
  const gross = adj.adr * adj.occ * 30.0;
  const varMonthly = adj.perStay * stays;
  const feePct = feeBasePct + feeBumpsPct;
  const feeMAD = gross * feePct;
  const fixedMonthly = fixeds.internet + fixeds.insurance + fixeds.hoa;
  const ownerNet = gross - varMonthly - feeMAD - fixedMonthly;

  const baseGross = baseADR * baseOcc * 30.0;
  const baseVar = basePer * Math.round(fractionalStays(baseOcc, avgStay));
  const baseFee = baseGross * feeBasePct;
  const baseOwner = baseGross - baseVar - baseFee - fixedMonthly;
  return {gross, stays, varMonthly, feeMAD, feePct, fixedMonthly, ownerNet, baseOwner};
}

function leaseCalc({nei, unit, avgStay, opsChecked, marginBasePct=0.12, bufferPct=0.05, fixeds, amortize}){
  const baseADR = getBaselineADR(nei, unit);
  const baseOcc = getBaselineOcc(nei, unit);
  const basePer = getPerStay(unit);
  const adj = applyOps(baseADR, baseOcc, basePer, opsChecked);
  const staysFrac = fractionalStays(adj.occ, avgStay);
  const gross = adj.adr * adj.occ * 30.0;
  const varMonthly = adj.perStay * staysFrac;
  const fixedMonthly = (fixeds.internet||0)+(fixeds.insurance||0)+(fixeds.hoa||0);
  let marginPct = marginBasePct + (adj.count>=3 ? 0.02 : 0.0);
  const marginMAD = gross * marginPct;
  const amortMAD = amortize.enabled ? (amortize.budget / Math.max(1, amortize.months)) : 0;
  let rentCap = gross - varMonthly - fixedMonthly - amortMAD - marginMAD;
  let offer = rentCap * (1.0 - bufferPct);

  // monotonic guard vs zero-ops
  const zGross = baseADR * baseOcc * 30.0;
  const zVar = basePer * fractionalStays(baseOcc, avgStay);
  const zMargin = zGross * marginBasePct;
  const zAmort = amortize.enabled ? (amortize.budget / Math.max(1, amortize.months)) : 0;
  const zCap = zGross - zVar - fixedMonthly - zAmort - zMargin;
  const zOffer = zCap * (1.0 - bufferPct);
  offer = Math.min(offer, zOffer);

  return {gross, staysFrac, varMonthly, fixedMonthly, marginMAD, amortMAD, rentCap, offer, marginPct};
}

function money(n){ return fmt(Math.round(n)); }

export { BASELINES, OPS, fmt, fmt1, money, cohostCalc, leaseCalc, getBudget };
