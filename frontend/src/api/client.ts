import axios from 'axios';
import { auth } from '../lib/firebase';
import { useAuthStore } from '../stores/authStore';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach Firebase ID Token or Store Demo Token on every request
api.interceptors.request.use(async (config) => {
  try {
    const storeToken = useAuthStore.getState().idToken;
    if (storeToken) {
      config.headers.Authorization = `Bearer ${storeToken}`;
    } else {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const token = await currentUser.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  } catch (err) {
    console.warn('Failed to attach auth token:', err);
  }
  return config;
});

// ─── Auth & Profile ─────────────────────────────────────────
export const registerUser = () => api.post('/auth/register', {}).then(r => r.data);
export const fetchMyProfile = () => api.get('/auth/me').then(r => r.data);
export const switchUserRole = (role: 'buyer' | 'merchant', merchantId: number = 1) =>
  api.post('/auth/switch-role', { role, merchant_id: merchantId }).then(r => r.data);
export const applyAsMerchant = (data: {
  business_name: string;
  category: string;
  description?: string;
  catalog_url?: string;
}) => api.post('/auth/apply-merchant', data).then(r => r.data);
export const fetchApplicationStatus = () => api.get('/auth/application-status').then(r => r.data);


// ─── Merchant Network Approvals & Users ─────────────────────
export const fetchMerchantApplications = () => api.get('/admin/applications').then(r => r.data);
export const approveMerchantApplication = (uid: string) => api.post(`/admin/approve-merchant/${uid}`).then(r => r.data);
export const rejectMerchantApplication = (uid: string, reason?: string) =>
  api.post(`/admin/reject-merchant/${uid}`, null, { params: { reason } }).then(r => r.data);
export const fetchAllUsers = () => api.get('/admin/users').then(r => r.data);

// ─── Catalog & Manifest ─────────────────────────────────────
export const createMerchant = (data: { name: string; category: string; raw_catalog_text?: string }) =>
  api.post('/merchants', data).then(r => r.data);
export const generateManifest = (merchantId: number) =>
  api.post(`/manifest/generate/${merchantId}`).then(r => r.data);
export const fetchMerchants = () => api.get('/merchants').then(r => r.data);
export const fetchMerchant = (id: number) => api.get(`/merchants/${id}`).then(r => r.data);
export const uploadCatalog = (merchantId: number, formData: FormData) =>
  api.post(`/merchants/${merchantId}/catalog/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);

export const fetchManifest = (merchantId: number) => api.get(`/manifest/${merchantId}`).then(r => r.data);
export const verifyManifest = (merchantId: number) => api.post(`/manifest/${merchantId}/verify`).then(r => r.data);
export const fetchProducts = (params?: { category?: string; merchant_id?: number }) =>
  api.get('/products', { params }).then(r => r.data);
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

// ─── Orders & Approvals ────────────────────────────────────
export const createOrder = (data: { product_id: number; amount: number; negotiation_id?: number; buyer_intent?: string }) =>
  api.post('/order/create', data).then(r => r.data);
export const verifyOrder = (data: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
  api.post('/order/verify', data).then(r => r.data);
export const completeTestPayment = (orderId: number) => api.post(`/order/complete-test-payment/${orderId}`).then(r => r.data);
export const fetchOrder = (orderId: number) => api.get(`/orders/${orderId}`).then(r => r.data);
export const fetchMyOrders = () => api.get('/orders/mine').then(r => r.data);
export const fetchPendingOrders = (merchantId: number) => api.get(`/merchant/${merchantId}/pending-orders`).then(r => r.data);
export const approvePendingOrder = (orderId: number) => api.post(`/orders/${orderId}/approve`).then(r => r.data);
export const rejectPendingOrder = (orderId: number) => api.post(`/orders/${orderId}/reject`).then(r => r.data);

// ─── Audit ─────────────────────────────────────────────────
export const fetchAuditLogs = (merchantId?: number, status?: string) => {
  const params = new URLSearchParams();
  if (merchantId) params.append('merchant_id', String(merchantId));
  if (status) params.append('status', status);
  return api.get(`/audit?${params}`).then(r => r.data);
};
export const fetchMerchantAudit = (merchantId: number) => api.get(`/audit/${merchantId}`).then(r => r.data);

// ─── Dashboard & Analytics ─────────────────────────────────
export const fetchDashboard = (merchantId: number) => api.get(`/dashboard/${merchantId}`).then(r => r.data);
export const fetchCertificate = (merchantId: number) => api.get(`/merchant/${merchantId}/certificate`).then(r => r.data);
export const fetchGrowthData = (merchantId: number) => api.get(`/growth/${merchantId}`).then(r => r.data);
export const updateGrowthRules = (merchantId: number, data: any) => api.put(`/growth/${merchantId}`, data).then(r => r.data);

// ─── Voice Order ──────────────────────────────────────────────
export const startVoiceOrderSession = () =>
  api.post('/voice-order/start').then(r => r.data);

export const sendVoiceUtterance = (sessionId: string, audioBlob: Blob, languageCode: string = 'en-IN') => {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  formData.append('language_code', languageCode);
  return api.post(`/voice-order/${sessionId}/utterance`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};

export const sendVoiceUtteranceText = (sessionId: string, transcript: string, languageCode: string = 'en-IN') => {
  const formData = new FormData();
  formData.append('transcript_text', transcript);
  formData.append('language_code', languageCode);
  return api.post(`/voice-order/${sessionId}/utterance`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};

export const getVoiceSessionState = (sessionId: string) =>
  api.get(`/voice-order/${sessionId}`).then(r => r.data);

export default api;
