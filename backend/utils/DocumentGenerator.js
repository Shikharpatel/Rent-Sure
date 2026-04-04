/**
 * DocumentGenerator.js
 * 
 * A standalone, pure transformation utility that compiles policy data 
 * deeply integrated from orchestration engines into an official 
 * HTML-formatted "Insurance Contract" document.
 */

/**
 * Builds the official Rent-Sure policy contract in HTML format.
 * 
 * @param {Object} documentData
 * @param {string} documentData.policy_id
 * @param {Object} documentData.tenant_details - name, income, default_history
 * @param {Object} documentData.property_details - rent, city, furnishing
 * @param {Object} documentData.pricing_details - final premium, base, breakdown
 * @param {Object} [documentData.risk_details] - underwritten risk levels
 * @param {Object} documentData.coverages - coverage flags/limits
 * @param {Array<string>} documentData.exclusions - list of exclusion terms
 * @param {Object} [documentData.add_ons] - any add-on selections (e.g., appliances)
 * @returns {string} Fully rendered HTML string of the contract
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
    // Current date logic for stamping the contract
    const executionDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    let html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Rental Insurance Contract - ${policy_id}</title>
        <style>
            body {
                font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                color: #333;
                line-height: 1.6;
                padding: 40px;
                max-width: 800px;
                margin: 0 auto;
                background-color: #fff;
            }
            .header {
                text-align: center;
                border-bottom: 2px solid #2c3e50;
                padding-bottom: 20px;
                margin-bottom: 30px;
            }
            .header h1 {
                margin: 0;
                color: #2c3e50;
                font-size: 28px;
                text-transform: uppercase;
                letter-spacing: 2px;
            }
            .header p {
                margin: 5px 0 0;
                font-size: 14px;
                color: #7f8c8d;
            }
            h2 {
                color: #2980b9;
                border-bottom: 1px solid #ecf0f1;
                padding-bottom: 5px;
                margin-top: 30px;
            }
            .grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
            }
            .card {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 5px;
                border: 1px solid #e9ecef;
            }
            .label {
                font-weight: bold;
                color: #34495e;
            }
            .value {
                color: #2c3e50;
            }
            .table-container {
                margin-top: 20px;
            }
            table {
                width: 100%;
                border-collapse: collapse;
            }
            th, td {
                padding: 10px;
                border-bottom: 1px solid #ddd;
                text-align: left;
            }
            th {
                background-color: #ecf0f1;
            }
            .terms {
                font-size: 13px;
                color: #555;
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #ccc;
            }
            .footer {
                margin-top: 50px;
                text-align: center;
                font-weight: bold;
                font-size: 18px;
                color: #27ae60;
            }
        </style>
    </head>
    <body>

        <div class="header">
            <h1>Rent-Sure Master Policy</h1>
            <p>Official Coverage Declaration</p>
            <p><strong>Policy ID:</strong> ${policy_id || 'DRAFT'}</p>
        </div>

        <p>This rental insurance contract ("Agreement") is executed on <strong>${executionDate}</strong> and provides coverage strictly bound by the conditions instantiated by the Underwriting & Pricing Engines.</p>

        <div class="grid">
            <div class="card">
                <h2>I. Insured Parties</h2>
                <p><span class="label">Tenant Name:</span> <span class="value">${tenant_details.name || 'Provided Base Identity'}</span></p>
                <p><span class="label">Risk Tier:</span> <span class="value">${risk_details.level ? risk_details.level.toUpperCase() : 'N/A'}</span></p>
            </div>
            <div class="card">
                <h2>II. Covered Property</h2>
                <p><span class="label">Geography:</span> <span class="value">${property_details.city || 'Standard City'}</span></p>
                <p><span class="label">Base Rent:</span> <span class="value">₹${property_details.rent_amount || 'N/A'}</span></p>
                <p><span class="label">Furnishing:</span> <span class="value">${(property_details.furnishing_level || 'unfurnished').replace('_', ' ').toUpperCase()}</span></p>
            </div>
        </div>

        <div class="table-container">
            <h2>III. Premium & Pricing</h2>
            <table>
                <tr>
                    <th>Pricing Stage</th>
                    <th>Value</th>
                </tr>
                <tr>
                    <td>Base Premium Calculation</td>
                    <td>₹${pricing_details.base || 0}</td>
                </tr>
                <tr>
                    <td>Risk Weighted Surcharge Factor</td>
                    <td>₹${(pricing_details.risk_loaded || pricing_details.base || 0) - (pricing_details.base || 0)}</td>
                </tr>
                <tr>
                    <td><strong>Final Enacted Premium (Monthly)</strong></td>
                    <td style="color:#27ae60; font-weight:bold;">₹${pricing_details.final_monthly_premium || pricing_details.final_premium || 0}</td>
                </tr>
            </table>
        </div>

        <div class="card" style="margin-top: 20px;">
            <h2>IV. Coverage Scope & Limits</h2>
            <p><strong>Damage Liability Protection:</strong> ₹${coverages.damage_cover_limit || 0}</p>
            <p><strong>Rent Default Grace Period:</strong> ${coverages.rent_default_months || 0} Months</p>
            <p><strong>Tenant Deductible Assignment:</strong> ₹${coverages.deductible || 0} (per claim)</p>
            ${add_ons.legal_cover ? '<p><strong>Add-on Active:</strong> Legal Cover Available</p>' : ''}
            ${add_ons.appliance_cover ? '<p><strong>Add-on Active:</strong> Appliance Breakdown Cover Available</p>' : ''}
        </div>

        <div class="card" style="margin-top: 20px; background: #fff3f3; border-color: #ffc9c9;">
            <h2 style="color: #e74c3c; border-bottom-color: #ffc9c9;">V. Mandated Exclusions</h2>
            <p style="font-size: 14px; color: #c0392b;">The CoverageBehaviorEngine strictly forbids payouts under the following conditions:</p>
            <ul>
                ${exclusions.length > 0 
                    ? exclusions.map(ex => `<li>${ex.replace(/_/g, ' ').toUpperCase()}</li>`).join('')
                    : '<li>Standard fraud and non-adherence exclusions apply.</li>'
                }
            </ul>
        </div>

        <div class="terms">
            <strong>VI. Terms & Conditions</strong><br/>
            This document is generated by the Rent-Sure backend systems. Payouts are bound strictly to the LifecycleStateMachine. Any claims failing to pass the automated Verification Gate will be terminated. Early termination or breach of rent immediately voids coverage.
        </div>

    </body>
    </html>
    `;

    return html;
};

// Export pure functions
module.exports = {
    generateContractHTML
};
