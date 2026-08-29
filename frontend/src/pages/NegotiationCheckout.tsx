import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { negotiate, counterNegotiate, createOrder, fetchMerchants, fetchManifest } from '../api/client';

import { Spinner, TrustBadge } from '../components';
import { useUIStore } from '../stores/uiStore';


interface UpsellItem {
  id: string;
  name: string;
  category: string;
  originalPrice: number;
  bundlePrice: number;
  discountPercent: number;
  description: string;
  badge: string;
}

function getUpsellRecommendation(category: string = '', productName: string = ''): UpsellItem {
  const cat = (category || '').toLowerCase();
  const name = (productName || '').toLowerCase();

  if (cat.includes('smart') || cat.includes('phone') || name.includes('iphone') || name.includes('galaxy') || name.includes('pixel')) {
    return {
      id: 'phone-bundle',
      name: 'MagSafe Shockproof Case + 25W Ultra-Fast Charger',
      category: 'Smartphones',
      originalPrice: 1999,
      bundlePrice: 899,
      discountPercent: 55,
      description: '78% of phone buyers bundle certified high-speed charging and magnetic drop protection.',
      badge: 'Frequently Bought Together',
    };
  }

  if (cat.includes('footwear') || cat.includes('shoe') || name.includes('shoe') || name.includes('sneaker')) {
    return {
      id: 'footwear-bundle',
      name: 'Anti-Blister Pro Cushion Performance Socks (Pack of 3)',
      category: 'Footwear',
      originalPrice: 899,
      bundlePrice: 399,
      discountPercent: 55,
      description: 'Moisture-wicking breathable cotton engineered for high-impact athletic durability.',
      badge: 'Performance Add-on',
    };
  }

  if (cat.includes('audio') || cat.includes('headphone') || name.includes('earbud') || name.includes('buds')) {
    return {
      id: 'audio-bundle',
      name: 'Military-Grade Hardshell Carrying Case & Carabiner',
      category: 'Audio',
      originalPrice: 699,
      bundlePrice: 299,
      discountPercent: 57,
      description: 'Shockproof weatherproof EVA hard case tailored for premium audio gear.',
      badge: 'Essential Accessory',
    };
  }

  if (cat.includes('laptop') || cat.includes('tablet') || name.includes('ipad') || name.includes('macbook')) {
    return {
      id: 'laptop-bundle',
      name: 'Aluminum 6-in-1 USB-C Hub (4K HDMI + 100W PD)',
      category: 'Laptops & Tablets',
      originalPrice: 2999,
      bundlePrice: 1299,
      discountPercent: 56,
      description: 'Expands single USB-C port to dual USB 3.0, 4K HDMI, SD reader, and fast charging.',
      badge: 'Productivity Booster',
    };
  }

  if (cat.includes('dress') || cat.includes('saree') || cat.includes('ethnic') || cat.includes('clothing')) {
    return {
      id: 'fashion-bundle',
      name: 'Embroidered Silk Stole / Dupatta Accessory',
      category: 'Fashion',
      originalPrice: 1299,
      bundlePrice: 499,
      discountPercent: 61,
      description: 'Hand-finished artisanal border designed to complement your apparel.',
      badge: 'Style Pairing',
    };
  }

  return {
    id: 'general-bundle',
    name: 'AgentReady 1-Year Comprehensive Protection Guarantee',
    category: 'Protection',
    originalPrice: 999,
    bundlePrice: 449,
    discountPercent: 55,
    description: 'Instant zero-deductible replacement guarantee with priority customer support.',
    badge: 'Protection Guarantee',
  };
}

export default function NegotiationCheckout() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { addToast } = useUIStore();
  const pid = Number(productId);

  const [proposedPrice, setProposedPrice] = useState('');
  const [buyerMessage, setBuyerMessage] = useState('');
  const [negotiation, setNegotiation] = useState<any>(null);
  const [policyResult, setPolicyResult] = useState<any>(null);
  const [orderData, setOrderData] = useState<any>(null);
  const [upsellAdded, setUpsellAdded] = useState(false);

  // WebSocket & Round-2 negotiation states
  const [isStreaming, setIsStreaming] = useState(false);
  const [thinkingText, setThinkingText] = useState<string | null>(null);
  const [showCounterForm, setShowCounterForm] = useState(false);
  const [counterRoundPrice, setCounterRoundPrice] = useState('');
  const [counterRoundMessage, setCounterRoundMessage] = useState('');
  const wsRef = useRef<WebSocket | null>(null);

  // Clean up WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Fetch product info
  const { data: productData, isLoading } = useQuery({
    queryKey: ['product-for-negotiate', pid],
    queryFn: async () => {
      const merchants = await fetchMerchants();
      for (const m of merchants) {
        try {
          const manifest = await fetchManifest(m.id);
          const product = manifest.products?.find((p: any) => p.id === pid);
          if (product) return { product, merchant: m };
        } catch { continue; }
      }
      return null;
    },
  });


  const product = productData?.product;
  const merchant = productData?.merchant;
  const upsellItem = product ? getUpsellRecommendation(product.category, product.name) : null;

  const basePrice = negotiation?.final_price || Number(product?.price || 0);
  const payableAmount = upsellAdded && upsellItem ? basePrice + upsellItem.bundlePrice : basePrice;

  const negotiateMut = useMutation({
    mutationFn: (data: any) => negotiate(data),
    onSuccess: (data) => {
      setNegotiation(data);
      setIsStreaming(false);
      setThinkingText(null);
      if (data.status === 'accepted' || data.status === 'counter') {
        setPolicyResult({ approved: true, reason: data.policy_reason });
      } else if (data.status === 'blocked') {
        setPolicyResult({ approved: false, reason: data.policy_reason });
      }
    },
    onError: (err: any) => {
      setIsStreaming(false);
      setThinkingText(null);
      setNegotiation(null);
      addToast(err?.response?.data?.detail || 'Negotiation failed', 'error');
    },
  });

  const orderMut = useMutation({
    mutationFn: (data: any) => createOrder(data),
    onSuccess: (data) => {
      setOrderData(data);
      addToast('Order created! Redirecting to receipt...', 'success');
      setTimeout(() => navigate(`/shop/receipt/${data.id}`), 1500);
    },
    onError: (err: any) => addToast(err?.response?.data?.detail || 'Order creation failed', 'error'),
  });

  const handleNegotiate = () => {
    if (!proposedPrice) return addToast('Enter your proposed price', 'error');
    const priceNum = Number(proposedPrice);

    // Provide instant UI transition & feedback
    const initialTranscript = [
      { role: 'buyer', message: buyerMessage || `Can I get this for ₹${priceNum.toLocaleString()}?` }
    ];

    setNegotiation({
      product_id: pid,
      original_price: product?.price || 0,
      proposed_price: priceNum,
      status: 'pending',
      negotiation_transcript: initialTranscript,
    });
    setIsStreaming(true);
    setThinkingText('Connecting to autonomous negotiation channel...');

    let wsSucceeded = false;

    // Attempt real-time WebSocket connection
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.port === '5173' ? 'localhost:8000' : window.location.host;
      const ws = new WebSocket(`${protocol}//${wsHost}/ws/negotiate/${pid}`);
      wsRef.current = ws;

      const transcriptAcc: any[] = [...initialTranscript];

      ws.onopen = () => {
        wsSucceeded = true;
        setThinkingText('Merchant AI is considering your offer...');
        ws.send(JSON.stringify({
          proposed_price: priceNum,
          buyer_message: buyerMessage,
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'buyer') {
            // Buyer message already rendered in initial state
          } else if (data.type === 'thinking') {
            setThinkingText(data.message);
          } else if (data.type === 'merchant_ai') {
            setThinkingText(null);
            transcriptAcc.push({ role: 'merchant_ai', message: data.message });
            setNegotiation((prev: any) => ({
              ...(prev || { product_id: pid, original_price: product?.price || 0 }),
              negotiation_transcript: [...transcriptAcc],
            }));
          } else if (data.type === 'policy') {
            transcriptAcc.push({ role: 'policy', message: data.message, status: data.status });
            setNegotiation((prev: any) => ({
              ...(prev || { product_id: pid, original_price: product?.price || 0 }),
              status: data.status,
              final_price: data.final_price,
              policy_reason: data.message,
              discount_percent: data.discount_percent || 0,
              negotiation_transcript: [...transcriptAcc],
            }));
            if (data.status === 'accepted' || data.status === 'counter') {
              setPolicyResult({ approved: true, reason: data.message });
            } else if (data.status === 'blocked') {
              setPolicyResult({ approved: false, reason: data.message });
            }
          } else if (data.type === 'negotiation_update') {
            setNegotiation((prev: any) => ({
              ...prev,
              id: data.negotiation_id,
              status: data.status,
              final_price: data.final_price,
            }));
            setIsStreaming(false);
            setThinkingText(null);
          } else if (data.type === 'error') {
            setIsStreaming(false);
            setThinkingText(null);
            addToast(data.message, 'error');
          }
        } catch {
          // ignore parsing error
        }
      };

      ws.onerror = () => {
        if (!wsSucceeded) {
          // Fallback to REST API immediately
          setThinkingText('Connecting via secure REST fallback...');
          negotiateMut.mutate({
            product_id: pid,
            proposed_price: priceNum,
            buyer_message: buyerMessage,
          });
        }
      };

      ws.onclose = () => {
        if (!wsSucceeded) {
          negotiateMut.mutate({
            product_id: pid,
            proposed_price: priceNum,
            buyer_message: buyerMessage,
          });
        } else {
          setIsStreaming(false);
          setThinkingText(null);
        }
      };
    } catch {
      // Fallback to REST API
      setThinkingText('Negotiating with Merchant Policy Engine...');
      negotiateMut.mutate({
        product_id: pid,
        proposed_price: priceNum,
        buyer_message: buyerMessage,
      });
    }
  };

  const handleAcceptCounter = async () => {
    if (!negotiation) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'accept' }));
    } else {
      try {
        const res = await counterNegotiate(negotiation.id, { action: 'accept' });
        setNegotiation(res);
        setPolicyResult({ approved: true, reason: res.policy_reason });
        addToast('Counter-offer accepted! Ready for checkout.', 'success');
      } catch (err: any) {
        addToast(err?.response?.data?.detail || 'Failed to accept counter-offer', 'error');
      }
    }
  };

  const handleSendRound2Offer = async () => {
    if (!counterRoundPrice) return addToast('Enter your revised offer', 'error');
    const priceNum = Number(counterRoundPrice);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setIsStreaming(true);
      setThinkingText('Submitting round 2 counter-offer...');
      wsRef.current.send(JSON.stringify({
        action: 'offer',
        proposed_price: priceNum,
        buyer_message: counterRoundMessage || `Can we agree on ₹${priceNum.toLocaleString()}?`,
      }));
      setShowCounterForm(false);
    } else {
      try {
        const res = await counterNegotiate(negotiation.id, {
          action: 'offer',
          proposed_price: priceNum,
          buyer_message: counterRoundMessage || `Can we agree on ₹${priceNum.toLocaleString()}?`,
        });
        setNegotiation(res);
        if (res.status === 'accepted') {
          setPolicyResult({ approved: true, reason: res.policy_reason });
        } else if (res.status === 'blocked') {
          setPolicyResult({ approved: false, reason: res.policy_reason });
        }
        setShowCounterForm(false);
      } catch (err: any) {
        addToast(err?.response?.data?.detail || 'Round 2 counter failed', 'error');
      }
    }
  };

  const handleDeclineCounter = async () => {
    if (!negotiation) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'decline' }));
    } else {
      try {
        const res = await counterNegotiate(negotiation.id, { action: 'decline' });
        setNegotiation(res);
        setPolicyResult({ approved: false, reason: 'Negotiation declined by buyer' });
      } catch (err: any) {
        addToast(err?.response?.data?.detail || 'Failed to decline', 'error');
      }
    }
  };

  const handleToggleUpsell = () => {
    if (!upsellItem) return;
    const next = !upsellAdded;
    setUpsellAdded(next);
    if (next) {
      addToast(`Added ${upsellItem.name} (+₹${upsellItem.bundlePrice.toLocaleString()})`, 'success');
    } else {
      addToast(`Removed bundle add-on`, 'info');
    }
  };

  const handlePay = () => {
    const finalPrice = negotiation?.final_price || Number(product?.price || 0);
    if (!product || finalPrice <= 0) return;
    orderMut.mutate({
      product_id: pid,
      amount: payableAmount || finalPrice,
      negotiation_id: negotiation?.id || undefined,
      buyer_intent: upsellAdded && upsellItem
        ? `${buyerMessage || 'Direct purchase'} + Cross-Sell Bundle: ${upsellItem.name} (₹${upsellItem.bundlePrice})`
        : (buyerMessage || 'Direct purchase at list price'),
    });
  };


  if (isLoading) return <Spinner />;
  if (!product) return <div className="text-center py-16 text-text-secondary">Product not found</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 animate-fadeIn">
      <h1 className="text-xl sm:text-2xl font-bold text-text mb-6 sm:mb-8">Negotiate & Checkout</h1>


      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        {/* Left: Product + Negotiation */}
        <div className="lg:col-span-7 space-y-4 sm:space-y-6">

          {/* Product Card */}
          <div className="bg-white rounded-2xl border border-border shadow-sm p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
              <div className="flex-1">
                <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-full">{product.category}</span>
                <h2 className="text-lg sm:text-xl font-bold text-text mt-2 leading-snug">{product.name}</h2>
                {merchant && (
                  <p className="text-xs sm:text-sm text-text-secondary mt-1.5 flex items-center gap-2 flex-wrap">
                    <span>by {merchant.name}</span>
                    <TrustBadge score={merchant.trust_score} />
                  </p>
                )}
                {(product.variants?.source_url || product.source_url) && (
                  <a
                    href={product.variants?.source_url || product.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2 font-medium"
                  >
                    <span>View original product listing</span>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
              <div className="text-left sm:text-right">
                <span className="text-xs text-text-tertiary block sm:hidden">Price</span>
                <p className="text-2xl sm:text-3xl font-bold text-text">₹{Number(product.price).toLocaleString('en-IN')}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2.5 sm:gap-4 mt-4 pt-3 border-t border-border/60 text-xs sm:text-sm text-text-secondary">
              <span>📦 {product.stock} in stock</span>
              <span>🚚 {product.delivery_days}-day delivery</span>
              <span>↩️ {product.return_policy}</span>
            </div>
          </div>

          {/* Negotiation Input */}
          {!negotiation && (
            <div className="bg-white rounded-2xl border border-border shadow-sm p-4 sm:p-6">
              <h3 className="font-semibold text-text text-base mb-4">Make Your Offer</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm text-text-secondary mb-1">Your Price (₹)</label>
                  <input
                    type="number"
                    value={proposedPrice}
                    onChange={e => setProposedPrice(e.target.value)}
                    placeholder={`e.g. ${Math.round(product.price * 0.9)}`}
                    className="w-full px-4 py-2.5 sm:py-3 rounded-xl border border-border bg-white text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm text-text-secondary mb-1">Message (optional)</label>
                  <textarea
                    value={buyerMessage}
                    onChange={e => setBuyerMessage(e.target.value)}
                    placeholder="I'm looking to buy immediately if we can agree on this price."
                    rows={2}
                    className="w-full px-4 py-2.5 sm:py-3 rounded-xl border border-border bg-white text-text text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 pt-2">

                  <button
                    onClick={handleNegotiate}
                    disabled={negotiateMut.isPending || isStreaming || !proposedPrice}
                    className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs sm:text-sm font-bold hover:shadow-md transition-all disabled:opacity-50 cursor-pointer shadow-xs flex items-center justify-center gap-2"
                  >
                    {(negotiateMut.isPending || isStreaming) && (
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    )}
                    <span>{negotiateMut.isPending || isStreaming ? 'Negotiating...' : '🤖 Propose AI Discount'}</span>
                  </button>

                  <button
                    onClick={() => {
                      orderMut.mutate({
                        product_id: pid,
                        amount: payableAmount || Number(product.price),
                        buyer_intent: upsellAdded && upsellItem
                          ? `Instant Purchase at ₹${product.price} + Bundle: ${upsellItem.name} (₹${upsellItem.bundlePrice})`
                          : `Instant Purchase at List Price (₹${product.price})`,
                      });
                    }}
                    disabled={orderMut.isPending}
                    className="btn-3d-primary flex-1 py-3 text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {orderMut.isPending ? 'Processing...' : `⚡ Buy Now (₹${payableAmount.toLocaleString('en-IN')})`}
                  </button>
                </div>
              </div>
            </div>
          )}


          {/* Negotiation Transcript */}
          {negotiation && (
            <div className="bg-white rounded-2xl border border-border shadow-sm p-4 sm:p-6">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h3 className="font-semibold text-text text-base">Negotiation Transcript</h3>
                <div className="flex items-center gap-2">
                  {!isStreaming && (
                    <button
                      onClick={() => {
                        setNegotiation(null);
                        setPolicyResult(null);
                        setShowCounterForm(false);
                      }}
                      className="text-xs text-text-secondary hover:text-primary font-medium transition-colors cursor-pointer"
                      title="Make another offer"
                    >
                      ↺ New Offer
                    </button>
                  )}
                  {isStreaming && (
                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      LIVE AGENT STREAM
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-3 sm:space-y-4">
                {negotiation.negotiation_transcript?.map((msg: any, i: number) => (
                  <div key={i} className={`flex ${msg.role === 'buyer' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[90%] sm:max-w-[80%] rounded-2xl px-3.5 sm:px-4 py-2.5 sm:py-3 ${
                      msg.role === 'buyer' ? 'bg-primary text-white rounded-br-md' :
                      msg.role === 'policy' ? (
                        msg.status === 'accepted' || msg.status === 'blocked' || msg.status === 'counter' ? (
                          msg.status === 'accepted' ? 'bg-success/10 text-success border border-success/30' :
                          msg.status === 'counter' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                          'bg-danger/10 text-danger border border-danger/30'
                        ) : 'bg-surface-alt text-text'
                      ) : 'bg-surface-alt text-text rounded-bl-md'
                    }`}>
                      <div className="text-[10px] uppercase font-medium mb-1 opacity-75">
                        {msg.role === 'buyer' ? '🛒 Buyer' : msg.role === 'merchant_ai' ? '🤖 Merchant AI' : '🛡️ Policy Engine'}
                      </div>
                      <p className="text-xs sm:text-sm leading-relaxed">{msg.message}</p>
                    </div>
                  </div>
                ))}
                {thinkingText && (
                  <div className="flex justify-start animate-fadeIn">
                    <div className="flex items-center gap-2 rounded-2xl px-4 py-2.5 bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                      <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                      <span>{thinkingText}</span>
                    </div>
                  </div>
                )}
                {upsellAdded && upsellItem && (
                  <div className="flex justify-start animate-fadeIn">
                    <div className="max-w-[90%] sm:max-w-[80%] rounded-2xl px-3.5 sm:px-4 py-2.5 sm:py-3 bg-primary/10 border border-primary/25 text-text rounded-bl-md shadow-xs">
                      <div className="text-[10px] uppercase font-bold mb-1 text-primary flex items-center gap-1.5 flex-wrap">
                        <span>🚀 AI Growth & Upsell Agent</span>
                        <span className="bg-primary text-white text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                          Special {upsellItem.discountPercent}% Bundle
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm leading-relaxed">
                        Deal expanded! I’ve bundled <strong>{upsellItem.name}</strong> for an exclusive <strong>₹{upsellItem.bundlePrice.toLocaleString()}</strong> (retail ₹{upsellItem.originalPrice.toLocaleString()}). Your updated checkout total is <strong>₹{payableAmount.toLocaleString()}</strong>.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Policy Check + Payment */}
        <div className="lg:col-span-5 space-y-6">

          {/* Policy Check Result */}
          {policyResult && (
            <div className={`rounded-2xl border-2 shadow-sm p-6 ${
              policyResult.approved
                ? negotiation?.status === 'counter'
                  ? 'bg-amber-50 border-amber-300'
                  : 'bg-success/5 border-success/30'
                : 'bg-danger/5 border-danger/30'
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  policyResult.approved 
                    ? negotiation?.status === 'counter' ? 'bg-amber-500 text-white' : 'bg-success text-white' 
                    : 'bg-danger text-white'
                }`}>
                  {policyResult.approved ? (negotiation?.status === 'counter' ? '💬' : '✓') : '✕'}
                </div>
                <h3 className="font-semibold text-text">
                  {policyResult.approved 
                    ? negotiation?.status === 'counter' ? 'Merchant Counter-Offer' : 'Policy Check Passed' 
                    : 'Policy Violation'}
                </h3>
              </div>
              <p className="text-sm text-text-secondary">{policyResult.reason}</p>
              {negotiation && (
                <div className="mt-4 pt-4 border-t border-border/50 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Original Price</span>
                    <span className="text-text">₹{negotiation.original_price?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Your Offer</span>
                    <span className="text-text">₹{negotiation.proposed_price?.toLocaleString()}</span>
                  </div>
                  {negotiation.final_price && (
                    <div className="flex justify-between font-semibold">
                      <span className="text-text">
                        {negotiation.status === 'counter' ? 'Merchant Counter' : 'Final Price'}
                      </span>
                      <span className="text-primary">₹{negotiation.final_price?.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Discount</span>
                    <span className="text-text">{negotiation.discount_percent?.toFixed(1)}%</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Round 2 / Counter-Offer Decision Card */}
          {negotiation?.status === 'counter' && !orderData && (
            <div className="bg-amber-50/80 rounded-2xl border-2 border-amber-300 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🤝</span>
                <h3 className="font-bold text-amber-900 text-base">Round 2: Counter-Offer Received</h3>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed mb-4">
                The merchant has countered your offer at <strong>₹{Number(negotiation.final_price).toLocaleString()}</strong>. You can accept to lock in this price, propose a second round offer, or decline.
              </p>

              <div className="bg-white rounded-xl p-4 mb-4 border border-amber-200 space-y-2">
                <div className="flex justify-between text-xs text-text-secondary">
                  <span>Original Catalog Price</span>
                  <span className="line-through">₹{Number(product.price).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs text-text-secondary">
                  <span>Your Initial Offer</span>
                  <span>₹{Number(negotiation.proposed_price).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-amber-900 pt-2 border-t border-amber-100">
                  <span>Merchant Counter</span>
                  <span className="text-primary text-base">₹{Number(negotiation.final_price).toLocaleString()}</span>
                </div>
              </div>

              {!showCounterForm ? (
                <div className="space-y-2.5">
                  <button
                    onClick={handleAcceptCounter}
                    disabled={isStreaming}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>✓</span>
                    <span>Accept Counter (₹{Number(negotiation.final_price).toLocaleString()})</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowCounterForm(true);
                      setCounterRoundPrice(String(Math.round(((negotiation.proposed_price || 0) + (negotiation.final_price || 0)) / 2)));
                    }}
                    disabled={isStreaming}
                    className="w-full py-2.5 px-4 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>💬</span>
                    <span>Make Counter-Offer (Round 2)</span>
                  </button>

                  <button
                    onClick={handleDeclineCounter}
                    disabled={isStreaming}
                    className="w-full py-2 px-4 bg-white border border-border text-text-secondary hover:text-text hover:bg-surface-alt rounded-xl text-xs font-medium transition-all text-center cursor-pointer"
                  >
                    Decline & Walk Away
                  </button>
                </div>
              ) : (
                <div className="space-y-3 pt-2 border-t border-amber-200/80 animate-fadeIn">
                  <div>
                    <label className="block text-xs font-semibold text-text mb-1">Your Round 2 Offer (₹)</label>
                    <input
                      type="number"
                      value={counterRoundPrice}
                      onChange={(e) => setCounterRoundPrice(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-border bg-white text-xs text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="e.g. your revised price"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text mb-1">Note to Merchant (optional)</label>
                    <input
                      type="text"
                      value={counterRoundMessage}
                      onChange={(e) => setCounterRoundMessage(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-border bg-white text-xs text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="e.g. Can we meet in the middle?"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSendRound2Offer}
                      disabled={isStreaming}
                      className="flex-1 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-hover transition-colors cursor-pointer shadow-xs"
                    >
                      {isStreaming ? 'Streaming...' : 'Submit Round 2 Offer'}
                    </button>
                    <button
                      onClick={() => setShowCounterForm(false)}
                      className="px-3 py-2 bg-white border border-border text-text-secondary rounded-xl text-xs font-medium hover:bg-surface-alt transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Blocked State */}
          {negotiation?.status === 'blocked' && (
            <div className="bg-danger/5 rounded-2xl border-2 border-danger/30 p-6 text-center">
              <div className="text-3xl mb-3">🚫</div>
              <h3 className="font-bold text-danger text-lg mb-2">Payment Blocked</h3>
              <p className="text-sm text-text-secondary mb-4">{negotiation.policy_reason}</p>
              <p className="text-xs text-text-secondary">
                No payment attempt was made. The policy engine blocked this transaction.
              </p>
              <button
                onClick={() => { setNegotiation(null); setPolicyResult(null); setProposedPrice(''); setUpsellAdded(false); }}
                className="mt-4 px-6 py-2 bg-white border border-border rounded-lg text-sm text-text hover:bg-surface-alt transition-colors cursor-pointer"
              >
                Try Again
              </button>
            </div>
          )}

          {/* AI Growth: Upsell & Cross-Sell Agent Card */}
          {negotiation?.status === 'accepted' && upsellItem && !orderData && (
            <div className={`rounded-2xl border-2 transition-all p-5 shadow-xs ${
              upsellAdded 
                ? 'bg-emerald-50/70 border-emerald-300' 
                : 'bg-white border-primary/20 hover:border-primary/40'
            }`}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">🚀</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                    AI Growth & Cross-Sell Agent
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {upsellItem.badge}
                </span>
              </div>

              <h4 className="text-sm font-bold text-text leading-snug">
                {upsellItem.name}
              </h4>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                {upsellItem.description}
              </p>

              <div className="mt-3.5 pt-3 border-t border-border/60 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-base font-bold text-text">
                      ₹{upsellItem.bundlePrice.toLocaleString()}
                    </span>
                    <span className="text-xs text-text-tertiary line-through">
                      ₹{upsellItem.originalPrice.toLocaleString()}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600">
                      Save {upsellItem.discountPercent}%
                    </span>
                  </div>
                  <span className="text-[10px] text-text-secondary">Exclusive AI bundle rate</span>
                </div>

                <button
                  type="button"
                  onClick={handleToggleUpsell}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                    upsellAdded
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-primary hover:bg-primary-hover text-white'
                  }`}
                >
                  {upsellAdded ? '✓ Bundle Added (Remove)' : `+ Add to Order (+₹${upsellItem.bundlePrice.toLocaleString()})`}
                </button>
              </div>
            </div>
          )}

          {/* Payment Section */}
          {negotiation?.status === 'accepted' && !orderData && (
            <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
              <h3 className="font-semibold text-text mb-4">Complete Payment</h3>
              <div className="bg-surface-alt rounded-xl p-4 mb-4 space-y-2">
                <div className="flex justify-between text-xs text-text-secondary">
                  <span>Base Negotiated Price</span>
                  <span className="text-text font-medium">₹{basePrice.toLocaleString()}</span>
                </div>
                {upsellAdded && upsellItem && (
                  <div className="flex justify-between text-xs text-emerald-700 font-medium animate-fadeIn">
                    <span>+ {upsellItem.name.split('+')[0].trim()}</span>
                    <span>+₹{upsellItem.bundlePrice.toLocaleString()}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-border/80 flex justify-between items-baseline">
                  <span className="text-xs font-semibold text-text uppercase tracking-wider">Total Payable</span>
                  <span className="font-bold text-text text-xl">₹{payableAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[11px] text-text-secondary pt-1">
                  <span>Razorpay Test Mode</span>
                  <span className="text-success">🔒 Policy Gated & Secure</span>
                </div>
              </div>
              <button
                onClick={handlePay}
                disabled={orderMut.isPending}
                className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {orderMut.isPending ? 'Processing...' : `Pay ₹${payableAmount.toLocaleString()} with Razorpay`}
              </button>
              <p className="text-[10px] text-text-secondary text-center mt-2">
                Test mode — no real money charged
              </p>
            </div>
          )}

          {/* Order Created */}
          {orderData && (
            <div className="bg-success/5 rounded-2xl border-2 border-success/30 p-6 text-center">
              <div className="text-3xl mb-2">✅</div>
              <h3 className="font-bold text-success text-lg mb-1">Order Created!</h3>
              <p className="text-sm text-text-secondary">Redirecting to receipt...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
