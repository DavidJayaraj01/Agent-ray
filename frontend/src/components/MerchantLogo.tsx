export interface MerchantLogoProps {
  name?: string;
  category?: string;
  logoUrl?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  showShadow?: boolean;
}

export const getBrandDetails = (name: string = '', category: string = '') => {
  const n = name.toLowerCase();

  if (n.includes('meesho')) {
    return {
      key: 'meesho',
      displayName: 'Meesho',
      bgClass: 'bg-gradient-to-br from-[#9B2063] to-[#670E3E]',
      shadowColor: 'shadow-pink-500/20',
      borderClass: 'border-[#9B2063]/30',
      brandColor: '#9B2063',
      tagline: 'Fashion & Ethnic Hub',
    };
  }
  if (n.includes('amazon')) {
    return {
      key: 'amazon',
      displayName: 'Amazon',
      bgClass: 'bg-gradient-to-br from-[#131921] to-[#232F3E]',
      shadowColor: 'shadow-amber-500/20',
      borderClass: 'border-slate-800',
      brandColor: '#FF9900',
      tagline: 'Electronics & Prime Hub',
    };
  }
  if (n.includes('flipkart')) {
    return {
      key: 'flipkart',
      displayName: 'Flipkart',
      bgClass: 'bg-gradient-to-br from-[#2874F0] to-[#1E5DC8]',
      shadowColor: 'shadow-blue-500/20',
      borderClass: 'border-blue-400/40',
      brandColor: '#2874F0',
      tagline: 'Sports & Footwear Assured',
    };
  }
  if (n.includes('zomato')) {
    return {
      key: 'zomato',
      displayName: 'Zomato',
      bgClass: 'bg-gradient-to-br from-[#E23744] to-[#C81E2E]',
      shadowColor: 'shadow-red-500/20',
      borderClass: 'border-red-400/40',
      brandColor: '#E23744',
      tagline: 'Food & Dining Direct',
    };
  }
  if (n.includes('swiggy')) {
    return {
      key: 'swiggy',
      displayName: 'Swiggy',
      bgClass: 'bg-gradient-to-br from-[#FC8019] to-[#E26A00]',
      shadowColor: 'shadow-orange-500/20',
      borderClass: 'border-orange-400/40',
      brandColor: '#FC8019',
      tagline: 'Instamart & Gourmet',
    };
  }
  if (n.includes('zepto')) {
    return {
      key: 'zepto',
      displayName: 'Zepto',
      bgClass: 'bg-gradient-to-br from-[#2E0249] to-[#190028]',
      shadowColor: 'shadow-purple-500/20',
      borderClass: 'border-purple-400/40',
      brandColor: '#8000FF',
      tagline: '10-Min Fast Commerce',
    };
  }
  if (n.includes('nykaa')) {
    return {
      key: 'nykaa',
      displayName: 'Nykaa',
      bgClass: 'bg-gradient-to-br from-[#FC2779] to-[#D80E5F]',
      shadowColor: 'shadow-pink-500/20',
      borderClass: 'border-pink-400/40',
      brandColor: '#FC2779',
      tagline: 'Luxe & Beauty',
    };
  }
  if (n.includes('bookmyshow') || n.includes('bms')) {
    return {
      key: 'bookmyshow',
      displayName: 'BookMyShow',
      bgClass: 'bg-gradient-to-br from-[#C4242D] to-[#96151C]',
      shadowColor: 'shadow-red-500/20',
      borderClass: 'border-red-400/40',
      brandColor: '#C4242D',
      tagline: 'Entertainment & Live Events',
    };
  }
  if (n.includes('spicejet')) {
    return {
      key: 'spicejet',
      displayName: 'SpiceJet',
      bgClass: 'bg-gradient-to-br from-[#FFFFFF] to-[#FFF1F1]',
      shadowColor: 'shadow-red-500/15',
      borderClass: 'border-red-200',
      brandColor: '#ED1B24',
      tagline: 'Airlines Direct',
    };
  }
  if (n.includes('facebook') || n.includes('meta')) {
    return {
      key: 'meta',
      displayName: 'Meta',
      bgClass: 'bg-gradient-to-br from-[#0081FB] via-[#0064E0] to-[#0052CC]',
      shadowColor: 'shadow-blue-500/20',
      borderClass: 'border-blue-400/40',
      brandColor: '#0064E0',
      tagline: 'Meta Business & Ads',
    };
  }
  if (n.includes('urban') || n.includes('urban company')) {
    return {
      key: 'urbancompany',
      displayName: 'Urban Company',
      bgClass: 'bg-gradient-to-br from-[#111827] to-[#030712]',
      shadowColor: 'shadow-slate-500/20',
      borderClass: 'border-slate-700',
      brandColor: '#111827',
      tagline: 'Pro Home Services',
    };
  }
  if (n.includes('coursera')) {
    return {
      key: 'coursera',
      displayName: 'Coursera',
      bgClass: 'bg-gradient-to-br from-[#0056D2] to-[#00419E]',
      shadowColor: 'shadow-blue-500/20',
      borderClass: 'border-blue-400/40',
      brandColor: '#0056D2',
      tagline: 'Professional Learning',
    };
  }

  // Fallback defaults
  return {
    key: 'generic',
    displayName: name || 'Merchant',
    bgClass: 'bg-gradient-to-br from-blue-600 to-indigo-600',
    shadowColor: 'shadow-blue-500/20',
    borderClass: 'border-blue-300/40',
    brandColor: '#2F6BFF',
    tagline: category || 'Verified Store',
  };
};

export default function MerchantLogo({
  name = '',
  category = '',
  logoUrl,
  size = 'md',
  className = '',
  showShadow = true,
}: MerchantLogoProps) {
  const sizeMap: Record<string, string> = {
    xs: 'w-6 h-6 rounded-lg text-[10px]',
    sm: 'w-8 h-8 rounded-xl text-xs',
    md: 'w-12 h-12 rounded-2xl text-base',
    lg: 'w-16 h-16 rounded-2xl text-xl',
    xl: 'w-20 h-20 rounded-3xl text-2xl',
  };

  const containerSizeClass = typeof size === 'string' ? sizeMap[size] || sizeMap.md : `w-[${size}px] h-[${size}px] rounded-2xl`;

  const brand = getBrandDetails(name, category);

  // If custom logo URL is provided and valid, render the image with graceful fallback
  if (logoUrl) {
    return (
      <div
        className={`relative overflow-hidden shrink-0 flex items-center justify-center bg-white border border-slate-200/80 ${
          showShadow ? 'shadow-md ' + brand.shadowColor : ''
        } ${containerSizeClass} ${className}`}
      >
        <img
          src={logoUrl}
          alt={name || 'Merchant Logo'}
          className="w-full h-full object-contain p-1.5"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      </div>
    );
  }

  // Render Real High-Fidelity SVG Brand Logos
  const renderSvgLogo = () => {
    switch (brand.key) {
      case 'meesho':
        return (
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <defs>
              <linearGradient id="meeshoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#9B2063" />
                <stop offset="100%" stopColor="#6E0D41" />
              </linearGradient>
            </defs>
            <rect width="100" height="100" rx="24" fill="url(#meeshoGrad)" />
            {/* Meesho Iconic Double Loop 'm' */}
            <path
              d="M26 68V42C26 34.268 32.268 28 40 28C47.732 28 54 34.268 54 42V68"
              stroke="white"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M48 42C48 34.268 54.268 28 62 28C69.732 28 76 34.268 76 42V68"
              stroke="white"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );

      case 'amazon':
        return (
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <defs>
              <linearGradient id="amazonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#19222D" />
                <stop offset="100%" stopColor="#0F141C" />
              </linearGradient>
            </defs>
            <rect width="100" height="100" rx="24" fill="url(#amazonGrad)" />
            {/* Amazon 'a' and smile arrow */}
            <text
              x="36"
              y="56"
              fill="#FFFFFF"
              fontSize="48"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight="900"
            >
              a
            </text>
            {/* Orange Smile Arrow */}
            <path
              d="M22 66C38 76 64 76 77 64"
              stroke="#FF9900"
              strokeWidth="5"
              strokeLinecap="round"
              fill="none"
            />
            {/* Arrowhead */}
            <path
              d="M74 60L80 64.5L74 68.5"
              fill="#FF9900"
              stroke="#FF9900"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );

      case 'flipkart':
        return (
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <defs>
              <linearGradient id="flipkartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2874F0" />
                <stop offset="100%" stopColor="#1752B3" />
              </linearGradient>
            </defs>
            <rect width="100" height="100" rx="24" fill="url(#flipkartGrad)" />
            {/* Yellow Shopping Bag */}
            <path
              d="M32 38C32 38 35 25 50 25C65 25 68 38 68 38"
              stroke="#FFE11B"
              strokeWidth="5.5"
              strokeLinecap="round"
            />
            <path d="M26 40H74L70 80H30L26 40Z" fill="#FFE11B" />
            {/* Blue 'f' */}
            <path
              d="M54 48C52.5 48 50 49 50 52V57H56V61H50V76H44V61H40V57H44V51.5C44 45.5 48 43 54.5 43C56 43 58 43.5 58 43.5V48.5C57 48.2 55.5 48 54 48Z"
              fill="#2874F0"
            />
            {/* Speed trails */}
            <path d="M18 46H23M16 54H21M19 62H24" stroke="#FFE11B" strokeWidth="3" strokeLinecap="round" />
          </svg>
        );

      case 'zomato':
        return (
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <defs>
              <linearGradient id="zomatoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#E23744" />
                <stop offset="100%" stopColor="#B81423" />
              </linearGradient>
            </defs>
            <rect width="100" height="100" rx="24" fill="url(#zomatoGrad)" />
            <text
              x="50"
              y="62"
              fill="#FFFFFF"
              fontSize="35"
              fontStyle="italic"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight="900"
              textAnchor="middle"
              letterSpacing="-1"
            >
              zomato
            </text>
          </svg>
        );

      case 'swiggy':
        return (
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <defs>
              <linearGradient id="swiggyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FC8019" />
                <stop offset="100%" stopColor="#DE6400" />
              </linearGradient>
            </defs>
            <rect width="100" height="100" rx="24" fill="url(#swiggyGrad)" />
            {/* Swiggy White Map Pin with Orange 'S' cutout */}
            <path
              d="M50 18C37 18 27 28 27 41C27 56 46 78 48.5 80.8C49.3 81.7 50.7 81.7 51.5 80.8C54 78 73 56 73 41C73 28 63 18 50 18Z"
              fill="white"
            />
            {/* Swiggy S */}
            <path
              d="M54 30C48 30 43 33 43 37C43 43 57 42 57 47C57 51 51 51 46 49L44 54C47 56 52 56 55 55C61 53 63 47 63 44C63 38 49 39 49 34C49 32 52 31 55 31C58 31 61 32 63 33L65 28C62 27 58 27 54 30Z"
              fill="#FC8019"
            />
          </svg>
        );

      case 'zepto':
        return (
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <defs>
              <linearGradient id="zeptoBg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#350058" />
                <stop offset="100%" stopColor="#180029" />
              </linearGradient>
              <linearGradient id="zeptoPink" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FF3269" />
                <stop offset="100%" stopColor="#FF7597" />
              </linearGradient>
            </defs>
            <rect width="100" height="100" rx="24" fill="url(#zeptoBg)" />
            <text
              x="50"
              y="60"
              fill="url(#zeptoPink)"
              fontSize="34"
              fontStyle="italic"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight="900"
              textAnchor="middle"
              letterSpacing="-1"
            >
              zepto
            </text>
            <path d="M28 68L72 68" stroke="#00E5FF" strokeWidth="3.5" strokeLinecap="round" />
          </svg>
        );

      case 'nykaa':
        return (
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <defs>
              <linearGradient id="nykaaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FC2779" />
                <stop offset="100%" stopColor="#CE0C54" />
              </linearGradient>
            </defs>
            <rect width="100" height="100" rx="24" fill="url(#nykaaGrad)" />
            <text
              x="50"
              y="59"
              fill="#FFFFFF"
              fontSize="23"
              fontStyle="italic"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight="900"
              textAnchor="middle"
              letterSpacing="1"
            >
              NYKAA
            </text>
          </svg>
        );

      case 'bookmyshow':
        return (
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <defs>
              <linearGradient id="bmsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#C4242D" />
                <stop offset="100%" stopColor="#900F17" />
              </linearGradient>
            </defs>
            <rect width="100" height="100" rx="24" fill="url(#bmsGrad)" />
            <text
              x="50"
              y="60"
              fill="#FFFFFF"
              fontSize="34"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight="900"
              textAnchor="middle"
              letterSpacing="-1.5"
            >
              bms
            </text>
            <circle cx="8" cy="50" r="7" fill="#F8FBFF" />
            <circle cx="92" cy="50" r="7" fill="#F8FBFF" />
          </svg>
        );

      case 'spicejet':
        return (
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <rect width="100" height="100" rx="24" fill="#FFFFFF" />
            <rect width="100" height="100" rx="24" fill="#FFF5F5" stroke="#FFE4E4" strokeWidth="2" />
            {/* SpiceJet 5 Spice dots */}
            <circle cx="26" cy="38" r="7.5" fill="#ED1B24" />
            <circle cx="41" cy="31" r="6.5" fill="#ED1B24" />
            <circle cx="56" cy="28" r="5.5" fill="#ED1B24" />
            <circle cx="70" cy="29" r="4.5" fill="#ED1B24" />
            <circle cx="82" cy="33" r="3.5" fill="#ED1B24" />
            <text
              x="50"
              y="68"
              fill="#ED1B24"
              fontSize="19"
              fontStyle="italic"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight="900"
              textAnchor="middle"
              letterSpacing="-0.5"
            >
              SpiceJet
            </text>
          </svg>
        );

      case 'meta':
        return (
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <defs>
              <linearGradient id="metaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0081FB" />
                <stop offset="50%" stopColor="#0064E0" />
                <stop offset="100%" stopColor="#0047B3" />
              </linearGradient>
            </defs>
            <rect width="100" height="100" rx="24" fill="url(#metaGrad)" />
            {/* Meta Continuous Infinity Ribbon */}
            <path
              d="M36 34C28 34 22 41 22 50C22 59 28 66 36 66C44 66 50 56 50 50C50 44 56 34 64 34C72 34 78 41 78 50C78 59 72 66 64 66C56 66 50 56 50 50C50 44 44 34 36 34Z"
              stroke="white"
              strokeWidth="7.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        );

      case 'urbancompany':
        return (
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <rect width="100" height="100" rx="24" fill="#111827" />
            <text
              x="50"
              y="64"
              fill="#FFFFFF"
              fontSize="40"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight="900"
              textAnchor="middle"
              letterSpacing="1"
            >
              UC
            </text>
          </svg>
        );

      case 'coursera':
        return (
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <defs>
              <linearGradient id="courseraGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0056D2" />
                <stop offset="100%" stopColor="#003D99" />
              </linearGradient>
            </defs>
            <rect width="100" height="100" rx="24" fill="url(#courseraGrad)" />
            {/* Coursera Infinity 'C' */}
            <path
              d="M58 32C46 32 36 40 36 50C36 60 46 68 58 68C65 68 70 65 72 62L66 56C64 58 61 60 58 60C50 60 44 55 44 50C44 45 50 40 58 40C61 40 64 42 66 44L72 38C70 35 65 32 58 32Z"
              fill="white"
            />
            <circle cx="68" cy="50" r="4.5" fill="#FFE11B" />
          </svg>
        );

      default:
        return (
          <div className="w-full h-full flex items-center justify-center text-white font-black">
            {name ? name.charAt(0).toUpperCase() : 'M'}
          </div>
        );
    }
  };

  return (
    <div
      className={`relative overflow-hidden shrink-0 flex items-center justify-center select-none ${
        showShadow ? 'shadow-md ' + brand.shadowColor : ''
      } ${containerSizeClass} ${className}`}
      title={name}
    >
      {renderSvgLogo()}
    </div>
  );
}
