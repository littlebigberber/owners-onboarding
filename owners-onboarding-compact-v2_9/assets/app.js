window.DRP = (() => {
  const UNIT_VAR_COST = { "Studio":190, "1BR":220, "2BR":260 };
  const DEFAULT_AVG_NIGHTS = 3.0;
  // Ops Stops penalties (applied multiplicatively)
  const OPS = {
    noise:     { adr:-0.04, occ:-0.06 },
    stairs:    { adr:-0.02, occ:-0.04 },
    parking:   { adr:-0.02, occ:-0.03 },
    hoa:       { adr:-0.01, occ:-0.02 },
    gated:     { adr:-0.01, occ:-0.01 },
    maze:      { adr:-0.01, occ:-0.02 },
    no_self:   { adr:-0.01, occ:-0.02 },
    delicate:  { adr:-0.01, occ:-0.01 }
  };

  function fmt(mad){ return new Intl.NumberFormat('en-US').format(Math.round(mad)); }
  function expectedStays(occPct, avgNights=DEFAULT_AVG_NIGHTS){
    const nightsPerMonth = 30 * (occPct/100);
    return nightsPerMonth / Math.max(1e-6, avgNights); // float, no rounding
  }

  function applyOps(adr, occ, checks){
    let a = adr, o = occ;
    for(const key of Object.keys(checks)){
      if(checks[key]){
        a *= (1 + OPS[key].adr);
        o *= (1 + OPS[key].occ);
      }
    }
    return { adr:a, occ:o };
  }

  function leaseTargetMargin(gross, opsChecks){
    // 12% base +2% buffer if 3+ Ops Stops
    const count = Object.values(opsChecks).filter(Boolean).length;
    const pct = 0.12 + (count >= 3 ? 0.02 : 0);
    return gross * pct;
  }

  function rentCap(gross, varTotal, fixed, margin){
    return Math.max(0, gross - varTotal - fixed - margin);
  }

  function suggestedOffer(cap){
    // 95% of cap (negotiation buffer)
    return cap * 0.95;
  }

  function populateSelect(sel, opts){
    sel.innerHTML = "";
    for(const key of Object.keys(opts)){
      const o = document.createElement('option');
      o.value = key; o.textContent = key;
      sel.appendChild(o);
    }
  }

  return {
    fmt, expectedStays, applyOps, leaseTargetMargin, rentCap, suggestedOffer,
    populateSelect, UNIT_VAR_COST, DEFAULT_AVG_NIGHTS
  };
})();