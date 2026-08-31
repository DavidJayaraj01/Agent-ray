import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { negotiate, counterNegotiate, createOrder, completeTestPayment, fetchMerchants, fetchManifest, fetchProducts } from '../api/client';

import { Spinner, TrustBadge, MerchantLogo } from '../components';
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

  // ─── Domain Experience Customization States ───
  // 1. Cinema / BookMyShow
  const [selectedTheatre, setSelectedTheatre] = useState('PVR INOX Laser IMAX 4K - Forum Mall');
  const [selectedShowtime, setSelectedShowtime] = useState('7:30 PM (Prime Laser)');
  const [selectedSeats, setSelectedSeats] = useState<string[]>(['E11', 'E12']);
  const [selectedPopcornCombo, setSelectedPopcornCombo] = useState(false);

  // 2. Food / Zomato / Swiggy / Zepto
  const [selectedPortion, setSelectedPortion] = useState('Single Feast (1 Person)');
  const [selectedSpice, setSelectedSpice] = useState('🌶️ Medium Spicy (Chef Special)');
  const [selectedFoodAddons, setSelectedFoodAddons] = useState<string[]>([]);

  // 3. Travel / SpiceJet
  const [selectedCabin, setSelectedCabin] = useState('SpiceMax Extra Legroom');
  const [selectedFlightSeat, setSelectedFlightSeat] = useState('Window 12A');
  const [selectedExtraBaggage, setSelectedExtraBaggage] = useState(false);

  // 4. Fashion / Retail
  const [selectedColor, setSelectedColor] = useState('Midnight Royal');
  const [selectedSize, setSelectedSize] = useState('M');

  // 5. Services / Tech
  const [selectedServiceSlot, setSelectedServiceSlot] = useState('Tomorrow 10:00 AM');

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
      const allProducts = await fetchProducts();
      const match = allProducts.find((p: any) => p.id === pid);
      if (match) {
        return {
          product: match,
          merchant: {
            id: match.merchant_id,
            name: match.merchant_name,
            category: match.merchant_category,
            trust_score: match.merchant_trust_score || 95,
          },
        };
      }
      const merchants = await fetchMerchants();
      for (const m of merchants) {
        try {
          const manifest = await fetchManifest(m.id);
          const product = manifest.products?.find((p: any) => p.id === pid);
          if (product) return { product, merchant: m };
        } catch {
          continue;
        }
      }
      return null;
    },
  });

  const product = productData?.product;
  const merchant = productData?.merchant;
  const upsellItem = product ? getUpsellRecommendation(product.category, product.name) : null;

  // Domain Detection
  const mName = (merchant?.name || '').toLowerCase();
  const pCat = (product?.category || '').toLowerCase();
  const pName = (product?.name || '').toLowerCase();

  const isCinema =
    mName.includes('bookmyshow') ||
    pCat.includes('entertainment') ||
    pCat.includes('cinema') ||
    pCat.includes('concert') ||
    pName.includes('spider-man') ||
    pName.includes('spiderman') ||
    pName.includes('avatar') ||
    pName.includes('pass') ||
    pName.includes('imax');

  const isFood =
    mName.includes('zomato') ||
    mName.includes('swiggy') ||
    mName.includes('zepto') ||
    pCat.includes('food') ||
    pCat.includes('groceries') ||
    pCat.includes('dairy') ||
    pCat.includes('beverages') ||
    pCat.includes('dining') ||
    pCat.includes('breakfast');

  const isFlight =
    mName.includes('spicejet') ||
    pCat.includes('travel') ||
    pCat.includes('flights');

  const isFashion =
    mName.includes('meesho') ||
    mName.includes('nykaa') ||
    mName.includes('amazon') ||
    mName.includes('flipkart') ||
    pCat.includes('fashion') ||
    pCat.includes('apparel') ||
    pCat.includes('ethnic') ||
    pCat.includes('footwear') ||
    pCat.includes('sports') ||
    pCat.includes('beauty');

  const isServiceOrTech =
    mName.includes('urban') ||
    mName.includes('coursera') ||
    mName.includes('meta') ||
    mName.includes('facebook') ||
    pCat.includes('home') ||
    pCat.includes('education') ||
    pCat.includes('certifications') ||
    pCat.includes('tech') ||
    pCat.includes('marketing');

  // Dynamic Add-ons Calculation
  const cinemaAddonPrice = (selectedPopcornCombo ? 299 : 0) + (selectedSeats.length > 1 ? (selectedSeats.length - 1) * Number(product?.price || 750) : 0);
  const foodAddonPrice = selectedFoodAddons.length * 59 + (selectedPortion.includes('Family') ? 320 : selectedPortion.includes('Couple') ? 150 : 0);
  const flightAddonPrice = (selectedExtraBaggage ? 899 : 0) + (selectedCabin.includes('SpiceMax') ? 499 : 0);

  const customAddonsTotal = isCinema ? cinemaAddonPrice : isFood ? foodAddonPrice : isFlight ? flightAddonPrice : 0;

  const basePrice = negotiation?.final_price || Number(product?.price || 0) + customAddonsTotal;
  const payableAmount = upsellAdded && upsellItem ? basePrice + upsellItem.bundlePrice : basePrice;

  // Build descriptive intent summary from selections
  const getFullIntentDescription = () => {
    const parts = [];
    if (isCinema) {
      parts.push(`BookMyShow: ${product?.name} at ${selectedTheatre}`);
      parts.push(`Showtime: ${selectedShowtime}`);
      parts.push(`Seats (${selectedSeats.length}): ${selectedSeats.join(', ')}`);
      if (selectedPopcornCombo) parts.push('Included: Popcorn & Drinks Combo');
    } else if (isFood) {
      parts.push(`Food Order: ${product?.name}`);
      parts.push(`Portion: ${selectedPortion}`);
      parts.push(`Spice: ${selectedSpice}`);
      if (selectedFoodAddons.length > 0) parts.push(`Addons: ${selectedFoodAddons.join(', ')}`);
    } else if (isFlight) {
      parts.push(`SpiceJet Flight: ${product?.name}`);
      parts.push(`Cabin: ${selectedCabin}`);
      parts.push(`Seat: ${selectedFlightSeat}`);
      if (selectedExtraBaggage) parts.push('Extra 15kg Baggage');
    } else if (isFashion) {
      parts.push(`Apparel: ${product?.name} (${selectedColor}, Size: ${selectedSize})`);
    } else if (isServiceOrTech) {
      parts.push(`Service Appointment: ${product?.name} on ${selectedServiceSlot}`);
    } else {
      parts.push(`Order: ${product?.name}`);
    }

    if (buyerMessage) parts.push(`Note: ${buyerMessage}`);
    return parts.join(' | ');
  };

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
    mutationFn: async (data: any) => {
      const order = await createOrder(data);
      try {
        const payment = await completeTestPayment(order.id);
        return { ...order, ...payment, id: order.id };
      } catch {
        return order;
      }
    },
    onSuccess: (data) => {
      setOrderData(data);
      addToast('Payment verified via Razorpay Test API! Redirecting to receipt...', 'success');
      setTimeout(() => navigate(`/shop/receipt/${data.id}`), 1000);
    },
    onError: (err: any) => addToast(err?.response?.data?.detail || 'Order creation failed', 'error'),
  });

  const handleNegotiate = () => {
    if (!proposedPrice) return addToast('Enter your proposed price', 'error');
    const priceNum = Number(proposedPrice);
    const intentMsg = getFullIntentDescription();

    const initialTranscript = [
      { role: 'buyer', message: buyerMessage ? `${buyerMessage} (${intentMsg})` : `Can I get this customized booking for ₹${priceNum.toLocaleString()}?` }
    ];

    setNegotiation({
      product_id: pid,
      original_price: payableAmount || product?.price || 0,
      proposed_price: priceNum,
      status: 'pending',
      negotiation_transcript: initialTranscript,
    });
    setIsStreaming(true);
    setThinkingText('Connecting to autonomous negotiation channel...');

    let wsSucceeded = false;

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
          buyer_message: intentMsg,
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'thinking') {
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
            setIsStreaming(false);
            setThinkingText(null);
          }
        } catch (e) {
          console.error('WS parse error:', e);
        }
      };

      ws.onerror = () => {
        if (!wsSucceeded) {
          fallbackToHttpNegotiate(priceNum, intentMsg);
        }
      };

      setTimeout(() => {
        if (!wsSucceeded && isStreaming) {
          fallbackToHttpNegotiate(priceNum, intentMsg);
        }
      }, 2500);

    } catch {
      fallbackToHttpNegotiate(priceNum, intentMsg);
    }
  };

  const fallbackToHttpNegotiate = (priceNum: number, msg: string) => {
    setThinkingText('Negotiating with Merchant Policy Engine...');
    negotiateMut.mutate({
      product_id: pid,
      proposed_price: priceNum,
      buyer_message: msg,
    });
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

  const toggleSeat = (seatId: string) => {
    if (selectedSeats.includes(seatId)) {
      if (selectedSeats.length === 1) {
        addToast('At least 1 seat must remain selected', 'info');
        return;
      }
      setSelectedSeats(selectedSeats.filter((s) => s !== seatId));
    } else {
      setSelectedSeats([...selectedSeats, seatId]);
    }
  };

  const toggleFoodAddon = (item: string) => {
    if (selectedFoodAddons.includes(item)) {
      setSelectedFoodAddons(selectedFoodAddons.filter((a) => a !== item));
    } else {
      setSelectedFoodAddons([...selectedFoodAddons, item]);
    }
  };

  if (isLoading) return <Spinner />;
  if (!product) return <div className="text-center py-16 text-text-secondary">Product not found</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 animate-fadeIn">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-primary rounded-full text-xs font-bold mb-2">
            <MerchantLogo name={merchant?.name || ''} category={merchant?.category} size="xs" showShadow={false} />
            <span>{merchant?.name} Experience Gateway</span>
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-text tracking-tight">
            Interactive Negotiation & Checkout
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        {/* Left Column: Domain Customization + Product + Negotiation */}
        <div className="lg:col-span-7 space-y-5">
          {/* Main Product Card */}
          <div className="bg-white rounded-2xl border border-border shadow-xs p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
              <div className="flex-1">
                <span className="px-2.5 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full">
                  {product.category}
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-text mt-2 leading-snug">
                  {product.name}
                </h2>
                {merchant && (
                  <div className="text-xs sm:text-sm text-text-secondary mt-2.5 flex items-center gap-2 flex-wrap">
                    <MerchantLogo name={merchant.name} category={merchant.category} size="xs" showShadow={false} />
                    <span>by <strong className="text-slate-800">{merchant.name}</strong></span>
                    <TrustBadge score={merchant.trust_score} />
                  </div>
                )}
              </div>
              <div className="text-left sm:text-right">
                <span className="text-xs text-text-tertiary block">Base Unit Price</span>
                <p className="text-2xl sm:text-3xl font-extrabold text-text">
                  ₹{Number(product.price).toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 sm:gap-4 mt-4 pt-3 border-t border-border/60 text-xs sm:text-sm text-text-secondary">
              <span>📦 {product.stock} in stock</span>
              <span>🚚 {product.delivery_days}-day fulfillment</span>
              <span>↩️ {product.return_policy}</span>
            </div>
          </div>

          {/* ─── DOMAIN 1: BOOKMYSHOW THEATRE & SEAT SELECTOR ─── */}
          {isCinema && (
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-slate-700">
              <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-700">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">🎟️</span>
                  <div>
                    <h3 className="font-extrabold text-base text-white">BookMyShow Live Theatre & Seats</h3>
                    <p className="text-xs text-slate-300">Select cinema hall, showtime, and interactive recliner seats</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-red-600/80 text-white rounded-md text-[11px] font-bold">
                  LIVE SEATING
                </span>
              </div>

              {/* 1. Theatre Selection */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  1. Select Cinema Theatre / Hall:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    'PVR INOX Laser IMAX 4K - Forum Mall',
                    'Cinepolis VIP Luxe - Grand Galleria',
                    'SPI Palazzo 4DX - Forum South',
                    'PVR Directors Cut - Ambience',
                  ].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedTheatre(t)}
                      className={`p-2.5 rounded-xl text-xs font-medium text-left border transition-all cursor-pointer ${
                        selectedTheatre === t
                          ? 'bg-blue-600/30 border-blue-400 text-white ring-1 ring-blue-400 font-bold'
                          : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      📍 {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Showtime Selection */}
              <div className="mb-5">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  2. Select Showtime:
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    '1:30 PM (IMAX 3D)',
                    '4:45 PM (Dolby 7.1)',
                    '7:30 PM (Prime Laser)',
                    '10:15 PM (Night Owl)',
                  ].map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setSelectedShowtime(time)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        selectedShowtime === time
                          ? 'bg-amber-500 text-slate-900 border-amber-400 font-extrabold shadow-sm'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      🕒 {time}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Interactive Visual Seat Map */}
              <div className="mb-5 bg-slate-950/70 rounded-xl p-4 border border-slate-800 text-center">
                <div className="w-4/5 mx-auto py-1 bg-gradient-to-r from-blue-500/10 via-blue-400/40 to-blue-500/10 rounded-t-full border-t-2 border-blue-400 text-[10px] uppercase font-bold text-blue-300 tracking-widest mb-4">
                  🎬 CURVED IMAX LASER SCREEN THIS WAY 🎬
                </div>

                <div className="space-y-2.5 max-w-md mx-auto">
                  {/* Row E (VIP Recliner) */}
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-[10px] font-mono text-slate-400 w-6 text-right">E (VIP)</span>
                    {['E9', 'E10', 'E11', 'E12', 'E13', 'E14'].map((s) => {
                      const isSel = selectedSeats.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggleSeat(s)}
                          className={`w-8 h-8 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center ${
                            isSel
                              ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-300 scale-105 shadow-sm'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>

                  {/* Row D (Prime) */}
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-[10px] font-mono text-slate-400 w-6 text-right">D</span>
                    {['D9', 'D10', 'D11', 'D12', 'D13', 'D14'].map((s) => {
                      const isSel = selectedSeats.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggleSeat(s)}
                          className={`w-8 h-8 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center ${
                            isSel
                              ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-300 scale-105 shadow-sm'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>

                  {/* Row C (Prime) */}
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-[10px] font-mono text-slate-400 w-6 text-right">C</span>
                    {['C9', 'C10', 'C11', 'C12', 'C13', 'C14'].map((s) => {
                      const isSel = selectedSeats.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggleSeat(s)}
                          className={`w-8 h-8 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center ${
                            isSel
                              ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-300 scale-105 shadow-sm'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-300 px-2">
                  <span>Selected: <strong className="text-emerald-400">{selectedSeats.join(', ')}</strong> ({selectedSeats.length} Tickets)</span>
                  <span className="text-[11px] text-slate-400">Click any seat to add/remove</span>
                </div>
              </div>

              {/* 4. Concessions Popcorn Combo */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedPopcornCombo(!selectedPopcornCombo)}
                  className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                    selectedPopcornCombo
                      ? 'bg-amber-500/20 border-amber-400 text-white'
                      : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">🍿</span>
                    <div className="text-left">
                      <div className="text-xs font-bold text-white">Large Gourmet Cheese Popcorn + 2 Cold Beverages</div>
                      <div className="text-[11px] text-slate-400">Exclusive 40% theatre concession bundle</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-amber-400">+₹299</span>
                    <span className="text-[10px] block text-slate-400">{selectedPopcornCombo ? '✓ Added' : '+ Add'}</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ─── DOMAIN 2: ZOMATO & SWIGGY FOOD CUSTOMIZER ─── */}
          {isFood && (
            <div className="bg-white rounded-2xl border border-border p-5 sm:p-6 shadow-xs">
              <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🍲</span>
                  <div>
                    <h3 className="font-bold text-base text-text">Gourmet Kitchen Customization</h3>
                    <p className="text-xs text-text-secondary">Customize portions, spice preferences, and culinary add-ons</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-xs font-bold">
                  FRESH KITCHEN
                </span>
              </div>

              {/* Portion Selector */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Select Portion Size:</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'Single Feast (1 Person)', extra: '+₹0' },
                    { id: 'Couple Pack (2 Persons)', extra: '+₹150' },
                    { id: 'Family Jumbo Handi (4 Persons)', extra: '+₹320' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPortion(p.id)}
                      className={`p-2.5 rounded-xl text-xs font-medium border text-left transition-all cursor-pointer ${
                        selectedPortion === p.id
                          ? 'bg-blue-50 border-primary text-primary font-bold shadow-2xs'
                          : 'bg-white border-border text-text hover:bg-slate-50'
                      }`}
                    >
                      <div>{p.id}</div>
                      <div className="text-[10px] text-text-tertiary">{p.extra}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Spice Preference */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Spice Level & Prep:</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    '🌿 Mild Fragrant',
                    '🌶️ Medium Spicy (Chef Special)',
                    '🌶️🌶️ Fiery Hot',
                    '✨ Jain / No Garlic',
                  ].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSelectedSpice(s)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        selectedSpice === s
                          ? 'bg-amber-50 border-amber-400 text-amber-900 font-bold'
                          : 'bg-white border-border text-text hover:bg-slate-50'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Addons */}
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Accompaniments & Add-ons:</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    'Extra Mint Raita & Salan (+₹49)',
                    'Tandoori Butter Garlic Naan 2pcs (+₹65)',
                    'Gulab Jamun Dessert 2pcs (+₹79)',
                    'Chilled Valencia Cold Juice (+₹50)',
                  ].map((item) => {
                    const isAdded = selectedFoodAddons.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleFoodAddon(item)}
                        className={`p-2 rounded-xl text-xs font-medium border text-left flex items-center justify-between transition-all cursor-pointer ${
                          isAdded
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-900 font-bold'
                            : 'bg-white border-border text-text hover:bg-slate-50'
                        }`}
                      >
                        <span>{item}</span>
                        <span className="text-[11px]">{isAdded ? '✓' : '+'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ─── DOMAIN 3: SPICEJET FLIGHT CONCIERGE ─── */}
          {isFlight && (
            <div className="bg-white rounded-2xl border border-border p-5 sm:p-6 shadow-xs">
              <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">✈️</span>
                  <div>
                    <h3 className="font-bold text-base text-text">SpiceJet Flight Seat & Cabin</h3>
                    <p className="text-xs text-text-secondary">Select cabin class, priority seat, and baggage allowances</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-blue-50 text-primary border border-blue-200 rounded text-xs font-bold">
                  NON-STOP
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1.5">Cabin Tier:</label>
                  <select
                    value={selectedCabin}
                    onChange={(e) => setSelectedCabin(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-xs font-semibold bg-white text-text"
                  >
                    <option value="SpiceMax Extra Legroom">SpiceMax (Extra Legroom + Free Meal)</option>
                    <option value="Standard Flexi Fare">Standard Flexi Fare</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1.5">Seat Preference:</label>
                  <select
                    value={selectedFlightSeat}
                    onChange={(e) => setSelectedFlightSeat(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-xs font-semibold bg-white text-text"
                  >
                    <option value="Window 12A">Window 12A (Forward Cabin)</option>
                    <option value="Aisle 12C">Aisle 12C (Quick Exit)</option>
                    <option value="Front Row 1B">Front Row 1B (Max Legroom)</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedExtraBaggage(!selectedExtraBaggage)}
                className={`w-full p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                  selectedExtraBaggage ? 'bg-blue-50 border-primary text-primary' : 'bg-white border-border text-text'
                }`}
              >
                <span>🧳 Add 15kg Extra Prepaid Baggage (+₹899)</span>
                <span>{selectedExtraBaggage ? '✓ Added' : '+ Add'}</span>
              </button>
            </div>
          )}

          {/* ─── DOMAIN 4: FASHION & RETAIL (MEESHO / AMAZON / FLIPKART) ─── */}
          {isFashion && (
            <div className="bg-white rounded-2xl border border-border p-5 sm:p-6 shadow-xs">
              <h3 className="font-bold text-base text-text mb-3">Product Options & Sizing</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Select Color:</label>
                  <div className="flex flex-wrap gap-2">
                    {['Midnight Royal', 'Emerald Green', 'Wine Red', 'Matte Onyx'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSelectedColor(c)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                          selectedColor === c ? 'bg-primary text-white border-primary shadow-xs' : 'bg-white text-text border-border'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Select Size:</label>
                  <div className="flex flex-wrap gap-2">
                    {['S', 'M', 'L', 'XL', 'XXL'].map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setSelectedSize(sz)}
                        className={`w-9 h-9 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center ${
                          selectedSize === sz ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-text border-border'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── DOMAIN 5: SERVICES & LEARNING (URBAN COMPANY / COURSERA) ─── */}
          {isServiceOrTech && (
            <div className="bg-white rounded-2xl border border-border p-5 sm:p-6 shadow-xs">
              <h3 className="font-bold text-base text-text mb-3">Service Schedule & Credentials</h3>
              <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Preferred Appointment Slot:</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {['Tomorrow 10:00 AM', 'Tomorrow 3:00 PM', 'Saturday 11:00 AM'].map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setSelectedServiceSlot(slot)}
                    className={`p-2.5 rounded-xl text-xs font-semibold border text-center transition-all cursor-pointer ${
                      selectedServiceSlot === slot ? 'bg-blue-50 border-primary text-primary font-bold' : 'bg-white border-border text-text'
                    }`}
                  >
                    📅 {slot}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Negotiation Input Box */}
          {!negotiation && (
            <div className="bg-white rounded-2xl border border-border shadow-xs p-5 sm:p-6">
              <h3 className="font-bold text-text text-base mb-4">Propose Your AI Discount Offer</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">Your Proposed Price (₹)</label>
                  <input
                    type="number"
                    value={proposedPrice}
                    onChange={(e) => setProposedPrice(e.target.value)}
                    placeholder={`e.g. ${Math.round(payableAmount * 0.88)}`}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-white text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">Special Instruction or Message (optional)</label>
                  <textarea
                    value={buyerMessage}
                    onChange={(e) => setBuyerMessage(e.target.value)}
                    placeholder="e.g. Booking for a group, looking to confirm immediately."
                    rows={2}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-text text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    onClick={handleNegotiate}
                    disabled={negotiateMut.isPending || isStreaming || !proposedPrice}
                    className="flex-1 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs sm:text-sm font-bold hover:shadow-md transition-all disabled:opacity-50 cursor-pointer shadow-xs flex items-center justify-center gap-2"
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
                        buyer_intent: getFullIntentDescription(),
                      });
                    }}
                    disabled={orderMut.isPending}
                    className="btn-3d-primary flex-1 py-3.5 text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {orderMut.isPending ? 'Processing...' : `⚡ Buy Now (₹${payableAmount.toLocaleString('en-IN')})`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Negotiation Transcript */}
          {negotiation && (
            <div className="bg-white rounded-2xl border border-border shadow-xs p-5 sm:p-6">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h3 className="font-bold text-text text-base">Negotiation Transcript</h3>
                <div className="flex items-center gap-2">
                  {!isStreaming && (
                    <button
                      onClick={() => {
                        setNegotiation(null);
                        setPolicyResult(null);
                        setShowCounterForm(false);
                      }}
                      className="text-xs text-text-secondary hover:text-text cursor-pointer hover:underline"
                    >
                      New Offer
                    </button>
                  )}
                  {isStreaming && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-primary bg-blue-50 px-2 py-0.5 rounded-full animate-pulse">
                      LIVE AGENT STREAM
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-3 sm:space-y-4">
                {negotiation.negotiation_transcript?.map((msg: any, i: number) => (
                  <div key={i} className={`flex ${msg.role === 'buyer' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[90%] sm:max-w-[80%] rounded-2xl px-4 py-3 ${
                        msg.role === 'buyer'
                          ? 'bg-primary text-white rounded-br-md'
                          : msg.role === 'policy'
                          ? msg.status === 'accepted' || msg.status === 'blocked' || msg.status === 'counter'
                            ? msg.status === 'accepted'
                              ? 'bg-success/10 text-success border border-success/30'
                              : msg.status === 'counter'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-danger/10 text-danger border border-danger/30'
                            : 'bg-surface-alt text-text'
                          : 'bg-surface-alt text-text rounded-bl-md'
                      }`}
                    >
                      <div className="text-[10px] uppercase font-bold mb-1 opacity-75">
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
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Policy Check + Price Breakdown & Payment */}
        <div className="lg:col-span-5 space-y-6">
          {/* Policy Check Result Card */}
          {policyResult && (
            <div
              className={`rounded-2xl border-2 shadow-xs p-6 ${
                policyResult.approved
                  ? negotiation?.status === 'counter'
                    ? 'bg-amber-50 border-amber-300'
                    : 'bg-success/5 border-success/30'
                  : 'bg-danger/5 border-danger/30'
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                    policyResult.approved
                      ? negotiation?.status === 'counter'
                        ? 'bg-amber-500 text-white'
                        : 'bg-success text-white'
                      : 'bg-danger text-white'
                  }`}
                >
                  {policyResult.approved ? (negotiation?.status === 'counter' ? '💬' : '✓') : '✕'}
                </div>
                <h3 className="font-bold text-text">
                  {policyResult.approved
                    ? negotiation?.status === 'counter'
                      ? 'Merchant Counter-Offer'
                      : 'Policy Check Passed'
                    : 'Policy Violation'}
                </h3>
              </div>
              <p className="text-sm text-text-secondary">{policyResult.reason}</p>
              {negotiation && (
                <div className="mt-4 pt-4 border-t border-border/50 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Original List Price</span>
                    <span className="text-text">₹{payableAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Your Proposed Offer</span>
                    <span className="text-text">₹{negotiation.proposed_price?.toLocaleString()}</span>
                  </div>
                  {negotiation.final_price && (
                    <div className="flex justify-between font-bold">
                      <span className="text-text">
                        {negotiation.status === 'counter' ? 'Merchant Counter' : 'Approved Final Price'}
                      </span>
                      <span className="text-primary text-base">₹{negotiation.final_price?.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Counter Offer Decision Card */}
          {negotiation?.status === 'counter' && !orderData && (
            <div className="bg-amber-50 rounded-2xl border-2 border-amber-300 p-6 shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🤝</span>
                <h3 className="font-bold text-amber-900 text-base">Counter-Offer Available</h3>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed mb-4">
                The merchant policy countered at <strong>₹{Number(negotiation.final_price).toLocaleString()}</strong>.
              </p>

              {!showCounterForm ? (
                <div className="space-y-2.5">
                  <button
                    onClick={handleAcceptCounter}
                    disabled={isStreaming}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>✓ Accept Counter (₹{Number(negotiation.final_price).toLocaleString()})</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowCounterForm(true);
                      setCounterRoundPrice(
                        String(Math.round(((negotiation.proposed_price || 0) + (negotiation.final_price || 0)) / 2))
                      );
                    }}
                    disabled={isStreaming}
                    className="w-full py-2.5 px-4 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>💬 Make Counter-Offer (Round 2)</span>
                  </button>

                  <button
                    onClick={handleDeclineCounter}
                    disabled={isStreaming}
                    className="w-full py-2 px-4 bg-white border border-border text-text-secondary hover:text-text rounded-xl text-xs font-medium transition-all text-center cursor-pointer"
                  >
                    Decline & Walk Away
                  </button>
                </div>
              ) : (
                <div className="space-y-3 pt-2 border-t border-amber-200/80 animate-fadeIn">
                  <div>
                    <label className="block text-xs font-bold text-text mb-1">Your Round 2 Offer (₹)</label>
                    <input
                      type="number"
                      value={counterRoundPrice}
                      onChange={(e) => setCounterRoundPrice(e.target.value)}
                      placeholder="e.g. 650"
                      className="w-full px-3 py-2 border rounded-xl text-xs bg-white text-text"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text mb-1">Counter Message (optional)</label>
                    <input
                      type="text"
                      value={counterRoundMessage}
                      onChange={(e) => setCounterRoundMessage(e.target.value)}
                      placeholder="e.g. Can we meet halfway?"
                      className="w-full px-3 py-2 border rounded-xl text-xs bg-white text-text"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSendRound2Offer}
                      disabled={isStreaming || !counterRoundPrice}
                      className="flex-1 py-2 bg-primary text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Submit Counter
                    </button>
                    <button
                      onClick={() => setShowCounterForm(false)}
                      className="px-3 py-2 bg-slate-200 text-slate-700 rounded-xl text-xs font-medium cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Upsell Cross-sell recommendation */}
          {upsellItem && (
            <div className="bg-gradient-to-br from-blue-50/70 to-indigo-50/70 rounded-2xl border border-blue-200/70 p-5 shadow-xs">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="px-2 py-0.5 bg-primary text-white text-[10px] font-bold rounded-full uppercase">
                  {upsellItem.badge}
                </span>
                <span className="text-xs font-bold text-emerald-700">Save {upsellItem.discountPercent}%</span>
              </div>
              <h4 className="text-sm font-bold text-text mb-1">{upsellItem.name}</h4>
              <p className="text-xs text-text-secondary mb-3 leading-relaxed">{upsellItem.description}</p>
              <div className="flex items-center justify-between pt-2 border-t border-blue-200/60">
                <div>
                  <span className="text-xs text-slate-400 line-through mr-1.5">₹{upsellItem.originalPrice.toLocaleString()}</span>
                  <span className="text-sm font-extrabold text-primary">₹{upsellItem.bundlePrice.toLocaleString()}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !upsellAdded;
                    setUpsellAdded(next);
                    if (next) {
                      addToast(`Added ${upsellItem.name} bundle (+₹${upsellItem.bundlePrice})`, 'success');
                    } else {
                      addToast('Removed bundle', 'info');
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    upsellAdded
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white border border-primary text-primary hover:bg-blue-50'
                  }`}
                >
                  {upsellAdded ? '✓ Bundle Added' : '+ Add Bundle'}
                </button>
              </div>
            </div>
          )}

          {/* Order Summary & Payment */}
          <div className="bg-white rounded-2xl border border-border shadow-xs p-6">
            <h3 className="font-bold text-text text-base mb-4">Order Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-text-secondary">
                <span>Base Item Price</span>
                <span>₹{Number(product.price).toLocaleString()}</span>
              </div>

              {isCinema && (
                <>
                  <div className="flex justify-between text-text-secondary">
                    <span>Seats ({selectedSeats.length} Tickets)</span>
                    <span>{selectedSeats.join(', ')}</span>
                  </div>
                  <div className="flex justify-between text-text-secondary">
                    <span>Hall & Showtime</span>
                    <span>{selectedShowtime.split(' ')[0]}</span>
                  </div>
                  {selectedPopcornCombo && (
                    <div className="flex justify-between text-text-secondary">
                      <span>Popcorn & Drinks Combo</span>
                      <span>+₹299</span>
                    </div>
                  )}
                </>
              )}

              {isFood && (
                <>
                  <div className="flex justify-between text-text-secondary">
                    <span>Portion ({selectedPortion.split(' ')[0]})</span>
                    <span>{selectedPortion.includes('Family') ? '+₹320' : selectedPortion.includes('Couple') ? '+₹150' : 'Included'}</span>
                  </div>
                  {selectedFoodAddons.length > 0 && (
                    <div className="flex justify-between text-text-secondary">
                      <span>Accompaniments ({selectedFoodAddons.length})</span>
                      <span>+₹{selectedFoodAddons.length * 59}</span>
                    </div>
                  )}
                </>
              )}

              {negotiation?.final_price && (
                <div className="flex justify-between text-emerald-600 font-bold pt-2 border-t border-border">
                  <span>Negotiated Price</span>
                  <span>₹{negotiation.final_price.toLocaleString()}</span>
                </div>
              )}

              <div className="flex justify-between font-extrabold text-lg text-text pt-3 border-t border-border">
                <span>Total Payable</span>
                <span className="text-primary">₹{payableAmount.toLocaleString()}</span>
              </div>
            </div>

            {/* Pay Button */}
            <div className="mt-6">
              <button
                onClick={() => {
                  orderMut.mutate({
                    product_id: pid,
                    amount: payableAmount,
                    negotiation_id: negotiation?.id || undefined,
                    buyer_intent: getFullIntentDescription(),
                  });
                }}
                disabled={orderMut.isPending}
                className="w-full btn-3d-primary py-3.5 text-white rounded-xl text-sm font-extrabold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {orderMut.isPending ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing Order...</span>
                  </>
                ) : (
                  <>
                    <span>💳</span>
                    <span>Pay ₹{payableAmount.toLocaleString()} via Test Payment</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
