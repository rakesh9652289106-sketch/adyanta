let shops = [];
let filteredShops = [];
let currentCategory = 'All';

const API_BASE = (typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) 
    ? import.meta.env.VITE_API_URL 
    : (typeof window !== 'undefined' && window.location && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:3000' : 'https://adyanta-commerce.onrender.com');

// Cookie Helper
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        console.log("Loading Shops...");
        const res = await fetch(API_BASE + '/api/shops');
        if (res.ok) {
            shops = await res.json();
            // Handle URL category parameters
            const urlParams = new URLSearchParams(window.location.search);
            const categoryParam = urlParams.get('category');
            if (categoryParam) {
                currentCategory = categoryParam;
                // Update UI active tab
                const tabBtns = document.querySelectorAll('.filter-tab-btn');
                tabBtns.forEach(btn => {
                    if (btn.getAttribute('data-category') === categoryParam) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
            }
            filterAndSearchShops();
        } else {
            document.getElementById('allStoresGrid').innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-soft);">
                    Failed to fetch stores. Please try again later.
                </div>
            `;
        }
    } catch(e) {
        console.error("Failed fetching shops:", e);
        document.getElementById('allStoresGrid').innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-soft);">
                Error loading stores. Connection refused.
            </div>
        `;
    }

    setupNavMenu();
    setupFilters();

    // Theme toggle bind
    const themeBtn = document.querySelector('.theme-toggle-btn');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            if (window.toggleTheme) window.toggleTheme();
        });
    }

    // Initialize Translation
    const savedLang = localStorage.getItem('language') || 'en';
    if (window.applyTranslations) {
        window.applyTranslations(savedLang);
    }
    
    // Setup chatbot
    setupStoresAIChatbot();
});

function setupNavMenu() {
    const navBtn = document.getElementById('navMenuBtn');
    const closeBtn = document.getElementById('closeNavBtn');
    const overlay = document.getElementById('navOverlay');
    const sidebar = document.getElementById('navSidebar');
    const sidebarUsername = document.getElementById('sidebarUsername');
    const sidebarLogout = document.getElementById('sidebarLogout');

    if (!navBtn || !sidebar) return;

    const openNav = () => {
        sidebar.classList.add('active');
        if (overlay) overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        document.body.classList.add('sidebar-active');
        
        const name = getCookie('full_name');
        const username = getCookie('username');
        const role = getCookie('role');
        const displayName = name && name !== 'undefined' ? decodeURIComponent(name) : (username ? decodeURIComponent(username) : null);
        
        if (displayName) {
            if (sidebarUsername) sidebarUsername.innerText = displayName;
            if (sidebarLogout) sidebarLogout.style.display = 'flex';
        }

        const adminLink = document.getElementById('sidebarAdminLink');
        if (adminLink) {
            if (role === 'vendor' || (role === 'super_admin' && username === '9490229108')) {
                adminLink.style.display = 'flex';
            } else {
                adminLink.style.display = 'none';
            }
        }
    };
    
    const closeNav = () => {
        sidebar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = 'auto';
        document.body.classList.remove('sidebar-active');
    };
    
    navBtn.addEventListener('click', openNav);
    if (closeBtn) closeBtn.addEventListener('click', closeNav);
    if (overlay) overlay.addEventListener('click', closeNav);
    
    if (sidebarLogout) {
        sidebarLogout.addEventListener('click', async (e) => {
            e.preventDefault();
            if (confirm("Are you sure you want to log out?")) {
                await fetch(API_BASE + '/api/auth/logout', { method: 'POST' });
                // Clear cookies
                document.cookie = "full_name=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                document.cookie = "username=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                document.cookie = "user_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                document.cookie = "role=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                // Clear localstorage
                localStorage.removeItem('user_full_name');
                localStorage.removeItem('user_username');
                localStorage.removeItem('user_id');
                localStorage.removeItem('user_role');
                window.location.reload();
            }
        });
    }
}

function setupFilters() {
    const searchInput = document.getElementById('storeSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            filterAndSearchShops();
        });
    }

    const tabBtns = document.querySelectorAll('.filter-tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCategory = btn.getAttribute('data-category');
            filterAndSearchShops();
        });
    });
}

function filterAndSearchShops() {
    const searchInput = document.getElementById('storeSearchInput');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    filteredShops = shops.filter(shop => {
        const matchesCategory = currentCategory === 'All' || shop.category === currentCategory;
        
        const name = (shop.name || '').toLowerCase();
        const desc = (shop.description || '').toLowerCase();
        const cat = (shop.category || '').toLowerCase();
        const matchesQuery = query === '' || name.includes(query) || desc.includes(query) || cat.includes(query);

        return matchesCategory && matchesQuery;
    });

    renderShops();
}

function getShopCategoryIcon(category) {
    switch (category) {
        case 'Frozen Shop': return '<i class="ph ph-snowflake" style="vertical-align: middle; margin-right: 4px;"></i>';
        case 'Juice Shop': return '<i class="ph ph-drop" style="vertical-align: middle; margin-right: 4px;"></i>';
        case 'Gold Shop': return '<i class="ph ph-crown" style="vertical-align: middle; margin-right: 4px;"></i>';
        case 'Dressing Shop': return '<i class="ph ph-t-shirt" style="vertical-align: middle; margin-right: 4px;"></i>';
        case 'General Store': return '<i class="ph ph-shopping-bag" style="vertical-align: middle; margin-right: 4px;"></i>';
        case 'Fresh Produce Shop': return '<i class="ph ph-leaf" style="vertical-align: middle; margin-right: 4px;"></i>';
        case 'Pharmacy / Health Shop': return '<i class="ph ph-first-aid" style="vertical-align: middle; margin-right: 4px;"></i>';
        default: return '<i class="ph ph-storefront" style="vertical-align: middle; margin-right: 4px;"></i>';
    }
}

function renderShops() {
    const grid = document.getElementById('allStoresGrid');
    if (!grid) return;

    if (filteredShops.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem; color: var(--text-soft);">
                <i class="ph ph-storefront" style="font-size: 3rem; color: #CBD5E1; display: block; margin-bottom: 1rem;"></i>
                <h3 style="font-family: 'Outfit'; font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem; color: var(--text-main);">No Stores Found</h3>
                <p>Try adjusting your filters or search query.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filteredShops.map(shop => {
        const logo = shop.logo || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=100';
        const rating = shop.rating || '4.5';
        const delivery = shop.delivery_time || '15-30 mins';
        const desc = shop.description || 'Premium multi-vendor shop.';

        return `
            <div class="store-card" onclick="enterStore(${shop.id})">
                <div class="store-card-header">
                    <img class="store-logo" src="${logo}" alt="${shop.name}">
                    <div class="store-title-area">
                        <h3 class="store-name">${shop.name}</h3>
                        <span class="store-category">
                            ${getShopCategoryIcon(shop.category)}
                            <span>${shop.category || 'Grocery'}</span>
                        </span>
                    </div>
                </div>
                <p class="store-desc">${desc}</p>
                <div class="store-meta">
                    <span class="store-rating"><i class="ph-fill ph-star"></i> ${rating}</span>
                    <span class="store-delivery"><i class="ph ph-clock"></i> ${delivery}</span>
                </div>
                <div class="store-arrow">
                    <i class="ph-bold ph-arrow-right"></i>
                </div>
            </div>
        `;
    }).join('');
}

window.enterStore = function(shopId) {
    console.log(`Selecting shop ${shopId} and redirecting...`);
    localStorage.setItem('active_shop_id', shopId);
    window.location.href = '/';
};

// Initialize AI Chatbot on All Stores Page
function setupStoresAIChatbot() {
    const bubble = document.getElementById('aiChatbotBubble');
    const widget = document.getElementById('aiChatbotWidget');
    const closeBtn = document.getElementById('closeChatbotBtn');
    const sendBtn = document.getElementById('sendChatbotMsgBtn');
    const input = document.getElementById('chatbotInput');
    const messages = document.getElementById('chatbotMessages');

    if (!bubble || !widget) return;

    // Toggle Chat visibility
    bubble.addEventListener('click', () => {
        const isHidden = !widget.classList.contains('active');
        if (isHidden) {
            widget.classList.add('active');
            if (input) input.focus();
            if (messages) messages.scrollTop = messages.scrollHeight;
        } else {
            widget.classList.remove('active');
        }
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            widget.classList.remove('active');
        });
    }

    // Send Message
    if (sendBtn && input) {
        sendBtn.addEventListener('click', handleChatbotSend);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleChatbotSend();
        });
    }

    // Handle suggested clicks
    window.sendChatbotSuggestion = function(text) {
        if (input) {
            input.value = text;
            handleChatbotSend();
        }
    };

    function handleChatbotSend() {
        if (!input || !messages || !input.value.trim()) return;

        const userText = input.value.trim();
        input.value = '';

        // Append User message
        messages.innerHTML += `
            <div class="ai-bubble-user">
                ${userText}
            </div>
        `;
        messages.scrollTop = messages.scrollHeight;

        // Simulate typing loader
        const loaderId = `chat-loader-${Date.now()}`;
        messages.innerHTML += `
            <div id="${loaderId}" class="ai-bubble-bot" style="display: flex; align-items: center; gap: 0.35rem; padding: 0.8rem 1.2rem; min-height: 38px;">
                <span style="width: 7px; height: 7px; background: var(--primary); border-radius: 50%; display: inline-block; animation: bounce 1.2s infinite ease-in-out;"></span>
                <span style="width: 7px; height: 7px; background: var(--primary); border-radius: 50%; display: inline-block; animation: bounce 1.2s infinite ease-in-out 0.2s;"></span>
                <span style="width: 7px; height: 7px; background: var(--primary); border-radius: 50%; display: inline-block; animation: bounce 1.2s infinite ease-in-out 0.4s;"></span>
            </div>
        `;
        messages.scrollTop = messages.scrollHeight;

        // Dynamic response computation
        setTimeout(() => {
            const loader = document.getElementById(loaderId);
            if (loader) loader.remove();

            let botReply = "I am a helpful assistant for ADYANTA. You can ask me about available vendor shops, active coupons, or delivery times!";
            const query = userText.toLowerCase();

            if (query.includes('shop') || query.includes('store') || query.includes('browse') || query.includes('nellore')) {
                if (typeof shops !== 'undefined' && shops.length > 0) {
                    const list = shops.map(s => `
                        <div class="premium-bot-card">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                                <div>
                                    <strong class="premium-bot-card-title">${s.name}</strong>
                                    <div style="font-size: 0.72rem; color: var(--text-soft); font-weight: 600; margin-top: 2px;">
                                        <i class="ph-fill ph-tag" style="color: var(--primary);"></i> ${s.category || 'Store'}
                                    </div>
                                </div>
                                <span style="font-size: 0.78rem; font-weight: 700; color: #D4AF37; background: #FFFDF0; padding: 2px 6px; border-radius: 6px; border: 1px solid rgba(212,175,55,0.2); display: flex; align-items: center; gap: 3px;">
                                    <i class="ph-fill ph-star"></i> ${s.rating || '4.5'}
                                </span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed rgba(0,0,0,0.06); padding-top: 8px; margin-top: 8px;">
                                <span style="font-size: 0.72rem; color: var(--text-soft); font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                    <i class="ph ph-clock" style="color: var(--primary); font-size: 0.85rem;"></i> ${s.delivery_time || '15-30 mins'}
                                </span>
                                <button onclick="enterStore(${s.id});" style="background: linear-gradient(135deg, var(--primary), #06341D); color: white; border: none; padding: 5px 12px; border-radius: 12px; font-size: 0.72rem; font-weight: 700; cursor: pointer; transition: all 0.2s; box-shadow: 0 3px 6px rgba(10,92,54,0.15);" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='none'">Visit Store</button>
                            </div>
                        </div>
                    `).join('');
                    botReply = `<div style="font-weight: 700; margin-bottom: 0.5rem; color: var(--primary);"><i class="ph ph-map-pin" style="color: var(--accent);"></i> Active partner stores near you:</div>${list}`;
                } else {
                    botReply = "There are no stores active right now. Please check back later!";
                }
            } else if (query.includes('coupon') || query.includes('discount') || query.includes('code') || query.includes('offer')) {
                const coupons = [
                    { code: 'WELCOME10', desc: 'Flat 10% OFF on all grocery orders' },
                    { code: 'FIRSTSAVE100', desc: 'Flat ₹100 OFF on orders above ₹500' }
                ];
                const list = coupons.map(c => `
                    <div class="golden-ticket-card">
                        <div style="min-width: 0; flex: 1; padding-right: 8px;">
                            <span class="golden-ticket-code">${c.code}</span>
                            <div style="font-size: 0.75rem; color: #92400E; font-weight: 700; margin-top: 6px;">${c.desc}</div>
                        </div>
                        <button onclick="navigator.clipboard.writeText('${c.code}'); if(window.Toast) Toast.show('Coupon code copied to clipboard!', 'success');" style="background: linear-gradient(135deg, #0A5C36, #06341D); color: white; border: none; padding: 6px 12px; border-radius: 12px; font-size: 0.75rem; font-weight: 800; cursor: pointer; transition: all 0.2s; box-shadow: 0 3px 8px rgba(10,92,54,0.15);" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">Copy</button>
                    </div>
                `).join('');
                botReply = `<div style="font-weight: 700; margin-bottom: 0.5rem; color: var(--primary);"><i class="ph ph-gift" style="color: var(--accent);"></i> Available discount codes:</div>${list}`;
            } else if (query.includes('delivery') || query.includes('speed') || query.includes('minutes') || query.includes('time')) {
                botReply = `
                <strong style="color: var(--primary); font-size: 0.95rem; font-family: 'Outfit', sans-serif; display: flex; align-items: center; gap: 6px; margin-bottom: 0.5rem;"><i class="ph ph-lightning" style="color: var(--accent);"></i> Lightning-Fast Deliveries</strong>
                We dispatch riders immediately. Current estimated delivery is <strong>15 to 45 minutes</strong>.
                
                <div class="delivery-gauge">
                    <div class="delivery-gauge-fill"></div>
                    <div class="delivery-step active">
                        <div class="delivery-step-icon"><i class="ph ph-storefront"></i></div>
                        <div class="delivery-step-label">Ordered</div>
                    </div>
                    <div class="delivery-step active">
                        <div class="delivery-step-icon"><i class="ph ph-package"></i></div>
                        <div class="delivery-step-label">Prepared</div>
                    </div>
                    <div class="delivery-step active">
                        <div class="delivery-step-icon"><i class="ph ph-moped"></i></div>
                        <div class="delivery-step-label">On Route</div>
                    </div>
                    <div class="delivery-step">
                        <div class="delivery-step-icon" style="border-color: #CBD5E1; color: #94A3B8;"><i class="ph ph-house"></i></div>
                        <div class="delivery-step-label">Delivered</div>
                    </div>
                </div>
                <div style="background: var(--primary-light); color: var(--primary); padding: 10px 12px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; border-left: 4px solid var(--primary); text-align: left; margin-top: 12px; display: flex; gap: 8px; align-items: flex-start;">
                    <i class="ph ph-info" style="font-size: 0.9rem; margin-top: 1px;"></i>
                    <span>Our average delivery speed in Nellore is just 22 minutes today!</span>
                </div>`;
            } else if (query.includes('hi') || query.includes('hello') || query.includes('hey')) {
                botReply = `
                <strong style="font-size: 1rem; color: var(--primary); display: block; margin-bottom: 0.5rem; font-family: 'Outfit', sans-serif;">👋 Hello! I am the ADYANTA Premium Assistant.</strong>
                I can help you navigate the marketplace and find the best deals. Click one of the options below or type your question:
                <div style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem;">
                    <button class="chat-suggest-btn" onclick="sendChatbotSuggestion('🔍 Show active shops')"><i class="ph ph-storefront"></i> Browse Partner Shops</button>
                    <button class="chat-suggest-btn" onclick="sendChatbotSuggestion('🎁 Give me active coupons')"><i class="ph ph-ticket"></i> Active Coupons & Offers</button>
                    <button class="chat-suggest-btn" onclick="sendChatbotSuggestion('⚡ Check delivery speeds')"><i class="ph ph-lightning"></i> Delivery Timelines</button>
                    <button class="chat-suggest-btn" onclick="sendChatbotSuggestion('💳 Payment Options')"><i class="ph ph-credit-card"></i> Accepted Payments</button>
                </div>`;
            } else if (query.includes('payment') || query.includes('upi') || query.includes('cod') || query.includes('pay')) {
                botReply = `
                <strong style="color: var(--primary); font-size: 0.95rem; font-family: 'Outfit', sans-serif; display: flex; align-items: center; gap: 6px; margin-bottom: 0.5rem;"><i class="ph ph-shield-check" style="color: var(--accent);"></i> Secure Payment Channels</strong>
                Choose from several verified sandbox gateways at checkout:
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px;">
                    <div style="background: var(--card-bg); border: 1px solid rgba(0,0,0,0.06); padding: 8px; border-radius: 12px; text-align: center; font-size: 0.75rem; font-weight: 700; color: var(--text-main); display: flex; flex-direction: column; align-items: center; gap: 4px;">
                        <i class="ph ph-device-mobile" style="font-size: 1.4rem; color: var(--primary);"></i> UPI Transfer
                    </div>
                    <div style="background: var(--card-bg); border: 1px solid rgba(0,0,0,0.06); padding: 8px; border-radius: 12px; text-align: center; font-size: 0.75rem; font-weight: 700; color: var(--text-main); display: flex; flex-direction: column; align-items: center; gap: 4px;">
                        <i class="ph ph-credit-card" style="font-size: 1.4rem; color: var(--primary);"></i> Credit/Debit Card
                    </div>
                    <div style="background: var(--card-bg); border: 1px solid rgba(0,0,0,0.06); padding: 8px; border-radius: 12px; text-align: center; font-size: 0.75rem; font-weight: 700; color: var(--text-main); display: flex; flex-direction: column; align-items: center; gap: 4px;">
                        <i class="ph ph-wallet" style="font-size: 1.4rem; color: var(--primary);"></i> Cash on Delivery
                    </div>
                    <div style="background: var(--card-bg); border: 1px solid rgba(0,0,0,0.06); padding: 8px; border-radius: 12px; text-align: center; font-size: 0.75rem; font-weight: 700; color: var(--text-main); display: flex; flex-direction: column; align-items: center; gap: 4px;">
                        <i class="ph ph-bank" style="font-size: 1.4rem; color: var(--primary);"></i> Net Banking
                    </div>
                </div>`;
            }

            messages.innerHTML += `
                <div class="ai-bubble-bot">
                    ${botReply}
                </div>
            `;
            messages.scrollTop = messages.scrollHeight;
        }, 1000);
    }
}
