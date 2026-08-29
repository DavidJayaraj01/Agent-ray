"""Seed data — Real-world authentic merchants and catalogs for major companies using Razorpay.

Categories & Merchants:
1. Food Delivery & Quick Commerce:
   - Zomato Direct
   - Swiggy Instamart & Gourmet
   - Zepto 10-Min Fast Commerce

2. E-commerce & Retail:
   - Nykaa Luxe & Beauty
   - BookMyShow Entertainment
   - SpiceJet Airlines Direct
   - Meesho Fashion Direct
   - Amazon India Official Hub
   - Flipkart SuperComNet Sports

3. Tech & Services:
   - Facebook / Meta Business
   - Urban Company Pro Services
   - Coursera Professional Learning
"""
from sqlalchemy.orm import Session
from backend.models import Merchant, Product, Manifest
from backend.services.catalog_normalizer import _normalize_rule_based
from backend.services.trust_scorer import compute_trust_score


# ─── 1. FOOD DELIVERY & QUICK COMMERCE ─────────────────────────────

ZOMATO_CATALOG = """name,price,stock,category,delivery_days,return_policy,cuisine,serves
Royal Awadhi Dum Biryani Feast,649,50,Food & Dining,1,Instant refund if temperature or seal compromised,Mughlai|North Indian,2-3 Persons
Authentic Wood-Fired Margherita Gourmet Pizza,499,40,Food & Dining,1,Instant refund if cold or delayed,Italian,1-2 Persons
Chef Special Butter Chicken Handi with Garlic Naan,549,45,Food & Dining,1,Instant resolution on spill or delay,North Indian,2 Persons
Pan-Asian Gourmet Bento Box (Dimsums & Hakka Noodles),599,35,Food & Dining,1,Freshness guarantee or 100% refund,Pan-Asian,1 Person
Zomato Gold 1-Year VIP Dining & Free Delivery Pass,999,500,Memberships,1,Instant digital activation,Digital,1 Member"""

SWIGGY_CATALOG = """name,price,stock,category,delivery_days,return_policy,origin,pack_size
Grade A Ratnagiri Alphonso Mangoes (3kg Box),1199,60,Groceries & Fresh,1,100% replacement on quality issue,Ratnagiri,1 Dozen / 3kg
Amul Pure Desi Ghee (1L Tin) with Organic Cow Milk,680,85,Groceries & Dairy,1,Instant replacement if damaged,Gujarat,1L + 1L
Starbucks Signature Caramel Cold Brew Pack (4 Bottles),799,50,Beverages,1,Instant replacement if damaged,Global,4 x 250ml
Swiggy One VIP Membership (Free Food & Instamart),899,500,Memberships,1,Instant digital activation,Digital,Annual Plan
Farm-Fresh Mexican Hass Avocados (Pack of 4),499,75,Groceries & Fresh,1,Freshness guaranteed or instant credit,Mexico,Pack of 4"""

ZEPTO_CATALOG = """name,price,stock,category,delivery_days,return_policy,brand,net_weight
Kellogg's Real Almond & Honey Muesli Family Pack,549,120,Breakfast & Cereals,1,Instant 10-minute return,Kellogg's,1 kg
Nescafe Gold Rich & Smooth Craft Coffee Jar,780,90,Beverages,1,Instant 10-minute return,Nescafe,200 g
Raw Pressery 100% Valencia Orange Cold Pressed Juice (6 Bottles),510,70,Cold Beverages,1,Chilled delivery guarantee,Raw Pressery,6 x 200ml
Epigamia High-Protein Greek Yogurt Berry Pack (6 Cups),360,80,Dairy & Snacks,1,Instant 10-minute replacement,Epigamia,6 x 90g
Zepto SuperPass 6-Month Unlimited Express Delivery,299,1000,Subscriptions,1,Instant digital activation,Zepto,6 Months"""

# ─── 2. E-COMMERCE & RETAIL ────────────────────────────────────────

NYKAA_CATALOG = """name,price,stock,category,delivery_days,return_policy,brand,volume
Estee Lauder Advanced Night Repair Recovery Complex,8900,25,Beauty & Skincare,2,15-day return on unopened items,Estee Lauder,50 ml
MAC Studio Fix Fluid SPF 15 Matte Foundation,3600,40,Cosmetics,2,15-day return on shade mismatch,MAC Cosmetics,30 ml
Huda Beauty Empowered 18-Shade Luxury Eyeshadow Palette,5850,30,Cosmetics,2,10-day replacement on transit damage,Huda Beauty,18 Shades
Forest Essentials Soundarya 24K Gold Radiance Facial Serum,4975,35,Ayurvedic Skincare,2,15-day return on unopened seals,Forest Essentials,30 ml
Laneige Berry Lip Sleeping Mask with Vitamin C,1450,80,Skincare,2,15-day return,Laneige,20 g"""

BOOKMYSHOW_CATALOG = """name,price,stock,category,delivery_days,return_policy,event_type,seat_tier
IMAX 3D Laser Cinema Premium Recliner Pass (2 Tickets + F&B),1850,60,Entertainment & Cinema,1,Cancel up to 2 hours before showtime,Movie,VIP Recliner
ColdPlay Music of the Spheres World Tour VIP Lounge Pass,12500,15,Concerts & Live,1,Non-refundable verified collectible pass,Concert,VIP Lounge
Arijit Singh Live In Concert Platinum Front Row Pass,8500,25,Concerts & Live,1,100% refund if event rescheduled,Live Music,Platinum Front
Comic Con India 3-Day All-Access Collector Pass,2999,100,Exhibitions & Pop Culture,1,Transferable digital ticket,Convention,All-Access Pass
Sunburn Electronic Dance Music Festival VIP Weekend Wristband,9500,40,Festivals & Nightlife,1,Insured ticket protection,EDM Festival,VIP Weekend"""

SPICEJET_CATALOG = """name,price,stock,category,delivery_days,return_policy,route,cabin_class
Delhi to Goa Express Non-Stop Flight Ticket (SpiceMax),5499,30,Travel & Flights,1,Free date change up to 24 hrs before departure,DEL-GOI,SpiceMax Extra Legroom
Mumbai to Bengaluru Business Flexi Flight Ticket,4299,45,Travel & Flights,1,Full refund on cancellation with FlexiFare,BOM-BLR,Business Flexi
Delhi to Dubai International Roundtrip Flight Ticket,18999,20,Travel & Flights,1,Standard international airline tariff,DEL-DXB,Economy International
SpiceJet 20kg Extra Baggage & Priority Baggage Delivery,1200,150,Travel Add-ons,1,Instant confirmation,All Routes,20 kg Allowance
SpiceJet In-Flight Hot Gourmet Multi-Course Meal & Lounge Pass,850,200,Travel Add-ons,1,Meal guarantee,All Routes,Gourmet Meal + Lounge"""

MEESHO_CATALOG = """name,price,stock,category,delivery_days,return_policy,color,size
Georgette Floral Print Anarkali Flared Dress,1299,45,Fashion & Apparel,3,7-day easy return,Blue|Pink|Wine,S|M|L|XL|XXL
Rayon A-Line Maxi Dress with Fabric Belt,849,60,Fashion & Apparel,3,7-day easy return,Black|Maroon|Mustard,M|L|XL
Embroidered Semi-Stitched Velvet Party Wear Gown Dress,1899,25,Fashion & Apparel,4,7-day easy return,Emerald Green|Royal Blue|Maroon,Free Size
Banarasi Art Silk Woven Designer Saree with Blouse,2499,35,Ethnic Wear,4,7-day return & exchange,Red & Gold|Bottle Green|Royal Blue,Free Size
Kanjivaram Soft Silk Zari Border Festive Saree,3499,20,Ethnic Wear,4,7-day return & exchange,Magenta|Deep Red|Mustard Gold,Free Size
Pure Cotton Kurti with Palazzo & Dupatta 3-Piece Set,1199,40,Ethnic Wear,3,7-day return,Teal Blue|Coral Pink|Sage Green,M|L|XL|XXL"""

AMAZON_CATALOG = """name,price,stock,category,delivery_days,return_policy,color,size
Sony WH-1000XM5 Wireless Noise Canceling Headphones,26990,18,Electronics & Tech,1,7-day replacement,Black|Silver|Midnight Blue,Over-Ear
Apple iPad 10th Gen 10.9-inch Liquid Retina Display 64GB,34900,12,Electronics & Tech,1,7-day replacement,Blue|Pink|Silver|Yellow,64GB
Logitech MX Master 3S Advanced Wireless Mouse,8495,22,Electronics & Tech,1,7-day replacement,Graphite|Pale Grey,Standard
Samsung Galaxy Buds2 Pro with ANC,9999,25,Electronics & Tech,2,15-day replacement,Graphite|White|Bora Purple,In-Ear
Keychron K2 Wireless Mechanical Keyboard,7499,15,Electronics & Tech,3,7-day replacement,Black,Tenkeyless"""

FLIPKART_CATALOG = """name,price,stock,category,delivery_days,return_policy,color,size
Nike Air Zoom Pegasus 40 Men Road Running Shoes,8995,28,Sports & Footwear,2,15-day return,Black/White|Deep Royal Blue,UK7|UK8|UK9|UK10
Puma RS-X Reinvention Unisex Retro Sneakers,6499,30,Sports & Footwear,2,15-day return,White/Red/Blue|Triple Black,UK6|UK7|UK8|UK9
Nike Dri-FIT Legend Men Short-Sleeve Training T-Shirt,1695,40,Sports & Footwear,2,15-day return,Black|Heather Grey|Navy,S|M|L|XL
Adidas Ultraboost Light Men Running Shoes,13999,15,Sports & Footwear,2,30-day returns,White|Black|Grey,UK7|UK8|UK9|UK10
Yonex Nanoray Light 18i Graphite Badminton Racket,2190,25,Sports & Footwear,2,10-day replacement,Black/Blue,G4"""

# ─── 3. TECH & SERVICES ────────────────────────────────────────────

META_CATALOG = """name,price,stock,category,delivery_days,return_policy,tier,duration
Meta Verified Business Subscription (Blue Badge & Priority Support),1999,500,Tech & Cloud Services,1,Cancel anytime monthly subscription,Business Tier,3 Months
Facebook Ads Campaign Launch Boost (₹5,000 Ad Match Voucher),4999,200,Marketing & Advertising,1,Non-refundable promotional credit,Growth Booster,Instant Credit
WhatsApp Business API High-Throughput Messaging Tier (10k Msgs),3499,300,Enterprise Communication,1,Pay-as-you-go credit rollover,Tier 1 High-Volume,10000 Msgs
Meta Horizon Workrooms Pro Collaborative VR Enterprise License,2499,100,Productivity & VR,1,14-day free trial money-back guarantee,Enterprise Seat,Annual"""

URBAN_COMPANY_CATALOG = """name,price,stock,category,delivery_days,return_policy,service_type,scope
Complete Home Deep Cleaning & Sanitization (3 BHK Villa),4899,40,Home Services,1,Free rework if dissatisfied within 48 hrs,Full Cleaning,3 BHK
Premium AC Foam Jet Master Servicing & Gas Leak Test,1299,60,Home Appliance Repair,1,60-day service warranty on cooling,AC Maintenance,1.5 Ton Split
Salon Classic: Keratin Hair Spa & Herbal Glow Facial for Women,2499,50,Beauty & Wellness,1,100% hygienic single-use kits,Salon at Home,Women Complete
Men's Stress Relief Ayurvedic Full Body Massage & Grooming,1699,45,Wellness & Spa,1,Certified Ayurvedic therapists,Spa at Home,90 Minutes
Bathroom High-Pressure Tile Buffing & Stain Extraction (2 Baths),999,70,Home Services,1,Sparkle finish guarantee,Deep Clean,2 Bathrooms"""

COURSERA_CATALOG = """name,price,stock,category,delivery_days,return_policy,institution,credentials
Google Data Analytics Professional Certificate,3999,500,Education & Certifications,1,14-day 100% money-back guarantee,Google,ACE Accredited Certificate
DeepLearning.AI Generative AI & LLM Engineering MasterTrack,7999,250,Education & Certifications,1,14-day full refund guarantee,DeepLearning.AI,MasterTrack Certificate
IBM Full Stack Cloud Software Developer Professional Certificate,4999,300,Education & Certifications,1,14-day full refund guarantee,IBM,Industry Recognized Credential
Stanford University Machine Learning Specialization with Andrew Ng,6499,400,Education & Certifications,1,14-day full refund guarantee,Stanford Online,Official Specialization
Coursera Plus 1-Year Unlimited Access to 7000+ Courses & Degrees,24999,1000,Subscriptions,1,30-day money-back guarantee,Coursera Global,Annual All-Access"""


def seed_all(db: Session):
    """Seed all 12 enterprise merchants with catalogs, products, manifests, and trust scores."""
    merchants_data = [
        # 1. Food Delivery & Quick Commerce
        {
            "name": "Zomato Direct",
            "category": "Food Delivery & Quick Commerce",
            "catalog": ZOMATO_CATALOG,
            "policy": {"max_discount": 15, "min_price": 200, "max_auto_order": 50000, "negotiation_enabled": True},
        },
        {
            "name": "Swiggy Instamart & Gourmet",
            "category": "Food Delivery & Quick Commerce",
            "catalog": SWIGGY_CATALOG,
            "policy": {"max_discount": 12, "min_price": 250, "max_auto_order": 50000, "negotiation_enabled": True},
        },
        {
            "name": "Zepto 10-Min Commerce",
            "category": "Food Delivery & Quick Commerce",
            "catalog": ZEPTO_CATALOG,
            "policy": {"max_discount": 10, "min_price": 150, "max_auto_order": 30000, "negotiation_enabled": True},
        },
        # 2. E-commerce & Retail
        {
            "name": "Nykaa Luxe & Beauty",
            "category": "E-commerce & Retail",
            "catalog": NYKAA_CATALOG,
            "policy": {"max_discount": 10, "min_price": 500, "max_auto_order": 100000, "negotiation_enabled": True},
        },
        {
            "name": "BookMyShow Entertainment",
            "category": "E-commerce & Retail",
            "catalog": BOOKMYSHOW_CATALOG,
            "policy": {"max_discount": 8, "min_price": 500, "max_auto_order": 150000, "negotiation_enabled": True},
        },
        {
            "name": "SpiceJet Airlines Direct",
            "category": "E-commerce & Retail",
            "catalog": SPICEJET_CATALOG,
            "policy": {"max_discount": 10, "min_price": 500, "max_auto_order": 200000, "negotiation_enabled": True},
        },
        {
            "name": "Meesho Fashion Direct",
            "category": "E-commerce & Retail",
            "catalog": MEESHO_CATALOG,
            "policy": {"max_discount": 15, "min_price": 300, "max_auto_order": 50000, "negotiation_enabled": True},
        },
        {
            "name": "Amazon India Official Hub",
            "category": "E-commerce & Retail",
            "catalog": AMAZON_CATALOG,
            "policy": {"max_discount": 8, "min_price": 500, "max_auto_order": 250000, "negotiation_enabled": True},
        },
        {
            "name": "Flipkart SuperComNet Sports",
            "category": "E-commerce & Retail",
            "catalog": FLIPKART_CATALOG,
            "policy": {"max_discount": 15, "min_price": 500, "max_auto_order": 250000, "negotiation_enabled": True},
        },
        # 3. Tech & Services
        {
            "name": "Facebook (Meta Business)",
            "category": "Tech & Services",
            "catalog": META_CATALOG,
            "policy": {"max_discount": 10, "min_price": 1000, "max_auto_order": 300000, "negotiation_enabled": True},
        },
        {
            "name": "Urban Company Pro Services",
            "category": "Tech & Services",
            "catalog": URBAN_COMPANY_CATALOG,
            "policy": {"max_discount": 12, "min_price": 500, "max_auto_order": 100000, "negotiation_enabled": True},
        },
        {
            "name": "Coursera Professional Learning",
            "category": "Tech & Services",
            "catalog": COURSERA_CATALOG,
            "policy": {"max_discount": 15, "min_price": 1000, "max_auto_order": 200000, "negotiation_enabled": True},
        },
    ]

    for mdata in merchants_data:
        # Check if merchant already exists
        existing = db.query(Merchant).filter(Merchant.name == mdata["name"]).first()
        if existing:
            continue

        merchant = Merchant(
            name=mdata["name"],
            category=mdata["category"],
            raw_catalog_text=mdata["catalog"],
            status="active",
            policy_rules=mdata["policy"],
        )
        db.add(merchant)
        db.flush()

        # Normalize catalog using fast rule-based parser
        normalized = _normalize_rule_based(mdata["catalog"])


        # Create products
        product_ids = []
        flagged = 0
        for p in normalized:
            variants = p.get("variants", {})
            if isinstance(variants, dict):
                for k, v in variants.items():
                    if isinstance(v, str) and ("|" in v or "/" in v):
                        variants[k] = [x.strip() for x in v.replace("/", "|").split("|") if x.strip()]

            product = Product(
                merchant_id=merchant.id,
                name=p.get("name", "Unknown"),
                price=p.get("price", 0),
                stock=p.get("stock", 0),
                category=p.get("category", "General"),
                delivery_days=p.get("delivery_days", 1),
                return_policy=p.get("return_policy", "Standard satisfaction guarantee"),
                variants=variants,
                confidence_flags=p.get("confidence_flags", {}),
                needs_verification=p.get("needs_verification", False),
                raw_text=p.get("raw_text", ""),
            )
            db.add(product)
            db.flush()
            product_ids.append(product.id)
            if product.needs_verification:
                flagged += 1

        # Compute trust score
        trust_result = compute_trust_score(
            products=normalized,
            manifest_completeness=100.0 if flagged == 0 else 85.0,
        )
        merchant.trust_score = trust_result["overall"]

        # Create manifest
        manifest = Manifest(
            merchant_id=merchant.id,
            raw_product_count=len(normalized),
            normalized_product_count=len(product_ids),
            flagged_count=flagged,
            product_ids=product_ids,
            completeness_score=trust_result["breakdown"]["completeness"],
        )
        db.add(manifest)

    db.commit()
