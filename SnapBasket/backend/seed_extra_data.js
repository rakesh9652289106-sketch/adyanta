const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const newShops = [
    {
        id: 15,
        vendor_id: 1,
        name: 'Organic Oasis Produce',
        logo: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=150&h=150&fit=crop',
        banner: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200',
        description: 'Fresh organic greens, exotic fruits, and handpicked quality vegetables straight from certified organic farms.',
        timings: '7:30 AM - 9:00 PM',
        category: 'Fresh Produce Shop',
        contact_phone: '+91 94902 29108',
        rating: 4.9,
        delivery_time: '20-30 mins',
        status: 'active',
        commission_rate: 5,
        registered_shop: 'Fresh Produce Shop'
    },
    {
        id: 16,
        vendor_id: 1,
        name: 'Sub-Zero Treats',
        logo: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=150&h=150&fit=crop',
        banner: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=1200',
        description: 'Chilled ready-to-cook snacks, frozen premium meats, and delicious artisanal ice cream tubs.',
        timings: '10:00 AM - 11:00 PM',
        category: 'Frozen Shop',
        contact_phone: '+91 94902 29108',
        rating: 4.7,
        delivery_time: '15-25 mins',
        status: 'active',
        commission_rate: 5,
        registered_shop: 'Frozen Shop'
    },
    {
        id: 17,
        vendor_id: 1,
        name: 'Squeeze & Sip Blends',
        logo: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=150&h=150&fit=crop',
        banner: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=1200',
        description: 'Cold pressed immunity booster juices, organic shakes, and healthy coconut water extracts.',
        timings: '8:00 AM - 10:00 PM',
        category: 'Juice Shop',
        contact_phone: '+91 94902 29108',
        rating: 4.8,
        delivery_time: '15-30 mins',
        status: 'active',
        commission_rate: 5,
        registered_shop: 'Juice Shop'
    },
    {
        id: 18,
        vendor_id: 1,
        name: 'Carat Glow Jewelers',
        logo: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=150&h=150&fit=crop',
        banner: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=1200',
        description: 'Finely crafted lightweight jewelry, certified diamond rings, and premium gold studs for all celebrations.',
        timings: '11:00 AM - 8:30 PM',
        category: 'Gold Shop',
        contact_phone: '+91 94902 29108',
        rating: 4.9,
        delivery_time: '30-45 mins',
        status: 'active',
        commission_rate: 5,
        registered_shop: 'Gold Shop'
    },
    {
        id: 19,
        vendor_id: 1,
        name: 'Elegance Closet & Dressing',
        logo: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=150&h=150&fit=crop',
        banner: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=1200',
        description: 'Premium summer maxi dresses, classic designer button-up shirts, and festive silk ethnic suits.',
        timings: '10:00 AM - 9:30 PM',
        category: 'Dressing Shop',
        contact_phone: '+91 94902 29108',
        rating: 4.6,
        delivery_time: '25-45 mins',
        status: 'active',
        commission_rate: 5,
        registered_shop: 'Dressing Shop'
    },
    {
        id: 20,
        vendor_id: 1,
        name: 'Value Saver Supermarket',
        logo: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=150&h=150&fit=crop',
        banner: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=1200',
        description: 'Bulk budget supermarket offering unpolished premium pulses, whole organic dry fruits, and household cleaning supplies.',
        timings: '7:00 AM - 10:30 PM',
        category: 'General Store',
        contact_phone: '+91 94902 29108',
        rating: 4.7,
        delivery_time: '15-30 mins',
        status: 'active',
        commission_rate: 5,
        registered_shop: 'General Store'
    },
    {
        id: 21,
        vendor_id: 1,
        name: 'Lifeline Wellness Pharmacy',
        logo: 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=150&h=150&fit=crop',
        banner: 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=1200',
        description: 'Trusted healthcare supplements, digital thermometers, N95 face protection, and pain relief remedies.',
        timings: '8:00 AM - 11:00 PM',
        category: 'Pharmacy / Health Shop',
        contact_phone: '+91 94902 29108',
        rating: 4.9,
        delivery_time: '10-20 mins',
        status: 'active',
        commission_rate: 4,
        registered_shop: 'Pharmacy / Health Shop'
    }
];

const newProducts = [
    // Shop 15: Organic Oasis Produce
    { name: "Organic Seedless Grapes", category: "Fresh Fruits", weight: "500 g", price: 210, originalPrice: 240, rating: "4.8", reviews: "85", imgUrl: "https://images.unsplash.com/photo-1601275868399-45bec4f2cd86?w=300&h=300&fit=crop", discount: "12% OFF", is_trending: 1, description: "Sweet seedless green grapes grown organically.", shop_id: 15 },
    { name: "Organic Broccoli Head", category: "Vegetables", weight: "1 pc", price: 75, originalPrice: 90, rating: "4.7", reviews: "60", imgUrl: "https://images.unsplash.com/photo-1584270354949-c26b0d5b4a0c?w=300&h=300&fit=crop", discount: "16% OFF", shop_id: 15 },
    { name: "Sweet Yellow Papaya", category: "Fresh Fruits", weight: "1 pc", price: 65, originalPrice: 80, rating: "4.6", reviews: "120", imgUrl: "https://images.unsplash.com/photo-1517282009859-f000ec3b26fe?w=300&h=300&fit=crop", discount: "18% OFF", shop_id: 15 },
    { name: "Fresh Green Spinach Bunch", category: "Vegetables", weight: "250 g", price: 22, originalPrice: 30, rating: "4.9", reviews: "300", imgUrl: "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=300&h=300&fit=crop", discount: "26% OFF", shop_id: 15 },

    // Shop 16: Sub-Zero Treats
    { name: "Frozen Veg Burger Patties", category: "Frozen Foods", weight: "6 pcs", price: 145, originalPrice: 175, rating: "4.5", reviews: "95", imgUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&h=300&fit=crop", discount: "17% OFF", shop_id: 16 },
    { name: "Frozen Garlic Naan", category: "Frozen Foods", weight: "4 pcs", price: 110, originalPrice: 130, rating: "4.6", reviews: "75", imgUrl: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?w=300&h=300&fit=crop", discount: "15% OFF", shop_id: 16 },
    { name: "Premium Belgian Chocolate Tub", category: "Desserts", weight: "500 ml", price: 295, originalPrice: 350, rating: "4.9", reviews: "180", imgUrl: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=300&h=300&fit=crop", discount: "15% OFF", is_trending: 1, shop_id: 16 },
    { name: "Frozen Alphonso Mango Pulp", category: "Frozen Foods", weight: "1 kg", price: 185, originalPrice: 220, rating: "4.8", reviews: "60", imgUrl: "https://images.unsplash.com/photo-1553279768-8653869b007d?w=300&h=300&fit=crop", discount: "15% OFF", shop_id: 16 },

    // Shop 17: Squeeze & Sip Blends
    { name: "Pure Apple Juice Bottle", category: "Drinks", weight: "1 L", price: 140, originalPrice: 160, rating: "4.7", reviews: "140", imgUrl: "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=300&h=300&fit=crop", discount: "12% OFF", shop_id: 17 },
    { name: "Sparkling Lemon Mojito", category: "Drinks", weight: "300 ml", price: 55, originalPrice: 65, rating: "4.5", reviews: "90", imgUrl: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=300&h=300&fit=crop", discount: "15% OFF", shop_id: 17 },
    { name: "Guava Chili Spicy Drink", category: "Drinks", weight: "250 ml", price: 48, originalPrice: 60, rating: "4.6", reviews: "85", imgUrl: "https://images.unsplash.com/photo-1534080391025-a77c3835535d?w=300&h=300&fit=crop", discount: "20% OFF", shop_id: 17 },
    { name: "Aloe Vera Digest Health Juice", category: "Drinks", weight: "1 L", price: 195, originalPrice: 230, rating: "4.4", reviews: "210", imgUrl: "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=300&h=300&fit=crop", discount: "15% OFF", shop_id: 17 },

    // Shop 18: Carat Glow Jewelers
    { name: "22K Gold Stud Earrings", category: "Gold Jewelry", weight: "3 g", price: 18500, originalPrice: 21500, rating: "4.8", reviews: "42", imgUrl: "https://images.unsplash.com/photo-1635767790028-3e9a53664081?w=300&h=300&fit=crop", discount: "13% OFF", shop_id: 18 },
    { name: "Diamond Solitaire Pendant", category: "Diamond Jewelry", weight: "2 g", price: 34500, originalPrice: 38500, rating: "4.9", reviews: "28", imgUrl: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=300&h=300&fit=crop", discount: "10% OFF", is_trending: 1, shop_id: 18 },
    { name: "Gold Curb Link Bracelet", category: "Gold Jewelry", weight: "8 g", price: 68000, originalPrice: 75000, rating: "4.7", reviews: "15", imgUrl: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=300&h=300&fit=crop", discount: "9% OFF", shop_id: 18 },
    { name: "Diamond Heart Promise Ring", category: "Diamond Jewelry", weight: "4 g", price: 26500, originalPrice: 29900, rating: "4.9", reviews: "34", imgUrl: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=300&h=300&fit=crop", discount: "11% OFF", shop_id: 18 },

    // Shop 19: Elegance Closet & Dressing
    { name: "Casual Slim Fit Cotton Shirt", category: "Mens Wear", weight: "1 pc", price: 799, originalPrice: 1299, rating: "4.5", reviews: "190", imgUrl: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=300&h=300&fit=crop", discount: "38% OFF", shop_id: 19 },
    { name: "Women Summer Maxi Dress", category: "Womens Wear", weight: "1 pc", price: 1499, originalPrice: 2199, rating: "4.7", reviews: "210", imgUrl: "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=300&h=300&fit=crop", discount: "31% OFF", is_trending: 1, shop_id: 19 },
    { name: "Men Cargo Jogger Pants", category: "Mens Wear", weight: "1 pc", price: 999, originalPrice: 1599, rating: "4.6", reviews: "135", imgUrl: "https://images.unsplash.com/photo-1517135551947-f87e34085b2c?w=300&h=300&fit=crop", discount: "37% OFF", shop_id: 19 },
    { name: "Silk Georgette Anarkali Suit Set", category: "Womens Wear", weight: "1 pc", price: 2850, originalPrice: 3999, rating: "4.8", reviews: "80", imgUrl: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=300&h=300&fit=crop", discount: "28% OFF", shop_id: 19 },

    // Shop 20: Value Saver Supermarket
    { name: "Organic Kabuli Chana Premium", category: "Dals & Pulses", weight: "1 kg", price: 145, originalPrice: 175, rating: "4.7", reviews: "320", imgUrl: "https://images.unsplash.com/photo-1589131649983-4ec35f63d309?w=300&h=300&fit=crop", discount: "17% OFF", shop_id: 20 },
    { name: "Premium Almonds Whole", category: "Dry Fruits", weight: "500 g", price: 345, originalPrice: 399, rating: "4.8", reviews: "450", imgUrl: "https://images.unsplash.com/photo-1508061253366-f7da158b6d46?w=300&h=300&fit=crop", discount: "13% OFF", is_trending: 1, shop_id: 20 },
    { name: "Cream-Filled Chocolate Cookies", category: "Snacks", weight: "150 g", price: 45, originalPrice: 50, rating: "4.5", reviews: "190", imgUrl: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=300&h=300&fit=crop", discount: "10% OFF", shop_id: 20 },
    { name: "Multi-Surface Liquid Disinfectant", category: "Household", weight: "1 L", price: 165, originalPrice: 195, rating: "4.6", reviews: "280", imgUrl: "https://images.unsplash.com/photo-1584622781564-1d9876a13d1a?w=300&h=300&fit=crop", discount: "15% OFF", shop_id: 20 },

    // Shop 21: Lifeline Wellness Pharmacy
    { name: "Antacid Gas Relief Gel Mint", category: "Healthcare", weight: "200 ml", price: 95, originalPrice: 110, rating: "4.6", reviews: "450", imgUrl: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=300&h=300&fit=crop", discount: "13% OFF", shop_id: 21 },
    { name: "Multivitamin Daily Capsules Pack", category: "Healthcare", weight: "60 caps", price: 340, originalPrice: 399, rating: "4.8", reviews: "890", imgUrl: "https://images.unsplash.com/photo-1616679911721-eff6eec18fcd?w=300&h=300&fit=crop", discount: "14% OFF", is_trending: 1, shop_id: 21 },
    { name: "Digital Fever Thermometer Premium", category: "Healthcare", weight: "1 pc", price: 215, originalPrice: 250, rating: "4.7", reviews: "380", imgUrl: "https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=300&h=300&fit=crop", discount: "14% OFF", shop_id: 21 },
    { name: "N95 Medical Face Mask Pack 5s", category: "Healthcare", weight: "5 pcs", price: 149, originalPrice: 199, rating: "4.8", reviews: "640", imgUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&h=300&fit=crop", discount: "25% OFF", shop_id: 21 },

    // Additional items to existing shops to enrich inventory
    // Shop 1: Fresh Produce Shop
    { name: "Sweet Seedless Grapes Local", category: "Fresh Fruits", weight: "500 g", price: 125, originalPrice: 140, rating: "4.7", reviews: "45", imgUrl: "https://images.unsplash.com/photo-1601275868399-45bec4f2cd86?w=300&h=300&fit=crop", discount: "11% OFF", shop_id: 1 },
    { name: "Fresh Garlic Cloves Pack", category: "Vegetables", weight: "200 g", price: 45, originalPrice: 55, rating: "4.6", reviews: "35", imgUrl: "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=300&h=300&fit=crop", discount: "18% OFF", shop_id: 1 },
    
    // Shop 2: Frozen Shop
    { name: "McCain Veggie Nuggets Pack", category: "Frozen Foods", weight: "320 g", price: 95, originalPrice: 110, rating: "4.5", reviews: "80", imgUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&h=300&fit=crop", discount: "13% OFF", shop_id: 2 },
    { name: "Frozen Strawberry Ice Cream Tub", category: "Desserts", weight: "500 ml", price: 145, originalPrice: 165, rating: "4.7", reviews: "65", imgUrl: "https://images.unsplash.com/photo-1567206563064-6f6093f2d457?w=300&h=300&fit=crop", discount: "12% OFF", shop_id: 2 },

    // Shop 3: Juice Shop
    { name: "Pineapple Punch Juice", category: "Drinks", weight: "300 ml", price: 75, originalPrice: 90, rating: "4.6", reviews: "55", imgUrl: "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=300&h=300&fit=crop", discount: "16% OFF", shop_id: 3 },
    { name: "Citrus Lime Mint Cooler", category: "Drinks", weight: "250 ml", price: 50, originalPrice: 60, rating: "4.5", reviews: "75", imgUrl: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=300&h=300&fit=crop", discount: "16% OFF", shop_id: 3 },

    // Shop 4: Gold Shop
    { name: "Heritage Gold Ring 22K", category: "Gold Jewelry", weight: "6 g", price: 41800, originalPrice: 45000, rating: "4.8", reviews: "12", imgUrl: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=300&h=300&fit=crop", discount: "7% OFF", shop_id: 4 },
    { name: "Diamond Tennis Bracelet", category: "Diamond Jewelry", weight: "12 g", price: 92000, originalPrice: 99000, rating: "4.9", reviews: "8", imgUrl: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=300&h=300&fit=crop", discount: "7% OFF", shop_id: 4 },

    // Shop 5: Dressing Shop
    { name: "Premium Checked Shirt", category: "Mens Wear", weight: "1 pc", price: 899, originalPrice: 1199, rating: "4.6", reviews: "75", imgUrl: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=300&h=300&fit=crop", discount: "25% OFF", shop_id: 5 },
    { name: "Floral Georgette Kurti Set", category: "Womens Wear", weight: "1 pc", price: 1699, originalPrice: 2299, rating: "4.7", reviews: "60", imgUrl: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=300&h=300&fit=crop", discount: "26% OFF", shop_id: 5 },

    // Shop 6: General Store
    { name: "Premium Basmati Rice Gold", category: "Dals & Pulses", weight: "5 kg", price: 540, originalPrice: 650, rating: "4.9", reviews: "210", imgUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=300&h=300&fit=crop", discount: "16% OFF", shop_id: 6 },
    { name: "Salted Pistachios Premium", category: "Dry Fruits", weight: "200 g", price: 260, originalPrice: 320, rating: "4.8", reviews: "85", imgUrl: "https://images.unsplash.com/photo-1508061253366-f7da158b6d46?w=300&h=300&fit=crop", discount: "18% OFF", shop_id: 6 },

    // Shop 7: Pharmacy / Health Shop
    { name: "Pain Relief Balm Fast Acting", category: "Healthcare", weight: "50 g", price: 85, originalPrice: 95, rating: "4.6", reviews: "1200", imgUrl: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=300&h=300&fit=crop", discount: "10% OFF", shop_id: 7 },
    { name: "Vitamin D3 Supplements Capsule", category: "Healthcare", weight: "30 caps", price: 165, originalPrice: 199, rating: "4.8", reviews: "450", imgUrl: "https://images.unsplash.com/photo-1616679911721-eff6eec18fcd?w=300&h=300&fit=crop", discount: "17% OFF", shop_id: 7 },

    // Shop 8: Green Valley Fresh Market
    { name: "Green Lettuce Bunch Fresh", category: "Vegetables", weight: "1 pc", price: 45, originalPrice: 60, rating: "4.7", reviews: "30", imgUrl: "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=300&h=300&fit=crop", discount: "25% OFF", shop_id: 8 },
    { name: "Organic Sweet Corn Cob", category: "Vegetables", weight: "2 pcs", price: 35, originalPrice: 45, rating: "4.6", reviews: "25", imgUrl: "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=300&h=300&fit=crop", discount: "22% OFF", shop_id: 8 },

    // Shop 9: Polar Ice Foods & Desserts
    { name: "Polar Veg Spring Rolls Pack", category: "Frozen Foods", weight: "10 pcs", price: 165, originalPrice: 195, rating: "4.5", reviews: "40", imgUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&h=300&fit=crop", discount: "15% OFF", shop_id: 9 },
    { name: "Polar Mango Sorbet Tub", category: "Desserts", weight: "500 ml", price: 135, originalPrice: 155, rating: "4.6", reviews: "30", imgUrl: "https://images.unsplash.com/photo-1567206563064-6f6093f2d457?w=300&h=300&fit=crop", discount: "12% OFF", shop_id: 9 },

    // Shop 10: Citrus Squeeze Juice Bar
    { name: "Pure Watermelon Splash", category: "Drinks", weight: "300 ml", price: 65, originalPrice: 80, rating: "4.6", reviews: "90", imgUrl: "https://images.unsplash.com/photo-1546173159-315724a31696?w=300&h=300&fit=crop", discount: "18% OFF", shop_id: 10 },
    { name: "Guava Chili Tangy Twist", category: "Drinks", weight: "250 ml", price: 55, originalPrice: 70, rating: "4.5", reviews: "45", imgUrl: "https://images.unsplash.com/photo-1534080391025-a77c3835535d?w=300&h=300&fit=crop", discount: "21% OFF", shop_id: 10 },

    // Shop 11: Golden Heritage Fine Jewelry
    { name: "Heritage Gold Earrings 18K", category: "Gold Jewelry", weight: "4 g", price: 26800, originalPrice: 29500, rating: "4.7", reviews: "14", imgUrl: "https://images.unsplash.com/photo-1635767790028-3e9a53664081?w=300&h=300&fit=crop", discount: "9% OFF", shop_id: 11 },
    { name: "Heritage Diamond Pendant Star", category: "Diamond Jewelry", weight: "2 g", price: 21500, originalPrice: 24500, rating: "4.8", reviews: "9", imgUrl: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=300&h=300&fit=crop", discount: "12% OFF", shop_id: 11 },

    // Shop 12: Vogue Threads & Dressing Room
    { name: "Vogue Cotton Polo Shirt", category: "Mens Wear", weight: "1 pc", price: 699, originalPrice: 999, rating: "4.6", reviews: "95", imgUrl: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=300&h=300&fit=crop", discount: "30% OFF", shop_id: 12 },
    { name: "Vogue Casual Slip Dress", category: "Womens Wear", weight: "1 pc", price: 1199, originalPrice: 1699, rating: "4.7", reviews: "50", imgUrl: "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=300&h=300&fit=crop", discount: "29% OFF", shop_id: 12 },

    // Shop 13: QuickMart Express Grocery
    { name: "QuickMart Green Moong Dal", category: "Dals & Pulses", weight: "1 kg", price: 148, originalPrice: 175, rating: "4.7", reviews: "120", imgUrl: "https://images.unsplash.com/photo-1589131649983-4ec35f63d309?w=300&h=300&fit=crop", discount: "15% OFF", shop_id: 13 },
    { name: "QuickMart Unsalted Cashews", category: "Dry Fruits", weight: "250 g", price: 285, originalPrice: 340, rating: "4.6", reviews: "75", imgUrl: "https://images.unsplash.com/photo-1599587428807-6ad0c7ec44da?w=300&h=300&fit=crop", discount: "16% OFF", shop_id: 13 },

    // Shop 14: Apex Healthcare & Pharmacy
    { name: "Apex Vaporizing Rub Cold", category: "Healthcare", weight: "50 g", price: 78, originalPrice: 90, rating: "4.8", reviews: "620", imgUrl: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=300&h=300&fit=crop", discount: "13% OFF", shop_id: 14 },
    { name: "Apex Vitamin D3 Chew Pack", category: "Healthcare", weight: "30 tabs", price: 145, originalPrice: 180, rating: "4.7", reviews: "310", imgUrl: "https://images.unsplash.com/photo-1616679911721-eff6eec18fcd?w=300&h=300&fit=crop", discount: "19% OFF", shop_id: 14 }
];

db.serialize(() => {
    console.log("Seeding extra stores (Shops 15 to 21)...");
    const insertShop = db.prepare(`INSERT OR REPLACE INTO shops (id, vendor_id, name, logo, banner, description, timings, category, contact_phone, rating, delivery_time, status, commission_rate, registered_shop, is_active_store, show_special_offers)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`);
    newShops.forEach(s => {
        insertShop.run(s.id, s.vendor_id, s.name, s.logo, s.banner, s.description, s.timings, s.category, s.contact_phone, s.rating, s.delivery_time, s.status, s.commission_rate, s.registered_shop);
    });
    insertShop.finalize();

    console.log("Seeding extra wallets...");
    for (let i = 15; i <= 21; i++) {
        db.run(`INSERT OR REPLACE INTO vendor_wallets (shop_id, balance, revenue) VALUES (?, ?, ?)`, [i, 1000 * i, 3000 * i]);
    }

    console.log("Seeding extra products...");
    const insertProd = db.prepare(`INSERT INTO products (name, category, weight, price, originalPrice, rating, reviews, imgUrl, discount, is_available, is_trending, is_daily_essential, description, shop_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 1, ?, ?)`);
    newProducts.forEach(p => {
        insertProd.run(p.name, p.category, p.weight, p.price, p.originalPrice, p.rating || "4.7", p.reviews || "100", p.imgUrl, p.discount || "10% OFF", p.is_trending || 0, p.description || `High quality ${p.name} for your daily needs.`, p.shop_id);
    });
    insertProd.finalize();

    console.log("Extra database seeding completed successfully!");
    db.close();
});
