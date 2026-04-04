import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach auth token to every request if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const registerUser = (data) => api.post('/auth/register', data);
export const loginUser = (data) => api.post('/auth/login', data);
export const getProfile = () => api.get('/auth/profile');

// KYC
export const submitKYC = (data) => api.post('/kyc', data);
export const getMyKYC = () => api.get('/kyc/me');

// Properties
export const createProperty = (data) => api.post('/properties', data);
export const getMyProperties = () => api.get('/properties/mine');
export const getPropertyByInviteCode = (code) => api.get(`/properties/invite/${code}`);
export const updateProperty = (id, data) => api.put(`/properties/${id}`, data);
export const deleteProperty = (id) => api.delete(`/properties/${id}`);

// Risk
export const assessRisk = () => api.post('/risk/assess');
export const getMyRisk = () => api.get('/risk/me');

// Policies
export const getPolicyQuote = (data) => api.post(`/policies/quote`, data);
export const createPolicy = (data) => api.post('/policies', data);
export const getMyPolicies = () => api.get('/policies/me');
export const getLandlordPolicies = () => api.get('/policies/landlord');
export const getPolicyContract = (id) => api.get(`/policies/${id}/contract`);

// Payments
export const makePayment = (data) => api.post('/payments', data);
export const getMyPayments = () => api.get('/payments/me');
export const getPaymentsByPolicy = (policyId) => api.get(`/payments/policy/${policyId}`);

// Claims
export const fileClaim = (data) => api.post('/claims', data);
export const getMyClaims = () => api.get('/claims/me');

// Analytics
export const getLossRatio = () => api.get('/analytics/loss-ratio');
export const getFraudDistribution = () => api.get('/analytics/fraud-distribution');
export const getRiskSegmentation = () => api.get('/analytics/risk-segmentation');

export default api;
