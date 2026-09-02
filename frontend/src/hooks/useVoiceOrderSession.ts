import { useState, useRef, useCallback, useEffect } from 'react';
import { useVoiceOrderStore, type VoiceCandidate, type VoiceOrderResult } from '../stores/voiceOrderStore';
import {
  startVoiceOrderSession,
  sendVoiceUtterance,
  sendVoiceUtteranceText,
} from '../api/client';

interface UseVoiceOrderSessionReturn {
  // State
  sessionId: string | null;
  state: string;
  candidates: VoiceCandidate[];
  lastOrder: VoiceOrderResult | null;
  captionText: string;
  isProcessing: boolean;
  isRecording: boolean;
  parsedIntent: Record<string, any> | null;
  policyRejection: string | null;
  clarificationNeeded: boolean;
  transcriptHistory: string[];
  error: string | null;
  showTextFallback: boolean;

  // Actions
  startSession: () => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  sendTextInput: (text: string) => Promise<void>;
  playAudio: (base64Audio: string) => void;
  reset: () => void;
  language: string;
  setLanguage: (lang: string) => void;
}

export function useVoiceOrderSession(): UseVoiceOrderSessionReturn {
  const store = useVoiceOrderStore();
  const [isRecording, setIsRecording] = useState(false);
  const [language, setLanguage] = useState('en-IN');
  const [error, setError] = useState<string | null>(null);
  const [showTextFallback, setShowTextFallback] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Auto-start session on mount
  useEffect(() => {
    if (!store.sessionId) {
      startSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startSession = useCallback(async () => {
    try {
      setError(null);
      const resp = await startVoiceOrderSession();
      store.setSessionId(resp.session_id);
      store.setState('LISTENING');
    } catch (err: any) {
      setError(err?.message || 'Failed to start voice session');
    }
  }, [store]);

  const processResponse = useCallback(
    (data: any) => {
      store.setState(data.state || 'CANDIDATES_SHOWN');

      if (data.transcript) {
        store.addTranscript(data.transcript);
      }

      if (data.spoken_response) {
        store.setCaptionText(data.spoken_response);
      }

      if (data.parsed_intent) {
        store.setParsedIntent(data.parsed_intent);
      }

      if (data.candidates && data.candidates.length > 0) {
        store.setCandidates(data.candidates);
      }

      if (data.order_result) {
        store.setLastOrder(data.order_result);
      }

      if (data.policy_rejection) {
        store.setPolicyRejection(data.policy_rejection);
      }

      store.setClarificationNeeded(data.clarification_needed || false);

      // Auto-play TTS audio
      if (data.spoken_audio_base64) {
        store.setAudioBase64(data.spoken_audio_base64);
        playAudio(data.spoken_audio_base64);
      }

      setShowTextFallback(false);
      store.setIsProcessing(false);
    },
    [store]
  );

  const handleSttFailure = useCallback(() => {
    setShowTextFallback(true);
    store.setIsProcessing(false);
    store.setCaptionText("I couldn't understand the audio. Please type your request below.");
  }, [store]);

  const startRecording = useCallback(async () => {
    if (!store.sessionId) {
      await startSession();
    }
    try {
      setError(null);
      setShowTextFallback(false);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((t) => t.stop());

        if (!store.sessionId) return;

        store.setIsProcessing(true);
        try {
          const data = await sendVoiceUtterance(store.sessionId, blob, language);
          if (data.clarification_needed && !data.spoken_response) {
            handleSttFailure();
          } else {
            processResponse(data);
          }
        } catch (err: any) {
          setError(err?.response?.data?.detail || err?.message || 'Failed to process voice');
          handleSttFailure();
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      setError('Microphone access is required for voice assistant.');
    }
  }, [store, language, startSession, processResponse, handleSttFailure]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const sendTextInput = useCallback(
    async (text: string) => {
      if (!store.sessionId || !text.trim()) return;

      store.setIsProcessing(true);
      setShowTextFallback(false);
      setError(null);

      try {
        const data = await sendVoiceUtteranceText(store.sessionId, text, language);
        processResponse(data);
      } catch (err: any) {
        setError(err?.response?.data?.detail || err?.message || 'Failed to process text');
        store.setIsProcessing(false);
      }
    },
    [store, language, processResponse]
  );

  const playAudio = useCallback((base64Audio: string) => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
      audioRef.current = audio;
      audio.play().catch(() => {});
    } catch {
      // Audio playback failed silently
    }
  }, []);

  const reset = useCallback(() => {
    store.reset();
    setIsRecording(false);
    setError(null);
    setShowTextFallback(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, [store]);

  return {
    sessionId: store.sessionId,
    state: store.state,
    candidates: store.candidates,
    lastOrder: store.lastOrder,
    captionText: store.captionText,
    isProcessing: store.isProcessing,
    isRecording,
    parsedIntent: store.parsedIntent,
    policyRejection: store.policyRejection,
    clarificationNeeded: store.clarificationNeeded,
    transcriptHistory: store.transcriptHistory,
    error,
    showTextFallback,
    startSession,
    startRecording,
    stopRecording,
    sendTextInput,
    playAudio,
    reset,
    language,
    setLanguage,
  };
}
