import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyProperties, createProperty, deleteProperty, getLandlordPolicies, getMyClaims, fileClaim } from '../services/api';
import './Dashboard.css';

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
  const [propForm, setPropForm] = useState({ address: '', city: '', rent_amount: '', estimated_deposit: '', building_year: '' });

  // Claim form
  const [claimForm, setClaimForm] = useState({ policy_id: '', description: '', evidence_url: '', claim_amount: '' });

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
        getMyClaims(),
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
      setPropForm({ address: '', city: '', rent_amount: '', estimated_deposit: '', building_year: '' });
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

  const handleClaimSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fileClaim(claimForm);
      setClaims([res.data, ...claims]);
      setMessage({ type: 'success', text: 'Claim filed successfully!' });
      setClaimForm({ policy_id: '', description: '', evidence_url: '', claim_amount: '' });
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

      {/* Sidebar */}
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

      {/* Main Content */}
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
                <div className="stat-value">₹{policies.filter(p => p.status === 'active').reduce((s, p) => s + parseFloat(p.coverage_amount), 0).toLocaleString()}</div>
              </div>
              <div className="glass-card stat-card">
                <div className="stat-label">Pending Claims</div>
                <div className="stat-value">{claims.filter(c => c.status === 'pending').length}</div>
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
                        <td>₹{parseFloat(pol.coverage_amount).toLocaleString()}</td>
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
                      <div>
                        <span className="badge badge-warning" style={{marginRight: '8px'}}>Code: {prop.invite_code}</span>
                        <span className="badge badge-info">{prop.city}</span>
                      </div>
                    </div>
                    <div className="policy-details">
                      <div><span>Rent:</span>₹{parseFloat(prop.rent_amount).toLocaleString()}/mo</div>
                      <div><span>Deposit:</span>₹{parseFloat(prop.estimated_deposit).toLocaleString()}</div>
                      {prop.building_year && <div><span>Built:</span>{prop.building_year}</div>}
                    </div>
                    <button className="btn-danger-sm" onClick={() => handleDeleteProperty(prop.property_id)}>Remove</button>
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
                      <div><span>Premium:</span>₹{parseFloat(pol.premium_amount).toLocaleString()}/mo</div>
                      <div><span>Coverage:</span>₹{parseFloat(pol.coverage_amount).toLocaleString()}</div>
                      <div><span>Period:</span>{new Date(pol.start_date).toLocaleDateString()} – {new Date(pol.expiry_date).toLocaleDateString()}</div>
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
                  <thead><tr><th>Property</th><th>Amount</th><th>Status</th><th>Filed</th></tr></thead>
                  <tbody>
                    {claims.map(c => (
                      <tr key={c.claim_id}>
                        <td>{c.property_address}</td>
                        <td>₹{parseFloat(c.claim_amount).toLocaleString()}</td>
                        <td>{statusBadge(c.status)}</td>
                        <td>{new Date(c.created_at).toLocaleDateString()}</td>
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
                  <label className="form-label">Evidence URL (optional)</label>
                  <input className="input-field" placeholder="https://..." value={claimForm.evidence_url} onChange={e => setClaimForm({ ...claimForm, evidence_url: e.target.value })} />
                </div>
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
