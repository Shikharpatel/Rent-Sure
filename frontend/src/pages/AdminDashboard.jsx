import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, PieChart, Pie, Cell, Tooltip, Legend,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { getLossRatio, getFraudDistribution, getRiskSegmentation, getPendingPolicies, reviewPolicy, getPendingClaims, reviewClaim, getPendingKYC, reviewKYC } from '../services/api';
import './Dashboard.css';

const CHART_COLORS = {
  low:    '#34d399',
  medium: '#fbbf24',
  high:   '#f87171',
  accent: '#7c3aed',
  cyan:   '#06b6d4',
};

function AdminDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('policies');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [policies, setPolicies] = useState([]);
  const [claims, setClaims] = useState([]);
  const [kycPendings, setKycPendings] = useState([]);
  const [analytics, setAnalytics] = useState({ lossRatio: 0, fraudData: [], riskData: [] });
  const [loadingError, setLoadingError] = useState(null);
  const [expandedClaim, setExpandedClaim] = useState(null); // claim_id of the expanded row
  const [adminNotes, setAdminNotes] = useState({});          // { [claim_id]: string }

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
    setLoadingError(null);
    try {
      const results = await Promise.allSettled([
        getPendingPolicies(),
        getPendingClaims(),
        getPendingKYC(),
        getLossRatio(),
        getFraudDistribution(),
        getRiskSegmentation()
      ]);

      const [polRes, claimRes, kycRes, lossRes, fraudRes, riskRes] = results;

      results.forEach((res, index) => {
        if (res.status === 'rejected') {
          console.error(`Admin fetch error at index ${index}:`, res.reason);
          if (index <= 2) setLoadingError('Some critical data failed to load. Please refresh.');
        }
      });

      if (polRes.status === 'fulfilled') setPolicies(polRes.value.data);
      if (claimRes.status === 'fulfilled') setClaims(claimRes.value.data);
      if (kycRes.status === 'fulfilled') setKycPendings(kycRes.value.data);
      else setKycPendings(null);

      if (lossRes.status === 'fulfilled') setAnalytics(prev => ({ ...prev, lossRatio: lossRes.value.data.data.loss_ratio }));
      if (fraudRes.status === 'fulfilled') setAnalytics(prev => ({ ...prev, fraudData: fraudRes.value.data.data }));
      if (riskRes.status === 'fulfilled') setAnalytics(prev => ({ ...prev, riskData: riskRes.value.data.data }));
    } catch (err) {
      console.error('loadData error:', err);
      setLoadingError('Unexpected error loading dashboard.');
    } finally {
      setLoading(false);
    }
  };

  const handlePolicyReview = async (id, action) => {
    try {
      await reviewPolicy(id, { action });
      setMessage({ type: 'success', text: `Policy ${action}d successfully!` });
      setPolicies(policies.filter(p => p.policy_id !== id));
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to review policy' });
    }
  };

  const handleClaimReview = async (id, action) => {
    try {
      await reviewClaim(id, { action, admin_notes: adminNotes[id] || null });
      setMessage({ type: 'success', text: `Claim ${action}d successfully!` });
      setClaims(claims.filter(c => c.claim_id !== id));
      setExpandedClaim(null);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to review claim' });
    }
  };

  const isImageUrl = (url) => /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(url);

  const handleKYCReview = async (id, status) => {
    try {
      await reviewKYC(id, { status });
      setMessage({ type: 'success', text: `KYC ${status} successfully!` });
      setKycPendings(kycPendings.filter(k => k.kyc_id !== id));
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to review KYC' });
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  if (loading) return <div className="dash-loading"><div className="spinner"></div></div>;

  // Transform analytics data for Recharts
  const fraudChartData = analytics.fraudData.map(f => ({
    name: f.risk_flag || 'UNKNOWN',
    count: parseInt(f.count) || 0,
    fill: f.risk_flag === 'LOW' ? CHART_COLORS.low : f.risk_flag === 'MEDIUM' ? CHART_COLORS.medium : CHART_COLORS.high
  }));

  const riskPieData = analytics.riskData.map(r => ({
    name: (r.risk_level || 'unknown').toUpperCase(),
    value: parseInt(r.count) || 0,
    fill: r.risk_level === 'low' ? CHART_COLORS.low : r.risk_level === 'medium' ? CHART_COLORS.medium : CHART_COLORS.high
  }));

  const lossRatioPct = parseFloat(analytics.lossRatio || 0);

  return (
    <div className="dashboard dash-admin">
      <aside className="sidebar glass-card" style={{ borderRight: '1px solid var(--accent-1)' }}>
        <div className="sidebar-brand">
          <span className="text-gradient">Rent</span>Sure <span style={{ fontSize: '0.6em', color: 'var(--accent-1)', textTransform: 'uppercase' }}>[Admin]</span>
        </div>
        <nav className="sidebar-nav">
          {['policies', 'claims', 'kyc', 'analytics'].map(tab => (
            <button key={tab} className={`sidebar-link ${activeTab === tab ? 'sidebar-link-active' : ''}`} onClick={() => { setActiveTab(tab); setMessage({ type: '', text: '' }); }}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="sidebar-logout" onClick={logout}>Sign Out</button>
        </div>
      </aside>

      <main className="dash-main">
        {message.text && (
          <div className={message.type === 'success' ? 'message-success' : 'message-error'}>
            {message.text}
          </div>
        )}

        {loadingError && (
          <div className="message-error" style={{ marginBottom: '20px' }}>
            {loadingError}
            <button onClick={loadData} style={{ marginLeft: '10px', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}>Try Again</button>
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
                      <div><span>Property:</span>{pol.property_address || 'Property'}, {pol.property_city || 'Unknown'}</div>
                      <div><span>Premium:</span>₹{Number(pol.premium_amount || 0).toFixed(2)}/mo</div>
                      <div><span>Coverage:</span>₹{Number(pol.coverage_amount || 0).toLocaleString()}</div>
                      <div><span>Period:</span>{pol.start_date ? new Date(pol.start_date).toLocaleDateString() : 'N/A'} – {pol.expiry_date ? new Date(pol.expiry_date).toLocaleDateString() : 'N/A'}</div>

                      {pol.policy_document_url && (() => {
                        let pd = {};
                        try { pd = JSON.parse(pol.policy_document_url || '{}'); } catch {}
                        return (
                          <div style={{ gridColumn: '1 / -1', marginTop: '10px', fontSize: '11px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                            <div style={{ marginBottom: '5px', fontWeight: 'bold', color: 'var(--accent-1)' }}>Underwriting Data</div>
                            <p>Risk Score: <strong>{pd.risk_score ?? 'N/A'}</strong> | Level: <strong>{pd.risk_level ?? 'N/A'}</strong> | P(Default): <strong>{pd.probability_of_default ?? 'N/A'}</strong></p>
                            <p style={{ marginTop: '4px' }}>Base: ₹{pd.pricing_breakdown?.base ?? 0} | Risk Loading: ₹{pd.pricing_breakdown?.risk_loading ?? 0}</p>
                          </div>
                        );
                      })()}
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                      <button className="btn-primary" style={{ flex: 1 }} onClick={() => handlePolicyReview(pol.policy_id, 'approve')}>Approve</button>
                      <button className="btn-danger-sm" style={{ flex: 1 }} onClick={() => handlePolicyReview(pol.policy_id, 'reject')}>Reject</button>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {claims.map(c => {
                  const fs = c.fraud_score || 0;
                  const fraudColor = fs > 60 ? '#f87171' : fs > 30 ? '#fbbf24' : '#34d399';
                  const isExpanded = expandedClaim === c.claim_id;
                  const urls = Array.isArray(c.evidence_urls) ? c.evidence_urls.filter(Boolean) : [];

                  return (
                    <div key={c.claim_id} className="glass-card" style={{ padding: '20px' }}>
                      {/* Summary row */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto', gap: '12px', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Landlord</div>
                          <div style={{ fontWeight: '600' }}>{c.landlord_name}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Property</div>
                          <div>{c.property_address}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Claim Amount</div>
                          <div>₹{Number(c.claim_amount || 0).toLocaleString()}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Engine Payout</div>
                          <div style={{ color: 'var(--accent-1)', fontWeight: 'bold' }}>₹{Number(c.calculated_payout || 0).toLocaleString()}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Fraud Score</div>
                          <span className="badge" style={{ background: `${fraudColor}20`, color: fraudColor, border: `1px solid ${fraudColor}40` }}>
                            {fs}/100
                          </span>
                        </div>
                        <button
                          onClick={() => setExpandedClaim(isExpanded ? null : c.claim_id)}
                          style={{ padding: '6px 14px', fontSize: '12px', background: isExpanded ? 'rgba(124,58,237,0.15)' : 'var(--bg-glass)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          {isExpanded ? 'Collapse ▲' : 'Review ▼'}
                        </button>
                      </div>

                      {/* Expanded review panel */}
                      {isExpanded && (
                        <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-subtle)', paddingTop: '20px' }}>
                          {/* Claim description */}
                          <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{c.description}</p>
                          </div>

                          {/* Evidence viewer */}
                          <div style={{ marginBottom: '20px' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Evidence ({urls.length} item{urls.length !== 1 ? 's' : ''})
                            </div>
                            {urls.length === 0 ? (
                              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>No evidence submitted.</p>
                            ) : (
                              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                {urls.map((url, idx) => (
                                  isImageUrl(url) ? (
                                    <div key={idx} style={{ border: '1px solid var(--border-subtle)', borderRadius: '8px', overflow: 'hidden', maxWidth: '200px' }}>
                                      <img
                                        src={url}
                                        alt={`Evidence ${idx + 1}`}
                                        style={{ width: '200px', height: '150px', objectFit: 'cover', display: 'block' }}
                                        onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                                      />
                                      <a href={url} target="_blank" rel="noreferrer" style={{ display: 'none', padding: '8px', fontSize: '12px', color: 'var(--accent-2)' }}>
                                        Open file ↗
                                      </a>
                                    </div>
                                  ) : (
                                    <a key={idx} href={url} target="_blank" rel="noreferrer"
                                      style={{ padding: '10px 16px', background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: '8px', color: 'var(--accent-2)', fontSize: '0.85rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      📎 Document {idx + 1} ↗
                                    </a>
                                  )
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Admin Notes */}
                          <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Admin Decision Notes (optional)
                            </label>
                            <textarea
                              className="input-field"
                              rows="3"
                              placeholder="Add notes for this decision (visible in audit trail)..."
                              value={adminNotes[c.claim_id] || ''}
                              onChange={e => setAdminNotes({ ...adminNotes, [c.claim_id]: e.target.value })}
                              style={{ resize: 'vertical' }}
                            />
                          </div>

                          {/* Action buttons */}
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="btn-primary" style={{ flex: 1 }} onClick={() => handleClaimReview(c.claim_id, 'approve')}>
                              ✓ Approve Claim
                            </button>
                            <button className="btn-danger-sm" style={{ flex: 1, padding: '12px' }} onClick={() => handleClaimReview(c.claim_id, 'reject')}>
                              ✗ Reject Claim
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* KYC Approval */}
        {activeTab === 'kyc' && (
          <div className="animate-fade-in">
            <h1 className="dash-title">KYC Verification Inbox</h1>
            {kycPendings === null ? (
              <p className="dash-empty" style={{ color: '#f87171' }}>⚠️ Failed to load KYC data from server.</p>
            ) : kycPendings.length === 0 ? (
              <p className="dash-empty">No pending KYC records.</p>
            ) : (
              <div className="cards-grid">
                {kycPendings.map(k => (
                  <div key={k.kyc_id} className="glass-card policy-card">
                    <div className="policy-header">
                      <span>{k.tenant_name || 'Tenant ID: ' + k.user_id?.substring(0, 8)}</span>
                      <span className="badge badge-warning">Pending</span>
                    </div>
                    <div className="policy-details">
                      <div><span>PAN:</span>{k.pan_number}</div>
                      <div><span>Address:</span>{k.address}</div>
                      <div style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
                        <a href={k.id_document_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-2)', fontSize: '0.85rem', textDecoration: 'underline' }}>View Identity Document</a>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                      <button className="btn-primary" style={{ flex: 1 }} onClick={() => handleKYCReview(k.kyc_id, 'approved')}>Approve</button>
                      <button className="btn-danger-sm" style={{ flex: 1 }} onClick={() => handleKYCReview(k.kyc_id, 'rejected')}>Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Analytics Tab — Recharts */}
        {activeTab === 'analytics' && (
          <div className="animate-fade-in">
            <h1 className="dash-title">System Intelligence & Analytics</h1>

            {/* KPI Cards */}
            <div className="stats-grid" style={{ marginBottom: '32px' }}>
              <div className="glass-card stat-card" style={{ borderLeft: '4px solid var(--accent-1)' }}>
                <div className="stat-label">Platform Loss Ratio</div>
                <div className="stat-value" style={{ color: lossRatioPct > 0.8 ? '#f87171' : lossRatioPct > 0.5 ? '#fbbf24' : '#34d399' }}>
                  {(lossRatioPct * 100).toFixed(1)}%
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Claims Paid ÷ Premiums Collected</div>
              </div>
              <div className="glass-card stat-card" style={{ borderLeft: '4px solid var(--accent-2)' }}>
                <div className="stat-label">Total Claims Reviewed</div>
                <div className="stat-value">{analytics.fraudData.reduce((s, f) => s + (parseInt(f.count) || 0), 0)}</div>
              </div>
              <div className="glass-card stat-card" style={{ borderLeft: '4px solid #34d399' }}>
                <div className="stat-label">Tenants Assessed</div>
                <div className="stat-value">{analytics.riskData.reduce((s, r) => s + (parseInt(r.count) || 0), 0)}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {/* Fraud Distribution Bar Chart */}
              <div className="glass-card" style={{ padding: '24px' }}>
                <h3 style={{ marginBottom: '20px', fontSize: '0.95rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fraud Score Distribution</h3>
                {fraudChartData.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No claim data yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={fraudChartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {fraudChartData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Risk Segmentation Pie Chart */}
              <div className="glass-card" style={{ padding: '24px' }}>
                <h3 style={{ marginBottom: '20px', fontSize: '0.95rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Underwriting Risk Segmentation</h3>
                {riskPieData.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No risk data yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={riskPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {riskPieData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                      <Legend formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{value}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default AdminDashboard;
