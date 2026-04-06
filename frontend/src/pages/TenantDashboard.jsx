import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyPolicies, getMyPayments, getMyKYC, submitKYC, assessRisk, getMyRisk, getPropertyByInviteCode, getPolicyQuote, createPolicy, makePayment, getPolicyContract } from '../services/api';
import './Dashboard.css';

const ADD_ON_CATALOG = [
  { key: 'appliance_cover',   label: 'Appliance Cover',      cost: 250, desc: 'Covers breakdown of listed appliances' },
  { key: 'extended_rent',     label: 'Extended Rent Cover',  cost: 350, desc: 'One extra month of rent-default protection' },
  { key: 'legal_cover',       label: 'Legal Cover',          cost: 200, desc: 'Legal dispute assistance up to ₹50,000' },
  { key: 'accidental_damage', label: 'Accidental Damage',    cost: 150, desc: 'Covers sudden accidental damage to fixtures' },
];

const FURNISHING_SURCHARGE = {
  unfurnished: '0%',
  semi_furnished: '+8%',
  fully_furnished: '+15%',
};

function TenantDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [payments, setPayments] = useState([]);
  const [kyc, setKyc] = useState(null);
  const [risk, setRisk] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  // KYC form
  const [kycForm, setKycForm] = useState({ pan_number: '', id_document_url: '', address: '' });

  // Policy & Quoting
  const [inviteCode, setInviteCode] = useState('');
  const [foundProperty, setFoundProperty] = useState(null);
  const [quote, setQuote] = useState(null);
  const [tenantData, setTenantData] = useState({ income: '', employment_months: '' });
  const [policyForm, setPolicyForm] = useState({
    start_date: '', expiry_date: '', coverage_type: 'combined', damage_cover_limit: 500000
  });
  const [addOns, setAddOns] = useState({
    appliance_cover: false, extended_rent: false, legal_cover: false, accidental_damage: false
  });
  const [viewingContract, setViewingContract] = useState(null);
  const [paymentModal, setPaymentModal] = useState({ open: false, policyId: null, amount: 0 });
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [demoCard, setDemoCard] = useState({ number: '4111 1111 1111 1111', expiry: '12/28', cvv: '123', name: '' });

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsed = JSON.parse(userData);
      setUser(parsed);
      if (parsed.role !== 'tenant') {
        navigate('/landlord');
        return;
      }
    }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [polRes, payRes, kycRes] = await Promise.allSettled([
        getMyPolicies(),
        getMyPayments(),
        getMyKYC(),
      ]);
      if (polRes.status === 'fulfilled') setPolicies(polRes.value.data);
      if (payRes.status === 'fulfilled') setPayments(payRes.value.data);
      if (kycRes.status === 'fulfilled') setKyc(kycRes.value.data);

      try {
        const riskRes = await getMyRisk();
        setRisk(riskRes.data);
      } catch {}
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleKYCSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await submitKYC(kycForm);
      setKyc(res.data);
      setMessage({ type: 'success', text: 'KYC submitted successfully!' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'KYC submission failed' });
    }
  };

  const handleAssessRisk = async () => {
    if (!tenantData.income || !tenantData.employment_months) {
      setMessage({ type: 'error', text: 'Please enter income and employment duration first.' });
      return;
    }
    try {
      const res = await assessRisk({
        tenant_data: {
          income: Number(tenantData.income),
          employment_months: Number(tenantData.employment_months)
        }
      });
      setRisk(res.data);
      setMessage({ type: 'success', text: 'Risk assessment completed!' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Risk assessment failed' });
    }
  };

  const handleFindProperty = async (e) => {
    e.preventDefault();
    if (!risk) {
      setMessage({ type: 'error', text: 'You must complete a Risk Assessment first!' });
      return;
    }
    try {
      const propRes = await getPropertyByInviteCode(inviteCode);
      setFoundProperty(propRes.data);

      const quoteRes = await getPolicyQuote({
        property_id: propRes.data.property_id,
        tenant_data: {
          income: Number(tenantData.income),
          employment_months: Number(tenantData.employment_months)
        },
        coverages: { damage_cover_limit: policyForm.damage_cover_limit, deductible: 0 },
        add_ons: addOns
      });
      setQuote(quoteRes.data);
      setMessage({ type: 'success', text: 'Property found and Quote generated!' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Invalid invite code or unable to quote.' });
      setFoundProperty(null);
      setQuote(null);
    }
  };

  const refreshQuote = async (newCoverage, currentAddOns) => {
    if (!foundProperty) return;
    try {
      const res = await getPolicyQuote({
        property_id: foundProperty.property_id,
        tenant_data: {
          income: Number(tenantData.income),
          employment_months: Number(tenantData.employment_months)
        },
        coverages: {
          damage_cover_limit: newCoverage,
          rent_default_months: 2
        },
        add_ons: currentAddOns || addOns
      });
      setQuote(res.data);
    } catch (err) {
      console.error('Quote refresh failed', err);
    }
  };

  const handleAddOnToggle = (key) => {
    const updated = { ...addOns, [key]: !addOns[key] };
    setAddOns(updated);
    refreshQuote(policyForm.damage_cover_limit, updated);
  };

  const handleViewContract = async (policy_id) => {
    try {
      const res = await getPolicyContract(policy_id);
      setViewingContract(res.data);
    } catch (err) {
      setMessage({ type: 'error', text: 'Unable to fetch contract' });
    }
  };

  const handlePolicySubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await createPolicy({
        property_id: foundProperty.property_id,
        tenant_data: {
          income: Number(tenantData.income),
          employment_months: Number(tenantData.employment_months)
        },
        coverages: { damage_cover_limit: policyForm.damage_cover_limit, deductible: 0 },
        add_ons: addOns,
        start_date: policyForm.start_date,
        expiry_date: policyForm.expiry_date
      });
      setPolicies([res.data, ...policies]);
      setMessage({ type: 'success', text: 'Policy created! Awaiting admin activation.' });
      setFoundProperty(null);
      setQuote(null);
      setInviteCode('');
      setAddOns({ appliance_cover: false, extended_rent: false, legal_cover: false, accidental_damage: false });
      setPolicyForm({ start_date: '', expiry_date: '', coverage_type: 'combined', damage_cover_limit: 500000 });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Policy creation failed' });
    }
  };

  const handleOpenPayment = (policyId, amount) => {
    setDemoCard(prev => ({ ...prev, name: user?.name || '' }));
    setPaymentModal({ open: true, policyId, amount });
  };

  const handleCompletePayment = async () => {
    setPaymentProcessing(true);
    await new Promise(r => setTimeout(r, 1500));
    try {
      const res = await makePayment({ policy_id: paymentModal.policyId, amount: paymentModal.amount });
      setPayments([res.data, ...payments]);
      setPaymentModal({ open: false, policyId: null, amount: 0 });
      setPaymentProcessing(false);
      setMessage({ type: 'success', text: `Payment successful! Transaction ID: ${res.data.transaction_id}` });
    } catch (err) {
      setPaymentProcessing(false);
      setPaymentModal({ open: false, policyId: null, amount: 0 });
      setMessage({ type: 'error', text: err.response?.data?.message || 'Payment failed' });
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const statusBadge = (status) => {
    const map = { approved: 'badge-success', active: 'badge-success', pending: 'badge-warning', rejected: 'badge-danger', success: 'badge-success', expired: 'badge-danger' };
    return <span className={`badge ${map[status] || 'badge-info'}`}>{status}</span>;
  };

  const activeAddOnTotal = ADD_ON_CATALOG.filter(a => addOns[a.key]).reduce((s, a) => s + a.cost, 0);

  if (loading) return <div className="dash-loading"><div className="spinner"></div></div>;

  return (
    <div className="dashboard">
      <div className="dash-bg-orbs">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
      </div>

      <aside className="sidebar glass-card">
        <div className="sidebar-brand">
          <span className="text-gradient">Rent</span>Sure
        </div>
        <nav className="sidebar-nav">
          {['overview', 'kyc', 'policies', 'payments'].map(tab => (
            <button key={tab} className={`sidebar-link ${activeTab === tab ? 'sidebar-link-active' : ''}`} onClick={() => { setActiveTab(tab); setMessage({ type: '', text: '' }); }}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{user?.name?.charAt(0)}</div>
            <div>
              <div className="sidebar-user-name">{user?.name}</div>
              <div className="sidebar-user-role">Tenant</div>
            </div>
          </div>
          <button className="sidebar-logout" onClick={logout}>Sign Out</button>
        </div>
      </aside>

      <main className="dash-main">
        {message.text && (
          <div className={message.type === 'success' ? 'message-success' : 'message-error'}>
            {message.text}
          </div>
        )}

        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="animate-fade-in">
            <h1 className="dash-title">Welcome, <span className="text-gradient">{user?.name}</span></h1>
            <div className="stats-grid">
              <div className="glass-card stat-card">
                <div className="stat-label">Active Policies</div>
                <div className="stat-value">{policies.filter(p => p.status === 'active').length}</div>
              </div>
              <div className="glass-card stat-card">
                <div className="stat-label">Total Payments</div>
                <div className="stat-value">₹{payments.reduce((s, p) => s + parseFloat(p.amount || 0), 0).toLocaleString()}</div>
              </div>
              <div className="glass-card stat-card">
                <div className="stat-label">KYC Status</div>
                <div className="stat-value">{kyc ? statusBadge(kyc.status) : <span className="badge badge-warning">Not Submitted</span>}</div>
              </div>
              <div className="glass-card stat-card">
                <div className="stat-label">Risk Level</div>
                <div className="stat-value">{risk ? statusBadge(risk.risk_level) : <span className="badge badge-info">N/A</span>}</div>
              </div>
            </div>

            <h2 className="dash-subtitle">Recent Payments</h2>
            {payments.length === 0 ? (
              <p className="dash-empty">No payments yet.</p>
            ) : (
              <div className="table-wrap glass-card">
                <table className="dash-table">
                  <thead><tr><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
                  <tbody>
                    {payments.slice(0, 5).map(p => (
                      <tr key={p.payment_id}>
                        <td>{new Date(p.payment_date).toLocaleDateString()}</td>
                        <td>₹{parseFloat(p.amount).toLocaleString()}</td>
                        <td>{statusBadge(p.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* KYC Tab */}
        {activeTab === 'kyc' && (
          <div className="animate-fade-in">
            <h1 className="dash-title">KYC Verification</h1>
            {kyc ? (
              <div className="glass-card detail-card">
                <div className="detail-row"><span>Status:</span>{statusBadge(kyc.status)}</div>
                <div className="detail-row"><span>PAN Number:</span><span>{kyc.pan_number}</span></div>
                <div className="detail-row"><span>Address:</span><span>{kyc.address}</span></div>
                <div className="detail-row"><span>Submitted:</span><span>{new Date(kyc.created_at).toLocaleDateString()}</span></div>
              </div>
            ) : (
              <form onSubmit={handleKYCSubmit} className="glass-card form-card">
                <div className="form-group">
                  <label className="form-label">PAN Number</label>
                  <input className="input-field" placeholder="AAAAA0000A" value={kycForm.pan_number} onChange={e => setKycForm({ ...kycForm, pan_number: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">ID Document URL</label>
                  <input className="input-field" placeholder="https://..." value={kycForm.id_document_url} onChange={e => setKycForm({ ...kycForm, id_document_url: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <textarea className="input-field" rows="3" placeholder="Your full address" value={kycForm.address} onChange={e => setKycForm({ ...kycForm, address: e.target.value })} required />
                </div>
                <button type="submit" className="btn-primary">Submit KYC</button>
              </form>
            )}

            <h2 className="dash-subtitle" style={{ marginTop: '40px' }}>Risk Assessment</h2>

            {!risk && (
              <div className="glass-card form-card" style={{ marginBottom: '20px' }}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Monthly Income (₹)</label>
                    <input className="input-field" type="number" placeholder="e.g. 50000" value={tenantData.income} onChange={e => setTenantData({ ...tenantData, income: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Employment Duration (Months)</label>
                    <input className="input-field" type="number" placeholder="e.g. 24" value={tenantData.employment_months} onChange={e => setTenantData({ ...tenantData, employment_months: e.target.value })} />
                  </div>
                </div>
              </div>
            )}

            {risk ? (
              <div className="glass-card detail-card">
                <div className="detail-row"><span>Risk Score:</span><span>{risk.risk_score}/100</span></div>
                <div className="detail-row"><span>Risk Level:</span>{statusBadge(risk.risk_level)}</div>
                <div className="detail-row"><span>Assessed:</span><span>{new Date(risk.calculated_at).toLocaleDateString()}</span></div>
              </div>
            ) : (
              <button className="btn-primary" onClick={handleAssessRisk} disabled={!tenantData.income || !tenantData.employment_months}>
                Run Risk Assessment
              </button>
            )}
          </div>
        )}

        {/* Policies Tab */}
        {activeTab === 'policies' && (
          <div className="animate-fade-in">
            <h1 className="dash-title">My Policies</h1>

            {policies.length > 0 && (
              <div className="cards-grid">
                {policies.map(pol => (
                  <div key={pol.policy_id} className="glass-card policy-card">
                    <div className="policy-header">
                      <span>{pol.property_address || 'Property'}, {pol.property_city || 'Unknown City'}</span>
                      {statusBadge(pol.status)}
                    </div>
                    <div className="policy-details">
                      <div><span>Premium:</span>₹{Number(pol.premium_amount || 0).toFixed(2)}/mo</div>
                      <div><span>Coverage:</span>₹{Number(pol.coverage_amount || 0).toLocaleString()}</div>
                      <div><span>Period:</span>{pol.start_date ? new Date(pol.start_date).toLocaleDateString() : 'N/A'} – {pol.expiry_date ? new Date(pol.expiry_date).toLocaleDateString() : 'N/A'}</div>
                    </div>
                    {pol.status === 'active' && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                        <button className="btn-primary" style={{ flex: 1 }} onClick={() => handleOpenPayment(pol.policy_id, pol.premium_amount)}>
                          Pay ₹{parseFloat(pol.premium_amount).toLocaleString()}
                        </button>
                        <button className="btn-secondary" style={{ flex: 1 }} onClick={() => handleViewContract(pol.policy_id)}>
                          Contract
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <h2 className="dash-subtitle" style={{ marginTop: '40px' }}>Purchase New Policy</h2>

            {!quote ? (
              <form onSubmit={handleFindProperty} className="glass-card form-card">
                <p style={{ marginBottom: '20px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Ask your Landlord for their Property Invite Code to view the property and generate an insurance quote.
                </p>
                <div className="form-group">
                  <label className="form-label">Property Invite Code</label>
                  <input className="input-field" placeholder="XYZ-123" value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} required />
                </div>

                {/* Tenant data (shared across risk assessment and quoting) */}
                {!risk && (
                  <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(245,158,11,0.08)', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.2)', fontSize: '0.85rem', color: '#fbbf24' }}>
                    ⚠ Please complete your Risk Assessment in the KYC tab first to enable quoting.
                  </div>
                )}

                <button type="submit" className="btn-primary" disabled={!risk}>
                  Find Property & Get Quote
                </button>
              </form>
            ) : (
              <form onSubmit={handlePolicySubmit} className="glass-card form-card">
                {/* Property Summary */}
                <div style={{ padding: '16px', background: 'var(--bg-primary)', borderRadius: '8px', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '10px' }}>{foundProperty.address}, {foundProperty.city}</h3>
                  {foundProperty.furnishing_level && foundProperty.furnishing_level !== 'unfurnished' && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Furnishing: <strong style={{ color: 'var(--text-primary)' }}>{foundProperty.furnishing_level.replace('_', ' ')}</strong>
                      <span style={{ marginLeft: '6px', color: '#fbbf24' }}>({FURNISHING_SURCHARGE[foundProperty.furnishing_level]} premium surcharge)</span>
                    </div>
                  )}
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    Underwriting Score: <strong style={{ color: 'var(--text-primary)' }}>{quote.risk_details.score}/100</strong>
                    <span className={`badge ${quote.risk_details.level === 'low' ? 'badge-success' : quote.risk_details.level === 'medium' ? 'badge-warning' : 'badge-danger'}`} style={{ marginLeft: '8px', fontSize: '0.7rem' }}>
                      {quote.risk_details.level?.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Coverage Limit Selector */}
                <div className="form-group">
                  <label className="form-label">Selected Coverage Limit</label>
                  <select
                    className="input-field"
                    value={policyForm.damage_cover_limit}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setPolicyForm({ ...policyForm, damage_cover_limit: value });
                      refreshQuote(value, addOns);
                    }}
                  >
                    <option value={100000}>₹1,00,000 (Basic)</option>
                    <option value={300000}>₹3,00,000 (Recommended)</option>
                    <option value={500000}>₹5,00,000 (Elite)</option>
                  </select>
                </div>

                {/* Add-Ons */}
                <div style={{ marginBottom: '20px' }}>
                  <label className="form-label" style={{ marginBottom: '12px', display: 'block' }}>Optional Add-Ons</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {ADD_ON_CATALOG.map(addon => (
                      <label
                        key={addon.key}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px',
                          background: addOns[addon.key] ? 'rgba(124,58,237,0.12)' : 'var(--bg-glass)',
                          border: `1px solid ${addOns[addon.key] ? 'rgba(124,58,237,0.4)' : 'var(--border-subtle)'}`,
                          borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={addOns[addon.key]}
                          onChange={() => handleAddOnToggle(addon.key)}
                          style={{ marginTop: '2px', accentColor: 'var(--accent-1)' }}
                        />
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>{addon.label}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{addon.desc}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--accent-1)', marginTop: '4px', fontWeight: '600' }}>+₹{addon.cost}/mo</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Pricing Breakdown */}
                <div style={{ padding: '16px', background: 'var(--bg-primary)', borderRadius: '8px', marginBottom: '20px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Premium Breakdown</div>

                  <div className="detail-row"><span>Base Premium:</span><span>₹{Number(quote.pricing?.breakdown?.base || 0).toFixed(2)}</span></div>
                  <div className="detail-row"><span>Coverage Costs:</span><span>₹{Number(quote.pricing?.breakdown?.coverage_costs || 0).toFixed(2)}</span></div>
                  <div className="detail-row"><span>Property Surcharge:</span><span>₹{Number(quote.pricing?.breakdown?.property_surcharge || 0).toFixed(2)}</span></div>
                  <div className="detail-row" style={{ paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span>Risk Loading:</span><span>₹{Number(quote.pricing?.breakdown?.risk_loading || 0).toFixed(2)}</span>
                  </div>
                  {activeAddOnTotal > 0 && (
                    <div className="detail-row"><span>Add-ons Total:</span><span style={{ color: 'var(--accent-1)' }}>₹{activeAddOnTotal}/mo</span></div>
                  )}

                  {quote.pricing?.cap_applied && (
                    <div style={{ padding: '8px', background: 'rgba(255,165,0,0.1)', border: '1px solid orange', borderRadius: '4px', margin: '10px 0', fontSize: '0.8rem', color: 'orange' }}>
                      ⚠️ Premium capped at 50% of rent to ensure affordability.
                    </div>
                  )}

                  <div className="detail-row" style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontWeight: '600' }}>Final Monthly Premium:</span>
                    <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--accent-1)' }}>₹{Number(quote.pricing?.final_premium || 0).toLocaleString()}/mo</span>
                  </div>

                  <div style={{ marginTop: '10px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    <strong>Engine Summary:</strong> {quote.pricing?.summary || 'Calculations applied.'}
                  </div>
                </div>

                {/* Dates */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Start Date</label>
                    <input className="input-field" type="date" value={policyForm.start_date} onChange={e => setPolicyForm({ ...policyForm, start_date: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Expiry Date</label>
                    <input className="input-field" type="date" value={policyForm.expiry_date} onChange={e => setPolicyForm({ ...policyForm, expiry_date: e.target.value })} required />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" className="btn-secondary" onClick={() => { setQuote(null); setFoundProperty(null); }} style={{ flex: 1 }}>Cancel</button>
                  <button type="submit" className="btn-primary" style={{ flex: 2 }}>Accept Quote & Apply</button>
                </div>
              </form>
            )}

            {/* Contract Viewer */}
            {viewingContract && (
              <div style={{ marginTop: '40px' }} className="animate-fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h2 className="dash-subtitle" style={{ margin: 0 }}>Official Contract Document</h2>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn-primary" onClick={() => {
                      const w = window.open('', '_blank');
                      w.document.write(viewingContract);
                      w.document.close();
                      w.print();
                    }}>Print / Save PDF</button>
                    <button className="btn-secondary" onClick={() => setViewingContract(null)}>Close Viewer</button>
                  </div>
                </div>
                <div className="glass-card" style={{ padding: '0', overflow: 'auto', maxHeight: '70vh', background: '#fff', color: '#000' }}>
                  <div dangerouslySetInnerHTML={{ __html: viewingContract }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <div className="animate-fade-in">
            <h1 className="dash-title">Payment History</h1>
            {payments.length === 0 ? (
              <p className="dash-empty">No payment records found.</p>
            ) : (
              <div className="table-wrap glass-card">
                <table className="dash-table">
                  <thead><tr><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
                  <tbody>
                    {payments.map(p => (
                      <tr key={p.payment_id}>
                        <td>{new Date(p.payment_date).toLocaleDateString()}</td>
                        <td>₹{parseFloat(p.amount).toLocaleString()}</td>
                        <td>{statusBadge(p.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Payment Modal */}
      {paymentModal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="glass-card animate-fade-in" style={{ width: '420px', maxWidth: '95vw', padding: '32px', position: 'relative' }}>
            <button
              onClick={() => !paymentProcessing && setPaymentModal({ open: false, policyId: null, amount: 0 })}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: paymentProcessing ? 'not-allowed' : 'pointer', fontSize: '1.2rem', lineHeight: 1 }}
            >✕</button>

            <h2 style={{ fontSize: '1.2rem', marginBottom: '6px' }}>Complete Payment</h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Paying <strong style={{ color: 'var(--accent-1)' }}>₹{parseFloat(paymentModal.amount).toLocaleString()}</strong> via RazorDemo Gateway
            </div>

            {/* Visa card visual */}
            <div style={{ background: 'linear-gradient(135deg, #1a1a3e 0%, #7c3aed 100%)', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px', color: '#fff', fontFamily: 'monospace', userSelect: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <span style={{ fontSize: '0.65rem', opacity: 0.6, letterSpacing: '0.1em' }}>DEMO CARD</span>
                <span style={{ fontSize: '1rem', fontStyle: 'italic', fontWeight: 'bold', fontFamily: 'serif' }}>VISA</span>
              </div>
              <div style={{ fontSize: '1.15rem', letterSpacing: '0.15em', marginBottom: '20px' }}>{demoCard.number}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                <div>
                  <div style={{ opacity: 0.55, fontSize: '0.6rem', marginBottom: '2px', letterSpacing: '0.05em' }}>CARD HOLDER</div>
                  <div>{demoCard.name || 'YOUR NAME'}</div>
                </div>
                <div>
                  <div style={{ opacity: 0.55, fontSize: '0.6rem', marginBottom: '2px', letterSpacing: '0.05em' }}>EXPIRES</div>
                  <div>{demoCard.expiry}</div>
                </div>
              </div>
            </div>

            {/* Card fields */}
            <div className="form-group">
              <label className="form-label">Card Number</label>
              <input className="input-field" value={demoCard.number} onChange={e => setDemoCard({ ...demoCard, number: e.target.value })} style={{ fontFamily: 'monospace', letterSpacing: '0.08em' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Expiry (MM/YY)</label>
                <input className="input-field" value={demoCard.expiry} onChange={e => setDemoCard({ ...demoCard, expiry: e.target.value })} style={{ fontFamily: 'monospace' }} />
              </div>
              <div className="form-group">
                <label className="form-label">CVV</label>
                <input className="input-field" type="password" value={demoCard.cvv} onChange={e => setDemoCard({ ...demoCard, cvv: e.target.value })} maxLength={3} style={{ fontFamily: 'monospace' }} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Cardholder Name</label>
              <input className="input-field" value={demoCard.name} onChange={e => setDemoCard({ ...demoCard, name: e.target.value })} />
            </div>

            <button
              className="btn-primary"
              style={{ width: '100%', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', opacity: paymentProcessing ? 0.75 : 1 }}
              onClick={handleCompletePayment}
              disabled={paymentProcessing}
            >
              {paymentProcessing ? (
                <>
                  <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', margin: 0 }}></div>
                  Processing...
                </>
              ) : (
                `Pay ₹${parseFloat(paymentModal.amount).toLocaleString()}`
              )}
            </button>

            <div style={{ marginTop: '12px', textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Secured by RazorDemo · Demo environment — no real charges applied
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TenantDashboard;
