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
    const { error: catError } = await supabase.from('categories').insert(categories);
    if (catError) console.error("Category Error:", catError.message);

    // 2. Brands
    const brands = [
        { name: 'Adyanta Fresh' },
        { name: 'Nature Choice' }
    ];
    console.log("Inserting brands...");
    const { error: brandError } = await supabase.from('brands').insert(brands);
    if (brandError) console.error("Brand Error:", brandError.message);

    // 3. Products
    const products = [
        {
            name: 'Fresh Red Apples',
            category: 'Fruits & Vegetables',
            price: 150,
            originalprice: 180,
            weight: '1 kg',
            imgurl: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=300',
            description: 'Crispy and sweet red apples from the farm.',
            is_daily_essential: 1,
            is_trending: 1,
            is_available: 1
        },
        {
            name: 'Farm Fresh Eggs',
            category: 'Dairy & Eggs',
            price: 60,
            originalprice: 70,
            weight: 'Dozen',
            imgurl: 'https://images.unsplash.com/photo-1582722472060-24217771c017?w=300',
            description: 'Organic brown eggs from free-range chickens.',
            is_daily_essential: 1,
            is_trending: 0,
            is_available: 1
        },
        {
            name: 'Whole Grain Bread',
            category: 'Bakery',
            price: 45,
            originalprice: 50,
            weight: 'Packet',
            imgurl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300',
            description: 'Freshly baked whole grain bread.',
            is_daily_essential: 1,
            is_trending: 1,
            is_available: 1
        }
    ];

    console.log("Inserting products...");
    const { error: prodError } = await supabase.from('products').insert(products);
    if (prodError) console.error("Product Error:", prodError.message);

    console.log("Seeding Complete!");
}

seed();
