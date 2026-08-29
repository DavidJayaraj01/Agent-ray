import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// ─── Merchants ─────────────────────────────────────────────
export const fetchMerchants = () => api.get('/merchants').then(r => r.data);
export const fetchMerchant = (id: number) => api.get(`/merchants/${id}`).then(r => r.data);
export const createMerchant = (data: any) => api.post('/merchants', data).then(r => r.data);
export const updateMerchant = (id: number, data: any) => api.put(`/merchants/${id}`, data).then(r => r.data);

// ─── Manifest ──────────────────────────────────────────────
export const generateManifest = (merchantId: number) => api.post(`/manifest/generate/${merchantId}`).then(r => r.data);
export const fetchManifest = (merchantId: number) => api.get(`/manifest/${merchantId}`).then(r => r.data);
export const updateProduct = (productId: number, data: any) => api.put(`/products/${productId}`, data).then(r => r.data);

// ─── Trust ─────────────────────────────────────────────────
export const computeTrustScore = (merchantId: number) => api.post(`/trust/score/${merchantId}`).then(r => r.data);

// ─── Intent + Match ────────────────────────────────────────
export const parseIntent = (rawText: string) => api.post('/intent', { raw_text: rawText }).then(r => r.data);
export const matchProducts = (constraints: any, intentId?: number) =>
  api.post('/match', { constraints, intent_id: intentId }).then(r => r.data);

// ─── Negotiate ─────────────────────────────────────────────
export const negotiate = (data: { product_id: number; proposed_price: number; buyer_message?: string }) =>
  api.post('/negotiate', data).then(r => r.data);
export const counterNegotiate = (negotiationId: number, data: { proposed_price?: number; buyer_message?: string; action?: string }) =>
  api.post(`/negotiate/counter/${negotiationId}`, data).then(r => r.data);

// ─── Policy ────────────────────────────────────────────────
export const checkPolicy = (data: { product_id: number; proposed_price: number; merchant_id: number }) =>
  api.post('/policy/check', data).then(r => r.data);
export const fetchPolicy = (merchantId: number) => api.get(`/policy/${merchantId}`).then(r => r.data);
export const updatePolicy = (merchantId: number, data: any) => api.put(`/policy/${merchantId}`, data).then(r => r.data);

// ─── Orders ────────────────────────────────────────────────
export const createOrder = (data: { product_id: number; amount: number; negotiation_id?: number; buyer_intent?: string }) =>
  api.post('/order/create', data).then(r => r.data);
export const verifyOrder = (data: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
  api.post('/order/verify', data).then(r => r.data);
export const fetchOrder = (orderId: number) => api.get(`/orders/${orderId}`).then(r => r.data);

// ─── Audit ─────────────────────────────────────────────────
export const fetchAuditLogs = (merchantId?: number, status?: string) => {
  const params = new URLSearchParams();
  if (merchantId) params.append('merchant_id', String(merchantId));
  if (status) params.append('status', status);
  return api.get(`/audit?${params}`).then(r => r.data);
};
export const fetchMerchantAudit = (merchantId: number) => api.get(`/audit/${merchantId}`).then(r => r.data);

// ─── Dashboard ─────────────────────────────────────────────
export const fetchDashboard = (merchantId: number) => api.get(`/dashboard/${merchantId}`).then(r => r.data);

// ─── Firebase ──────────────────────────────────────────────
export const fetchFirebaseStatus = () => api.get('/firebase/status').then(r => r.data);
export const pingFirebase = () => api.post('/firebase/ping').then(r => r.data);

export default api;
