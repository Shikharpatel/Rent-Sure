import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyProperties, createProperty, deleteProperty, getLandlordPolicies, getMyClaims, fileClaim, regenerateInviteCode } from '../services/api';
import './Dashboard.css';

const FURNISHING_LABELS = {
  unfurnished: 'Unfurnished',
  semi_furnished: 'Semi-Furnished (+8% surcharge)',
  fully_furnished: 'Fully Furnished (+15% surcharge)',
};

const PROPERTY_TYPE_LABELS = {
  apartment: 'Apartment',
  independent_house: 'Independent House (+5% surcharge)',
  other: 'Other (+3% surcharge)',
};

function LandlordDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [properties, setProperties] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [claims, setClaims] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Property form
  const [propForm, setPropForm] = useState({
    address: '', city: '', rent_amount: '', estimated_deposit: '', building_year: '',
    furnishing_level: 'unfurnished', property_type: 'apartment'
  });

  // Claim form
  const [claimForm, setClaimForm] = useState({
    policy_id: '', description: '', evidence_urls: [''], claim_amount: '', damage_classification: 'minor'
  });

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsed = JSON.parse(userData);
      setUser(parsed);
      if (parsed.role !== 'landlord') {
        navigate('/tenant');
        return;
      }
    }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [propRes, polRes, claimRes] = await Promise.allSettled([
        getMyProperties(),
        getLandlordPolicies(),
        getMyClaims()
      ]);
      if (propRes.status === 'fulfilled') setProperties(propRes.value.data);
      if (polRes.status === 'fulfilled') setPolicies(polRes.value.data);
      if (claimRes.status === 'fulfilled') setClaims(claimRes.value.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePropertySubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await createProperty(propForm);
      setProperties([res.data, ...properties]);
      setMessage({ type: 'success', text: 'Property listed successfully!' });
      setPropForm({ address: '', city: '', rent_amount: '', estimated_deposit: '', building_year: '', furnishing_level: 'unfurnished', property_type: 'apartment' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to add property' });
    }
  };

  const handleDeleteProperty = async (id) => {
    try {
      await deleteProperty(id);
      setProperties(properties.filter(p => p.property_id !== id));
      setMessage({ type: 'success', text: 'Property removed.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to delete property' });
    }
  };

  const handleRegenerateCode = async (id) => {
    try {
      const res = await regenerateInviteCode(id);
      setProperties(properties.map(p => p.property_id === id ? res.data : p));
      setMessage({ type: 'success', text: 'Invite code regenerated!' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to regenerate invite code.' });
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code).then(() => {
      setMessage({ type: 'success', text: `Code "${code}" copied to clipboard!` });
    });
  };

  const handleClaimSubmit = async (e) => {
    e.preventDefault();
    try {
      const filteredUrls = claimForm.evidence_urls.filter(u => u && u.trim());
      const res = await fileClaim({
        claim_data: { ...claimForm, evidence_urls: filteredUrls },
        policy_data: {
          policy_id: claimForm.policy_id,
          coverage_limit: 500000,
          deductible: 10000,
          coverages: ['property_damage', 'rent_default']
        }
      });
      setClaims([res.data, ...claims]);
      setMessage({ type: 'success', text: 'Claim filed successfully!' });
      setClaimForm({ policy_id: '', description: '', evidence_urls: [''], claim_amount: '', damage_classification: 'minor' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to file claim' });
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
          {['overview', 'properties', 'policies', 'claims'].map(tab => (
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
              <div className="sidebar-user-role">Landlord</div>
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
                <div className="stat-label">Listed Properties</div>
                <div className="stat-value">{properties.length}</div>
              </div>
              <div className="glass-card stat-card">
                <div className="stat-label">Active Policies</div>
                <div className="stat-value">{policies.filter(p => p.status === 'active').length}</div>
              </div>
              <div className="glass-card stat-card">
                <div className="stat-label">Total Coverage</div>
                <div className="stat-value">₹{policies.filter(p => p.status === 'active').reduce((s, p) => s + parseFloat(p.coverage_amount || 0), 0).toLocaleString()}</div>
              </div>
              <div className="glass-card stat-card">
                <div className="stat-label">Pending Claims</div>
                <div className="stat-value">{claims.filter(c => c.status === 'under_review').length}</div>
              </div>
            </div>

            <h2 className="dash-subtitle">Active Tenant Policies</h2>
            {policies.length === 0 ? (
              <p className="dash-empty">No tenant policies yet.</p>
            ) : (
              <div className="table-wrap glass-card">
                <table className="dash-table">
                  <thead><tr><th>Tenant</th><th>Property</th><th>Coverage</th><th>Status</th></tr></thead>
                  <tbody>
                    {policies.slice(0, 5).map(pol => (
                      <tr key={pol.policy_id}>
                        <td>{pol.tenant_name}</td>
                        <td>{pol.property_address}, {pol.property_city}</td>
                        <td>₹{parseFloat(pol.coverage_amount || 0).toLocaleString()}</td>
                        <td>{statusBadge(pol.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Properties Tab */}
        {activeTab === 'properties' && (
          <div className="animate-fade-in">
            <h1 className="dash-title">My Properties</h1>

            {properties.length > 0 && (
              <div className="cards-grid">
                {properties.map(prop => (
                  <div key={prop.property_id} className="glass-card policy-card">
                    <div className="policy-header">
                      <span>{prop.address}</span>
                      <span className="badge badge-info">{prop.city}</span>
                    </div>
                    <div className="policy-details">
                      <div><span>Rent:</span>₹{parseFloat(prop.rent_amount).toLocaleString()}/mo</div>
                      <div><span>Deposit:</span>₹{parseFloat(prop.estimated_deposit).toLocaleString()}</div>
                      {prop.building_year && <div><span>Built:</span>{prop.building_year}</div>}
                      <div><span>Furnishing:</span>{FURNISHING_LABELS[prop.furnishing_level] || prop.furnishing_level || 'Unfurnished'}</div>
                      <div><span>Type:</span>{PROPERTY_TYPE_LABELS[prop.property_type]?.split(' ')[0] || 'Apartment'}</div>
                    </div>

                    {/* Invite Code section */}
                    <div style={{ marginTop: '14px', padding: '10px', background: 'rgba(124,58,237,0.08)', borderRadius: '8px', border: '1px solid rgba(124,58,237,0.2)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Tenant Invite Code</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--accent-1)', letterSpacing: '2px' }}>
                          {prop.invite_code}
                        </span>
                        <button
                          onClick={() => handleCopyCode(prop.invite_code)}
                          style={{ padding: '3px 8px', fontSize: '0.7rem', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border-subtle)', borderRadius: '4px', color: 'var(--text-secondary)', cursor: 'pointer' }}
                        >
                          Copy
                        </button>
                        <button
                          onClick={() => handleRegenerateCode(prop.property_id)}
                          style={{ padding: '3px 8px', fontSize: '0.7rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', borderRadius: '4px', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                          Regenerate
                        </button>
                      </div>
                    </div>

                    <button className="btn-danger-sm" style={{ marginTop: '12px' }} onClick={() => handleDeleteProperty(prop.property_id)}>Remove</button>
                  </div>
                ))}
              </div>
            )}

            <h2 className="dash-subtitle" style={{ marginTop: '40px' }}>Add New Property</h2>
            <form onSubmit={handlePropertySubmit} className="glass-card form-card">
              <div className="form-group">
                <label className="form-label">Address</label>
                <input className="input-field" placeholder="123 Main Street" value={propForm.address} onChange={e => setPropForm({ ...propForm, address: e.target.value })} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input className="input-field" placeholder="Mumbai" value={propForm.city} onChange={e => setPropForm({ ...propForm, city: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Building Year</label>
                  <input className="input-field" type="number" placeholder="2020" value={propForm.building_year} onChange={e => setPropForm({ ...propForm, building_year: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Monthly Rent (₹)</label>
                  <input className="input-field" type="number" placeholder="25000" value={propForm.rent_amount} onChange={e => setPropForm({ ...propForm, rent_amount: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Estimated Deposit (₹)</label>
                  <input className="input-field" type="number" placeholder="75000" value={propForm.estimated_deposit} onChange={e => setPropForm({ ...propForm, estimated_deposit: e.target.value })} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Furnishing Level</label>
                  <select className="input-field" value={propForm.furnishing_level} onChange={e => setPropForm({ ...propForm, furnishing_level: e.target.value })}>
                    <option value="unfurnished">Unfurnished</option>
                    <option value="semi_furnished">Semi-Furnished (+8% on premium)</option>
                    <option value="fully_furnished">Fully Furnished (+15% on premium)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Property Type</label>
                  <select className="input-field" value={propForm.property_type} onChange={e => setPropForm({ ...propForm, property_type: e.target.value })}>
                    <option value="apartment">Apartment</option>
                    <option value="independent_house">Independent House (+5% on premium)</option>
                    <option value="other">Other (+3% on premium)</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="btn-primary">List Property</button>
            </form>
          </div>
        )}

        {/* Policies Tab */}
        {activeTab === 'policies' && (
          <div className="animate-fade-in">
            <h1 className="dash-title">Tenant Policies</h1>
            {policies.length === 0 ? (
              <p className="dash-empty">No policies found on your properties.</p>
            ) : (
              <div className="cards-grid">
                {policies.map(pol => (
                  <div key={pol.policy_id} className="glass-card policy-card">
                    <div className="policy-header">
                      <span>{pol.tenant_name}</span>
                      {statusBadge(pol.status)}
                    </div>
                    <div className="policy-details">
                      <div><span>Property:</span>{pol.property_address}, {pol.property_city}</div>
                      <div><span>Premium:</span>₹{Number(pol.premium_amount || 0).toLocaleString()}/mo</div>
                      <div><span>Coverage:</span>₹{Number(pol.coverage_amount || 0).toLocaleString()}</div>
                      <div><span>Period:</span>{pol.start_date ? new Date(pol.start_date).toLocaleDateString() : 'N/A'} – {pol.expiry_date ? new Date(pol.expiry_date).toLocaleDateString() : 'N/A'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Claims Tab */}
        {activeTab === 'claims' && (
          <div className="animate-fade-in">
            <h1 className="dash-title">Claims</h1>

            {claims.length > 0 && (
              <div className="table-wrap glass-card" style={{ marginBottom: '40px' }}>
                <table className="dash-table">
                  <thead><tr><th>Property</th><th>Claim Amount</th><th>Final Payout</th><th>Fraud Score</th><th>Status</th></tr></thead>
                  <tbody>
                    {claims.map(c => (
                      <tr key={c.claim_id}>
                        <td>{c.property_address || c.claim_id?.substring(0, 8)}</td>
                        <td>₹{Number(c.claim_amount || 0).toLocaleString()}</td>
                        <td style={{ color: 'var(--accent-1)', fontWeight: 'bold' }}>₹{Number(c.calculated_payout || 0).toLocaleString()}</td>
                        <td>
                          <span className="badge" style={{ background: (c.fraud_score || 0) > 60 ? 'rgba(239,68,68,0.15)' : (c.fraud_score || 0) > 30 ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)', color: (c.fraud_score || 0) > 60 ? '#f87171' : (c.fraud_score || 0) > 30 ? '#fbbf24' : '#34d399', border: 'none' }}>
                            {c.fraud_score || 0}/100
                          </span>
                        </td>
                        <td>{statusBadge(c.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h2 className="dash-subtitle">File a New Claim</h2>
            <form onSubmit={handleClaimSubmit} className="glass-card form-card">
              <div className="form-group">
                <label className="form-label">Policy</label>
                <select className="input-field" value={claimForm.policy_id} onChange={e => setClaimForm({ ...claimForm, policy_id: e.target.value })} required>
                  <option value="">Select a policy...</option>
                  {policies.filter(p => p.status === 'active').map(p => (
                    <option key={p.policy_id} value={p.policy_id}>{p.tenant_name} — {p.property_address}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="input-field" rows="3" placeholder="Describe the damage or issue..." value={claimForm.description} onChange={e => setClaimForm({ ...claimForm, description: e.target.value })} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Claim Amount (₹)</label>
                  <input className="input-field" type="number" placeholder="10000" value={claimForm.claim_amount} onChange={e => setClaimForm({ ...claimForm, claim_amount: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Damage Classification</label>
                  <select className="input-field" value={claimForm.damage_classification} onChange={e => setClaimForm({ ...claimForm, damage_classification: e.target.value })}>
                    <option value="minor">Minor Wear & Tear</option>
                    <option value="moderate">Moderate Damage</option>
                    <option value="severe">Severe Structural Impact</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Evidence URLs (optional)</label>
                {claimForm.evidence_urls.map((url, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <input
                      className="input-field"
                      placeholder={`https://drive.google.com/... (evidence ${idx + 1})`}
                      value={url}
                      onChange={e => {
                        const updated = [...claimForm.evidence_urls];
                        updated[idx] = e.target.value;
                        setClaimForm({ ...claimForm, evidence_urls: updated });
                      }}
                      style={{ flex: 1, marginBottom: 0 }}
                    />
                    {claimForm.evidence_urls.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setClaimForm({ ...claimForm, evidence_urls: claimForm.evidence_urls.filter((_, i) => i !== idx) })}
                        style={{ padding: '6px 10px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#f87171', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setClaimForm({ ...claimForm, evidence_urls: [...claimForm.evidence_urls, ''] })}
                  style={{ padding: '6px 14px', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: '6px', color: 'var(--accent-1)', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  + Add URL
                </button>
              </div>
              <button type="submit" className="btn-primary">File Claim</button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

export default LandlordDashboard;
