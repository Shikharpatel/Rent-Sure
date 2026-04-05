import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLossRatio, getFraudDistribution, getRiskSegmentation, getPendingPolicies, reviewPolicy, getPendingClaims, reviewClaim } from '../services/api';
import './Dashboard.css';

function AdminDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('policies');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const [policies, setPolicies] = useState([]);
  const [claims, setClaims] = useState([]);
  const [analytics, setAnalytics] = useState({ lossRatio: 0, fraudData: [], riskData: [] });

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsed = JSON.parse(userData);
      setUser(parsed);
      if (parsed.role !== 'admin') {
        navigate('/');
        return;
      }
    } else {
        navigate('/login');
        return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [polRes, claimRes, lossRes, fraudRes, riskRes] = await Promise.allSettled([
        getPendingPolicies(),
        getPendingClaims(),
        getLossRatio(),
        getFraudDistribution(),
        getRiskSegmentation()
      ]);
      
      if (polRes.status === 'fulfilled') setPolicies(polRes.value.data);
      if (claimRes.status === 'fulfilled') setClaims(claimRes.value.data);
      if (lossRes.status === 'fulfilled') setAnalytics(prev => ({...prev, lossRatio: lossRes.value.data.data.loss_ratio }));
      if (fraudRes.status === 'fulfilled') setAnalytics(prev => ({...prev, fraudData: fraudRes.value.data.data }));
      if (riskRes.status === 'fulfilled') setAnalytics(prev => ({...prev, riskData: riskRes.value.data.data }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePolicyReview = async (id, action) => {
    try {
        await reviewPolicy(id, { action });
        setMessage({ type: 'success', text: `Policy ${action}d successfully!` });
        setPolicies(policies.filter(p => p.policy_id !== id));
    } catch(err) {
        setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to review policy' });
    }
  };

  const handleClaimReview = async (id, action) => {
    try {
        await reviewClaim(id, { action });
        setMessage({ type: 'success', text: `Claim ${action}d successfully!` });
        setClaims(claims.filter(c => c.claim_id !== id));
    } catch(err) {
        setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to review claim' });
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  if (loading) return <div className="dash-loading"><div className="spinner"></div></div>;

  return (
    <div className="dashboard dash-admin">
      {/* Sidebar */}
      <aside className="sidebar glass-card" style={{borderRight: '1px solid var(--accent-1)'}}>
        <div className="sidebar-brand">
          <span className="text-gradient">Rent</span>Sure <span style={{fontSize: '0.6em', color: 'var(--accent-1)', textTransform: 'uppercase'}}>[Admin]</span>
        </div>
        <nav className="sidebar-nav">
          {['policies', 'claims', 'analytics'].map(tab => (
            <button key={tab} className={`sidebar-link ${activeTab === tab ? 'sidebar-link-active' : ''}`} onClick={() => { setActiveTab(tab); setMessage({ type: '', text: '' }); }}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
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

        {/* Policies Pending Review */}
        {activeTab === 'policies' && (
          <div className="animate-fade-in">
            <h1 className="dash-title">Policies Under Review</h1>
            {policies.length === 0 ? (
                <p className="dash-empty">No pending policy reviews.</p>
            ) : (
                <div className="cards-grid">
                    {policies.map(pol => (
                    <div key={pol.policy_id} className="glass-card policy-card">
                        <div className="policy-header">
                            <span>{pol.tenant_name}</span>
                            <span className="badge badge-warning">Under Review</span>
                        </div>
                        <div className="policy-details">
                            <div><span>Property:</span>{pol.property_address}, {pol.property_city}</div>
                            <div><span>Premium:</span>₹{parseFloat(pol.premium_amount).toLocaleString()}</div>
                            <div><span>Coverage:</span>₹{parseFloat(pol.coverage_amount).toLocaleString()}</div>
                            {pol.policy_document_url && (
                                <div style={{gridColumn: '1 / -1', marginTop: '10px', fontSize: '11px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius:'8px'}}>
                                    <strong>Risk Data:</strong><br/>
                                    <span>{pol.policy_document_url}</span>
                                </div>
                            )}
                        </div>
                        <div style={{display: 'flex', gap: '10px', marginTop: '15px'}}>
                            <button className="btn-primary" style={{flex: 1}} onClick={() => handlePolicyReview(pol.policy_id, 'approve')}>Approve</button>
                            <button className="btn-danger-sm" style={{flex: 1}} onClick={() => handlePolicyReview(pol.policy_id, 'reject')}>Reject</button>
                        </div>
                    </div>
                    ))}
                </div>
            )}
          </div>
        )}

        {/* Claims Pending Review */}
        {activeTab === 'claims' && (
          <div className="animate-fade-in">
            <h1 className="dash-title">Claims Under Review</h1>
            {claims.length === 0 ? (
                <p className="dash-empty">No pending claim reviews.</p>
            ) : (
              <div className="table-wrap glass-card">
                <table className="dash-table">
                  <thead><tr><th>Landlord</th><th>Property</th><th>Claim Amount</th><th>Engine Payout</th><th>Fraud Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {claims.map(c => (
                      <tr key={c.claim_id}>
                        <td>{c.landlord_name}</td>
                        <td>{c.property_address}</td>
                        <td>₹{parseFloat(c.claim_amount).toLocaleString()}</td>
                        <td style={{color: 'var(--accent-1)', fontWeight: 'bold'}}>₹{parseFloat(c.calculated_payout || 0).toLocaleString()}</td>
                        <td><span className="badge badge-warning" style={{background: c.fraud_score > 30 ? '#e74c3c' : '#f39c12'}}>Score: {c.fraud_score}</span></td>
                        <td>
                            <div style={{display: 'flex', gap: '5px'}}>
                            <button className="btn-primary" style={{padding: '4px 10px', fontSize: '12px'}} onClick={() => handleClaimReview(c.claim_id, 'approve')}>Approve</button>
                            <button className="btn-danger-sm" style={{padding: '4px 10px'}} onClick={() => handleClaimReview(c.claim_id, 'reject')}>Reject</button>
                            </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="animate-fade-in">
            <h1 className="dash-title">System Intelligence & Analytics</h1>
            
            <div className="stats-grid">
               <div className="glass-card stat-card" style={{ borderLeft: '4px solid var(--accent-1)' }}>
                 <div className="stat-label">Platform Loss Ratio</div>
                 <div className="stat-value">{analytics.lossRatio}</div>
                 <div style={{fontSize: '12px', color: '#7f8c8d', marginTop: '4px'}}>Total Paid ÷ Total Collected</div>
               </div>
            </div>

            <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '30px' }}>
                <div className="glass-card detail-card" style={{ padding: '20px' }}>
                    <h3 style={{marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '10px'}}>Fraud Distribution Curve</h3>
                    {analytics.fraudData.map((f, i) => (
                        <div key={i} className="detail-row">
                            <span style={{fontWeight: 'bold'}}>{f.risk_flag} Risk:</span>
                            <span>{f.count} Claims</span>
                        </div>
                    ))}
                </div>
                
                <div className="glass-card detail-card" style={{ padding: '20px' }}>
                    <h3 style={{marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '10px'}}>Underwriting Segmentation</h3>
                    {analytics.riskData.map((r, i) => (
                        <div key={i} className="detail-row">
                            <span style={{fontWeight: 'bold'}}>{r.risk_level?.toUpperCase() || 'UNKNOWN'} Tier:</span>
                            <span>{r.count} Tenants Associated</span>
                        </div>
                    ))}
                </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default AdminDashboard;
