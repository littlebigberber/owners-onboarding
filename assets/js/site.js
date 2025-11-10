const $=(s,c=document)=>c.querySelector(s); const $$=(s,c=document)=>[...c.querySelectorAll(s)];
function navActive(){const p=location.pathname.split('/').pop()||'index.html'; $$('.links a').forEach(a=>{a.style.opacity=(a.getAttribute('href')===p)?'1':'.85'; a.style.textDecoration=(a.getAttribute('href')===p)?'underline':'none';});}
function fmt(n){return Number.isFinite(+n)?Number(n).toLocaleString('en-US'):'0';}
function baselineFrom(neigh,unit){const d=window.DRP_DATA; const n=d.neighborhoods?.[neigh]?.[unit]; return n||{adr:600,occ:0.6,avg_stay_nights:3.0};}
function opsRollup(sel){let occ=0,adr=0,fee=0,vb=0; sel.forEach(k=>{const o=DRP_DATA.ops[k]; if(o){occ+=o.occ_drop_pct||0; adr+=o.adr_drop_pct||0; fee+=o.fee_bump_pct||0; vb+=(o.var_bump_per_stay||0);}}); return {occDropPct:occ,adrDropPct:adr,feeBumpPct:fee,varBumpPerStay:vb};}
function turnoversPerMonthRounded(occ,avgStay){const nights=30*occ; return Math.max(1, Math.round(nights/Math.max(1,avgStay)));}
function turnoversPerMonthFractional(occ,avgStay){const nights=30*occ; return Math.max(0, nights/Math.max(0.1,avgStay));}

function readFixed(c){
  const on=(id)=>$(id,c)?.checked;
  const val=(id,def)=>{const el=$(id,c); const v=parseFloat(el?.value); return Number.isFinite(v)?v:def;}
  let internet = on('#fx-internet') ? val('#fx-internet-amt', DRP_DATA.fixed_expenses_defaults.internet) : 0;
  let insurance = on('#fx-insurance') ? val('#fx-insurance-amt', DRP_DATA.fixed_expenses_defaults.insurance) : 0;
  let hoa = on('#fx-hoa') ? val('#fx-hoa-amt', DRP_DATA.fixed_expenses_defaults.hoa) : 0;
  let furnishing = 0;
  if ($('#fx-furnish',c)) {
    const includeF = on('#fx-furnish');
    const budget = val('#fx-furnish-budget', DRP_DATA.furnishing_defaults.budget);
    const months = Math.max(1, val('#fx-furnish-months', DRP_DATA.furnishing_defaults.months));
    furnishing = includeF ? (budget / months) : 0;
  }
  return {internet, insurance, hoa, furnishing, total: (internet||0)+(insurance||0)+(hoa||0)+(furnishing||0)};
}

// Estimators
function cohostEstimate({neigh,unit,adrInput,occPctInput,baseFeePct,fixed,ops,includeFixed}){
  const base=baselineFrom(neigh,unit); const roll=opsRollup(ops);
  const occ=Math.max(0, Math.min(1, ((occPctInput??base.occ*100)/100) * (1-roll.occDropPct/100)));
  const adr=Math.max(0, (adrInput??base.adr) * (1-roll.adrDropPct/100));
  const gross=Math.round(adr*occ*30);
  const feePct=(baseFeePct||DRP_DATA.cohost_base_fee_pct)+roll.feeBumpPct;
  const stays=turnoversPerMonthRounded(occ, base.avg_stay_nights);
  const d=DRP_DATA.variable_per_stay; const varPerStay=(d.cleaning[unit]||150)+d.restock+d.linen+roll.varBumpPerStay;
  const variable=Math.round(stays*varPerStay);
  const fixedMonthly=includeFixed?(fixed.total||0):0;
  const feeMAD=Math.round(gross*(feePct/100));
  const ownerNet=Math.round(gross-feeMAD-variable-fixedMonthly);
  return {gross,feePct,feeMAD,stays,variable,fixedMonthly,ownerNet, avgStay: base.avg_stay_nights, adr, occ, varPerStay};
}

function leaseEstimateFractional({neigh,unit,ops,targetMarginPct,includeFixed,fixed}){
  const base=baselineFrom(neigh,unit); const roll=opsRollup(ops);
  const occ=Math.max(0, Math.min(1, base.occ * (1-roll.occDropPct/100)));
  const adr=Math.max(0, base.adr * (1-roll.adrDropPct/100));
  const gross=Math.round(adr*occ*30);
  const d=DRP_DATA.variable_per_stay; const varPerStay=(d.cleaning[unit]||150)+d.restock+d.linen+roll.varBumpPerStay;
  const staysFrac=turnoversPerMonthFractional(occ, base.avg_stay_nights);
  const variable=Math.round(staysFrac*varPerStay);
  const fixedMonthly=includeFixed ? (fixed.total||0) : 0;
  const marginMAD=Math.round((targetMarginPct/100)*gross);
  const rentCap=Math.max(0, gross - variable - fixedMonthly - marginMAD);
  const suggested=Math.max(0, Math.round(rentCap*0.95));
  return {gross,staysFrac,variable,fixedMonthly,marginMAD,rentCap,suggested, avgStay: base.avg_stay_nights, varPerStay};
}

function readOps(c){return $$('input[type=checkbox][data-op]:checked',c).map(i=>i.dataset.op)}
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
function furnishCardHtml(unit){const by=DRP_DATA.furnishing_by_unit; const def=by[unit]||DRP_DATA.furnishing_defaults.budget; return `<div class="note" style="margin-top:1rem">
  <div class="kv"><input id="fx-furnish" type="checkbox"> <strong>Include furnishing amortization</strong></div>
  <div class="row" style="margin-top:.6rem">
    <div><label for="fx-furnish-budget">Furnishing budget (MAD)</label><input id="fx-furnish-budget" type="number" min="0" value="${def}"></div>
    <div><label for="fx-furnish-months">Amortize over (months)</label><input id="fx-furnish-months" type="number" min="1" value="${DRP_DATA.furnishing_defaults.months}"></div>
  </div>
  <small class="help">Monthly amortization = budget ÷ months. <a href="furnishing-checklist.html" target="_blank">See sample furnishing checklist →</a></small>
</div>`;}

function updateFurnishDefaults(container, unit){
  const input=$('#fx-furnish-budget',container);
  if (!input) return;
  if (!input.dataset.touched){ // only auto-update if user hasn't edited
    const by=DRP_DATA.furnishing_by_unit; const v = by[unit]||DRP_DATA.furnishing_defaults.budget;
    input.value = v;
  }
}
function touchOnEdit(el){ if(!el) return; ['input','change','keyup'].forEach(ev=>el.addEventListener(ev,()=>el.dataset.touched='1')); }

function wireCohost(page){
  navActive(); const f=$('#calc-form');
  $('#ops-host',f).innerHTML=opsControlsHtml();
  $('#fixed-host',f).innerHTML=fixedGridHtml();
  const unitSel=$('#unit');
  if(page==='cohost-unfur'){ $('#furnish-host',f).innerHTML=furnishCardHtml(unitSel.value); touchOnEdit($('#fx-furnish-budget',f)); }
  const neigh=$('#neigh'), adr=$('#adr'), occ=$('#occ');
  function sync(){const b=baselineFrom(neigh.value,unitSel.value); if(!adr.dataset.touched) adr.value=b.adr; if(!occ.dataset.touched) occ.value=Math.round(b.occ*100); $('#avgstay').textContent=b.avg_stay_nights.toFixed(1); if(page==='cohost-unfur') updateFurnishDefaults(f, unitSel.value);}
  ['change','input'].forEach(ev=>{adr.addEventListener(ev,()=>adr.dataset.touched=true); occ.addEventListener(ev,()=>occ.dataset.touched=true)});
  neigh.addEventListener('change',sync); unitSel.addEventListener('change',sync); sync();
  function run(){
    const ops=readOps(f); const fixed=readFixed(f);
    const res=cohostEstimate({neigh:neigh.value,unit:unitSel.value,adrInput:parseFloat(adr.value),occPctInput:parseFloat(occ.value),baseFeePct:DRP_DATA.cohost_base_fee_pct,fixed,ops,includeFixed:true});
    // Fallback owner net if something was NaN
    let owner = Number.isFinite(res.ownerNet) ? res.ownerNet : Math.round((res.gross||0)-(res.feeMAD||0)-(res.variable||0)-(res.fixedMonthly||0));
    const baseB=baselineFrom(neigh.value,unitSel.value);
    const baseRes=cohostEstimate({neigh:neigh.value,unit:unitSel.value,adrInput:baseB.adr,occPctInput:baseB.occ*100,baseFeePct:DRP_DATA.cohost_base_fee_pct,fixed,ops,includeFixed:true});
    let baseOwner = Number.isFinite(baseRes.ownerNet) ? baseRes.ownerNet : Math.round((baseRes.gross||0)-(baseRes.feeMAD||0)-(baseRes.variable||0)-(baseRes.fixedMonthly||0));
    $('#kpi-gross').textContent=fmt(res.gross); $('#kpi-fee').textContent=`${Math.round(res.feePct)}% → ${fmt(res.feeMAD)}`; $('#kpi-stays').textContent=fmt(res.stays);
    $('#kpi-variable').textContent=fmt(res.variable); $('#kpi-fixed').textContent=fmt(res.fixedMonthly); if($('#kpi-furnish')) $('#kpi-furnish').textContent=fmt(fixed.furnishing);
    $('#kpi-owner').textContent=fmt(owner); $('#kpi-base-owner').textContent=fmt(baseOwner);
  }
  bind(f,run); $('#calc')?.addEventListener('click',run); run();
}

function wireLease(page){
  navActive(); const f=$('#calc-form');
  $('#ops-host',f).innerHTML=opsControlsHtml();
  const unitSel=$('#unit');
  if(page==='lease-unfur'){ $('#furnish-host',f).innerHTML=furnishCardHtml(unitSel.value); touchOnEdit($('#fx-furnish-budget',f)); }
  function run(){const neigh=$('#neigh').value, unit=unitSel.value; const ops=readOps(f); const fixed=readFixed(f);
    const res=leaseEstimateFractional({neigh,unit,ops,targetMarginPct:DRP_DATA.lease_target_margin_pct,includeFixed:true,fixed});
    $('#headline-val').textContent=fmt(res.suggested);
    $('#d-gross').textContent=fmt(res.gross); $('#d-stays').textContent=(Math.round(res.staysFrac*10)/10).toFixed(1);
    $('#d-variable').textContent=fmt(res.variable); $('#d-fixed').textContent=fmt(res.fixedMonthly - (fixed.furnishing||0));
    if($('#d-furnish')) $('#d-furnish').textContent=fmt(fixed.furnishing||0);
    $('#d-margin').textContent=fmt(res.marginMAD); $('#d-rentcap').textContent=fmt(res.rentCap); $('#d-avgstay').textContent=baselineFrom(neigh,unit).avg_stay_nights.toFixed(1);
  }
  // Update furnishing defaults on unit changes for lease-unfur
  if(page==='lease-unfur'){ unitSel.addEventListener('change',()=>updateFurnishDefaults(f, unitSel.value)); }
  bind(f,run); $('#calc')?.addEventListener('click',run); run();
}

window.addEventListener('DOMContentLoaded',()=>{
  const page=document.body.dataset.page;
  if(page==='cohost-fur'||page==='cohost-unfur'){wireCohost(page);}
  else if(page==='lease-fur'||page==='lease-unfur'){wireLease(page);}
  else {navActive();}
});
