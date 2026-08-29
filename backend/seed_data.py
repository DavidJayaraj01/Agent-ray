"""Seed data — Real-world authentic merchants and catalogs for Meesho, Amazon, and Flipkart.

Merchant 1: Meesho Verified Fashion Hub (Women's Dresses, Sarees, Kurtis)
Merchant 2: Amazon India Official Hub (Electronics, Audio, Tech Accessories)
Merchant 3: Flipkart SuperComNet Sports (Athletic Footwear, Shoes, Sportswear)
"""
from sqlalchemy.orm import Session
from backend.models import Merchant, Product, Manifest
from backend.services.catalog_normalizer import normalize_catalog
from backend.services.trust_scorer import compute_trust_score
import datetime


MEESHO_CATALOG = """name,price,stock,category,delivery_days,return_policy,color,size
Georgette Floral Print Anarkali Flared Dress,1299,45,Dresses,3,7-day easy return,Blue|Pink|Wine,S|M|L|XL|XXL
Rayon A-Line Maxi Dress with Fabric Belt,849,60,Dresses,3,7-day easy return,Black|Maroon|Mustard,M|L|XL
Crepe Printed Knee-Length Western Casual Dress,549,80,Dresses,4,7-day easy return,White Floral|Navy Floral,S|M|L|XL
Embroidered Semi-Stitched Velvet Party Wear Gown Dress,1899,25,Dresses,4,7-day easy return,Emerald Green|Royal Blue|Maroon,Free Size
Banarasi Art Silk Woven Designer Saree with Blouse,2499,35,Sarees,4,7-day return & exchange,Red & Gold|Bottle Green|Royal Blue,Free Size
Kanjivaram Soft Silk Zari Border Festive Saree,3499,20,Sarees,4,7-day return & exchange,Magenta|Deep Red|Mustard Gold,Free Size
Daily Wear Chiffon Printed Lightweight Saree,749,50,Sarees,3,7-day return & exchange,Peach|Lavender|Sky Blue,Free Size
Pure Cotton Kurti with Palazzo & Dupatta 3-Piece Set,1199,40,Ethnic Wear,3,7-day return,Teal Blue|Coral Pink|Sage Green,M|L|XL|XXL
Chikankari Hand Embroidered Pure Cotton Kurta,1499,30,Ethnic Wear,3,7-day return,White|Pastel Green|Powder Blue,S|M|L|XL"""

AMAZON_CATALOG = """name,price,stock,category,delivery_days,return_policy,color,size
Berrylush Women V-Neck Ruffled Hem Floral A-Line Dress,899,55,Dresses,1,10-day replacement/return,Burgundy|Navy Blue|Olive Green,XS|S|M|L|XL
Rare Women Georgette Flared Midi Casual Dress,1149,35,Dresses,2,10-day replacement/return,Black Floral|White Floral,S|M|L|XL
Sony WH-1000XM5 Wireless Noise Canceling Headphones,26990,18,Audio,1,7-day replacement,Black|Silver|Midnight Blue,Over-Ear
Apple iPad 10th Gen 10.9-inch Liquid Retina Display 64GB,34900,12,Tablets,1,7-day replacement,Blue|Pink|Silver|Yellow,64GB
Logitech MX Master 3S Advanced Wireless Mouse,8495,22,Peripherals,1,7-day replacement,Graphite|Pale Grey,Standard
Samsung Galaxy Buds2 Pro with ANC,9999,25,Audio,2,15-day replacement,Graphite|White|Bora Purple,In-Ear
Keychron K2 Wireless Mechanical Keyboard,7499,15,Peripherals,3,7-day replacement,Black,Tenkeyless
boAt Airdopes 141 Bluetooth True Wireless Earbuds,1299,60,Audio,1,7-day replacement,Bold Black|Cider Cyan,In-Ear"""

FLIPKART_CATALOG = """name,price,stock,category,delivery_days,return_policy,color,size
Tokyo Talkies Women Floral Print Fit and Flare Dress,749,70,Dresses,2,10-day hassle-free return,Yellow|Light Blue|Pink,XS|S|M|L|XL
Sassafras Women Tiered Smocked Bodice Midi Dress,899,45,Dresses,2,10-day hassle-free return,Sage Green|Lilac|Black,S|M|L
Nike Air Zoom Pegasus 40 Men Road Running Shoes,8995,28,Footwear,2,15-day return,Black/White|Deep Royal Blue,UK7|UK8|UK9|UK10
Puma RS-X Reinvention Unisex Retro Sneakers,6499,30,Footwear,2,15-day return,White/Red/Blue|Triple Black,UK6|UK7|UK8|UK9
Nike Dri-FIT Legend Men Short-Sleeve Training T-Shirt,1695,40,Clothing,2,15-day return,Black|Heather Grey|Navy,S|M|L|XL
Adidas Ultraboost Light Men Running Shoes,13999,15,Footwear,2,30-day returns,White|Black|Grey,UK7|UK8|UK9|UK10
Puma High-Rise 7/8 Women Workout Leggings,1999,35,Clothing,2,15-day return,Black|Navy,S|M|L
Yonex Nanoray Light 18i Graphite Badminton Racket,2190,25,Sports Equipment,2,10-day replacement,Black/Blue,G4"""


def seed_all(db: Session):
    """Seed all merchants with catalogs, products, manifests, and trust scores."""
    merchants_data = [
        {
            "name": "Meesho Fashion Direct",
            "category": "Fashion & Ethnic Wear",
            "catalog": MEESHO_CATALOG,
            "policy": {"max_discount": 12, "min_price": 300, "max_auto_order": 20000, "negotiation_enabled": True},
        },
        {
            "name": "Amazon India Official Hub",
            "category": "Electronics & Lifestyle",
            "catalog": AMAZON_CATALOG,
            "policy": {"max_discount": 8, "min_price": 500, "max_auto_order": 60000, "negotiation_enabled": True},
        },
        {
            "name": "Flipkart SuperComNet Sports",
            "category": "Sports & Footwear",
            "catalog": FLIPKART_CATALOG,
            "policy": {"max_discount": 15, "min_price": 500, "max_auto_order": 35000, "negotiation_enabled": True},
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

        # Normalize catalog
        normalized = normalize_catalog(mdata["catalog"])

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
                delivery_days=p.get("delivery_days", 7),
                return_policy=p.get("return_policy", "No returns specified"),
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
