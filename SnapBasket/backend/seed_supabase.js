const { supabase } = require('./supabaseClient');

async function seed() {
    console.log("Seeding Supabase...");

    // 1. Categories
    const categories = [
        { name: 'Fruits & Vegetables', iconurl: 'ph-leaf' },
        { name: 'Dairy & Eggs', iconurl: 'ph-egg' },
        { name: 'Bakery', iconurl: 'ph-bread' },
        { name: 'Meat & Seafood', iconurl: 'ph-fish' },
        { name: 'Snacks', iconurl: 'ph-cookie' },
        { name: 'Beverages', iconurl: 'ph-coffee' }
    ];

    console.log("Inserting categories...");
    const { data: cData, error: catError } = await supabase.from('categories').insert(categories).select();
    if (catError) console.error("Category Error:", catError.message);
    else console.log("Categories inserted:", cData?.length || 0);

    // 2. Brands
    const brands = [
        { name: 'Adyanta Fresh' },
        { name: 'Nature Choice' }
    ];
    console.log("Inserting brands...");
    const { data: bData, error: brandError } = await supabase.from('brands').insert(brands).select();
    if (brandError) console.error("Brand Error:", brandError.message);
    else console.log("Brands inserted:", bData?.length || 0);

    // 3. Products
    const products = [
        {
            name: 'Fresh Red Apples',
            category: 'Fruits & Vegetables',
            price: 150,
            originalprice: 180,
            weight: '1 kg',
            imgurl: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=600',
            description: 'Crispy and sweet red apples from the farm.',
            is_daily_essential: 1,
            is_trending: 1,
            is_available: 1
        },
        {
            name: 'Organic Bananas',
            category: 'Fruits & Vegetables',
            price: 60,
            originalprice: 80,
            weight: '1 Dozen',
            imgurl: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=600',
            description: 'Naturally ripened organic bananas.',
            is_daily_essential: 1,
            is_trending: 1,
            is_available: 1
        },
        {
            name: 'Farm Fresh Eggs',
            category: 'Dairy & Eggs',
            price: 90,
            originalprice: 110,
            weight: 'Dozen',
            imgurl: 'https://images.unsplash.com/photo-1582722472060-24217771c017?w=600',
            description: 'Organic brown eggs from free-range chickens.',
            is_daily_essential: 1,
            is_trending: 0,
            is_available: 1
        },
        {
            name: 'Full Cream Milk',
            category: 'Dairy & Eggs',
            price: 30,
            originalprice: 35,
            weight: '500 ml',
            imgurl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600',
            description: 'Pure and creamy fresh milk.',
            is_daily_essential: 1,
            is_trending: 1,
            is_available: 1
        },
        {
            name: 'Whole Grain Bread',
            category: 'Bakery',
            price: 45,
            originalprice: 55,
            weight: 'Packet',
            imgurl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600',
            description: 'Freshly baked whole grain bread.',
            is_daily_essential: 1,
            is_trending: 0,
            is_available: 1
        },
        {
            name: 'Premium Cashews',
            category: 'Snacks',
            price: 450,
            originalprice: 500,
            weight: '250 g',
            imgurl: 'https://images.unsplash.com/photo-1507048331197-7d4ac70811cf?w=600',
            description: 'Roasted and salted premium cashews.',
            is_daily_essential: 0,
            is_trending: 1,
            is_available: 1
        },
        {
            name: 'Roasted Almonds',
            category: 'Snacks',
            price: 380,
            originalprice: 420,
            weight: '250 g',
            imgurl: 'https://images.unsplash.com/photo-1508029091899-215ec2736c4b?w=600',
            description: 'Crunchy roasted almonds.',
            is_daily_essential: 0,
            is_trending: 0,
            is_available: 1
        },
        {
            name: 'Cold Brew Coffee',
            category: 'Beverages',
            price: 120,
            originalprice: 150,
            weight: '200 ml',
            imgurl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=600',
            description: 'Smooth and refreshing cold brew coffee.',
            is_daily_essential: 0,
            is_trending: 1,
            is_available: 1
        },
        {
            name: 'Fresh Salmon Fillet',
            category: 'Meat & Seafood',
            price: 850,
            originalprice: 950,
            weight: '500 g',
            imgurl: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600',
            description: 'Atlantic salmon fillet, rich in Omega-3.',
            is_daily_essential: 0,
            is_trending: 1,
            is_available: 1
        }
    ];

    console.log("Upserting products (preventing duplicates)...");
    const { data: pData, error: prodError } = await supabase.from('products').upsert(products, { onConflict: 'name' }).select();
    if (prodError) console.error("Product Error:", prodError.message);
    else console.log("Products synced:", pData?.length || 0);

    console.log("Seeding Complete!");
}

seed();
