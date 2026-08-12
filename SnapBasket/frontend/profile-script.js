const API_BASE = (typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) 
    ? import.meta.env.VITE_API_URL 
    : (typeof window !== 'undefined' && window.location && (
        window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1' || 
        window.location.hostname.startsWith('192.168.') || 
        window.location.hostname.startsWith('10.') || 
        window.location.hostname.startsWith('172.') || 
        window.location.hostname.endsWith('.local')
      ) ? '' : 'https://adyanta.onrender.com');

// Global Exports for HTML Event Handlers
window.reorder = (itemsJson) => {
    try {
        const items = typeof itemsJson === 'string' ? JSON.parse(itemsJson) : itemsJson;
        localStorage.setItem('cart', JSON.stringify(items));
        window.location.href = '/'; 
    } catch(e) {
        console.error("Reorder failed", e);
    }
};

window.toggleEditMode = (edit) => {
    const view = document.getElementById('profileView');
    const form = document.getElementById('profileEditForm');
    if (edit) {
        view.style.display = 'none';
        form.style.display = 'block';
    } else {
        view.style.display = 'block';
        form.style.display = 'none';
    }
};

async function initProfile() {
    const username = getCookie('username');

    if (!username) {
        Toast.show("Please login to view your profile", "error");
        setTimeout(() => location.href = "/", 2000);
        return;
    }

    initDashboard();
}

if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", initProfile);
} else {
    initProfile();
}

function initDashboard() {
    setupTabs();
    fetchOverview();
    fetchOrders(); // Default tab content
    setupForms();
    setupModals();
    setupNavMenu();
}

// 1. Tab Switching Logic
function setupTabs() {
    const tabs = document.querySelectorAll('.dash-nav-item[data-tab]');
    const contents = document.querySelectorAll('.tab-content');

    // Handle URL Params for deep linking (e.g., profile.html?tab=addresses)
    const urlParams = new URLSearchParams(window.location.search);
    const initialTab = urlParams.get('tab') || 'orders';

    window.switchTab = (tabId) => {
        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));

        const targetTab = document.querySelector(`.dash-nav-item[data-tab="${tabId}"]`);
        const targetContent = document.getElementById(tabId);

        if (targetTab && targetContent) {
            targetTab.classList.add('active');
            targetContent.classList.add('active');
            
            // Trigger specific fetch if needed
            if (tabId === 'addresses') fetchAddresses();
            if (tabId === 'wishlist') fetchWishlist();
            if (tabId === 'coupons') fetchCoupons();
            if (tabId === 'profile') fetchProfile();
            if (tabId === 'orders') fetchOrders();
            if (tabId === 'inquiries') fetchInquiries();
        }
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            window.switchTab(tab.dataset.tab);
        });
    });

    window.switchTab(initialTab);
}

// 2. Fetch Dashboard Overview Stats
async function fetchOverview() {
    try {
        const [profile, orders, wishlist, addresses, activity] = await Promise.all([
            fetch(API_BASE + '/api/user/profile', { credentials: 'include' }).then(r => r.json()),
            fetch(API_BASE + '/api/user/orders', { credentials: 'include' }).then(r => r.json()),
            fetch(API_BASE + '/api/user/wishlist', { credentials: 'include' }).then(r => r.json()),
            fetch(API_BASE + '/api/user/addresses', { credentials: 'include' }).then(r => r.json()),
            fetch(API_BASE + '/api/user/activity', { credentials: 'include' }).then(r => r.json())
        ]);

        document.getElementById('welcomeName').innerText = `Welcome, ${profile.full_name || profile.username}!`;
        document.getElementById('profileAvatarInitial').innerText = (profile.full_name || profile.username).charAt(0).toUpperCase();
        
        document.getElementById('statOrdersCount').innerText = orders.length || 0;
        if (document.getElementById('statCoinsCount')) {
            document.getElementById('statCoinsCount').innerText = profile.coins || 0;
        }
        if (document.getElementById('statCoinsWorth')) {
            document.getElementById('statCoinsWorth').innerText = '₹' + Math.floor((profile.coins || 0) / 10);
        }
        document.getElementById('statWishlistCount').innerText = wishlist.length || 0;
        document.getElementById('statAddressCount').innerText = addresses.length || 0;

        // Render Recent Activity
        const actList = document.getElementById('recentActivityList');
        if (actList) {
            if (!activity || activity.length === 0) {
                actList.innerHTML = '<p style="color:var(--text-soft); font-size:0.9rem;">No recent activity.</p>';
            } else {
                actList.innerHTML = activity.slice(0, 5).map(act => {
                    const isReply = act.type === 'support_reply';
                    const icon = isReply ? 'ph ph-chat-circle-dots' : 'ph ph-question';
                    const color = isReply ? 'var(--primary)' : '#6366F1';
                    const title = isReply ? `Admin Reply: ${act.title}` : `Inquiry: ${act.title}`;
                    const msg = act.message;
                    
                    return `
                        <div style="display:flex; gap:1rem; margin-bottom:1rem; padding-bottom:1rem; border-bottom:1px solid var(--border);">
                            <div style="width:36px; height:36px; border-radius:50%; background:var(--bg-color); display:flex; align-items:center; justify-content:center; color:${color}; font-size:1.25rem; flex-shrink:0;">
                                <i class="${icon}"></i>
                            </div>
                            <div style="flex:1;">
                                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                    <strong style="font-size:0.9rem; color:var(--text-main);">${title}</strong>
                                    <small style="font-size:0.75rem; color:var(--text-soft);">${new Date(act.date).toLocaleDateString()}</small>
                                </div>
                                <p style="font-size:0.85rem; color:var(--text-soft); margin-top:0.2rem; line-height:1.4;">${msg}</p>
                            </div>
                        </div>
                    `;
                }).join('');
            }
            reRenderIcons();
        }

        // Auto-fill profile form if it's open
        if (profile) fillProfileForm(profile);

    } catch (e) {
        console.error("Overview error:", e);
    }
}

// 3. Orders Tab
async function fetchOrders() {
    const listEl = document.getElementById('orderList');
    try {
        const res = await fetch(API_BASE + '/api/user/orders', { credentials: 'include' });
        const orders = await res.json();
        
        if (!orders.length) {
            listEl.innerHTML = '<div style="text-align:center; padding:3rem;"><i class="ph ph-mask-sad" style="font-size:3rem; color:var(--text-soft); margin-bottom:1rem; display:block;"></i><p>No orders placed yet.</p></div>';
            return;
        }

        listEl.innerHTML = orders.map(order => {
            let items = [];
            try {
                items = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []);
            } catch (e) { console.error("Error parsing order items:", e); items = []; }
            
            const orderItems = JSON.stringify(items);
            
            // Timeline mapping
            const status = (order.status || 'pending').toLowerCase();
            const steps = [
                { id: 'pending', label: 'Pending' },
                { id: 'confirmed', label: 'Confirmed' },
                { id: 'delivered', label: 'Delivered' }
            ];
            
            // Find current index
            let currentIndex = steps.findIndex(s => s.id === status);
            if (currentIndex === -1) currentIndex = 0; // fallback

            return `
                <div class="dash-card">
                    <div style="display:flex; justify-content:space-between; border-bottom: 1px solid var(--border); padding-bottom:1rem; margin-bottom:1rem;">
                        <div>
                            <div style="display:flex; align-items:center; gap:0.4rem; font-size:0.85rem; color:var(--text-soft);">
                                <span>Order ID: #${order.id}</span>
                                <span>&bull;</span>
                                <strong style="color: var(--primary); font-weight: 700;"><i class="ph ph-storefront"></i> ${order.shop_name || items[0]?.shop_name || items[0]?.shopName || 'Store'}</strong>
                            </div>
                            <h4 style="margin-top:0.25rem;">${new Date(order.created_at).toLocaleDateString()}</h4>
                        </div>
                        <div style="text-align:right;">
                            <span style="display:inline-block; padding:2px 10px; background:var(--primary-light); color:var(--primary); border-radius:12px; font-size:0.75rem; font-weight:600; margin-bottom:0.5rem; text-transform:uppercase;">${status}</span>
                            <h4 style="color:var(--primary);">₹${order.total}</h4>
                        </div>
                    </div>
                    
                    <!-- Order Items -->
                    <div style="display:flex; flex-direction:column; gap:0.5rem; margin-bottom:1.5rem;">
                        ${items.map(i => `<div style="display:flex; justify-content:space-between; font-size:0.95rem;">
                            <span>${i.quantity}x ${i.name}</span>
                            <span>₹${i.price * i.quantity}</span>
                        </div>`).join('')}
                    </div>

                    <!-- Loyalty Program Coins -->
                    ${(order.coins_earned > 0 || order.coins_used > 0) ? `
                        <div style="display:flex; justify-content:space-between; font-size:0.85rem; padding: 0.5rem; background: var(--bg-main); border-radius: 6px; margin-bottom: 1rem; border: 1px solid var(--border);">
                            <span style="color: var(--text-soft); font-weight: 500;">Loyalty Coins</span>
                            <div style="display: flex; gap: 1rem;">
                                ${order.coins_earned > 0 ? `<span style="color: #10B981; font-weight: 600;"><i class="ph ph-plus-circle"></i> +${order.coins_earned} Earned</span>` : ''}
                                ${order.coins_used > 0 ? `<span style="color: #EF4444; font-weight: 600;"><i class="ph ph-minus-circle"></i> -${order.coins_used} Redeemed</span>` : ''}
                            </div>
                        </div>
                    ` : ''}

                    <!-- Delivery OTP Badge for Active Orders -->
                    ${order.delivery_otp && status !== 'delivered' && status !== 'cancelled' ? `
                        <div style="background: #EFF6FF; border: 1px solid #BFDBFE; color: #1E40AF; padding: 0.6rem 1rem; border-radius: 10px; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 0.85rem; font-weight: 700; display: flex; align-items: center; gap: 0.4rem;">
                                <i class="ph ph-shield-check" style="font-size: 1.1rem; color: #2563EB;"></i> Delivery OTP for Rider: <strong style="font-size: 1.1rem; letter-spacing: 2px; color: #1D4ED8;">${order.delivery_otp}</strong>
                            </span>
                            <span style="font-size: 0.72rem; color: #3B82F6; font-weight: 600;">Share at door</span>
                        </div>
                    ` : ''}

                    <!-- Order Action & Evidence Bar -->
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem;">
                        ${order.packing_photo ? `
                            <button type="button" onclick="viewCustomerEvidence(${order.id})" style="background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; padding: 6px 12px; border-radius: 8px; font-size: 0.8rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 0.4rem;">
                                <i class="ph ph-camera"></i> View Vendor Pack Photo ${order.is_tamper_sealed ? '🔒 Sealed' : ''}
                            </button>
                        ` : ''}
                        
                        ${(status !== 'delivered' && status !== 'cancelled') ? `
                            <button type="button" onclick="openOrderTrackingModal(${order.id})" style="background: #EFF6FF; color: #1E40AF; border: 1px solid #BFDBFE; padding: 6px 12px; border-radius: 8px; font-size: 0.8rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 0.4rem;">
                                <i class="ph ph-map-trifold"></i> Live Track Delivery
                            </button>
                        ` : ''}
                        
                        <button type="button" onclick="openCustomerDisputeModal(${order.id})" style="background: #FEF2F2; color: #991B1B; border: 1px solid #FECACA; padding: 6px 12px; border-radius: 8px; font-size: 0.8rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 0.4rem;">
                            <i class="ph ph-warning-circle"></i> Report Issue / Discrepancy
                        </button>
                    </div>

                    <!-- Visual Timeline -->
                    <div class="order-timeline">
                        ${steps.map((step, idx) => `
                            <div class="timeline-step ${idx <= currentIndex ? 'active' : ''}">
                                <div class="timeline-dot"></div>
                                <span class="timeline-label">${step.label}</span>
                            </div>
                        `).join('')}
                    </div>

                    <!-- Quick Re-order -->
                    <button class="reorder-btn" onclick='window.reorder(\`${orderItems.replace(/'/g, "&apos;")}\`)'>
                        <i class="ph ph-arrows-counter-clockwise"></i> Re-order This Shipment
                    </button>
                </div>
            `;
        }).join('');
        reRenderIcons();
    } catch (e) { listEl.innerHTML = '<p>Error loading orders.</p>'; }
}

// 4. Addresses Tab
let cachedAddressesList = [];

async function fetchAddresses() {
    const grid = document.getElementById('addressGrid');
    try {
        const res = await fetch(API_BASE + '/api/user/addresses', { credentials: 'include' });
        const addresses = await res.json();
        cachedAddressesList = addresses || [];
        
        // Cache addresses locally for offline support
        localStorage.setItem('cached_addresses', JSON.stringify(cachedAddressesList));

        renderAddressesHtml(cachedAddressesList);
    } catch (e) { 
        console.error("Address fetch failed. Loading offline cache...", e);
        const cached = localStorage.getItem('cached_addresses');
        if (cached) {
            cachedAddressesList = JSON.parse(cached);
            renderAddressesHtml(cachedAddressesList);
            Toast.show("Loaded offline address cache.", "info");
        } else {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; padding:2rem; color:var(--text-soft);">No saved addresses yet.</p>';
        }
    }
}

function renderAddressesHtml(addresses) {
    const grid = document.getElementById('addressGrid');
    if (!grid) return;

    if (!Array.isArray(addresses) || !addresses.length) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; padding:2rem; color:var(--text-soft);">No saved addresses yet.</p>';
        return;
    }

    grid.innerHTML = addresses.map((addr, index) => {
        const favoriteIcon = addr.is_favorite ? 'ph-fill ph-star' : 'ph ph-star';
        const favoriteColor = addr.is_favorite ? '#EAB308' : 'var(--text-soft)';
        
        let detailsHtml = '';
        if (addr.apartment_name) detailsHtml += `<span>${addr.apartment_name}</span>`;
        if (addr.floor_number) detailsHtml += `<span>, ${addr.floor_number}</span>`;
        if (addr.landmark) detailsHtml += `<p style="font-size:0.85rem; color:var(--text-soft); margin-top:0.25rem;"><i class="ph ph-map-trifold"></i> Landmark: ${addr.landmark}</p>`;
        if (addr.delivery_instructions && addr.delivery_instructions !== 'None') detailsHtml += `<p style="font-size:0.82rem; color:#4F46E5; margin-top:0.25rem; font-weight:600;"><i class="ph ph-bell"></i> Note: ${addr.delivery_instructions}</p>`;
        if (addr.phone_number) detailsHtml += `<p style="font-size:0.85rem; color:var(--text-main); margin-top:0.25rem;"><i class="ph ph-phone"></i> ${addr.contact_person || 'Receiver'}: ${addr.phone_number}</p>`;
        
        const dragHandle = `
            <div style="display:flex; flex-direction:column; gap:0.25rem;">
                ${index > 0 ? `<button onclick="moveAddress(${addr.id}, -1)" class="reorder-btn" title="Move Up"><i class="ph-bold ph-caret-up"></i></button>` : '<div style="height:20px;width:20px;"></div>'}
                ${index < addresses.length - 1 ? `<button onclick="moveAddress(${addr.id}, 1)" class="reorder-btn" title="Move Down"><i class="ph-bold ph-caret-down"></i></button>` : '<div style="height:20px;width:20px;"></div>'}
            </div>
        `;

        return `
            <div class="address-card ${addr.is_default ? 'default' : ''}" style="position:relative; display:flex; gap:1rem;">
                <div style="flex:1;">
                    ${addr.is_default ? '<span class="address-badge">DEFAULT</span>' : ''}
                    ${addr.is_shared ? '<span class="address-badge" style="background:#EEF2F6; color:#475569; margin-left:5px;">FAMILY SHARED</span>' : ''}
                    <div style="display:flex; gap:0.75rem; align-items:center; margin-bottom:0.75rem;">
                        <i class="ph ph-${addr.label === 'Home' ? 'house' : (addr.label === 'Office' ? 'briefcase' : (addr.label === 'College' ? 'graduation-cap' : 'map-pin'))}" style="color:var(--primary); font-size:1.25rem;"></i>
                        <strong style="font-size:1.1rem;">${addr.label}</strong>
                        
                        <button onclick="toggleFavoriteAddress(${addr.id}, ${addr.is_favorite ? 0 : 1})" class="btn-text" style="margin-left:auto; background:none; border:none; cursor:pointer; padding:0; font-size:1.2rem; color:${favoriteColor};">
                            <i class="${favoriteIcon}"></i>
                        </button>
                    </div>
                    <p style="font-size:0.95rem; color:var(--text-main); line-height:1.4; margin-bottom:0.25rem;">${addr.address_line}</p>
                    <p style="font-size:0.9rem; color:var(--text-soft); font-weight:600;">${detailsHtml}</p>
                    <p style="font-size:0.9rem; color:var(--text-soft); margin-top:0.25rem;">${addr.city} - ${addr.pincode}</p>
                    
                    ${addr.photo_url ? `<div style="margin-top:0.75rem;"><img src="${addr.photo_url}" style="width:60px; height:60px; border-radius:6px; object-fit:cover; border:1px solid var(--border);" alt="Entrance Photo" onclick="window.open('${addr.photo_url}', '_blank')"></div>` : ''}

                    <div style="margin-top:1.25rem; display:flex; gap:1rem;">
                        <button class="btn-text" onclick="editAddress(${addr.id})" style="color:var(--primary); border:none; padding:0; background:none; cursor:pointer; font-weight:700; font-size:0.85rem;"><i class="ph ph-pencil-simple"></i> EDIT</button>
                        <button class="btn-text" onclick="deleteAddress(${addr.id})" style="color:#EF4444; border:none; padding:0; background:none; cursor:pointer; font-weight:700; font-size:0.85rem;"><i class="ph ph-trash"></i> DELETE</button>
                        ${!addr.is_default ? `<button onclick="setDefaultAddress(${addr.id})" class="btn-text" style="color:var(--primary); font-weight:700; font-size:0.85rem; border:none; padding:0; background:none; cursor:pointer;"><i class="ph ph-check-circle"></i> SET AS DEFAULT</button>` : ''}
                    </div>
                </div>
                <div style="display:flex; align-items:center;">
                    ${dragHandle}
                </div>
            </div>
        `;
    }).join('');
    reRenderIcons();
}

async function deleteAddress(id) {
    if (!confirm("Are you sure you want to delete this address?")) return;
    try {
        await fetch(`${API_BASE}/api/user/addresses/${id}`, { method: 'DELETE', credentials: 'include' });
        Toast.show("Address removed", "info");
        fetchAddresses();
        fetchOverview();
    } catch (e) { console.error(e); }
}

async function toggleFavoriteAddress(id, isFavorite) {
    try {
        const res = await fetch(`${API_BASE}/api/user/addresses/${id}/favorite`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_favorite: isFavorite }),
            credentials: 'include'
        });
        if (res.ok) {
            Toast.show(isFavorite ? "Added to favorites ⭐" : "Removed from favorites", "success");
            fetchAddresses();
        }
    } catch (e) { console.error(e); }
}

async function moveAddress(id, direction) {
    const idx = cachedAddressesList.findIndex(a => a.id === id);
    if (idx === -1) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= cachedAddressesList.length) return;

    // Swap locally
    const temp = cachedAddressesList[idx];
    cachedAddressesList[idx] = cachedAddressesList[newIdx];
    cachedAddressesList[newIdx] = temp;

    const orderedIds = cachedAddressesList.map(a => a.id);
    try {
        const res = await fetch(`${API_BASE}/api/user/addresses/reorder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: orderedIds }),
            credentials: 'include'
        });
        if (res.ok) {
            fetchAddresses();
        }
    } catch (e) { console.error(e); }
}

// 5. Wishlist Tab
async function fetchWishlist() {
    const grid = document.getElementById('wishlistGrid');
    try {
        const res = await fetch(API_BASE + '/api/user/wishlist', { credentials: 'include' });
        const wishlist = await res.json();

        if (!wishlist.length) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; padding:3rem; color:var(--text-soft);">Your wishlist is empty.</p>';
            return;
        }

        grid.innerHTML = wishlist.map(p => {
            const imgUrl = p.imgUrl || p.imgurl || "";
            return `
            <div class="product-card" style="position: relative;">
                <i class="ph-fill ph-heart" style="position: absolute; top: 1rem; right: 1rem; font-size: 1.5rem; color: #EF4444; z-index: 2; cursor: pointer;" onclick="removeFromWishlist('${p.id}')"></i>
                <div class="product-img-container">
                    <img src="${imgUrl}" alt="${p.name}" class="product-img" onerror="this.src='https://images.unsplash.com/photo-1542838132-92c53300491e?w=300&text=Product'">
                </div>
                <div class="product-info">
                    <h4 class="product-title">${p.name}</h4>
                    <span class="product-weight">${p.weight}</span>
                    <div class="product-bottom">
                        <div class="price">
                            <span class="current-price">₹${p.price}</span>
                            ${p.originalPrice || p.originalprice ? `<span class="old-price">₹${p.originalPrice || p.originalprice}</span>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;}).join('');
        reRenderIcons();
    } catch (e) { console.error(e); }
}

window.removeFromWishlist = async function(pid) {
    try {
        await fetch(`${API_BASE}/api/user/wishlist/${pid}`, { method: 'DELETE', credentials: 'include' });
        Toast.show("Removed from favorites", "info");
        fetchWishlist();
        fetchOverview();
    } catch (e) { console.error(e); }
}

// 6. Coupons Tab
async function fetchCoupons() {
    const list = document.getElementById('couponList');
    if (!list) return;
    try {
        const res = await fetch(API_BASE + '/api/user/coupons', { credentials: 'include' });
        if (!res.ok) throw new Error("Failed to fetch coupons");
        const coupons = await res.json();

        if (!coupons || coupons.length === 0) {
            list.innerHTML = '<p style="grid-column:1/-1; text-align:center;">No coupons available right now.</p>';
            return;
        }

        list.innerHTML = coupons.map(c => `
            <div class="coupon-card dash-card ${c.used ? 'used' : ''}" style="border: 2px dashed ${c.used ? 'var(--border)' : 'var(--primary)'}; padding:1.25rem; position: relative;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
                    <span style="font-weight:700; color:${c.used ? 'var(--text-soft)' : 'var(--primary)'}; font-size:1.1rem; letter-spacing:1px;">${c.code || 'COUPON'}</span>
                    <i class="ph ph-copy" style="cursor:pointer;" onclick="!${c.used} && navigator.clipboard.writeText('${c.code}'); !${c.used} && Toast.show('Coupon Copied!', 'success');"></i>
                </div>
                <h4 style="margin-bottom:0.25rem;">${c.discount_type === 'percent' ? (c.discount_value || 0) + '% OFF' : '₹' + (c.discount_value || 0) + ' Cashback'}</h4>
                <p style="font-size:0.8rem; color:var(--text-soft);">${c.min_amount > 0 ? `Min. spend ₹${c.min_amount} | ` : ''}Valid until ${c.expiry_date ? new Date(c.expiry_date).toLocaleDateString() : 'Forever'}</p>
                ${c.used ? '<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-15deg); background: rgba(0,0,0,0.6); color: white; padding: 2px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: 800;">ALREADY USED</div>' : ''}
            </div>
        `).join('');
    } catch (e) {
        console.error(e);
        list.innerHTML = '<p style="grid-column:1/-1; text-align:center; color: #EF4444;">Error loading coupons. Please refresh.</p>';
    }
}

// 6b. Inquiries Tab
async function fetchInquiries() {
    const list = document.getElementById('inquiryList');
    try {
        const res = await fetch(API_BASE + '/api/user/inquiries', { credentials: 'include' });
        const items = await res.json();

        if (!items.length) {
            list.innerHTML = '<div style="text-align:center; padding:3rem;"><i class="ph ph-chat-circle-dots" style="font-size:3rem; color:var(--text-soft); margin-bottom:1rem; display:block;"></i><p>No support history found.</p></div>';
            return;
        }

        list.innerHTML = items.map(item => `
            <div class="dash-card">
                <div style="display:flex; justify-content:space-between; margin-bottom:1rem; border-bottom:1px solid var(--border); padding-bottom:0.75rem;">
                    <strong style="color:var(--primary);">${item.subject || 'Support Request'}</strong>
                    <small style="color:var(--text-soft);">${new Date(item.created_at).toLocaleDateString()}</small>
                </div>
                <div style="font-size:0.95rem; line-height:1.5; color:var(--text-main);">
                    <p style="margin-bottom:1rem;"><strong>Your Message:</strong><br>${item.message}</p>
                    ${item.reply ? `
                        <div style="background:var(--primary-light); padding:1rem; border-radius:8px; border-left:4px solid var(--primary); margin-top:1rem;">
                            <p style="color:var(--primary); font-weight:600; margin-bottom:0.5rem; display:flex; align-items:center; gap:0.5rem;">
                                <i class="ph ph-shield-check"></i> Admin Reply:
                            </p>
                            <p style="color:var(--text-main);">${item.reply}</p>
                        </div>
                    ` : `
                        <p style="font-style:italic; color:var(--text-soft); font-size:0.85rem; margin-top:1rem;">
                            <i class="ph ph-hourglass-simple"></i> Awaiting response from our team...
                        </p>
                    `}
                </div>
            </div>
        `).join('');
    } catch (e) { list.innerHTML = '<p>Error loading inquiries.</p>'; }
}

// 7. Profile Update
async function fetchProfile() {
    try {
        const res = await fetch(API_BASE + '/api/user/profile', { credentials: 'include' });
        const user = await res.json();
        fillProfileForm(user);
    } catch (e) { console.error(e); }
}

function fillProfileForm(user) {
    const form = document.getElementById('profileForm');
    form.full_name.value = user.full_name || '';
    form.email.value = user.email || '';
    form.phone.value = user.phone || '';
    form.alternate_phone.value = user.alternate_phone || '';
    form.gender.value = user.gender || '';
    form.dob.value = user.dob || '';
    form.profile_pic.value = user.profile_pic || '';
}

function setupForms() {
    // Profile Edit Submit
    const pForm = document.getElementById('profileForm');
    pForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const phone = pForm.phone.value.trim();
        const altPhone = pForm.alternate_phone.value.trim();

        // Validation
        if (phone && !/^\d{10}$/.test(phone)) {
            return Toast.show("Phone number must be exactly 10 digits", "error");
        }
        if (altPhone && !/^\d{10}$/.test(altPhone)) {
            return Toast.show("Alternate phone must be exactly 10 digits", "error");
        }

        const data = {
            full_name: pForm.full_name.value.trim(),
            email: pForm.email.value.trim(),
            phone: phone,
            alternate_phone: altPhone,
            gender: pForm.gender.value,
            dob: pForm.dob.value,
            profile_pic: pForm.profile_pic.value.trim()
        };

        try {
            const res = await fetch(API_BASE + '/api/user/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                credentials: 'include'
            });
            if (res.ok) {
                Toast.show("Profile updated successfully!", "success");
                // Sync updated data to cookies and localStorage for header greeting
                document.cookie = `full_name=${encodeURIComponent(data.full_name)}; path=/; max-age=31536000`;
                localStorage.setItem('user_full_name', data.full_name);
                
                if (typeof window.updateAuthUI === 'function') {
                    window.updateAuthUI(data.full_name);
                }
                fetchOverview();
            }
        } catch (e) { console.error(e); }
    });

    // Pincode to City Autofill Mapping
    const pinEl = document.getElementById('addrPincode');
    const cityEl = document.getElementById('addrCity');
    if (pinEl && cityEl) {
        const updateCityFromPincode = async () => {
            const pinVal = pinEl.value.trim();
            if (pinVal.length === 6) {
                try {
                    const res = await fetch(`${API_BASE}/api/settings?t=` + Date.now(), { cache: 'no-store' });
                    if (res.ok) {
                        const settings = await res.json();
                        if (settings && settings.allowed_pincodes) {
                            const allowedItems = settings.allowed_pincodes.split(',').map(p => p.trim()).filter(p => p.length > 0);
                            const match = allowedItems.find(item => item.split('-')[0].trim() === pinVal);
                            if (match) {
                                const parts = match.split('-');
                                if (parts[1]) {
                                    cityEl.value = parts[1].trim();
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error("Autofill check failed", e);
                }
            }
        };
        pinEl.addEventListener('input', updateCityFromPincode);
        pinEl.addEventListener('change', updateCityFromPincode);
    }

    // Detect My Coordinates Button
    const detectBtn = document.getElementById('getCurrentLocationBtn');
    if (detectBtn) {
        detectBtn.addEventListener('click', () => {
            if (!navigator.geolocation) {
                return Toast.show("Geolocation not supported", "error");
            }
            detectBtn.disabled = true;
            detectBtn.innerHTML = '<i class="ph ph-spinner animate-spin"></i> Detecting...';
            navigator.geolocation.getCurrentPosition(async (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                document.getElementById('addrLat').value = lat;
                document.getElementById('addrLng').value = lng;
                
                initMapAtCoords(lat, lng);

                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
                        headers: { 'Accept-Language': 'en' }
                    });
                    const data = await response.json();
                    if (data.address) {
                        const building = data.address.building || data.address.amenity || data.address.house_number || '';
                        const road = data.address.road || '';
                        const suburb = data.address.suburb || data.address.neighbourhood || '';
                        const city = data.address.city || data.address.town || data.address.village || '';
                        const pincode = data.address.postcode || '';
                        
                        let addrLine = '';
                        if (building) addrLine += building + ', ';
                        if (road) addrLine += road + ', ';
                        if (suburb) addrLine += suburb;
                        addrLine = addrLine.replace(/,\s*$/, "");
                        
                        if (addrLine) document.getElementById('addrLine').value = addrLine;
                        if (city) document.getElementById('addrCity').value = city;
                        if (pincode) {
                            document.getElementById('addrPincode').value = pincode;
                            document.getElementById('addrPincode').dispatchEvent(new Event('input'));
                        }
                    }
                } catch (e) {
                    console.error(e);
                }
                detectBtn.disabled = false;
                detectBtn.innerHTML = '<i class="ph ph-gps"></i> Detect My Coordinates';
            }, (err) => {
                console.error(err);
                Toast.show("Failed to get geolocation", "error");
                detectBtn.disabled = false;
                detectBtn.innerHTML = '<i class="ph ph-gps"></i> Detect My Coordinates';
            });
        });
    }

    // Address Modal Submit
    const aForm = document.getElementById('addressForm');
    aForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('addressIdInput').value;
        const data = {
            label: aForm.label.value,
            address_line: aForm.address_line.value.trim(),
            city: aForm.city.value.trim(),
            pincode: aForm.pincode.value.trim(),
            landmark: aForm.landmark.value.trim(),
            floor_number: aForm.floor_number.value.trim(),
            apartment_name: aForm.apartment_name.value.trim(),
            delivery_instructions: aForm.delivery_instructions.value,
            contact_person: aForm.contact_person.value.trim(),
            phone_number: aForm.phone_number.value.trim(),
            latitude: parseFloat(aForm.latitude.value) || null,
            longitude: parseFloat(aForm.longitude.value) || null,
            entrance_latitude: parseFloat(aForm.entrance_latitude.value) || null,
            entrance_longitude: parseFloat(aForm.entrance_longitude.value) || null,
            entrance_type: aForm.entrance_type.value,
            photo_url: aForm.photo_url.value.trim(),
            is_default: aForm.is_default.checked ? 1 : 0,
            is_favorite: aForm.is_favorite.checked ? 1 : 0,
            is_shared: aForm.is_shared.checked ? 1 : 0
        };

        if (!data.address_line || !data.city || !data.pincode) {
            return Toast.show("Please fill all required fields", "error");
        }

        try {
            // Pincode restriction validation
            const settingsRes = await fetch(`${API_BASE}/api/settings?t=` + Date.now(), { cache: 'no-store' });
            if (settingsRes.ok) {
                const settings = await settingsRes.json();
                if (settings && settings.allowed_pincodes && settings.allowed_pincodes.trim().length > 0) {
                    const allowedArray = settings.allowed_pincodes.split(',').map(p => p.trim()).filter(p => p.length > 0);
                    if (allowedArray.length > 0 && !allowedArray.includes(data.pincode)) {
                        return Toast.show(`Delivery not available in your area (Pincode: ${data.pincode}).`, "error");
                    }
                }
            }

            const url = id ? `${API_BASE}/api/user/addresses/${id}` : `${API_BASE}/api/user/addresses`;
            const method = id ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                credentials: 'include'
            });
            
            const result = await res.json();
            
            if (res.ok) {
                Toast.show(id ? "Address updated successfully!" : "Address added successfully!", "success");
                toggleModal('addressModalOverlay', false);
                aForm.reset();
                fetchAddresses();
                fetchOverview();
            } else {
                Toast.show(result.error || "Failed to save address", "error");
            }
        } catch (e) { 
            console.error(e);
            Toast.show("Connection error. Please try again.", "error");
        }
    });
}

// Sidebar logic (Partial duplicate to avoid index.html dependency)
function setupModals() {
    const overlay = document.getElementById('addressModalOverlay');
    const closeBtn = document.getElementById('closeAddressModal');
    
    closeBtn.onclick = () => toggleModal('addressModalOverlay', false);
    overlay.onclick = (e) => { if(e.target === overlay) toggleModal('addressModalOverlay', false); };
}

let googleMapInstance = null;
let googleMarker = null;
let googleEntranceMarker = null;
let showingEntranceMarker = false;

function loadGoogleMapsScript(callback) {
    if (window.google && window.google.maps) {
        if (callback) callback();
        return;
    }
    const script = document.createElement('script');
    const apiKey = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GOOGLE_MAPS_API_KEY) || '';
    const keyParam = apiKey ? `&key=${apiKey}` : '';
    script.src = `https://maps.googleapis.com/maps/api/js?callback=initProfileMap${keyParam}`;
    script.async = true;
    script.defer = true;
    window.initProfileMap = () => {
        if (callback) callback();
    };
    script.onerror = () => {
        console.error("Failed to load Google Maps SDK.");
    };
    document.head.appendChild(script);
}

function initMapAtCoords(lat, lng) {
    const mapDiv = document.getElementById('addressPickerMap');
    const entranceBtn = document.getElementById('entrancePinBtn');
    if (!mapDiv) return;
    mapDiv.style.display = 'block';
    if (entranceBtn) entranceBtn.style.display = 'block';

    loadGoogleMapsScript(() => {
        const myLatLng = { lat: parseFloat(lat || 14.4426), lng: parseFloat(lng || 79.9865) };
        googleMapInstance = new google.maps.Map(mapDiv, {
            center: myLatLng,
            zoom: 16,
            mapTypeControl: false,
            streetViewControl: false
        });

        googleMarker = new google.maps.Marker({
            position: myLatLng,
            map: googleMapInstance,
            draggable: true,
            title: "Drag to set delivery location"
        });

        googleMarker.addListener('dragend', async () => {
            const pos = googleMarker.getPosition();
            document.getElementById('addrLat').value = pos.lat();
            document.getElementById('addrLng').value = pos.lng();
            
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.lat()}&lon=${pos.lng()}`, {
                    headers: { 'Accept-Language': 'en' }
                });
                const data = await response.json();
                if (data.address) {
                    const building = data.address.building || data.address.amenity || data.address.house_number || '';
                    const road = data.address.road || '';
                    const suburb = data.address.suburb || data.address.neighbourhood || '';
                    const city = data.address.city || data.address.town || data.address.village || '';
                    const pincode = data.address.postcode || '';
                    
                    let addrLine = '';
                    if (building) addrLine += building + ', ';
                    if (road) addrLine += road + ', ';
                    if (suburb) addrLine += suburb;
                    addrLine = addrLine.replace(/,\s*$/, "");
                    
                    if (addrLine) document.getElementById('addrLine').value = addrLine;
                    if (city) document.getElementById('addrCity').value = city;
                    if (pincode) document.getElementById('addrPincode').value = pincode;
                }
            } catch (err) {
                console.error("Drag reverse geocode error:", err);
            }
        });
    });
}

window.toggleEntrancePin = function() {
    if (!googleMapInstance) return;
    showingEntranceMarker = !showingEntranceMarker;
    const btn = document.getElementById('entrancePinBtn');
    if (showingEntranceMarker) {
        if (btn) btn.innerHTML = '<i class="ph ph-check-circle"></i> Remove Entrance Pin';
        if (btn) btn.style.borderColor = '#10B981';
        const center = googleMapInstance.getCenter();
        googleEntranceMarker = new google.maps.Marker({
            position: center,
            map: googleMapInstance,
            draggable: true,
            icon: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png',
            title: "Drag to mark exact gate/lobby entrance"
        });
        
        document.getElementById('addrEntranceLat').value = center.lat();
        document.getElementById('addrEntranceLng').value = center.lng();

        googleEntranceMarker.addListener('dragend', () => {
            const pos = googleEntranceMarker.getPosition();
            document.getElementById('addrEntranceLat').value = pos.lat();
            document.getElementById('addrEntranceLng').value = pos.lng();
        });
        Toast.show("Drag the green pin to mark your gate/lobby entrance", "info");
    } else {
        if (btn) btn.innerHTML = '<i class="ph ph-door"></i> Mark Entrance Pin on Map';
        if (btn) btn.style.borderColor = 'var(--border)';
        if (googleEntranceMarker) {
            googleEntranceMarker.setMap(null);
            googleEntranceMarker = null;
        }
        document.getElementById('addrEntranceLat').value = '';
        document.getElementById('addrEntranceLng').value = '';
    }
}

function openAddressModal() {
    toggleModal('addressModalOverlay', true);
}

function toggleModal(id, show) {
    const el = document.getElementById(id);
    if(show) el.classList.add('active');
    else el.classList.remove('active');
}

// Global functions
window.openAddressModal = function() {
    const el = document.getElementById('addressModalOverlay');
    if (el) el.classList.add('active');
    
    document.getElementById('addressModalTitle').innerText = "Add New Address";
    document.getElementById('addressForm').reset();
    document.getElementById('addressIdInput').value = '';
    
    document.getElementById('addressPickerMap').style.display = 'none';
    document.getElementById('entrancePinBtn').style.display = 'none';
    
    showingEntranceMarker = false;
    if (googleEntranceMarker) {
        googleEntranceMarker.setMap(null);
        googleEntranceMarker = null;
    }
    const btn = document.getElementById('entrancePinBtn');
    if (btn) {
        btn.innerHTML = '<i class="ph ph-door"></i> Mark Entrance Pin on Map';
        btn.style.borderColor = 'var(--border)';
    }
};

window.editAddress = function(id) {
    const addr = cachedAddressesList.find(a => a.id === id);
    if (!addr) return;

    const el = document.getElementById('addressModalOverlay');
    if (el) el.classList.add('active');

    document.getElementById('addressModalTitle').innerText = "Edit Address";
    
    document.getElementById('addressIdInput').value = addr.id;
    document.getElementById('addrLabel').value = addr.label || 'Home';
    document.getElementById('addrLine').value = addr.address_line || '';
    document.getElementById('addrCity').value = addr.city || '';
    document.getElementById('addrPincode').value = addr.pincode || '';
    document.getElementById('addrLandmark').value = addr.landmark || '';
    document.getElementById('addrFloor').value = addr.floor_number || '';
    document.getElementById('addrApartment').value = addr.apartment_name || '';
    document.getElementById('addrInstructions').value = addr.delivery_instructions || 'None';
    document.getElementById('addrContactPerson').value = addr.contact_person || '';
    document.getElementById('addrPhone').value = addr.phone_number || '';
    document.getElementById('addrPhoto').value = addr.photo_url || '';
    document.getElementById('addrEntranceType').value = addr.entrance_type || 'Main Gate';
    
    document.getElementById('defAddr').checked = addr.is_default === 1;
    document.getElementById('favAddr').checked = addr.is_favorite === 1;
    document.getElementById('sharedAddr').checked = addr.is_shared === 1;

    document.getElementById('addrLat').value = addr.latitude || '';
    document.getElementById('addrLng').value = addr.longitude || '';
    document.getElementById('addrEntranceLat').value = addr.entrance_latitude || '';
    document.getElementById('addrEntranceLng').value = addr.entrance_longitude || '';

    // Load map with the existing address coordinates
    const lat = addr.latitude || 14.4426;
    const lng = addr.longitude || 79.9865;
    initMapAtCoords(lat, lng);

    showingEntranceMarker = false;
    if (addr.entrance_latitude && addr.entrance_longitude) {
        showingEntranceMarker = true;
        const btn = document.getElementById('entrancePinBtn');
        if (btn) {
            btn.innerHTML = '<i class="ph ph-check-circle"></i> Remove Entrance Pin';
            btn.style.borderColor = '#10B981';
        }
        setTimeout(() => {
            if (googleMapInstance) {
                googleEntranceMarker = new google.maps.Marker({
                    position: { lat: parseFloat(addr.entrance_latitude), lng: parseFloat(addr.entrance_longitude) },
                    map: googleMapInstance,
                    draggable: true,
                    icon: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png',
                    title: "Drag to mark exact gate/lobby entrance"
                });
                googleEntranceMarker.addListener('dragend', () => {
                    const pos = googleEntranceMarker.getPosition();
                    document.getElementById('addrEntranceLat').value = pos.lat();
                    document.getElementById('addrEntranceLng').value = pos.lng();
                });
            }
        }, 1000);
    }
};

window.setDefaultAddress = async (id) => {
    try {
        const res = await fetch(`${API_BASE}/api/user/addresses/${id}/default`, { method: 'PATCH', credentials: 'include' });
        if (res.ok) {
            Toast.show("Default address updated!", "success");
            fetchAddresses();
        }
    } catch (e) { console.error(e); }
};

// Utilities
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

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
        const usernameCookie = getCookie('username');
        const displayName = name && name !== 'undefined' ? decodeURIComponent(name) : (usernameCookie ? decodeURIComponent(usernameCookie) : 'User');

        if (displayName) {
            if (sidebarUsername) sidebarUsername.innerText = displayName;
            if (sidebarLogout) sidebarLogout.style.display = 'flex';
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
                await fetch(API_BASE + '/api/auth/logout', { method: 'POST', credentials: 'include' });
                // Clear all auth cookies
                document.cookie = "full_name=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                document.cookie = "username=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                document.cookie = "user_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                // Clear localStorage fallbacks
                localStorage.removeItem('user_full_name');
                localStorage.removeItem('user_username');
                localStorage.removeItem('user_id');
                location.href = "/";
            }
        });
    }

    // Wiring links that change tabs directly
    const navLinks = sidebar.querySelectorAll('.nav-item');
    navLinks.forEach(link => {
        if (link.id && link.id.startsWith('nav-')) {
            link.addEventListener('click', (e) => {
                if (link.href.includes('profile.html?tab=')) {
                    e.preventDefault();
                    const tabId = link.href.split('tab=')[1];
                    if (window.switchTab) window.switchTab(tabId);
                    closeNav();
                } else if (link.id !== 'nav-tracking') {
                    closeNav();
                }
            });
        }
    });
}

function reRenderIcons() {
    // Phosphor 2.x uses CSS classes, no replacement script needed.
    if (window.phosphor && typeof window.phosphor.replace === 'function') {
        window.phosphor.replace();
    }
}

// ==========================================================================
// CUSTOMER DISPUTE & EVIDENCE VIEWER SYSTEM
// ==========================================================================

let activeDisputeOrderId = null;
let custUnboxingPhotoBase64 = null;

window.openCustomerDisputeModal = function(orderId) {
    activeDisputeOrderId = orderId;
    custUnboxingPhotoBase64 = null;
    document.getElementById('custDisputeModalTitle').innerText = `Report Issue for Order #${orderId}`;
    document.getElementById('custDisputeDesc').value = '';
    document.getElementById('custUnboxingPhotoInput').value = '';
    document.getElementById('custUnboxingPreviewBox').style.display = 'none';
    document.getElementById('custUnboxingImg').src = '';
    document.getElementById('custDisputeModal').style.display = 'flex';
};

window.closeCustDisputeModal = function() {
    document.getElementById('custDisputeModal').style.display = 'none';
};

window.handleCustUnboxingPhotoSelected = function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        custUnboxingPhotoBase64 = evt.target.result;
        document.getElementById('custUnboxingImg').src = custUnboxingPhotoBase64;
        document.getElementById('custUnboxingPreviewBox').style.display = 'block';
    };
    reader.readAsDataURL(file);
};

window.submitCustDispute = async function() {
    if (!activeDisputeOrderId) return;
    const reasonCode = document.getElementById('custDisputeReason').value;
    const desc = document.getElementById('custDisputeDesc').value;
    const submitBtn = document.getElementById('submitCustDisputeBtn');

    submitBtn.disabled = true;
    submitBtn.innerText = 'Submitting Claim...';

    try {
        const res = await fetch(`${API_BASE}/api/user/orders/${activeDisputeOrderId}/dispute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                reason_code: reasonCode,
                description: desc,
                customer_unboxing_photo: custUnboxingPhotoBase64
            })
        });
        const data = await res.json();

        if (res.ok) {
            alert(`✅ Discrepancy Claim Submitted!\n\nYour claim for Order #${activeDisputeOrderId} has been logged. The vendor's packing evidence photo and checklist have been auto-linked to support.`);
            closeCustDisputeModal();
            fetchOrders();
        } else {
            alert(data.error || "Failed to submit dispute claim");
        }
    } catch(err) {
        console.error(err);
        alert("Network error while submitting dispute claim");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Submit Discrepancy Claim';
    }
};

window.viewCustomerEvidence = async function(orderId) {
    const modal = document.getElementById('custEvidenceModal');
    const body = document.getElementById('custEvidenceModalBody');
    modal.style.display = 'flex';
    body.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-soft);">Loading verification evidence...</div>';

    try {
        const res = await fetch(`${API_BASE}/api/user/orders/${orderId}/evidence`, { credentials: 'include' });
        const data = await res.json();

        if (!res.ok) {
            body.innerHTML = `<div style="padding: 2rem; text-align: center; color: #EF4444;">${data.error || 'Failed to load evidence'}</div>`;
            return;
        }

        const itemsHtml = (data.packing_checklist || []).map(idx => `<div style="font-size:0.8rem; padding:4px 8px; background:var(--bg-main); border-radius:6px; border:1px solid var(--border);">✔️ Verified Item #${idx + 1}</div>`).join('');

        body.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                <div style="background: var(--bg-main); padding: 1rem; border-radius: 12px; border: 1px solid var(--border);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <h4 style="margin:0; font-size:0.95rem; color:var(--text-main);"><i class="ph ph-camera" style="color:#10B981;"></i> Vendor Packing Photo</h4>
                        ${data.is_tamper_sealed ? '<span style="font-size: 0.7rem; background: #DCFCE7; color: #166534; padding: 2px 8px; border-radius: 12px; font-weight: 700;">🔒 Tamper-Proof Sealed</span>' : ''}
                    </div>
                    ${data.packing_photo ? `
                        <div style="border-radius: 10px; overflow: hidden; border: 1px solid var(--border); max-height: 220px;">
                            <img src="${data.packing_photo}" style="width: 100%; height: 200px; object-fit: cover;">
                        </div>
                        <div style="font-size: 0.72rem; color: var(--text-soft); margin-top: 6px; font-family: monospace;">
                            ${data.packing_geo || ''} | Packed: ${data.packed_at ? new Date(data.packed_at).toLocaleString() : 'N/A'}
                        </div>
                    ` : '<div style="padding:1rem; text-align:center; color:var(--text-soft);">No packing photo uploaded</div>'}
                </div>

                ${data.delivery_otp ? `
                    <div style="background: #EFF6FF; border: 1px solid #BFDBFE; padding: 0.75rem 1rem; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size:0.85rem; font-weight:700; color:#1E40AF;">Your Delivery OTP:</span>
                        <strong style="font-size: 1.3rem; letter-spacing: 2px; color: #1D4ED8;">${data.delivery_otp}</strong>
                    </div>
                ` : ''}
            </div>
        `;
    } catch(err) {
        body.innerHTML = `<div style="padding: 2rem; text-align: center; color: #EF4444;">Error loading evidence</div>`;
    }
};

window.closeCustEvidenceModal = function() {
    document.getElementById('custEvidenceModal').style.display = 'none';
};

let trackingInterval = null;
let trackingMapInstance = null;
let trackingStoreMarker = null;
let trackingCustomerMarker = null;
let trackingRiderMarker = null;
let trackingRouteLine = null;

window.openOrderTrackingModal = function(id) {
    const modal = document.getElementById('orderTrackingModalOverlay');
    if (modal) modal.classList.add('active');

    // Bind close
    const closeBtn = document.getElementById('closeOrderTrackingModal');
    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.classList.remove('active');
            if (trackingInterval) {
                clearInterval(trackingInterval);
                trackingInterval = null;
            }
            // Clean map instance
            trackingMapInstance = null;
        };
    }

    // Start live tracking loop
    pollTrackingInfo(id);
    trackingInterval = setInterval(() => pollTrackingInfo(id), 3000);
};

async function pollTrackingInfo(id) {
    try {
        const res = await fetch(`${API_BASE}/api/orders/${id}/tracking`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();

        // Update UI Text
        document.getElementById('trackingStoreName').innerText = data.shop_name || 'Store';
        document.getElementById('trackingStatusText').innerText = data.status;
        document.getElementById('trackingETA').innerText = data.eta_minutes;
        document.getElementById('trackingWeather').innerText = data.weather_condition;
        document.getElementById('trackingTraffic').innerText = data.traffic_condition;

        // Weather icon
        const weatherIcon = document.getElementById('trackingWeatherIcon');
        if (weatherIcon) {
            weatherIcon.className = data.weather_condition === 'sunny' ? 'ph-fill ph-sun' : (data.weather_condition === 'rainy' ? 'ph-fill ph-cloud-rain' : 'ph-fill ph-cloud-lightning');
            weatherIcon.style.color = data.weather_condition === 'sunny' ? '#F59E0B' : '#6B7280';
        }

        // Traffic icon
        const trafficIcon = document.getElementById('trackingTrafficIcon');
        if (trafficIcon) {
            trafficIcon.className = data.traffic_condition === 'clear' ? 'ph-fill ph-smiley' : (data.traffic_condition === 'moderate' ? 'ph-fill ph-car' : 'ph-fill ph-warning-circle');
            trafficIcon.style.color = data.traffic_condition === 'clear' ? '#10B981' : (data.traffic_condition === 'moderate' ? '#F59E0B' : '#EF4444');
        }

        // Info card (entrance & status checks)
        const infoCard = document.getElementById('trackingInfoCard');
        if (infoCard) {
            if (data.status === 'out_for_delivery' || data.status === 'delivered') {
                infoCard.style.display = 'flex';
                const entranceText = document.getElementById('trackingEntranceType');
                if (entranceText) entranceText.innerText = data.entrance_type || 'Main Gate';
            } else {
                infoCard.style.display = 'none';
            }
        }

        // Draw Map
        const mapDiv = document.getElementById('trackingMap');
        if (mapDiv) {
            loadGoogleMapsScript(() => {
                const storeLatLng = { lat: parseFloat(data.shop_latitude || 14.4426), lng: parseFloat(data.shop_longitude || 79.9865) };
                const customerLatLng = { lat: parseFloat(data.delivery_lat || 14.4455), lng: parseFloat(data.delivery_lng || 79.9822) };
                const riderLatLng = { lat: parseFloat(data.delivery_partner_lat || storeLatLng.lat), lng: parseFloat(data.delivery_partner_lng || storeLatLng.lng) };

                // Initialize Map once
                if (!trackingMapInstance) {
                    trackingMapInstance = new google.maps.Map(mapDiv, {
                        center: riderLatLng,
                        zoom: 15,
                        mapTypeControl: false,
                        streetViewControl: false
                    });

                    // Store Marker
                    trackingStoreMarker = new google.maps.Marker({
                        position: storeLatLng,
                        map: trackingMapInstance,
                        icon: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
                        title: data.shop_name
                    });

                    // Customer Marker
                    trackingCustomerMarker = new google.maps.Marker({
                        position: customerLatLng,
                        map: trackingMapInstance,
                        icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                        title: "Your Location"
                    });

                    // Rider Marker
                    trackingRiderMarker = new google.maps.Marker({
                        position: riderLatLng,
                        map: trackingMapInstance,
                        icon: 'http://maps.google.com/mapfiles/ms/icons/cycling.png',
                        title: "Delivery Partner"
                    });

                    // Draw Route Polyline
                    const routeCoordinates = data.route_coordinates || [storeLatLng, customerLatLng];
                    trackingRouteLine = new google.maps.Polyline({
                        path: routeCoordinates,
                        geodesic: true,
                        strokeColor: '#4F46E5',
                        strokeOpacity: 0.8,
                        strokeWeight: 4,
                        map: trackingMapInstance
                    });
                } else {
                    // Update Rider position dynamically
                    if (trackingRiderMarker) trackingRiderMarker.setPosition(riderLatLng);
                    trackingMapInstance.setCenter(riderLatLng);
                }

                // If delivered, stop tracking and reload order list
                if (data.status === 'delivered') {
                    if (trackingInterval) {
                        clearInterval(trackingInterval);
                        trackingInterval = null;
                    }
                    Toast.show("🎉 Your order has been delivered!", "success");
                    fetchOrders();
                }
            });
        }
    } catch (e) {
        console.error("Live tracking polling error:", e);
    }
}
