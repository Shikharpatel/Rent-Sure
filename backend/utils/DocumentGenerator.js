/**
 * DocumentGenerator.js
 *
 * Generates a professional HTML policy contract rendered inline in the browser.
 * Design: letterhead style, proper typography, clear sections, signature block.
 */

const generateContractHTML = ({
    policy_id,
    tenant_details = {},
    property_details = {},
    pricing_details = {},
    risk_details = {},
    coverages = {},
    exclusions = [],
    add_ons = {}
}) => {
    const executionDate = new Date().toLocaleDateString('en-IN', {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    const activatedAddOns = Object.entries(add_ons)
        .filter(([, v]) => v)
        .map(([k]) => k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));

    const furnishingLabel = (property_details.furnishing_level || 'unfurnished')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Rent-Sure Policy Contract — ${policy_id}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&family=Inter:wght@400;500;600&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', Arial, sans-serif;
      color: #1a1a2e;
      background: #fff;
      padding: 48px 56px;
      max-width: 820px;
      margin: 0 auto;
      font-size: 14px;
      line-height: 1.7;
    }
    /* Header / Letterhead */
    .letterhead {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #7c3aed;
      padding-bottom: 20px;
      margin-bottom: 28px;
    }
    .brand { font-family: 'Merriweather', serif; font-size: 26px; font-weight: 700; color: #7c3aed; }
    .brand span { color: #06b6d4; }
    .contract-meta { text-align: right; font-size: 12px; color: #666; }
    .contract-meta strong { display: block; font-size: 14px; color: #1a1a2e; }
    /* Status pill */
    .status-pill {
      display: inline-block; padding: 3px 10px; border-radius: 20px;
      font-size: 11px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase;
      background: #e0f2fe; color: #0284c7;
    }
    /* Section */
    .section { margin-bottom: 28px; }
    .section-title {
      font-family: 'Merriweather', serif;
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #7c3aed;
      border-bottom: 1px solid #e9d5ff;
      padding-bottom: 6px;
      margin-bottom: 14px;
    }
    /* Two-column grid */
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .info-block p { margin-bottom: 6px; }
    .info-block .label { font-weight: 600; color: #374151; min-width: 140px; display: inline-block; }
    /* Premium table */
    table { width: 100%; border-collapse: collapse; }
    th { background: #f5f3ff; color: #4c1d95; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; padding: 10px 14px; text-align: left; }
    td { padding: 10px 14px; border-bottom: 1px solid #f3f4f6; }
    .amount { font-weight: 600; }
    .total-row td { background: #faf5ff; font-weight: 700; font-size: 15px; color: #7c3aed; }
    /* Add-ons list */
    .addon-pill {
      display: inline-block; padding: 3px 10px; border-radius: 6px; margin: 3px 4px;
      background: #ede9fe; color: #5b21b6; font-size: 12px; font-weight: 600;
    }
    /* Exclusions */
    .exclusion-list { padding-left: 18px; }
    .exclusion-list li { margin-bottom: 5px; color: #be123c; }
    /* Terms */
    .terms-text { font-size: 12px; color: #4b5563; line-height: 1.8; }
    /* Signature */
    .signature-block {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      margin-top: 48px;
      padding-top: 28px;
      border-top: 2px dashed #d1d5db;
    }
    .sig-line { border-bottom: 1px solid #374151; height: 40px; margin-bottom: 8px; }
    .sig-label { font-size: 12px; color: #6b7280; }
    .sig-name { font-size: 13px; font-weight: 600; margin-top: 4px; }
    /* Footer */
    .doc-footer {
      margin-top: 36px;
      text-align: center;
      font-size: 11px;
      color: #9ca3af;
      border-top: 1px solid #f3f4f6;
      padding-top: 16px;
    }
  </style>
</head>
<body>

  <!-- Letterhead -->
  <div class="letterhead">
    <div>
      <div class="brand">Rent<span>Sure</span></div>
      <div style="font-size:12px; color:#6b7280; margin-top:4px;">Rental Insurance & Deposit Protection</div>
    </div>
    <div class="contract-meta">
      <strong>POLICY CONTRACT</strong>
      <span class="status-pill">Official Document</span><br/>
      <div style="margin-top:6px">Policy ID: <strong>${policy_id || 'DRAFT'}</strong></div>
      <div>Issued: ${executionDate}</div>
    </div>
  </div>

  <p style="margin-bottom:24px; color:#4b5563; font-size:13px;">
    This Rental Insurance Contract ("Agreement") is issued by <strong>Rent-Sure Insurance Platform</strong>
    and provides coverage strictly governed by the conditions set by the Underwriting & Pricing Engines.
    Coverage is effective from the Policy Start Date subject to premium payment and Admin activation.
  </p>

  <!-- Parties + Property -->
  <div class="section">
    <div class="section-title">I. Parties & Covered Property</div>
    <div class="grid-2">
      <div class="info-block">
        <p><span class="label">Insured Tenant:</span> ${tenant_details.name || '—'}</p>
        <p><span class="label">Risk Tier:</span> ${risk_details.level ? risk_details.level.toUpperCase() : 'N/A'}</p>
        <p><span class="label">P(Default):</span> ${risk_details.probability_of_default !== undefined ? (risk_details.probability_of_default * 100).toFixed(1) + '%' : 'N/A'}</p>
      </div>
      <div class="info-block">
        <p><span class="label">Property City:</span> ${property_details.city || '—'}</p>
        <p><span class="label">Monthly Rent:</span> ₹${Number(property_details.rent_amount || 0).toLocaleString('en-IN')}</p>
        <p><span class="label">Furnishing:</span> ${furnishingLabel}</p>
      </div>
    </div>
  </div>

  <!-- Premium & Pricing -->
  <div class="section">
    <div class="section-title">II. Premium & Pricing Breakdown</div>
    <table>
      <tr><th>Stage</th><th class="amount">Amount (₹)</th></tr>
      <tr><td>Base Premium (1.5% of rent)</td><td class="amount">₹${Number(pricing_details.base || 0).toLocaleString('en-IN')}</td></tr>
      <tr><td>Risk-Weighted Surcharge</td><td class="amount">₹${Math.max(0, Number(pricing_details.risk_loaded || 0) - Number(pricing_details.base || 0)).toLocaleString('en-IN')}</td></tr>
      ${activatedAddOns.length > 0 ? `<tr><td>Optional Add-Ons (${activatedAddOns.join(', ')})</td><td class="amount">Included</td></tr>` : ''}
      <tr class="total-row"><td><strong>Final Monthly Premium</strong></td><td class="amount">₹${Number(pricing_details.final_monthly_premium || pricing_details.final_premium || 0).toLocaleString('en-IN')}</td></tr>
    </table>
  </div>

  <!-- Coverage Scope -->
  <div class="section">
    <div class="section-title">III. Coverage Scope & Limits</div>
    <div class="grid-2">
      <div class="info-block">
        <p><span class="label">Damage Cover Limit:</span> ₹${Number(coverages.damage_cover_limit || 0).toLocaleString('en-IN')}</p>
        <p><span class="label">Rent Default Cover:</span> ${coverages.rent_default_months || 0} month(s)</p>
        <p><span class="label">Tenant Deductible:</span> ₹${Number(coverages.deductible || 0).toLocaleString('en-IN')} per claim</p>
      </div>
      <div>
        ${activatedAddOns.length > 0
            ? `<div style="margin-bottom:6px; font-weight:600; color:#374151; font-size:13px;">Active Add-Ons:</div>
               ${activatedAddOns.map(a => `<span class="addon-pill">${a}</span>`).join('')}`
            : '<span style="color:#9ca3af; font-size:13px;">No optional add-ons selected.</span>'
        }
      </div>
    </div>
  </div>

  <!-- Exclusions -->
  <div class="section">
    <div class="section-title">IV. Mandated Exclusions</div>
    <ul class="exclusion-list">
      ${exclusions.length > 0
          ? exclusions.map(ex => `<li>${ex.replace(/_/g, ' ')}</li>`).join('')
          : '<li>Standard fraud, willful damage, and non-adherence exclusions apply as per CoverageBehaviorEngine rules.</li><li>Claims filed within 7 days of policy inception are subject to enhanced fraud review.</li><li>Rent defaults caused by tenant misconduct are not covered.</li>'
      }
    </ul>
  </div>

  <!-- Terms -->
  <div class="section">
    <div class="section-title">V. Terms & Conditions</div>
    <p class="terms-text">
      1. This policy is governed by the Rent-Sure LifecycleStateMachine. All transitions from <em>under_review → active → expired</em> are system-enforced and irreversible without Admin action.<br/>
      2. Claims are processed through the automated CoverageBehaviorEngine and ClaimsAdjudicator. Payouts are subject to depreciation (1.5% per month), deductible subtraction, and the coverage limit cap.<br/>
      3. Fraud scores above 60/100 trigger mandatory manual review before any payout is released.<br/>
      4. The policyholder consents to use of submitted KYC and financial data for underwriting purposes only.<br/>
      5. This contract is auto-generated and is legally binding upon Admin activation of the policy.
    </p>
  </div>

  <!-- Signature -->
  <div class="signature-block">
    <div>
      <div class="sig-line"></div>
      <div class="sig-label">Insured Tenant Signature</div>
      <div class="sig-name">${tenant_details.name || '________________________'}</div>
      <div class="sig-label" style="margin-top:4px;">Date: ${executionDate}</div>
    </div>
    <div>
      <div class="sig-line"></div>
      <div class="sig-label">Authorized — Rent-Sure Platform</div>
      <div class="sig-name">Underwriting Department</div>
      <div class="sig-label" style="margin-top:4px;">Policy ID: ${policy_id || 'DRAFT'}</div>
    </div>
  </div>

  <div class="doc-footer">
    This document is generated by the Rent-Sure Backend Engine. Contract ID: ${policy_id} | Generated: ${executionDate}<br/>
    Rent-Sure Insurance Platform · Automated Underwriting System · Not for unauthorized distribution.
  </div>

</body>
</html>`;
};

module.exports = { generateContractHTML };
