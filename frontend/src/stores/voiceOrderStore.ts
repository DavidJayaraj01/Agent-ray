import { create } from 'zustand';

export type VoiceOrderState =
  | 'IDLE'
  | 'LISTENING'
  | 'TRANSCRIBING'
  | 'INTENT_PARSED'
  | 'CANDIDATES_SHOWN'
  | 'CONFIRMATION_PENDING'
  | 'POLICY_CHECK'
  | 'PAYMENT_PROCESSING'
  | 'COMPLETED'
  | 'FAILED';

export interface VoiceCandidate {
  product_id: number;
  name: string;
  price: number;
  category: string;
  merchant_id: number;
  merchant_name: string;
  merchant_trust_score: number;
  match_score: number;
  match_reasons: Record<string, any>;
  stock: number;
  delivery_days: number;
}

export interface VoiceOrderResult {
  order_id: number;
  razorpay_order_id: string;
  amount: number;
  currency: string;
  status: string;
  product_name: string;
  merchant_name: string;
}

interface VoiceOrderStore {
  sessionId: string | null;
  state: VoiceOrderState;
  candidates: VoiceCandidate[];
  lastOrder: VoiceOrderResult | null;
  transcriptHistory: string[];
  captionText: string;
  isProcessing: boolean;
  parsedIntent: Record<string, any> | null;
  policyRejection: string | null;
  clarificationNeeded: boolean;
  audioBase64: string | null;

  // Actions
  setSessionId: (id: string) => void;
  setState: (state: VoiceOrderState) => void;
  setCandidates: (candidates: VoiceCandidate[]) => void;
  setLastOrder: (order: VoiceOrderResult | null) => void;
  addTranscript: (transcript: string) => void;
  setCaptionText: (text: string) => void;
  setIsProcessing: (val: boolean) => void;
  setParsedIntent: (intent: Record<string, any> | null) => void;
  setPolicyRejection: (reason: string | null) => void;
  setClarificationNeeded: (val: boolean) => void;
  setAudioBase64: (audio: string | null) => void;
  reset: () => void;
}

const initialState = {
  sessionId: null,
  state: 'IDLE' as VoiceOrderState,
  candidates: [],
  lastOrder: null,
  transcriptHistory: [],
  captionText: '',
  isProcessing: false,
  parsedIntent: null,
  policyRejection: null,
  clarificationNeeded: false,
  audioBase64: null,
};

export const useVoiceOrderStore = create<VoiceOrderStore>((set) => ({
  ...initialState,

  setSessionId: (id) => set({ sessionId: id }),
  setState: (state) => set({ state }),
  setCandidates: (candidates) => set({ candidates }),
  setLastOrder: (order) => set({ lastOrder: order }),
  addTranscript: (transcript) =>
    set((s) => ({ transcriptHistory: [...s.transcriptHistory, transcript] })),
  setCaptionText: (text) => set({ captionText: text }),
  setIsProcessing: (val) => set({ isProcessing: val }),
  setParsedIntent: (intent) => set({ parsedIntent: intent }),
  setPolicyRejection: (reason) => set({ policyRejection: reason }),
  setClarificationNeeded: (val) => set({ clarificationNeeded: val }),
  setAudioBase64: (audio) => set({ audioBase64: audio }),
  reset: () => set(initialState),
}));
