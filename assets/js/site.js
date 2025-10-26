const $=(s,c=document)=>c.querySelector(s); const $$=(s,c=document)=>[...c.querySelectorAll(s)];
function navActive(){const p=location.pathname.split('/').pop()||'index.html'; $$('.links a').forEach(a=>{a.style.opacity=(a.getAttribute('href')===p)?'1':'.85'; a.style.textDecoration=(a.getAttribute('href')===p)?'underline':'none';});}
function fmt(n){return Number(n||0).toLocaleString('en-US');}
function baselineFrom(neigh,unit){const d=window.DRP_DATA; const n=d.neighborhoods?.[neigh]?.[unit]; return n||{adr:600,occ:0.6,avg_stay_nights:3.0};}
function opsRollup(sel){let occ=0,adr=0,fee=0,vb=0; sel.forEach(k=>{const o=DRP_DATA.ops[k]; if(o){occ+=o.occ_drop_pct||0; adr+=o.adr_drop_pct||0; fee+=o.fee_bump_pct||0; vb+=(o.var_bump_per_stay||0);}}); return {occDropPct:occ,adrDropPct:adr,feeBumpPct:fee,varBumpPerStay:vb};}
function turnoversPerMonth(occ,avgStay){const nights=30*occ; return Math.max(1, Math.round(nights/Math.max(1,avgStay)));}
function cohostEstimate({neigh,unit,adrInput,occPctInput,baseFeePct,fixed,ops,includeFixed}){
  const base=baselineFrom(neigh,unit); const roll=opsRollup(ops);
  const occ=Math.max(0, Math.min(1, ((occPctInput??base.occ*100)/100) * (1-roll.occDropPct/100)));
  const adr=Math.max(0, (adrInput??base.adr) * (1-roll.adrDropPct/100));
  const gross=Math.round(adr*occ*30);
  const feePct=(baseFeePct||DRP_DATA.cohost_base_fee_pct)+roll.feeBumpPct;
  const stays=turnoversPerMonth(occ, base.avg_stay_nights);
  const d=DRP_DATA.variable_per_stay; const varPerStay=(d.cleaning[unit]||150)+d.restock+d.linen+roll.varBumpPerStay;
  const variable=Math.round(stays*varPerStay);
  const fixedMonthly=includeFixed?(fixed.internet+fixed.insurance+fixed.hoa):0;
  const feeMAD=Math.round(gross*(feePct/100)); const ownerNet=Math.round(gross-feeMAD-variable-fixedMonthly);
  return {gross,feePct,feeMAD,stays,variable,fixedMonthly,ownerNet, avgStay: base.avg_stay_nights, adr, occ};
}
function baseCohostEstimate(p){const b=baselineFrom(p.neigh,p.unit); return cohostEstimate({...p, adrInput:b.adr, occPctInput:b.occ*100});}
function leaseEstimate({neigh,unit,includeFixed,ops,targetMarginPct}){
  const base=baselineFrom(neigh,unit);
  const co=cohostEstimate({neigh,unit,adrInput:base.adr,occPctInput:base.occ*100,baseFeePct:DRP_DATA.cohost_base_fee_pct,fixed:DRP_DATA.fixed_expenses_defaults,ops,includeFixed});
  const margin=Math.round((targetMarginPct/100)*co.gross);
  let rentCap=Math.max(0, co.gross - co.variable - (includeFixed?co.fixedMonthly:0) - margin);
  const suggested=Math.max(0, Math.round(rentCap*0.95)); return {gross:co.gross,stays:co.stays,variable:co.variable,fixedMonthly:co.fixedMonthly,marginMAD:margin,rentCap,suggested, avgStay: co.avgStay};
}
function readOps(c){return $$('input[type=checkbox][data-op]:checked',c).map(i=>i.dataset.op)}
function readFixed(c){const on=(id)=>$(id,c)?.checked; const val=(id,def)=>{const el=$(id,c); const v=parseFloat(el?.value||def)||def; return v}; return {internet:on('#fx-internet')?val('#fx-internet-amt',300):0,insurance:on('#fx-insurance')?val('#fx-insurance-amt',120):0,hoa:on('#fx-hoa')?val('#fx-hoa-amt',0):0};}
function bind(form,run){['input','change','keyup','click'].forEach(e=>form.addEventListener(e,run));}
function opsControlsHtml(){return Object.entries(DRP_DATA.ops).map(([k,o])=>`<label><input type="checkbox" data-op="${k}"> ${o.label}</label>`).join('');}
function fixedGridHtml(){const d=DRP_DATA.fixed_expenses_defaults; return `<div class="fixed-grid">
  <div class="fixed-row"><input id="fx-internet" type="checkbox" checked> <span>Internet</span>
    <input id="fx-internet-amt" type="number" min="0" value="${d.internet}"> <span>MAD / month</span></div>
  <div class="fixed-row"><input id="fx-insurance" type="checkbox" checked> <span>Insurance</span>
    <input id="fx-insurance-amt" type="number" min="0" value="${d.insurance}"> <span>MAD / month</span></div>
  <div class="fixed-row"><input id="fx-hoa" type="checkbox"> <span>HOA</span>
    <input id="fx-hoa-amt" type="number" min="0" value="${d.hoa}"> <span>MAD / month</span></div>
</div>`;}
function wireCohost(){navActive(); const f=$('#calc-form'); $('#ops-host',f).innerHTML=opsControlsHtml(); $('#fixed-host',f).innerHTML=fixedGridHtml();
  const neigh=$('#neigh'), unit=$('#unit'), adr=$('#adr'), occ=$('#occ');
  function sync(){const b=baselineFrom(neigh.value,unit.value); if(!adr.dataset.touched) adr.value=b.adr; if(!occ.dataset.touched) occ.value=Math.round(b.occ*100); $('#avgstay').textContent=b.avg_stay_nights.toFixed(1);}
  ['change','input'].forEach(ev=>{adr.addEventListener(ev,()=>adr.dataset.touched=true); occ.addEventListener(ev,()=>occ.dataset.touched=true)}); neigh.addEventListener('change',sync); unit.addEventListener('change',sync); sync();
  function run(){const ops=readOps(f); const fixed=readFixed(f);
    const res=cohostEstimate({neigh:neigh.value,unit:unit.value,adrInput:parseFloat(adr.value),occPctInput:parseFloat(occ.value),baseFeePct:DRP_DATA.cohost_base_fee_pct,fixed,ops,includeFixed:true});
    const baseRes=baseCohostEstimate({neigh:neigh.value,unit:unit.value,baseFeePct:DRP_DATA.cohost_base_fee_pct,fixed,ops,includeFixed:true});
    $('#kpi-gross').textContent=fmt(res.gross); $('#kpi-fee').textContent=`${res.feePct.toFixed(0)}% → ${fmt(res.feeMAD)}`; $('#kpi-stays').textContent=fmt(res.stays);
    $('#kpi-variable').textContent=fmt(res.variable); $('#kpi-fixed').textContent=fmt(res.fixedMonthly); $('#kpi-owner').textContent=fmt(res.ownerNet); $('#kpi-base-owner').textContent=fmt(baseRes.ownerNet);}
  bind(f,run); $('#calc')?.addEventListener('click',run); run();}
function wireLease(){navActive(); const f=$('#calc-form'); $('#ops-host',f).innerHTML=opsControlsHtml();
  function run(){const neigh=$('#neigh').value, unit=$('#unit').value; const ops=readOps(f); const res=leaseEstimate({neigh,unit,includeFixed:true,ops,targetMarginPct:DRP_DATA.lease_target_margin_pct});
    $('#headline-val').textContent=fmt(res.suggested); $('#d-gross').textContent=fmt(res.gross); $('#d-stays').textContent=fmt(res.stays);
    $('#d-variable').textContent=fmt(res.variable); $('#d-fixed').textContent=fmt(res.fixedMonthly); $('#d-margin').textContent=fmt(res.marginMAD); $('#d-rentcap').textContent=fmt(res.rentCap); $('#d-avgstay').textContent=res.avgStay.toFixed(1);}
  bind(f,run); $('#calc')?.addEventListener('click',run); run();}
window.addEventListener('DOMContentLoaded',()=>{const p=document.body.dataset.page; if(p==='cohost-fur'||p==='cohost-unfur') wireCohost(); else if(p==='lease-fur'||p==='lease-unfur') wireLease(); else navActive();});
