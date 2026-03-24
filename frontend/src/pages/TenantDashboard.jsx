import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyPolicies, getMyPayments, getMyKYC, submitKYC, assessRisk, getMyRisk, getPropertyByInviteCode, getPolicyQuote, createPolicy, makePayment } from '../services/api';
import './Dashboard.css';

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
  const [policyForm, setPolicyForm] = useState({
    start_date: '', expiry_date: '', coverage_type: 'combined'
  });

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
    try {
      const res = await assessRisk();
      setRisk(res.data);
      setMessage({ type: 'success', text: 'Risk assessment completed!' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Risk assessment failed' });
    }
  };

  const handleFindProperty = async (e) => {
    e.preventDefault();
    if (!risk) {
      setMessage({ type: 'error', text: 'You must complete an Approved Risk Assessment first!' });
      return;
    }
    
    try {
      const propRes = await getPropertyByInviteCode(inviteCode);
      setFoundProperty(propRes.data);
      
      const quoteRes = await getPolicyQuote(propRes.data.property_id);
      setQuote(quoteRes.data);
      setMessage({ type: 'success', text: 'Property found and Quote generated!' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Invalid invite code or unable to quote.' });
      setFoundProperty(null);
      setQuote(null);
    }
  };

  const handlePolicySubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await createPolicy({
        property_id: foundProperty.property_id,
        start_date: policyForm.start_date,
        expiry_date: policyForm.expiry_date,
        coverage_type: policyForm.coverage_type
      });
      setPolicies([res.data, ...policies]);
      setMessage({ type: 'success', text: 'Policy created! Awaiting activation.' });
      
      // Reset flow
      setFoundProperty(null);
      setQuote(null);
      setInviteCode('');
      setPolicyForm({ start_date: '', expiry_date: '', coverage_type: 'combined' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Policy creation failed' });
    }
  };

  const handlePayment = async (policyId, amount) => {
    try {
      const res = await makePayment({ policy_id: policyId, amount });
      setPayments([res.data, ...payments]);
      setMessage({ type: 'success', text: 'Payment successful!' });
    } catch (err) {
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
                <div className="stat-value">₹{payments.reduce((s, p) => s + parseFloat(p.amount), 0).toLocaleString()}</div>
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
            {risk ? (
              <div className="glass-card detail-card">
                <div className="detail-row"><span>Risk Score:</span><span>{risk.risk_score}/100</span></div>
                <div className="detail-row"><span>Risk Level:</span>{statusBadge(risk.risk_level)}</div>
                <div className="detail-row"><span>Assessed:</span><span>{new Date(risk.calculated_at).toLocaleDateString()}</span></div>
              </div>
            ) : (
              <button className="btn-primary" onClick={handleAssessRisk}>Run Risk Assessment</button>
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
                      <span>{pol.property_address || 'Property'}, {pol.property_city}</span>
                      {statusBadge(pol.status)}
                    </div>
                    <div className="policy-details">
                      <div><span>Premium:</span>₹{parseFloat(pol.premium_amount).toLocaleString()}/mo</div>
                      <div><span>Coverage:</span>₹{parseFloat(pol.coverage_amount).toLocaleString()}</div>
                      <div><span>Period:</span>{new Date(pol.start_date).toLocaleDateString()} – {new Date(pol.expiry_date).toLocaleDateString()}</div>
                    </div>
                    {pol.status === 'active' && (
                      <button className="btn-primary" style={{ marginTop: '16px', width: '100%' }} onClick={() => handlePayment(pol.policy_id, pol.premium_amount)}>
                        Pay ₹{parseFloat(pol.premium_amount).toLocaleString()} Premium
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <h2 className="dash-subtitle" style={{ marginTop: '40px' }}>Purchase New Policy</h2>
            
            {!quote ? (
              <form onSubmit={handleFindProperty} className="glass-card form-card">
                <p style={{marginBottom: '20px', fontSize: '0.9rem', color: 'var(--text-secondary)'}}>
                  Ask your Landlord for their Property Invite Code to view the property and generate an insurance quote.
                </p>
                <div className="form-group">
                  <label className="form-label">Property Invite Code</label>
                  <input className="input-field" placeholder="XYZ-123" value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} required />
                </div>
                <button type="submit" className="btn-primary">Find Property & Get Quote</button>
              </form>
            ) : (
              <form onSubmit={handlePolicySubmit} className="glass-card form-card">
                <div className="detail-card" style={{padding: '16px', background: 'var(--bg-primary)', borderRadius: '8px', marginBottom: '24px'}}>
                  <h3 style={{fontSize: '1.1rem', marginBottom: '12px'}}>{foundProperty.address}, {foundProperty.city}</h3>
                  <div className="detail-row"><span>Landlord:</span><span>{foundProperty.owner_name}</span></div>
                  <div className="detail-row"><span>Coverage (Deposit):</span><span style={{fontWeight: 'bold', color: 'var(--text-primary)'}}>₹{parseFloat(quote.coverage_amount).toLocaleString()}</span></div>
                  <div className="detail-row"><span>Monthly Premium:</span><span style={{fontWeight: 'bold', color: 'var(--accent-1)'}}>₹{parseFloat(quote.premium_amount).toLocaleString()}/mo</span></div>
                </div>

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
                
                <div style={{display: 'flex', gap: '12px'}}>
                  <button type="button" className="btn-secondary" onClick={() => { setQuote(null); setFoundProperty(null); }} style={{padding: '12px 24px', flex: 1}}>Cancel</button>
                  <button type="submit" className="btn-primary" style={{flex: 2}}>Accept Quote & Apply</button>
                </div>
              </form>
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
    </div>
  );
}

export default TenantDashboard;
