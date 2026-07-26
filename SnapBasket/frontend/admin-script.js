/**
 * ADYANTA Admin Panel Script
 * Consolidated & Fixed Integration
 */
const API_BASE = (typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) 
    ? import.meta.env.VITE_API_URL 
    : (typeof window !== 'undefined' && window.location && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:3000' : 'https://adyanta.onrender.com');

let currentAdmin = null;
let revenueChart = null;
let tempVariants = [];
let currentEditVariants = [];
let currentPortalRole = 'super_admin';

// Cookie Helper
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

// Helper for cross-origin authenticated requests
async function adminFetch(url, options = {}) {
    options.credentials = 'include';
    return fetch(url, options);
}

// Switch between Super Admin and Vendor access portals
function switchPortalRole(role) {
    const userRole = getCookie('role');
    const username = getCookie('username');
    const isSuresh = userRole === 'super_admin' && username === '9490229108';

    if (role === 'super_admin' && !isSuresh) {
        alert("Access Denied: Only Suresh is authorized to access the Super Admin Panel.");
        currentPortalRole = 'vendor';
        localStorage.setItem('admin_portal_role', 'vendor');
        const roleSelector = document.getElementById('portalRoleSelector');
        if (roleSelector) {
            roleSelector.value = 'vendor';
            roleSelector.disabled = true;
            const container = document.getElementById('roleSelectorContainer');
            if (container) container.style.display = 'none';
        }
        renderSidebarForRole('vendor');
        showSection('view-vendor-dashboard');
        return;
    }

    currentPortalRole = role;
    localStorage.setItem('admin_portal_role', role);
    renderSidebarForRole(role);
    
    const defaultSection = role === 'super_admin' ? 'view-dashboard' : 'view-vendor-dashboard';
    showSection(defaultSection);
}

// Dynamically render sidebar items based on current portal role
function renderSidebarForRole(role) {
    const menu = document.querySelector('.sidebar-menu');
    if (!menu) return;
    
    if (role === 'super_admin') {
        menu.innerHTML = `
            <li onclick="showSection('view-dashboard')"><i class="ph ph-chart-pie"></i> Dashboard Overview</li>
            <li onclick="showSection('view-feature-switchboard')"><i class="ph ph-toggle-left"></i> Feature Switchboard</li>
            <li onclick="showSection('view-vendor-approvals')"><i class="ph ph-seal-check"></i> Vendor KYC Approvals</li>
            <li onclick="showSection('view-orders')"><i class="ph ph-receipt"></i> Global Orders</li>
            <li onclick="showSection('view-products')"><i class="ph ph-package"></i> Global Products</li>
            <li onclick="showSection('view-notifications')"><i class="ph ph-bell"></i> Push Notifications</li>
            <li onclick="showSection('view-promo')"><i class="ph ph-presentation"></i> Promotional Ads</li>
            <li onclick="showSection('view-categories')"><i class="ph ph-list-bullets"></i> Product Categories</li>
            <li onclick="showSection('view-brands')"><i class="ph ph-copyright"></i> Brand Partners</li>
            <li onclick="showSection('view-inquiries')"><i class="ph ph-chat-circle-text"></i> Customer Inquiries</li>
            <li onclick="showSection('view-reviews')"><i class="ph ph-star-half"></i> Product Reviews</li>
            <li onclick="showSection('view-payment')"><i class="ph ph-currency-circle-dollar"></i> Payment Tracking</li>
            <li onclick="showSection('view-cancelled-orders')"><i class="ph ph-prohibit"></i> Cancelled Payments</li>
            <li onclick="showSection('view-users')"><i class="ph ph-users"></i> Manage Users</li>
            <li onclick="showSection('view-coupons')"><i class="ph ph-ticket"></i> Global & Shop Coupons</li>
            <li onclick="showSection('view-loyalty')"><i class="ph ph-coins"></i> Loyalty Program</li>
            <li onclick="showSection('view-settings')"><i class="ph ph-gear"></i> App Settings</li>
            <li onclick="showSection('view-orders', true)"><i class="ph ph-truck"></i> Manage Delivery</li>
            <li><a href="/" style="text-decoration: none; color: inherit; display: flex; align-items: center; gap: 0.5rem;"><i class="ph ph-storefront"></i> View Store</a></li>
            <li onclick="adminLogout()" style="margin-top: 2rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1.5rem; color: #FDA4AF;"><i class="ph ph-sign-out"></i> Admin Logout</li>
        `;
    } else if (role === 'vendor') {
        menu.innerHTML = `
            <li onclick="showSection('view-vendor-dashboard')"><i class="ph ph-chart-pie"></i> Store Dashboard</li>
            <li onclick="showSection('view-vendor-shop')"><i class="ph ph-storefront"></i> Customize storefront</li>
            <li onclick="showSection('view-vendor-notifications')"><i class="ph ph-bell"></i> Notifications</li>
            <li onclick="showSection('view-vendor-special-offers')"><i class="ph ph-gift"></i> Special Offers</li>
            <li onclick="showSection('view-products')"><i class="ph ph-package"></i> Manage Products</li>
            <li onclick="showSection('view-orders')"><i class="ph ph-receipt"></i> Recent Orders</li>
            <li onclick="showSection('view-vendor-wallet')"><i class="ph ph-wallet"></i> Wallet & Payouts</li>
            <li onclick="showSection('view-coupons')"><i class="ph ph-ticket"></i> Shop Coupons</li>
            <li onclick="showSection('view-reviews')"><i class="ph ph-star-half"></i> Store Reviews</li>
            <li onclick="showSection('view-inquiries')"><i class="ph ph-chat-circle-text"></i> Customer Inquiries</li>
            <li onclick="showSection('view-orders', true)"><i class="ph ph-truck"></i> Manage Delivery</li>
            <li><a href="/" style="text-decoration: none; color: inherit; display: flex; align-items: center; gap: 0.5rem;"><i class="ph ph-storefront"></i> View Store</a></li>
            <li onclick="adminLogout()" style="margin-top: 2rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1.5rem; color: #FDA4AF;"><i class="ph ph-sign-out"></i> Vendor Logout</li>
        `;
    }
}

// --- GLOBAL EXPORTS FOR HTML ---
window.getCookie = getCookie;
window.switchPortalRole = switchPortalRole;
window.toggleAdminSidebar = toggleAdminSidebar;
window.showSection = showSection;
window.adminLogout = adminLogout;
window.fetchDashboardStats = (d) => fetchDashboardStats(d);
window.copyHealthSql = () => {
    const sql = document.getElementById('healthWarningSql').innerText;
    navigator.clipboard.writeText(sql);
    if (window.Toast) window.Toast.show('SQL copied to clipboard');
};
window.addVariantToTempList = addVariantToTempList;
window.loadProductForQuickVariants = loadProductForQuickVariants;
window.addQuickVariant = addQuickVariant;
window.saveQuickVariants = saveQuickVariants;
window.closeQuickVariantEditor = closeQuickVariantEditor;
window.fetchAdminProducts = fetchAdminProducts;
window.fetchNotificationsHistory = fetchNotificationsHistory;
window.clearAllNotifications = clearAllNotifications;
window.fetchOrders = (s, d) => fetchOrders(s, d);
window.fetchPaymentHistory = fetchPaymentHistory;
window.fetchMessages = fetchMessages;
window.fetchAdminReviews = fetchAdminReviews;
window.fetchUsers = fetchUsers;
window.addVariantToEditList = addVariantToEditList;
window.removeVariant = removeVariant;
window.toggleProductField = toggleProductField;
window.openEditModal = openEditModal;
window.deleteProduct = deleteProduct;
window.updatePaymentStatus = updatePaymentStatus;
window.updateOrderStatus = updateOrderStatus;
window.clearDashboardDate = () => {
    const picker = document.querySelector('.global-date-filter input');
    if (picker) {
        picker.value = '';
        fetchDashboardStats('');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    checkInitialAuth();
    setupEventListeners();
});

// --- AUTHENTICATION ---

async function checkInitialAuth() {
    const userRole = getCookie('role');
    const username = getCookie('username');

    // Restrict access: Only Suresh (super_admin) or Vendors can access the admin panel page
    const isSuresh = userRole === 'super_admin' && username === '9490229108';
    const isVendor = userRole === 'vendor';

    if (!isSuresh && !isVendor) {
        alert("Access Denied: You do not have permissions to access the Admin Panel.");
        window.location.href = 'login.html';
        return;
    }

    const overlay = document.getElementById('adminLoginOverlay');
    const main = document.getElementById('adminLayoutMain');

    if (overlay) overlay.style.display = 'none';
    if (main) main.style.display = 'flex';
    
    // Multi-Vendor Role Setup
    const roleSelector = document.getElementById('portalRoleSelector');
    
    if (isVendor) {
        currentPortalRole = 'vendor';
        localStorage.setItem('admin_portal_role', 'vendor');
        if (roleSelector) {
            roleSelector.value = 'vendor';
            roleSelector.disabled = true;
            const container = document.getElementById('roleSelectorContainer');
            if (container) container.style.display = 'none';
        }
    } else if (isSuresh) {
        const lastSavedRole = localStorage.getItem('admin_portal_role') || 'super_admin';
        currentPortalRole = lastSavedRole;
        if (roleSelector) {
            roleSelector.value = lastSavedRole;
            const container = document.getElementById('roleSelectorContainer');
            if (container) container.style.display = 'block';
        }
    }
    
    renderSidebarForRole(currentPortalRole);
    initDashboard();
}

function setAuthMode(mode) {
    const title = document.getElementById('adminAuthTitle');
    const desc = document.getElementById('adminAuthDesc');
    const nameField = document.getElementById('adminFullName');
    const phoneField = document.getElementById('adminPhone');
    const passField = document.getElementById('adminPassword');
    const confirmField = document.getElementById('adminConfirmPasswordField');
    const securityFields = document.getElementById('adminSecurityFields');
    const btn = document.getElementById('adminSubmitBtn');
    const forgotBtn = document.getElementById('adminForgotBtn');
    const backBtn = document.getElementById('adminBackToLoginBtn');

    // Reset visibility
    [nameField, phoneField, passField.parentElement, confirmField, securityFields, forgotBtn, backBtn].forEach(el => {
        if (el) el.style.display = 'none';
    });

    if (mode === 'setup') {
        title.innerHTML = '<i class="ph ph-shield-plus"></i> Admin Setup';
        desc.innerText = 'Create master credentials to secure panel.';
        nameField.style.display = 'block';
        phoneField.style.display = 'block';
        passField.parentElement.style.display = 'block';
        confirmField.style.display = 'block';
        securityFields.style.display = 'block';
        btn.innerText = 'Save Credentials';
    } else if (mode === 'login') {
        title.innerHTML = '<i class="ph ph-shield-check"></i> Admin Login';
        desc.innerText = 'Enter credentials to access dashboard.';
        nameField.style.display = 'block';
        phoneField.style.display = 'block';
        passField.parentElement.style.display = 'block';
        btn.innerText = 'Login to Panel';
        forgotBtn.style.display = 'inline-block';
    } else if (mode === 'recover') {
        title.innerHTML = '<i class="ph ph-shield-warning"></i> Reset Password';
        desc.innerText = 'Answer security questions to reset.';
        phoneField.style.display = 'block';
        securityFields.style.display = 'block';
        document.getElementById('adminNewPasswordWrapper').style.display = 'block';
        btn.innerText = 'Reset Password';
        backBtn.style.display = 'inline-block';
    }
    
    btn.onclick = () => handleAuthSubmit(mode);
}

async function handleAuthSubmit(mode) {
    const payload = {
        full_name: document.getElementById('adminFullName').value,
        phone: document.getElementById('adminPhone').value,
        password: document.getElementById('adminPassword').value
    };

    if (mode === 'setup') {
        payload.security_q1 = document.getElementById('adminQ1').value;
        payload.security_a1 = document.getElementById('adminA1').value;
        payload.security_q2 = document.getElementById('adminQ2').value;
        payload.security_a2 = document.getElementById('adminA2').value;
        if (payload.password !== document.getElementById('adminConfirmPassword').value) {
            return Toast.show("Passwords do not match", "error");
        }
    }

    if (mode === 'recover') {
        payload.q1 = document.getElementById('adminQ1').value;
        payload.a1 = document.getElementById('adminA1').value;
        payload.q2 = document.getElementById('adminQ2').value;
        payload.a2 = document.getElementById('adminA2').value;
        payload.newPassword = document.getElementById('adminNewPassword').value;
    }

    let url = mode === 'setup' ? '/api/admin/setup' : (mode === 'login' ? '/api/admin/login' : '/api/admin/verify-security');
    
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            if (mode === 'recover') {
                // After verification, we actually need to hit the reset-password endpoint
                const resetRes = await fetch(API_BASE + '/api/admin/reset-password', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ admin_id: data.admin_id, newPassword: payload.newPassword })
                });
                if (resetRes.ok) {
                    Toast.show("Password reset! Please login.", "success");
                    setAuthMode('login');
                }
            } else {
                refreshWithToast(data.message || "Login successful", "success", true);
            }
        } else {
            Toast.show(data.error || "Failed", "error");
        }
    } catch (err) { Toast.show("Error", "error"); }
}

async function adminLogout() {
    if (confirm("Are you sure you want to logout from the Admin Panel?")) {
        try {
            await fetch(API_BASE + '/api/admin/logout', { method: 'POST' });
            // Clear all admin state
            localStorage.removeItem('admin_last_section');
            localStorage.removeItem('admin_last_fulfillment');
            
            // Show toast and reload to trigger auth check
            refreshWithToast("Admin session ended safely", "info", true);
        } catch (e) {
            location.reload();
        }
    }
}

// --- NAVIGATION ---

function showSection(sectionId, forFulfillment = false) {
    if (sectionId === 'view-fulfillment') sectionId = 'view-orders';
    
    // Block super admin sections if the user is not Suresh
    const superAdminSections = [
        'view-dashboard',
        'view-feature-switchboard',
        'view-vendor-approvals',
        'view-users',
        'view-loyalty',
        'view-settings',
        'view-promo'
    ];
    const userRole = getCookie('role');
    const username = getCookie('username');
    const isSuresh = userRole === 'super_admin' && username === '9490229108';

    if (superAdminSections.includes(sectionId) && !isSuresh) {
        console.warn(`Unauthorized section access attempt: ${sectionId}`);
        // Fallback to vendor dashboard
        showSection('view-vendor-dashboard');
        return;
    }

    // Save state for persistence
    localStorage.setItem('admin_last_section', sectionId);
    localStorage.setItem('admin_last_fulfillment', forFulfillment ? 'true' : 'false');

    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(sectionId);
    if (target) {
        target.classList.add('active');
        
        // Refresh data
        if (sectionId === 'view-dashboard') { fetchDashboardStats(); setupCharts(); }
        if (sectionId === 'view-orders') {
            window.isFulfillmentMode = forFulfillment;
            document.getElementById('fulfillmentHeading').style.display = forFulfillment ? 'block' : 'none';
            document.getElementById('deliveryPincodeSettings').style.display = (forFulfillment && currentPortalRole === 'super_admin') ? 'block' : 'none';
            
            // Update table headers dynamically
            const theadRow = document.querySelector('#view-orders .admin-table thead tr');
            if (theadRow) {
                if (forFulfillment) {
                    theadRow.innerHTML = `
                        <th>ID</th>
                        <th>CUSTOMER</th>
                        <th>TOTAL</th>
                        <th>PAYMENT</th>
                        <th>DATE</th>
                        <th>PAYMENT STATUS</th>
                        <th>ACTION</th>
                    `;
                } else {
                    theadRow.innerHTML = `
                        <th>ID</th>
                        <th>CUSTOMER</th>
                        <th>ORDERED ITEMS</th>
                        <th>DELIVERY ADDRESS</th>
                        <th>STATUS</th>
                        <th>ACTION</th>
                    `;
                }
            }
            
            fetchOrders();
            if (forFulfillment && currentPortalRole === 'super_admin') fetchDeliverySettings();
        }
        if (sectionId === 'view-products') { fetchAdminProducts(); fetchCategoriesForSelects(); populateVariantProductDropdown(); }
        if (sectionId === 'view-categories') fetchAdminCategories();
        if (sectionId === 'view-brands') fetchAdminBrands();
        if (sectionId === 'view-coupons') { fetchAdminCoupons(); populateCouponShopsDropdown(); }
        if (sectionId === 'view-notifications') { fetchNotificationsHistory(); loadMarquee(); }
        if (sectionId === 'view-vendor-notifications') { fetchVendorNotifications(); }
        if (sectionId === 'view-vendor-special-offers') { fetchVendorOffers(); }
        if (sectionId === 'view-inquiries') fetchMessages();
        if (sectionId === 'view-reviews') fetchAdminReviews();
        if (sectionId === 'view-users') fetchUsers();
        if (sectionId === 'view-payment') fetchPaymentHistory();
        if (sectionId === 'view-promo') {
            if (currentPortalRole !== 'vendor') {
                fetchBanner();
                fetchOffers();
            }
            fetchCategoriesForSelects();
            fetchPromoBannersAdmin();
        }
        if (sectionId === 'view-settings') fetchShopSettings();
        if (sectionId === 'view-loyalty') fetchLoyaltySettings();
        if (sectionId === 'view-cancelled-orders') fetchCancelledPayments();
        if (sectionId === 'view-feature-switchboard') fetchFeatureFlags();
        if (sectionId === 'view-vendor-approvals') fetchVendorApprovals();
        if (sectionId === 'view-vendor-dashboard') fetchVendorDashboardStats();
        if (sectionId === 'view-vendor-shop') fetchVendorShopDetails();
        if (sectionId === 'view-vendor-wallet') fetchVendorWalletDetails();
        if (sectionId === 'view-vendor-chats') loadVendorChats();
        if (sectionId !== 'view-vendor-chats') stopVendorChatPolling();
    }
    
    // UI updates
    document.querySelectorAll('.sidebar-menu li').forEach(li => {
        const onclick = li.getAttribute('onclick') || '';
        if (onclick.includes(sectionId) && (onclick.includes('true') === forFulfillment)) {
            li.classList.add('active');
        } else {
            li.classList.remove('active');
        }
    });
}

function toggleAdminSidebar() {
    const sidebar = document.getElementById('adminSidebar');
    sidebar.classList.toggle('active');
    document.getElementById('adminSidebarOverlay').style.display = sidebar.classList.contains('active') ? 'block' : 'none';
}

// --- DASHBOARD ---

async function initDashboard() {
    // Check for pending toasts from previous reload
    const pendingToast = localStorage.getItem('admin_pending_toast');
    if (pendingToast) {
        const { message, type } = JSON.parse(pendingToast);
        Toast.show(message, type);
        localStorage.removeItem('admin_pending_toast');
    }

    const userRole = getCookie('role');
    const username = getCookie('username');
    const isSuresh = userRole === 'super_admin' && username === '9490229108';

    // Restore last section
    let lastSection = localStorage.getItem('admin_last_section');
    if (!lastSection) {
        lastSection = isSuresh ? 'view-dashboard' : 'view-vendor-dashboard';
    }
    
    // Ensure vendor is forced away from super admin sections
    const superAdminSections = [
        'view-dashboard',
        'view-feature-switchboard',
        'view-vendor-approvals',
        'view-users',
        'view-loyalty',
        'view-settings'
    ];
    if (superAdminSections.includes(lastSection) && !isSuresh) {
        lastSection = 'view-vendor-dashboard';
    }

    const lastFulfillment = localStorage.getItem('admin_last_fulfillment') === 'true';
    showSection(lastSection, lastFulfillment);

    if (isSuresh && lastSection === 'view-dashboard') {
        fetchDashboardStats();
        setupCharts();
    } else if (!isSuresh && lastSection === 'view-vendor-dashboard') {
        fetchVendorDashboardStats();
    }
}

function refreshWithToast(message, type = 'success', forceReload = false) {
    if (forceReload) {
        localStorage.setItem('admin_pending_toast', JSON.stringify({ message, type }));
        location.reload();
        return;
    }

    // 1. Show Toast Immediately
    if (window.Toast) {
        Toast.show(message, type);
    } else {
        localStorage.setItem('admin_pending_toast', JSON.stringify({ message, type }));
    }
    
    // 2. Trigger Soft Refresh of Current Section
    const lastSection = localStorage.getItem('admin_last_section') || 'view-dashboard';
    const lastFulfillment = localStorage.getItem('admin_last_fulfillment') === 'true';
    showSection(lastSection, lastFulfillment);

    // 3. Close Any Open Modals
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.style.display = 'none';
    });
}

async function fetchDashboardStats(date = "") {
    try {
        const url = date ? `/api/admin/dashboard/stats?date=${date}` : '/api/admin/dashboard/stats';
        const res = await adminFetch(url);
        const { stats } = await res.json();
        if (stats) {
            if (document.getElementById('statRevenue')) document.getElementById('statRevenue').innerText = `₹${Math.round(stats.totalRevenue)}`;
            if (document.getElementById('statOrdersToday')) document.getElementById('statOrdersToday').innerText = stats.ordersToday;
            if (document.getElementById('statProducts')) document.getElementById('statProducts').innerText = stats.totalProducts;
            if (document.getElementById('statMessages')) document.getElementById('statMessages').innerText = stats.unreadInquiries;
        }
    } catch (e) {}
}

async function setupCharts() {
    console.log("Setting up charts...");
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;

    try {
        const res = await adminFetch(API_BASE + '/api/admin/orders');
        const orders = await res.json();
        
        if (!Array.isArray(orders)) {
            console.warn("Graph data: Expected array but got", orders);
            return;
        }

        const last7Days = [...Array(7)].map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            return d.toISOString().split('T')[0];
        }).reverse();

        const dataPoints = last7Days.map(date => {
            return orders
                .filter(o => {
                    if (!o.created_at) return false;
                    // Robust matching: compare ISO date strings
                    const oDate = new Date(o.created_at).toISOString().split('T')[0];
                    return oDate === date;
                })
                .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
        });

        console.log("Graph data points:", dataPoints);

        if (revenueChart) revenueChart.destroy();
        revenueChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: last7Days.map(d => d.split('-').slice(1).reverse().join('/')),
                datasets: [{
                    label: 'Revenue (₹)',
                    data: dataPoints,
                    borderColor: '#4F46E5',
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    fill: true, 
                    tension: 0.4, 
                    borderWidth: 3,
                    pointBackgroundColor: '#4F46E5',
                    pointRadius: 4
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => `Revenue: ₹${context.raw}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (val) => '₹' + val
                        }
                    }
                }
            }
        });
    } catch (e) {
        console.error("Critical error setting up revenue chart:", e);
    }
}

// --- PRODUCTS ---

async function fetchAdminProducts() {
    const search = document.getElementById('adminProductSearch').value || '';
    const cat = document.getElementById('adminProductCategory').value || 'All';
    try {
        let url = `${API_BASE}/api/products?search=${search}&category=${cat}`;
        if (currentPortalRole === 'vendor') {
            url = `${API_BASE}/api/vendor/products?search=${search}&category=${cat}`;
        }
        const res = await adminFetch(url);
        const products = await res.json();
        const tbody = document.getElementById('productsTableBody');
        
        tbody.innerHTML = products.map(p => {
            const stockLevel = p.stock_quantity || 0;
            const isLowStock = stockLevel < 10;
            const statusColor = isLowStock ? '#EF4444' : '#10B981';
            const statusBg = isLowStock ? '#FEF2F2' : '#F0FDF4';

            return `
                <tr style="transition: background 0.2s ease;">
                    <td style="color: #64748B; font-family: monospace; font-size: 0.85rem;">#${p.id}</td>
                    <td>
                        <div style="position: relative; width: 48px; height: 48px; border-radius: 12px; overflow: hidden; border: 1px solid #E2E8F0; background: #F8FAFC; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                            <img src="${p.imgurl || p.imgUrl || 'https://via.placeholder.com/60?text=Product'}" 
                                 style="width: 100%; height: 100%; object-fit: cover;"
                                 onerror="this.src='https://placehold.co/60?text=Error'">
                        </div>
                    </td>
                    <td>
                        <div style="font-weight: 600; color: #1E293B; font-size: 0.95rem;">${p.name}</div>
                        <div style="display: flex; align-items: center; gap: 0.4rem;">
                            <span style="font-size: 0.75rem; color: #64748B;">${p.weight || 'N/A'}</span>
                            ${p.variants && p.variants.length > 0 ? `<span title="${p.variants.length} Variants" style="padding: 1px 4px; border-radius: 4px; background: #E0E7FF; color: #4338CA; font-size: 0.65rem; font-weight: 700;">+${p.variants.length} VAR</span>` : ''}
                        </div>
                    </td>
                    <td>
                        <span style="display: inline-block; padding: 4px 10px; border-radius: 20px; background: #F1F5F9; color: #475569; font-size: 0.75rem; font-weight: 600;">
                            ${p.category}
                        </span>
                    </td>
                    <td>
                        <div style="font-weight: 700; color: #0F172A;">₹${p.price}</div>
                        <div style="font-size: 0.7rem; color: #94A3B8; text-decoration: line-through;">₹${p.originalprice || p.originalPrice || p.price}</div>
                    </td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span style="padding: 2px 8px; border-radius: 6px; font-weight: 700; font-size: 0.8rem; background: ${statusBg}; color: ${statusColor}; border: 1px solid ${isLowStock ? '#FEE2E2' : '#DCFCE7'};">
                                ${stockLevel}
                            </span>
                            ${isLowStock ? '<i class="ph-fill ph-warning" style="color: #EF4444; font-size: 0.9rem;" title="Low Stock"></i>' : ''}
                        </div>
                    </td>
                    <td>
                        <label class="toggle-switch">
                            <input type="checkbox" ${p.is_available !== 0 ? 'checked' : ''} onchange="toggleProductField(${p.id}, 'availability', this.checked)">
                            <span class="slider"></span>
                        </label>
                    </td>
                    <td>
                        <label class="toggle-switch">
                            <input type="checkbox" ${p.is_trending === 1 ? 'checked' : ''} onchange="toggleProductField(${p.id}, 'trending', this.checked)">
                            <span class="slider" style="background:${p.is_trending ? '#F59E0B' : '#ccc'}"></span>
                        </label>
                    </td>
                    <td>
                        <label class="toggle-switch">
                            <input type="checkbox" ${p.is_daily_essential === 1 ? 'checked' : ''} onchange="toggleProductField(${p.id}, 'essential', this.checked)">
                            <span class="slider" style="background:${p.is_daily_essential ? '#3B82F6' : '#ccc'}"></span>
                        </label>
                    </td>
                    <td style="text-align: right;">
                        <div style="display: flex; gap: 8px; justify-content: flex-end; padding-right: 1rem;">
                            <button onclick="openEditModal(${p.id})" class="action-btn" style="background: #4F46E5; width: 32px; height: 32px; border-radius: 8px;" title="Edit Product">
                                <i class="ph ph-pencil-simple" style="font-size: 1rem;"></i>
                            </button>
                            <button onclick="deleteProduct(${p.id})" class="action-btn" style="background: #EF4444; width: 32px; height: 32px; border-radius: 8px;" title="Delete Product">
                                <i class="ph ph-trash" style="font-size: 1rem;"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error("Failed to fetch products", e);
    }
}

async function toggleProductField(id, field, val) {
    const payload = {};
    const updateKey = field === 'availability' ? 'is_available' : (field === 'trending' ? 'is_trending' : 'is_daily_essential');
    payload[updateKey] = val ? 1 : 0;
    
    try {
        const res = await fetch(`${API_BASE}/api/admin/products/${id}/${field}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            Toast.show("Status updated", "success");
            // No need to full refresh, the switch reflects state
        } else {
            Toast.show("Failed to update status", "error");
        }
    } catch (err) {
        Toast.show("Connection error", "error");
    }
}

async function handleAddProduct(e) {
    e.preventDefault();
    const payload = {
        name: document.getElementById('pName').value,
        price: Number(document.getElementById('pPrice').value) || 0,
        originalprice: Number(document.getElementById('pOriginalPrice').value) || 0,
        category: document.getElementById('pCategory').value,
        stock_quantity: Number(document.getElementById('pStock').value) || 0,
        weight: document.getElementById('pWeight').value,
        discount: document.getElementById('pDiscount').value,
        imgurl: document.getElementById('pImageUrl').value,
        is_daily_essential: document.getElementById('pDailyEssential').checked ? 1 : 0,
        variants: tempVariants
    };

    try {
        const url = currentPortalRole === 'vendor' ? `${API_BASE}/api/vendor/products` : `${API_BASE}/api/admin/products`;
        const res = await adminFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            refreshWithToast("Product added", "success");
        } else {
            const data = await res.json();
            Toast.show(data.error || "Failed to add product", "error");
        }
    } catch (err) {
        Toast.show("Connection error", "error");
    }
}

async function openEditModal(id) {
    const res = await fetch(`${API_BASE}/api/products/${id}`);
    const p = await res.json();
    if (p) {
        document.getElementById('editPId').value = p.id;
        document.getElementById('editPName').value = p.name;
        document.getElementById('editPCategory').value = p.category;
        document.getElementById('editPPrice').value = p.price;
        document.getElementById('editPOriginalPrice').value = p.originalprice || p.originalPrice;
        document.getElementById('editPWeight').value = p.weight;
        document.getElementById('editPDiscount').value = p.discount;
        document.getElementById('editPStock').value = p.stock_quantity;
        document.getElementById('editPImageUrl').value = p.imgurl || p.imgUrl;
        document.getElementById('editPDailyEssential').checked = p.is_daily_essential === 1;
        document.getElementById('editPTrending').checked = p.is_trending === 1;
        document.getElementById('editPAvailable').checked = p.is_available !== 0;
        
        currentEditVariants = p.variants || [];
        renderVariantList('editVariantList', currentEditVariants, 'edit');
        document.getElementById('editProductModal').style.display = 'flex';
    }
}

async function handleEditProduct(e) {
    e.preventDefault();
    const id = document.getElementById('editPId').value;
    const payload = {
        name: document.getElementById('editPName').value,
        price: Number(document.getElementById('editPPrice').value) || 0,
        originalprice: Number(document.getElementById('editPOriginalPrice').value) || 0,
        category: document.getElementById('editPCategory').value,
        stock_quantity: Number(document.getElementById('editPStock').value) || 0,
        weight: document.getElementById('editPWeight').value,
        discount: document.getElementById('editPDiscount').value,
        imgurl: document.getElementById('editPImageUrl').value,
        is_daily_essential: document.getElementById('editPDailyEssential').checked ? 1 : 0,
        is_trending: document.getElementById('editPTrending').checked ? 1 : 0,
        is_available: document.getElementById('editPAvailable').checked ? 1 : 0,
        variants: currentEditVariants
    };
    try {
        const url = currentPortalRole === 'vendor' ? `${API_BASE}/api/vendor/products/${id}` : `${API_BASE}/api/admin/products/${id}`;
        const res = await adminFetch(url, {
            method: currentPortalRole === 'vendor' ? 'PATCH' : 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            refreshWithToast("Product updated", "success");
        } else {
            const data = await res.json();
            Toast.show(data.error || "Failed to update product", "error");
        }
    } catch (err) {
        Toast.show("Connection error", "error");
    }
}

async function deleteProduct(id) {
    if (confirm("Delete product?")) {
        const url = currentPortalRole === 'vendor' ? `${API_BASE}/api/vendor/products/${id}` : `${API_BASE}/api/admin/products/${id}`;
        await adminFetch(url, { method: 'DELETE' });
        refreshWithToast("Product removed", "warning");
    }
}

// --- VARIANTS ---

function renderVariantList(containerId, list, type) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = list.map((v, idx) => `
        <div class="variant-item" style="display:flex; justify-content:space-between; align-items:center; background:#fff; padding:5px 10px; border:1px solid #eee; margin-bottom:5px; border-radius:4px;">
            <div style="display:flex; align-items:center; gap:0.5rem;">
                ${v.imgurl ? `<img src="${v.imgurl}" style="width:24px; height:24px; object-fit:contain; border-radius:4px;">` : '<i class="ph ph-image" style="color:#CBD5E1;"></i>'}
                <span>${v.weight} - ₹${v.price}</span>
            </div>
            <button type="button" onclick="removeVariant('${type}', ${idx})" style="border:none; background:none; color:#EF4444;"><i class="ph ph-trash"></i></button>
        </div>
    `).join('');
}

window.addVariantToTempList = () => {
    const w = document.getElementById('vWeight')?.value.trim();
    const p = Number(document.getElementById('vPrice')?.value) || 0;
    const op = Number(document.getElementById('vOriginalPrice')?.value) || p;
    const img = document.getElementById('vImgUrl')?.value.trim() || '';
    
    if (!w) return Toast.show("Variant weight/size is required", "warning");
    if (p <= 0) return Toast.show("Variant price must be greater than 0", "warning");
    
    // Check for duplicate weight
    if (tempVariants.find(v => v.weight.toLowerCase() === w.toLowerCase())) {
        return Toast.show("This variant already exists", "warning");
    }

    tempVariants.push({ weight: w, price: p, originalprice: op, imgurl: img });
    renderVariantList('addVariantList', tempVariants, 'add');
    
    // Clear inputs
    document.getElementById('vWeight').value = ''; 
    document.getElementById('vPrice').value = ''; 
    document.getElementById('vOriginalPrice').value = '';
    if (document.getElementById('vImgUrl')) document.getElementById('vImgUrl').value = '';
};

window.addVariantToEditList = () => {
    const w = document.getElementById('evWeight')?.value.trim();
    const p = Number(document.getElementById('evPrice')?.value) || 0;
    const op = Number(document.getElementById('evOriginalPrice')?.value) || p;
    const img = document.getElementById('evImgUrl')?.value.trim() || '';
    
    if (!w) return Toast.show("Variant weight/size is required", "warning");
    if (p <= 0) return Toast.show("Variant price must be greater than 0", "warning");

    if (currentEditVariants.find(v => v.weight.toLowerCase() === w.toLowerCase())) {
        return Toast.show("This variant already exists", "warning");
    }

    currentEditVariants.push({ weight: w, price: p, originalprice: op, imgurl: img });
    renderVariantList('editVariantList', currentEditVariants, 'edit');
    
    document.getElementById('evWeight').value = ''; 
    document.getElementById('evPrice').value = ''; 
    document.getElementById('evOriginalPrice').value = '';
    if (document.getElementById('evImgUrl')) document.getElementById('evImgUrl').value = '';
};

window.removeVariant = (type, idx) => {
    if (type === 'add') {
        tempVariants.splice(idx, 1);
        renderVariantList('addVariantList', tempVariants, 'add');
    } else {
        currentEditVariants.splice(idx, 1);
        renderVariantList('editVariantList', currentEditVariants, 'edit');
    }
};

// Quick Variant Manager
async function populateVariantProductDropdown() {
    const res = await fetch(API_BASE + '/api/products');
    const products = await res.json();
    const select = document.getElementById('quickVariantProductSelect');
    if (select) {
        select.innerHTML = '<option value="" disabled selected>-- Choose product --</option>' +
            products.sort((a,b) => a.name.localeCompare(b.name)).map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    }
}

window.addVariantToNewList = () => {
    const w = document.getElementById('avWeight').value;
    const p = Number(document.getElementById('avPrice').value);
    const op = Number(document.getElementById('avOriginalPrice').value || p);
    if (!w || !p) return;
    tempVariants.push({ weight: w, price: p, originalprice: op });
    renderNewVariantList();
    document.getElementById('avWeight').value = ''; 
    document.getElementById('avPrice').value = ''; 
    document.getElementById('avOriginalPrice').value = '';
};

function renderNewVariantList() {
    const container = document.getElementById('addVariantList');
    if (!container) return;
    container.innerHTML = tempVariants.map((v, idx) => `
        <div style="background: white; border: 1px solid #E2E8F0; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; display: flex; align-items: center; gap: 0.5rem; box-shadow: 0 2px 4px rgba(0,0,0,0.03);">
            <span style="font-weight: 600;">${v.weight}</span>
            <span style="color: #64748B;">₹${v.price}</span>
            <button type="button" onclick="removeVariantFromNewList(${idx})" style="border: none; background: none; color: #EF4444; padding: 0; cursor: pointer; display: flex;"><i class="ph ph-x-circle"></i></button>
        </div>
    `).join('');
}

window.removeVariantFromNewList = (idx) => {
    tempVariants.splice(idx, 1);
    renderNewVariantList();
};

window.loadProductForQuickVariants = async (id) => {
    const res = await fetch(`${API_BASE}/api/products/${id}`);
    const p = await res.json();
    if (p) {
        document.getElementById('quickVariantProductName').innerText = p.name;
        tempVariants = p.variants || [];
        renderQuickVariantList();
        document.getElementById('quickVariantEditor').style.display = 'block';
    }
};

function renderQuickVariantList() {
    const container = document.getElementById('quickVariantList');
    if (!container) return;
    container.innerHTML = tempVariants.map((v, idx) => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:white; padding:8px 12px; border:1px solid #E2E8F0; border-radius:8px; margin-bottom:0.5rem;">
            <div style="display:flex; align-items:center; gap:0.5rem;">
                ${v.imgurl ? `<img src="${v.imgurl}" style="width:24px; height:24px; object-fit:contain; border-radius:4px;">` : '<i class="ph ph-image" style="color:#CBD5E1;"></i>'}
                <span>${v.weight} - ₹${v.price}</span>
            </div>
            <button type="button" onclick="removeQuickVariant(${idx})" style="border:none; background:none; color:#EF4444;"><i class="ph ph-trash"></i></button>
        </div>
    `).join('');
}

window.addQuickVariant = () => {
    const w = document.getElementById('qvWeight').value.trim();
    const p = Number(document.getElementById('qvPrice').value);
    const op = Number(document.getElementById('qvOriginalPrice').value || p);
    const img = document.getElementById('qvImgUrl')?.value.trim() || '';
    if (!w || !p) return;
    tempVariants.push({ weight: w, price: p, originalprice: op, imgurl: img });
    renderQuickVariantList();
    document.getElementById('qvWeight').value = ''; 
    document.getElementById('qvPrice').value = ''; 
    document.getElementById('qvOriginalPrice').value = '';
    if (document.getElementById('qvImgUrl')) document.getElementById('qvImgUrl').value = '';
};

window.removeQuickVariant = (idx) => {
    tempVariants.splice(idx, 1);
    renderQuickVariantList();
};

window.saveQuickVariants = async () => {
    const id = document.getElementById('quickVariantProductSelect').value;
    const btn = document.querySelector('button[onclick="saveQuickVariants()"]');
    
    if (!id) return Toast.show("Please select a product", "warning");

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="ph ph-spinner-gap ph-spin"></i> Saving...';
    }

    try {
        const res = await fetch(`${API_BASE}/api/admin/products/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ variants: tempVariants })
        });
        
        const data = await res.json();

        if (res.ok) {
            Toast.show("Variants saved", "success");
            closeQuickVariantEditor();
            fetchAdminProducts();
        } else {
            console.error("Save failed:", data.error);
            Toast.show(data.error || "Failed to save variants", "error");
        }
    } catch (err) {
        console.error("Network error:", err);
        Toast.show("Connection error", "error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = 'Save Changes to Product';
        }
    }
};

window.closeQuickVariantEditor = () => {
    document.getElementById('quickVariantEditor').style.display = 'none';
    document.getElementById('quickVariantProductSelect').value = '';
};

// --- ORDERS ---

async function fetchOrders(search = "", date = "") {
    try {
        let url = `/api/admin/orders?search=${search}`;
        if (currentPortalRole === 'vendor') {
            url = `/api/vendor/orders?search=${search}`;
        }
        if (date) url += `&date=${date}`;
        const res = await adminFetch(url);
        const orders = await res.json();
        
        const todayStr = new Date().toISOString().split('T')[0];
        
        // Calculate stats
        let displayCount, deliveredCount;
        
        if (date) {
            // If a specific date is selected, show stats for that date
            displayCount = orders.length;
            deliveredCount = orders.filter(o => o.status === 'delivered').length;
            // Update labels to be specific
            document.querySelector('#statOrdersToday').parentElement.querySelector('p').innerText = "Orders on " + date;
            document.querySelector('#statOrdersDelivered').parentElement.querySelector('p').innerText = "Delivered on " + date;
        } else {
            // If no date selected, 'Total Orders Today' should only count today's orders
            displayCount = orders.filter(o => o.created_at.startsWith(todayStr)).length;
            deliveredCount = orders.filter(o => o.status === 'delivered' && o.created_at.startsWith(todayStr)).length;
            // Reset labels to default
            document.querySelector('#statOrdersToday').parentElement.querySelector('p').innerText = "Total Orders Today";
            document.querySelector('#statOrdersDelivered').parentElement.querySelector('p').innerText = "Orders Delivered Today";
        }
        
        const statToday = document.getElementById('statOrdersToday');
        const statDelivered = document.getElementById('statOrdersDelivered');
        
        if (statToday) statToday.innerText = displayCount;
        if (statDelivered) statDelivered.innerText = deliveredCount;

        const tbody = document.getElementById('ordersTableBody');
        tbody.innerHTML = orders.map(o => {
            const items = typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []);
            const itemsHtml = items.map(i => `<div class="order-item-badge">${i.name} ${i.weight ? `(${i.weight})` : ''} x${i.quantity}</div>`).join('');
            
            const method = (o.payment_method || 'cash').toUpperCase();
            let columnsHtml = '';
            
            if (window.isFulfillmentMode) {
                columnsHtml = `
                    <td style="font-weight:600; color:#EF4444;">₹${o.total || 0}</td>
                    <td>
                        <div style="font-size:0.85rem; color:#475569;">${method}</div>
                        <div style="font-size:0.75rem; color:${o.payment_status === 'paid' ? '#10B981' : '#EF4444'}; font-weight:600;">
                            ${(o.payment_status || 'pending').toUpperCase()}
                        </div>
                    </td>
                    <td style="font-size:0.85rem; color:#475569;">${o.created_at ? new Date(o.created_at).toLocaleDateString() : 'N/A'}</td>
                    <td>
                        ${method === 'CASH' ? `
                            <select onchange="updatePaymentStatus(${o.id}, this.value)" class="admin-input" style="padding:4px 8px; font-size:0.8rem; border-radius:20px; border-color:#CBD5E1; background: ${o.payment_status === 'paid' ? '#DCFCE7' : '#FEF2F2'}; color: ${o.payment_status === 'paid' ? '#16A34A' : '#EF4444'}; font-weight:700; text-transform:uppercase;">
                                <option value="pending" ${o.payment_status === 'pending' ? 'selected' : ''}>COD PENDING</option>
                                <option value="paid" ${o.payment_status === 'paid' ? 'selected' : ''}>RECEIVED</option>
                            </select>
                        ` : `
                            <div style="padding:6px 12px; font-size:0.8rem; border-radius:20px; background: ${o.payment_status === 'paid' ? '#DCFCE7' : '#FEF2F2'}; color: ${o.payment_status === 'paid' ? '#16A34A' : '#EF4444'}; font-weight:700; text-align:center; display:inline-block;">
                                ${(o.payment_status || 'pending').toUpperCase()} (${method})
                            </div>
                        `}
                    </td>
                `;
            } else {
                columnsHtml = `
                    <td>
                        <div style="display:flex; flex-wrap:wrap; gap:4px; max-width:300px;">
                            ${itemsHtml}
                        </div>
                        <div style="margin-top:8px; font-weight:700; color:var(--primary); font-size:0.85rem; border-top:1px dashed #CBD5E1; padding-top:4px;">
                            Total Items: ${items.reduce((sum, i) => sum + i.quantity, 0)}
                        </div>
                    </td>
                    <td style="font-size:0.8rem; color:#475569; max-width:200px; line-height:1.4;">
                        <div style="display:flex; gap:6px;">
                            <i class="ph ph-map-pin" style="color:var(--primary); margin-top:2px;"></i>
                            <span>${o.address || 'N/A'}</span>
                        </div>
                        <div style="font-size:0.75rem; color:var(--primary); font-weight:700; margin-top:4px; border-top:1px dashed #CBD5E1; padding-top:4px;">Type: ${o.delivery_type || 'Home Delivery'}</div>
                    </td>
                    <td>
                        <select onchange="updateOrderStatus(${o.id}, this.value)" class="admin-input" style="padding:4px 8px; font-size:0.8rem; border-radius:20px; border-color:#CBD5E1; background: ${o.status === 'delivered' ? '#DCFCE7' : (o.status === 'cancelled' ? '#FEF2F2' : '#F1F5F9')}; color: ${o.status === 'delivered' ? '#16A34A' : (o.status === 'cancelled' ? '#EF4444' : '#475569')}; font-weight:700; text-transform:uppercase;">
                            <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="confirmed" ${o.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                            <option value="delivered" ${o.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                            <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                        </select>
                    </td>
                `;
            }

            return `
                <tr>
                    <td>#${o.display_id || o.id}</td>
                    <td>
                        <div style="font-weight:600; color:#1E293B;">${o.full_name || 'Customer'}</div>
                        <div style="font-size:0.75rem; color:#64748B;">${o.phone || ''}</div>
                    </td>
                    ${columnsHtml}
                    <td>
                        <div style="display:flex; gap:6px;">
                            <button onclick="viewOrderDetails(${o.id})" class="action-btn" style="background:#F1F5F9; color:#64748B; border:1px solid #E2E8F0;" title="View Details">
                                <i class="ph ph-eye"></i>
                            </button>
                            <button onclick="deleteOrder(${o.id})" class="action-btn" style="background:#FEE2E2; color:#EF4444; border:1px solid #FECACA;" title="Delete Order">
                                <i class="ph ph-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {}
}

async function updateOrderStatus(id, status) {
    await adminFetch(`${API_BASE}/api/admin/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
    refreshWithToast("Status updated", "success");
}

async function updatePaymentStatus(id, status) {
    await adminFetch(`${API_BASE}/api/admin/orders/${id}/payment-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
    refreshWithToast("Payment status updated", "success");
}

async function deleteOrder(id) {
    if (confirm("Delete order?")) {
        await adminFetch(`${API_BASE}/api/admin/orders/${id}`, { method: 'DELETE' });
        refreshWithToast("Order removed", "warning");
    }
}

async function fetchPaymentHistory(date = "") {
    try {
        const url = date ? `/api/admin/payments?date=${date}` : '/api/admin/payments';
        const res = await adminFetch(url);
        const payments = await res.json();
        const tbody = document.getElementById('paymentTableBody');
        if (!tbody) return;
        tbody.innerHTML = payments.map(p => `
            <tr>
                <td>#${p.order_id}</td>
                <td><div style="font-weight:600;">${p.full_name}</div><small>${p.phone}</small></td>
                <td style="font-weight:700;">₹${p.amount}</td>
                <td><span class="badge" style="background:#F1F5F9; color:#475569; text-transform:uppercase; font-size:0.7rem;">${p.method}</span></td>
                <td><span style="color:#10B981; font-weight:700;">RECEIVED</span></td>
                <td style="font-size:0.85rem; color:#64748B;">${new Date(p.created_at).toLocaleString()}</td>
                <td>
                    <button onclick="deleteOrder(${p.order_id})" class="action-btn" style="background:#EF4444;" title="Delete Record"><i class="ph ph-trash"></i></button>
                </td>
            </tr>
        `).join('');
    } catch (e) {}
}

// --- SUPPORT ---

async function fetchMessages(date = "") {
    const isVendor = currentPortalRole === 'vendor';
    const baseUrl = isVendor ? '/api/vendor/support-messages' : '/api/admin/support-messages';
    const url = date ? `${baseUrl}?date=${date}` : baseUrl;
    const res = await adminFetch(url);
    const messages = await res.json();
    const tbody = document.getElementById('messagesTableBody');
    if (!tbody) return;
    tbody.innerHTML = messages.map(m => `
        <tr>
            <td>${new Date(m.created_at).toLocaleDateString()}</td>
            <td>${m.name}<br><small>${m.email}</small></td>
            <td>${m.subject}</td>
            <td><span class="badge ${m.status}">${m.status}</span></td>
            <td>
                <button onclick="viewMessage(${m.id})" class="action-btn" style="background:#4F46E5; width:auto; padding:4px 12px; display:inline-flex; align-items:center; gap:5px;">
                    <i class="ph ph-reply"></i> Reply
                </button>
                <button onclick="deleteMessage(${m.id})" class="action-btn" style="background:#EF4444; margin-left:5px;"><i class="ph ph-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

window.viewMessage = async (id) => {
    const isVendor = currentPortalRole === 'vendor';
    const baseUrl = isVendor ? `/api/vendor/support-messages` : `/api/admin/support-messages`;
    const res = await adminFetch(`${baseUrl}/${id}`);
    const m = await res.json();
    if (m) {
        document.getElementById('messageDetailContent').innerHTML = `
            <h3>${m.subject}</h3>
            <p>From: ${m.name} (${m.email})</p>
            <div style="background:#f1f5f9; padding:15px; border-radius:8px; margin:10px 0;">${m.message}</div>
            ${m.reply ? `<div style="border-left:4px solid #4F46E5; padding-left:10px;"><strong>Reply:</strong> ${m.reply}</div>` : ''}
        `;
        document.getElementById('sendReplyBtn').onclick = () => handleSendReply(id);
        document.getElementById('viewMessageModal').style.display = 'flex';
        adminFetch(`${baseUrl}/${id}/read`, { method: 'PATCH' });
    }
};

async function handleSendReply(id) {
    const reply = document.getElementById('replyText').value;
    if (!reply) return;
    const isVendor = currentPortalRole === 'vendor';
    const baseUrl = isVendor ? `/api/vendor/support-messages` : `/api/admin/support-messages`;
    await adminFetch(`${baseUrl}/${id}/reply`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply })
    });
    refreshWithToast("Reply sent", "success");
}

async function deleteMessage(id) {
    if (confirm("Delete message?")) {
        const isVendor = currentPortalRole === 'vendor';
        const baseUrl = isVendor ? `/api/vendor/support-messages` : `/api/admin/support-messages`;
        await adminFetch(`${baseUrl}/${id}`, { method: 'DELETE' });
        refreshWithToast("Message removed", "warning");
    }
}

// --- SETTINGS ---

async function fetchShopSettings() {
    const res = await fetch(API_BASE + '/api/settings');
    const s = await res.json();
    if (s) {
        if (document.getElementById('sEmail')) document.getElementById('sEmail').value = s.shop_email || '';
        if (document.getElementById('sPhone')) document.getElementById('sPhone').value = s.shop_phone || '';
        if (document.getElementById('sAddress')) document.getElementById('sAddress').value = s.shop_address || '';
        if (document.getElementById('sImage')) document.getElementById('sImage').value = s.shop_image || '';
        
        if (document.getElementById('rzpKeyId')) document.getElementById('rzpKeyId').value = s.razorpay_key_id || '';
        if (document.getElementById('rzpSecret')) document.getElementById('rzpSecret').value = s.razorpay_secret || '';
        if (document.getElementById('sBannerSpeed')) document.getElementById('sBannerSpeed').value = s.banner_speed || 3000;
        if (document.getElementById('vFeeAmount')) document.getElementById('vFeeAmount').value = s.vendor_fee_amount || 0;
        if (document.getElementById('vFeeDiscount')) document.getElementById('vFeeDiscount').value = s.vendor_fee_discount || 0;
        if (document.getElementById('vFeeCoupon')) document.getElementById('vFeeCoupon').value = s.vendor_fee_coupon || '';
        
        // App Config
        if (document.getElementById('defaultLanguage')) document.getElementById('defaultLanguage').value = s.default_language || 'en';
        if (document.getElementById('privacyPolicyText')) document.getElementById('privacyPolicyText').value = s.privacy_policy || '';

    }

    try {
        const adminRes = await fetch(API_BASE + '/api/admin/info');
        const adminInfo = await adminRes.json();
        if (adminInfo) {
            document.getElementById('secFullName').value = adminInfo.full_name || '';
            document.getElementById('secPhone').value = adminInfo.phone || '';
        }
    } catch (e) { console.warn("Could not fetch admin info", e); }
}

async function handleSaveSettings(e) {
    e.preventDefault();
    const data = {
        shop_email: document.getElementById('sEmail').value,
        shop_phone: document.getElementById('sPhone').value,
        shop_address: document.getElementById('sAddress').value,
        shop_image: document.getElementById('sImage').value,
        razorpay_key_id: document.getElementById('rzpKeyId')?.value || '',
        razorpay_secret: document.getElementById('rzpSecret')?.value || '',
        banner_speed: Number(document.getElementById('sBannerSpeed')?.value || 3000),
        vendor_fee_amount: Number(document.getElementById('vFeeAmount')?.value || 0),
        vendor_fee_discount: Number(document.getElementById('vFeeDiscount')?.value || 0),
        vendor_fee_coupon: document.getElementById('vFeeCoupon')?.value || ''
    };
    const res = await fetch(API_BASE + '/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const err = await res.json();
        return alert("Failed to save: " + (err.error || "Unknown error"));
    }
    refreshWithToast("Settings saved", "success");
}

async function handleSaveAppConfig(e) {
    e.preventDefault();
    const data = {
        default_language: document.getElementById('defaultLanguage').value,
        privacy_policy: document.getElementById('privacyPolicyText').value
    };
    await fetch(API_BASE + '/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    refreshWithToast("App configuration updated", "success");
}


async function fetchDeliverySettings() {
    const res = await fetch(API_BASE + '/api/settings');
    const s = await res.json();
    document.getElementById('managePincodeActive').checked = s.pincode_restriction_active === 1;
    document.getElementById('manageAllowedPincodes').value = s.allowed_pincodes;
}

async function handleSaveDeliverySettings(e) {
    e.preventDefault();
    const data = {
        pincode_restriction_active: document.getElementById('managePincodeActive').checked ? 1 : 0,
        allowed_pincodes: document.getElementById('manageAllowedPincodes').value
    };
    await fetch(API_BASE + '/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    refreshWithToast("Delivery settings updated", "success");
}

// --- LOYALTY PROGRAM ---

async function checkLoyaltySchema() {
    try {
        const res = await adminFetch(API_BASE + '/api/admin/loyalty/check-schema');
        const data = await res.json();
        const banner = document.getElementById('loyaltyMigrationBanner');
        if (data && data.missing && data.missing.length > 0) {
            if (banner) banner.style.display = 'block';
        } else {
            if (banner) banner.style.display = 'none';
        }
    } catch (err) {
        console.error("Loyalty schema check failed", err);
    }
}

async function fetchLoyaltySettings() {
    try {
        // Fetch coin settings
        const settingsRes = await fetch(API_BASE + '/api/settings');
        const s = await settingsRes.json();
        if (s) {
            if (document.getElementById('loyaltySystemActiveToggle')) {
                document.getElementById('loyaltySystemActiveToggle').checked = s.coins_system_active === 1;
            }
            if (document.getElementById('loyaltyRewardRate')) {
                document.getElementById('loyaltyRewardRate').value = s.coin_reward_rate || 1000;
            }
            if (document.getElementById('loyaltyRewardAmount')) {
                document.getElementById('loyaltyRewardAmount').value = s.coin_reward_amount || 30;
            }
            if (document.getElementById('loyaltyValuePerRupee')) {
                document.getElementById('loyaltyValuePerRupee').value = s.coin_value_per_rupee || 10;
            }
        }

        // Fetch stats
        const statsRes = await adminFetch(API_BASE + '/api/admin/loyalty/stats');
        if (statsRes.ok) {
            const stats = await statsRes.json();
            if (document.getElementById('loyaltyStatDistributed')) {
                document.getElementById('loyaltyStatDistributed').innerText = stats.totalCoins || 0;
            }
            if (document.getElementById('loyaltyStatSavings')) {
                document.getElementById('loyaltyStatSavings').innerText = '₹' + (stats.totalSavings || 0);
            }
            if (document.getElementById('loyaltyStatMembers')) {
                document.getElementById('loyaltyStatMembers').innerText = stats.activeMembers || 0;
            }
        }

        // Trigger schema verification
        await checkLoyaltySchema();
    } catch (err) {
        console.error("Failed to fetch loyalty settings/stats", err);
    }
}

async function handleSaveLoyaltySettings(e) {
    if (e) e.preventDefault();
    try {
        const payload = {
            coins_system_active: document.getElementById('loyaltySystemActiveToggle').checked ? 1 : 0,
            coin_reward_rate: Number(document.getElementById('loyaltyRewardRate').value || 1000),
            coin_reward_amount: Number(document.getElementById('loyaltyRewardAmount').value || 30),
            coin_value_per_rupee: Number(document.getElementById('loyaltyValuePerRupee').value || 10)
        };

        const res = await fetch(API_BASE + '/api/admin/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            refreshWithToast("Loyalty rules successfully updated!", "success");
        } else {
            const err = await res.json();
            Toast.show(err.error || "Failed to update loyalty settings", "error");
        }
    } catch (err) {
        Toast.show("Error saving loyalty settings", "error");
    }
}

window.copyLoyaltySqlScript = () => {
    const textEl = document.getElementById('loyaltySqlScriptText');
    if (textEl) {
        navigator.clipboard.writeText(textEl.value).then(() => {
            Toast.show("SQL Script copied to clipboard!", "success");
        });
    }
};

window.fetchLoyaltySettings = fetchLoyaltySettings;
window.handleSaveLoyaltySettings = handleSaveLoyaltySettings;

// --- VENDOR NOTIFICATIONS ---
async function fetchVendorNotifications(date = "") {
    const tbody = document.getElementById('vendorNotificationsTableBody');
    if (!tbody) return;
    
    try {
        const url = date ? `${API_BASE}/api/vendor/notifications?date=${date}` : `${API_BASE}/api/vendor/notifications`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch notifications");
        const notifications = await res.json();
        
        if (notifications.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align: center; padding: 3rem; color: #64748B;">
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem;">
                            <i class="ph ph-bell-slash" style="font-size: 3rem; color: #CBD5E1; display: block;"></i>
                            <span style="font-weight: 600; font-family: 'Outfit', sans-serif;">No Announcements Yet</span>
                            <span style="font-size: 0.8rem; color: #94A3B8;">Check back later for updates from Super Admin.</span>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = notifications.map(n => {
            const dateStr = new Date(n.created_at).toLocaleString();
            const isImportant = n.is_important === 1 || n.is_important === true;
            return `
                <tr style="${isImportant ? 'background: rgba(254, 242, 242, 0.7); border-left: 4px solid #EF4444;' : ''}">
                    <td style="vertical-align: middle;">
                        ${isImportant 
                            ? `<span style="background: #FEE2E2; color: #EF4444; padding: 4px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;"><i class="ph-fill ph-warning-circle"></i> Important</span>`
                            : `<span style="background: #F0FDF4; color: #15803D; padding: 4px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;"><i class="ph-fill ph-info"></i> Broadcast</span>`
                        }
                    </td>
                    <td>
                        <span style="${isImportant ? 'font-weight: 700; color: #991B1B;' : 'color: #334155;'} font-family: 'Inter', sans-serif; font-size: 0.9rem; line-height: 1.5; display: block;">
                            ${n.message}
                        </span>
                    </td>
                    <td style="vertical-align: middle;">
                        <span style="font-size: 0.8rem; color: #64748B; font-weight: 600; font-family: 'Inter', sans-serif;">
                            ${dateStr}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" style="text-align: center; padding: 2rem; color: #EF4444; font-weight: 600;">
                    <i class="ph ph-warning" style="font-size: 1.5rem; display: block; margin-bottom: 0.5rem;"></i>
                    Error loading announcements.
                </td>
            </tr>
        `;
    }
}
window.fetchVendorNotifications = fetchVendorNotifications;

// --- NOTIFICATIONS ---

async function fetchNotificationsHistory(date = "") {
    try {
        const url = date ? `/api/notifications/history?date=${date}` : '/api/notifications/history';
        const res = await fetch(url);
        const notifications = await res.json();
        const tbody = document.getElementById('notifHistoryBody');
        if (!tbody) return;
        tbody.innerHTML = notifications.map(n => {
            const isDanger = n.is_important == 1 || n.is_important === true;
            return `
                <tr>
                    <td>#${n.id}</td>
                    <td style="${isDanger ? 'color: #EF4444 !important; font-weight: 700;' : ''}">${n.message}</td>
                    <td style="font-size: 0.85rem; color: #64748B;">${new Date(n.created_at).toLocaleString()}</td>
                    <td style="text-align: center;">
                        ${isDanger ? '<i class="ph-fill ph-warning-circle" style="color: #EF4444 !important; font-size: 1.25rem;" title="Important Notification"></i>' : '<span style="color: #CBD5E1;">-</span>'}
                    </td>
                    <td>
                        <button onclick="deleteNotification(${n.id})" class="action-btn" style="background:#EF4444;"><i class="ph ph-trash"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {}
}

async function handleSendNotification(e) {
    e.preventDefault();
    const message = document.getElementById('nMessage').value;
    const is_important = document.getElementById('nIsImportant')?.checked ? 1 : 0;
    const target_role = document.getElementById('nTargetRole')?.value || 'all';

    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.innerHTML = '<i class="ph ph-spinner-gap ph-spin"></i> Broadcasting...';

    try {
        await fetch(API_BASE + '/api/admin/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, is_important, target_role })
        });
        refreshWithToast("Broadcast sent", "success");
        e.target.reset();
    } catch (err) {
        Toast.show("Failed to send notification", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Push Notification';
    }
}

async function deleteNotification(id) {
    if (confirm("Delete this notification?")) {
        const res = await fetch(`${API_BASE}/api/admin/notifications/${id}`, { method: 'DELETE' });
        if (res.ok) {
            refreshWithToast("Notification removed", "warning");
        } else {
            Toast.show("Failed to delete notification", "error");
        }
    }
}

async function clearAllNotifications() {
    if (confirm("Clear history?")) {
        await fetch(API_BASE + '/api/admin/notifications/history', { method: 'DELETE' });
        refreshWithToast("History cleared", "warning");
    }
}

async function loadMarquee() {
    const res = await fetch(API_BASE + '/api/settings');
    const s = await res.json();
    document.getElementById('marqueeInput').value = s.marquee_text;
}

async function handleMarqueeSubmit(e) {
    e.preventDefault();
    const text = document.getElementById('marqueeInput').value;
    await fetch(API_BASE + '/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marquee_text: text })
    });
    refreshWithToast("Marquee updated", "success");
}

// --- PROMO ---

async function fetchBanner() {
    const res = await fetch(API_BASE + '/api/banners');
    const banners = await res.json();
    const hero = banners.find(b => b.id === 1);
    if (hero) {
        document.getElementById('bannerId').value = hero.id;
        document.getElementById('bBadge').value = hero.badge;
        document.getElementById('bTitle').value = hero.title;
        document.getElementById('bDesc').value = hero.description;
        document.getElementById('bBtnText').value = hero.btnText;
        document.getElementById('bImgUrl').value = hero.imgUrl;
        document.getElementById('bCategory').value = hero.target_category;
    }
    const mf = banners.find(b => b.id === 2);
    if (mf) {
        document.getElementById('mfBadge').value = mf.badge;
        document.getElementById('mfTitle').value = mf.title;
        document.getElementById('mfDesc').value = mf.description;
        document.getElementById('mfBtnText').value = mf.btnText;
        document.getElementById('mfImgUrl').value = mf.imgUrl;
        document.getElementById('mfCategory').value = mf.target_category;
    }
}

async function handleSaveBanner(e) {
    e.preventDefault();
    const data = {
        badge: document.getElementById('bBadge').value,
        title: document.getElementById('bTitle').value,
        description: document.getElementById('bDesc').value,
        btnText: document.getElementById('bBtnText').value,
        imgUrl: document.getElementById('bImgUrl').value,
        target_category: document.getElementById('bCategory').value
    };
    await fetch(`${API_BASE}/api/admin/banners/1`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    refreshWithToast("Hero banner updated", "success");
}

async function handleSaveMorningFreshBanner(e) {
    e.preventDefault();
    const data = {
        badge: document.getElementById('mfBadge').value,
        title: document.getElementById('mfTitle').value,
        description: document.getElementById('mfDesc').value,
        btnText: document.getElementById('mfBtnText').value,
        imgUrl: document.getElementById('mfImgUrl').value,
        target_category: document.getElementById('mfCategory').value
    };
    await fetch(`${API_BASE}/api/admin/banners/2`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    refreshWithToast("Banner updated", "success");
}

async function fetchOffers() {
    const res = await fetch(API_BASE + '/api/special-offers');
    const offers = await res.json();
    offers.forEach((o, i) => {
        const id = i + 1;
        document.getElementById(`offerId${id}`).value = o.id;
        document.getElementById(`oTitle${id}`).value = o.title;
        document.getElementById(`oDesc${id}`).value = o.description;
        document.getElementById(`oCategory${id}`).value = o.target_category;
    });
}

async function handleSaveOffer(e, idx) {
    e.preventDefault();
    const id = document.getElementById(`offerId${idx}`).value;
    const data = {
        title: document.getElementById(`oTitle${idx}`).value,
        description: document.getElementById(`oDesc${idx}`).value,
        target_category: document.getElementById(`oCategory${idx}`).value
    };
    await fetch(`${API_BASE}/api/admin/special-offers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    refreshWithToast("Offer updated", "success");
}

// --- VENDOR SPECIAL OFFERS ---
async function fetchVendorOffers() {
    try {
        // Fetch vendor products to extract categories related specifically to this store
        const prodRes = await fetch(`${API_BASE}/api/vendor/products`);
        const products = await prodRes.json();
        
        // Extract unique category names from vendor products
        let uniqueCategories = [...new Set(products.map(p => p.category || p.Category).filter(Boolean))];
        
        // Fallback to global categories if no products exist
        if (uniqueCategories.length === 0) {
            const catRes = await fetch(`${API_BASE}/api/categories`);
            if (catRes.ok) {
                const cats = await catRes.json();
                uniqueCategories = cats.map(c => c.name);
            }
        }
        
        for (let i = 1; i <= 2; i++) {
            const select = document.getElementById(`vOCategory${i}`);
            if (select) {
                select.innerHTML = '<option value="All">All Categories</option>' + 
                    uniqueCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
            }
        }

        const res = await fetch(API_BASE + '/api/vendor/special-offers');
        const offers = await res.json();
        
        offers.forEach((o, i) => {
            const id = i + 1;
            if (document.getElementById(`vOfferId${id}`)) {
                document.getElementById(`vOfferId${id}`).value = o.id;
                document.getElementById(`vOTitle${id}`).value = o.title;
                document.getElementById(`vODesc${id}`).value = o.description || '';
                document.getElementById(`vOCategory${id}`).value = o.target_category || 'All';
            }
        });
    } catch (err) {
        console.error("Failed to fetch vendor offers:", err);
    }
}

async function handleSaveVendorOffer(e, idx) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.innerHTML = '<i class="ph ph-spinner-gap ph-spin"></i> Saving...';
    
    try {
        const id = document.getElementById(`vOfferId${idx}`).value;
        const data = {
            title: document.getElementById(`vOTitle${idx}`).value,
            description: document.getElementById(`vODesc${idx}`).value,
            target_category: document.getElementById(`vOCategory${idx}`).value
        };
        
        const res = await fetch(`${API_BASE}/api/vendor/special-offers/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (res.ok) {
            Toast.show(`Offer ${idx} updated successfully!`, "success");
        } else {
            const errData = await res.json();
            Toast.show(errData.error || "Failed to update offer", "error");
        }
    } catch (err) {
        console.error(err);
        Toast.show("Network error saving offer", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `Save Offer ${idx}`;
    }
}

window.fetchVendorOffers = fetchVendorOffers;
window.handleSaveVendorOffer = handleSaveVendorOffer;

// --- MANAGEMENT ---

async function fetchAdminCategories() {
    const res = await fetch(API_BASE + '/api/categories');
    const cats = await res.json();
    document.getElementById('categoriesTableBody').innerHTML = cats.map(c => `
        <tr>
            <td>#${c.id}</td>
            <td><i class="ph ${c.iconUrl || c.iconurl}" style="font-size:1.2rem;"></i></td>
            <td>${c.name}</td>
            <td>${c.commission_rate !== undefined ? c.commission_rate : 5}%</td>
            <td>
                <button onclick="openEditCategoryModal(${c.id}, '${c.name.replace(/'/g, "\\'")}', '${c.iconUrl || c.iconurl}', ${c.commission_rate !== undefined ? c.commission_rate : 5})" class="action-btn" style="background:#4F46E5;"><i class="ph ph-pencil-simple"></i></button>
                <button onclick="deleteCategory(${c.id})" class="action-btn" style="background:#EF4444;"><i class="ph ph-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

window.openAddCategoryModal = () => {
    document.getElementById('catId').value = '';
    document.getElementById('catName').value = '';
    document.getElementById('catIcon').value = '';
    document.getElementById('catCommissionRate').value = '5';
    document.getElementById('categoryModal').style.display = 'flex';
};

window.openEditCategoryModal = (id, name, icon, commissionRate) => {
    document.getElementById('catId').value = id;
    document.getElementById('catName').value = name;
    document.getElementById('catIcon').value = icon;
    document.getElementById('catCommissionRate').value = commissionRate !== undefined ? commissionRate : 5;
    document.getElementById('categoryModal').style.display = 'flex';
};

async function handleCategorySubmit(e) {
    e.preventDefault();
    const id = document.getElementById('catId').value;
    const data = { 
        name: document.getElementById('catName').value, 
        iconUrl: document.getElementById('catIcon').value,
        commission_rate: parseInt(document.getElementById('catCommissionRate').value) || 5
    };
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/admin/categories/${id}` : '/api/admin/categories';
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    refreshWithToast("Category saved", "success");
}

async function deleteCategory(id) {
    if (confirm("Delete category?")) {
        await fetch(`${API_BASE}/api/admin/categories/${id}`, { method: 'DELETE' });
        refreshWithToast("Category removed", "warning");
    }
}

async function fetchAdminBrands() {
    const res = await fetch(API_BASE + '/api/brands');
    const brands = await res.json();
    document.getElementById('brandsTableBody').innerHTML = brands.map(b => `
        <tr>
            <td>#${b.id}</td>
            <td>${b.name}</td>
            <td><button onclick="deleteBrand(${b.id})" class="action-btn" style="background:#EF4444;" title="Delete Brand"><i class="ph ph-trash"></i></button></td>
        </tr>
    `).join('');
}

window.openAddBrandModal = () => {
    document.getElementById('brandNameInput').value = '';
    document.getElementById('brandModal').style.display = 'flex';
};

async function handleBrandSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('brandNameInput').value;
    await fetch(API_BASE + '/api/admin/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    });
    refreshWithToast("Brand added", "success");
}

async function deleteBrand(id) {
    if (confirm("Remove brand?")) {
        await fetch(`${API_BASE}/api/admin/brands/${id}`, { method: 'DELETE' });
        refreshWithToast("Brand removed", "warning");
    }
}

async function fetchAdminCoupons(date = "") {
    try {
        const statsRes = await fetch(API_BASE + '/api/admin/coupons/stats');
        const stats = await statsRes.json();
        if (document.getElementById('statTotalSaved')) document.getElementById('statTotalSaved').innerText = `₹${Math.round(stats.totalSaved)}`;
        if (document.getElementById('statTotalUses')) document.getElementById('statTotalUses').innerText = stats.totalUses;

        const url = date ? `/api/admin/coupons?date=${date}` : '/api/admin/coupons';
        const res = await fetch(url);
        const coupons = await res.json();
        const tbody = document.getElementById('couponsTableBody');
        if (!tbody) return;
        tbody.innerHTML = coupons.map(c => `
            <tr>
                <td><div style="font-weight:700; color:#1E293B;">${c.code}</div></td>
                <td><span class="badge" style="background:#F1F5F9; color:#475569;">${c.discount_type === 'percent' ? c.discount_value + '%' : '₹' + c.discount_value}</span></td>
                <td>
                    <div style="font-size:0.85rem; font-weight:600; color:var(--text-main);">${c.discount_type === 'percent' ? 'Percentage' : 'Fixed Amount'}</div>
                    <div style="font-size:0.75rem; color:#64748B;">Min: ₹${c.min_amount}</div>
                </td>
                <td><span style="font-weight:600;">${c.useCount}</span></td>
                <td><span style="font-weight:700; color:#16A34A;">₹${Math.round(c.totalSaved || 0)}</span></td>
                <td style="font-size:0.85rem; color:#64748B;">${new Date(c.expiry_date).toLocaleDateString()}</td>
                <td>
                    <button onclick="deleteCoupon(${c.id})" class="action-btn" style="background:#EF4444;"><i class="ph ph-trash"></i></button>
                </td>
            </tr>
        `).join('');
    } catch (e) {}
}

async function handleCouponSubmit(e) {
    e.preventDefault();
    const data = {
        code: document.getElementById('couponCode').value.toUpperCase(),
        discount_value: Number(document.getElementById('couponValue').value),
        discount_type: document.getElementById('couponType').value,
        min_amount: Number(document.getElementById('couponMinAmt').value),
        expiry_date: document.getElementById('couponExpiry').value,
        is_one_time: document.getElementById('couponIsOneTime').checked ? 1 : 0,
        shop_id: document.getElementById('couponShopId')?.value || null
    };
    await fetch(API_BASE + '/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    refreshWithToast("Coupon distributed successfully", "success");
}

async function deleteCoupon(id) {
    if (confirm("Delete coupon?")) {
        await fetch(`${API_BASE}/api/admin/coupons/${id}`, { method: 'DELETE' });
        refreshWithToast("Coupon removed", "warning");
    }
}

async function fetchUsers(search = "", date = "") {
    let url = `/api/admin/users?search=${search}`;
    if (date) url += `&date=${date}`;
    const res = await fetch(url);
    const users = await res.json();
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    tbody.innerHTML = users.map(u => `
        <tr>
            <td>#${u.id}</td>
            <td><div style="font-weight:600;">${u.full_name || 'User'}</div><small>${u.username}</small></td>
            <td>${u.email || 'N/A'}</td>
            <td>${u.phone || 'N/A'}</td>
            <td><span style="background:#E0E7FF; color:#4F46E5; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight:700; text-transform:uppercase;">${u.role || 'customer'}</span></td>
            <td><span class="badge ${u.status || 'active'}">${u.status || 'active'}</span></td>
            <td><small>${new Date(u.created_at).toLocaleDateString()}</small></td>
            <td>
                <button onclick="toggleUserStatus('${u.id}', '${u.status === 'blocked' ? 'active' : 'blocked'}')" class="action-btn" style="background:${u.status === 'blocked' ? '#10B981' : '#F59E0B'};" title="${u.status === 'blocked' ? 'Unblock' : 'Block'} User"><i class="ph ph-prohibit"></i></button>
                <button onclick="changeUserRole('${u.id}', '${u.role === 'vendor' ? 'customer' : 'vendor'}')" class="action-btn" style="background:${u.role === 'vendor' ? '#F59E0B' : '#10B981'}; margin-left:5px;" title="${u.role === 'vendor' ? 'Demote to Customer' : 'Upgrade to Vendor'}"><i class="${u.role === 'vendor' ? 'ph ph-user-minus' : 'ph ph-user-gear'}"></i></button>
                <button onclick="deleteUser('${u.id}')" class="action-btn" style="background:#EF4444; margin-left:5px;"><i class="ph ph-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

async function toggleUserStatus(id, newStatus) {
    await fetch(`${API_BASE}/api/admin/users/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
    });
    refreshWithToast(`User ${newStatus === 'active' ? 'activated' : 'blocked'}`, "success");
}

async function changeUserRole(id, role) {
    try {
        const res = await fetch(`${API_BASE}/api/admin/users/${id}/role`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role })
        });
        const data = await res.json();
        if (res.ok) {
            refreshWithToast(data.message || `User role updated successfully!`, "success");
        } else {
            Toast.show(data.error || "Failed to update role", "error");
        }
    } catch (err) {
        Toast.show("Network error updating role", "error");
    }
}
window.changeUserRole = changeUserRole;

async function deleteUser(id) {
    if (confirm("Delete user?")) {
        await fetch(`${API_BASE}/api/admin/users/${id}`, { method: 'DELETE' });
        refreshWithToast("User removed", "warning");
    }
}

async function fetchAdminReviews(date = "") {
    const url = date ? `/api/admin/reviews?date=${date}` : '/api/admin/reviews';
    const res = await fetch(url);
    const reviews = await res.json();
    const tbody = document.getElementById('reviewsTableBody');
    if (!tbody) return;
    tbody.innerHTML = reviews.map(r => `
        <tr>
            <td><div style="font-weight:600;">${r.product_name}</div></td>
            <td><div style="font-weight:600;">${r.username}</div></td>
            <td><div style="color:#F59E0B;">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div></td>
            <td><small>${r.comment}</small></td>
            <td>${new Date(r.created_at).toLocaleDateString()}</td>
            <td><button onclick="deleteReview(${r.id})" class="action-btn" style="background:#EF4444;"><i class="ph ph-trash"></i></button></td>
        </tr>
    `).join('');
}

async function deleteReview(id) {
    if (confirm("Delete review?")) {
        await fetch(`${API_BASE}/api/admin/reviews/${id}`, { method: 'DELETE' });
        refreshWithToast("Review removed", "warning");
    }
}

// --- UTILS ---

async function fetchCategoriesForSelects() {
    const res = await fetch(API_BASE + '/api/categories');
    let cats = await res.json();

    const isVendor = getCookie('role') === 'vendor' || currentPortalRole === 'vendor';
    if (isVendor) {
        if (!window.vendorShop) {
            try {
                const shopRes = await adminFetch('/api/vendor/shop');
                if (shopRes.ok) {
                    window.vendorShop = await shopRes.json();
                }
            } catch (e) {
                console.error("Failed to load vendor shop details for category filtering", e);
            }
        }

        const shopType = window.vendorShop?.registered_shop;
        if (shopType) {
            const shopCategoriesMap = {
                'Fresh Produce Shop': ['Fresh Fruits', 'Vegetables'],
                'Frozen Shop': ['Frozen Foods', 'Desserts'],
                'Juice Shop': ['Drinks'],
                'Gold Shop': ['Gold Jewelry', 'Diamond Jewelry'],
                'Dressing Shop': ['Mens Wear', 'Womens Wear'],
                'General Store': ['Dals & Pulses', 'Snacks', 'Dairy & Bakery', 'Dry Fruits', 'Household'],
                'Pharmacy / Health Shop': ['Healthcare']
            };
            const allowed = shopCategoriesMap[shopType] || [];
            if (allowed.length > 0) {
                cats = cats.filter(c => allowed.some(name => name.toLowerCase() === c.name.toLowerCase()));
            }
        }
    }

    const options = cats.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    const selects = ['pCategory', 'editPCategory', 'adminProductCategory', 'bCategory', 'mfCategory', 'oCategory1', 'oCategory2', 'oCategory3'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const initial = id === 'adminProductCategory' ? '<option value="All">All Categories</option>' : '';
            el.innerHTML = initial + options;
        }
    });
}

function setupEventListeners() {
    document.getElementById('addProductForm')?.addEventListener('submit', handleAddProduct);
    document.getElementById('editProductForm')?.addEventListener('submit', handleEditProduct);
    document.getElementById('shopSettingsForm')?.addEventListener('submit', handleSaveSettings);
    document.getElementById('adminDeliverySettingsForm')?.addEventListener('submit', handleSaveDeliverySettings);
    document.getElementById('adminNotificationForm')?.addEventListener('submit', handleSendNotification);
    document.getElementById('adminMarqueeForm')?.addEventListener('submit', handleMarqueeSubmit);
    document.getElementById('bannerEditForm')?.addEventListener('submit', handleSaveBanner);
    document.getElementById('morningFreshBannerForm')?.addEventListener('submit', handleSaveMorningFreshBanner);
    [1,2,3].forEach(i => document.getElementById(`offerForm${i}`)?.addEventListener('submit', (e) => handleSaveOffer(e, i)));
    [1,2].forEach(i => document.getElementById(`vendorOfferForm${i}`)?.addEventListener('submit', (e) => handleSaveVendorOffer(e, i)));
    document.getElementById('categoryForm')?.addEventListener('submit', handleCategorySubmit);
    document.getElementById('brandForm')?.addEventListener('submit', handleBrandSubmit);
    document.getElementById('couponForm')?.addEventListener('submit', handleCouponSubmit);
    document.getElementById('adminSecurityForm')?.addEventListener('submit', handleSecurityUpdate);
    document.getElementById('appFeaturesForm')?.addEventListener('submit', handleSaveAppConfig);
    document.getElementById('adminPromoBannerForm')?.addEventListener('submit', handlePromoBannerSubmit);
    document.getElementById('vendorStorefrontForm')?.addEventListener('submit', handleVendorStorefrontSubmit);
    document.getElementById('vendorPayoutRequestForm')?.addEventListener('submit', handleVendorPayoutSubmit);
    document.getElementById('loyaltyProgramSettingsForm')?.addEventListener('submit', handleSaveLoyaltySettings);

    document.getElementById('mockVendorPaymentBtn')?.addEventListener('click', async () => {
        const spinner = document.getElementById('mockPaymentSpinner');
        const btnText = document.getElementById('mockSubmitBtnText');
        if (spinner) spinner.style.display = 'inline-block';
        if (btnText) btnText.innerText = "Processing sandbox transaction...";
        
        setTimeout(async () => {
            try {
                const res = await adminFetch('/api/vendor/renew-subscription', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        payment_id: 'pay_' + Math.random().toString(36).substring(2, 11),
                        amount: 500
                    })
                });
                const data = await res.json();
                if (res.ok) {
                    if (window.Toast) Toast.show(data.message || "Subscription renewed successfully!", "success");
                    closeMockPayment();
                    fetchVendorDashboardStats();
                } else {
                    if (window.Toast) Toast.show(data.error || "Failed to renew subscription", "error");
                    if (spinner) spinner.style.display = 'none';
                    if (btnText) btnText.innerText = "Authorize Payment";
                }
            } catch (err) {
                console.error("Renewal failed:", err);
                if (window.Toast) Toast.show("Error renewing subscription", "error");
                if (spinner) spinner.style.display = 'none';
                if (btnText) btnText.innerText = "Authorize Payment";
            }
        }, 1500);
    });
}

async function renewVendorSubscription() {
    const modal = document.getElementById('mockPaymentModal');
    if (!modal) return;
    
    document.getElementById('mockPaymentAmountText').innerText = '₹500';
    document.getElementById('mockSubmitBtnText').innerText = "Authorize Payment";
    
    const spinner = document.getElementById('mockPaymentSpinner');
    if (spinner) spinner.style.display = 'none';
    
    modal.style.display = 'flex';
}
window.renewVendorSubscription = renewVendorSubscription;

function closeMockPayment() {
    const modal = document.getElementById('mockPaymentModal');
    if (modal) modal.style.display = 'none';
}
window.closeMockPayment = closeMockPayment;

async function handleSecurityUpdate(e) {
    e.preventDefault();
    const newPassword = document.getElementById('secNewPassword').value;
    const full_name = document.getElementById('secFullName').value;
    const phone = document.getElementById('secPhone').value;
    const security_q1 = document.getElementById('secQ1').value;
    const security_a1 = document.getElementById('secA1').value;
    const security_q2 = document.getElementById('secQ2').value;
    const security_a2 = document.getElementById('secA2').value;

    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.innerHTML = '<i class="ph ph-spinner-gap ph-spin"></i> Updating...';

    try {
        const payload = {};
        if (newPassword) payload.newPassword = newPassword;
        if (full_name) payload.full_name = full_name;
        if (phone) payload.phone = phone;
        if (security_q1) payload.security_q1 = security_q1;
        if (security_a1) payload.security_a1 = security_a1;
        if (security_q2) payload.security_q2 = security_q2;
        if (security_a2) payload.security_a2 = security_a2;

        const res = await fetch(API_BASE + '/api/admin/security', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.ok) {
            Toast.show("Security credentials updated successfully", "success");
            e.target.reset();
        } else {
            Toast.show(data.error || "Update failed", "error");
        }
    } catch (err) {
        Toast.show("Connection error", "error");
    } finally {
        btn.disabled = false;
        btn.innerText = 'Update Security Credentials';
    }
}

window.togglePasswordVisibility = (id, el) => {
    const input = document.getElementById(id);
    if (input.type === 'password') {
        input.type = 'text'; el.classList.replace('ph-eye', 'ph-eye-closed');
    } else {
        input.type = 'password'; el.classList.replace('ph-eye-closed', 'ph-eye');
    }
};

// Global Exports
window.showSection = showSection;
window.toggleAdminSidebar = toggleAdminSidebar;
window.adminLogout = adminLogout;
window.fetchDashboardStats = fetchDashboardStats;
window.fetchOrders = fetchOrders; 
window.fetchAdminProducts = fetchAdminProducts;
window.viewMessage = viewMessage;
window.openEditModal = openEditModal;
window.deleteProduct = deleteProduct;
window.updateOrderStatus = updateOrderStatus;
window.deleteOrder = deleteOrder;
window.fetchMessages = fetchMessages;
window.viewMessage = viewMessage;
window.deleteMessage = deleteMessage;
window.deleteNotification = deleteNotification;
window.clearAllNotifications = clearAllNotifications;
window.toggleUserStatus = toggleUserStatus;
window.deleteUser = deleteUser;
window.deleteReview = deleteReview;
window.deleteCategory = deleteCategory;
window.deleteBrand = deleteBrand;
window.deleteCoupon = deleteCoupon;
window.openAddCategoryModal = openAddCategoryModal;
window.openEditCategoryModal = openEditCategoryModal;
window.openAddBrandModal = openAddBrandModal;
window.openAddCouponModal = () => {
    document.getElementById('couponForm').reset();
    document.getElementById('couponModal').style.display = 'flex';
};
window.loadProductForQuickVariants = loadProductForQuickVariants;

async function checkSystemHealth() {
    try {
        const res = await fetch(API_BASE + '/api/admin/system/health');
        const data = await res.json();
        
        const healthStatus = document.getElementById('statHealthStatus');
        const healthBox = document.getElementById('healthWarningBox');
        const healthSql = document.getElementById('healthWarningSql');
        
        if (healthStatus) {
            healthStatus.innerText = data.status === 'healthy' ? 'Healthy' : 'Sync Required';
            healthStatus.style.color = data.status === 'healthy' ? '#10B981' : '#EF4444';
        }
        
        if (data.status === 'degraded') {
            if (healthBox && healthSql) {
                healthBox.style.display = 'block';
                const totalSql = data.missing_columns.map(c => c.sql).join('\n');
                healthSql.innerText = totalSql;
            }
        } else {
            if (healthBox) healthBox.style.display = 'none';
        }
    } catch (err) {
        console.error("Health check failed", err);
    }
}

window.copyHealthSql = () => {
    const sql = document.getElementById('healthWarningSql').innerText;
    navigator.clipboard.writeText(sql).then(() => {
        Toast.show("SQL copied to clipboard", "success");
    });
};

// Update fetchDashboardStats to include health check
const originalFetchDashboardStats = window.fetchDashboardStats;
window.fetchDashboardStats = async function() {
    if (typeof originalFetchDashboardStats === 'function') await originalFetchDashboardStats();
    await checkSystemHealth();
};

// Initial health check
if (getCookie('admin_auth') === 'true') {
    checkSystemHealth();
}

async function fetchCancelledPayments(search = "", date = "") {
    try {
        let url = `/api/admin/orders/cancelled?search=${search}`;
        if (date) url += `&date=${date}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch cancelled payments");
        const orders = await res.json();

        const tbody = document.getElementById('cancelledOrdersTableBody');
        if (!tbody) return;

        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:3rem; color:#64748B;">No cancelled payments found.</td></tr>';
            return;
        }

        tbody.innerHTML = orders.map(o => `
            <tr>
                <td>#${o.display_id || o.id}</td>
                <td>
                    <div style="font-weight:600; color:#1E293B;">${o.full_name}</div>
                    <div style="font-size:0.75rem; color:#64748B;">${o.phone}</div>
                </td>
                <td style="font-weight:600; color:#EF4444;">₹${o.total}</td>
                <td>
                    <div style="font-size:0.85rem; color:#475569;">${o.payment_method.toUpperCase()}</div>
                    <div style="font-size:0.75rem; color:#EF4444; font-weight:600;">
                        ${o.payment_status.toUpperCase()}
                    </div>
                </td>
                <td style="font-size:0.85rem; color:#475569;">${new Date(o.created_at).toLocaleDateString()}</td>
                <td><span class="status-badge badge-cancelled">CANCELLED</span></td>
                <td>
                    <button class="action-btn" title="View Details" onclick="viewOrderDetails(${o.id})">
                        <i class="ph ph-eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error(e);
        if (window.Toast) Toast.show("Could not load cancelled payments", "error");
    }
}

window.viewOrderDetails = async (id) => {
    try {
        const res = await fetch(`${API_BASE}/api/admin/orders`);
        const orders = await res.json();
        const o = orders.find(x => x.id === id);
        if (!o) return Toast.show("Order not found", "error");

        const items = typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []);
        const itemsHtml = items.map(i => `
            <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f1f5f9;">
                <span>${i.name} ${i.weight ? `(${i.weight})` : ''} x${i.quantity}</span>
                <span style="font-weight:600;">₹${i.price * i.quantity}</span>
            </div>
        `).join('');

        document.getElementById('orderDetailContent').innerHTML = `
            <div style="background:#F8FAFC; padding:1rem; border-radius:8px; margin-bottom:1rem;">
                <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                    <span style="color:#64748B;">Customer:</span>
                    <strong style="color:#1E293B;">${o.full_name}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                    <span style="color:#64748B;">Phone:</span>
                    <strong style="color:#1E293B;">${o.phone}</strong>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:#64748B;">Address:</span>
                    <strong style="color:#1E293B; text-align:right; max-width:200px;">${o.address}</strong>
                </div>
            </div>
            <h4 style="margin-bottom:0.5rem; color:#475569;">Items</h4>
            <div style="margin-bottom:1rem;">${itemsHtml}</div>
            <div style="display:flex; justify-content:space-between; font-size:1.1rem; font-weight:700; color:#1E293B; border-top:2px solid #E2E8F0; padding-top:0.5rem;">
                <span>Total Amount</span>
                <span>₹${o.total}</span>
            </div>
        `;
        document.getElementById('orderDetailModal').style.display = 'flex';
    } catch (err) {
        console.error(err);
        Toast.show("Error loading details", "error");
    }
};

// --- PROMO BANNERS ---

async function fetchPromoBannersAdmin() {
    try {
        const heroCard = document.getElementById('platformHeroBannerCard');
        const morningCard = document.getElementById('platformMorningFreshBannerCard');
        const offersCard = document.getElementById('platformOffersCard');
        const slidingCard = document.getElementById('slidingPromoBannersCard');
        
        if (currentPortalRole === 'vendor') {
            if (heroCard) heroCard.style.display = 'none';
            if (morningCard) morningCard.style.display = 'none';
            if (offersCard) offersCard.style.display = 'none';
            if (slidingCard) slidingCard.style.display = 'none';
        } else {
            if (heroCard) heroCard.style.display = 'block';
            if (morningCard) morningCard.style.display = 'block';
            if (offersCard) offersCard.style.display = 'grid';
            if (slidingCard) slidingCard.style.display = 'block';
        }

        const url = currentPortalRole === 'vendor' ? `${API_BASE}/api/vendor/promo-banners` : `${API_BASE}/api/admin/promo-banners`;
        const res = await adminFetch(url);
        const banners = await res.json();
        const tbody = document.getElementById('promoBannersTableBody');
        if (!tbody) return;
        
        if (banners.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem; color:#64748B;">No promo banners added yet. Max 6 allowed.</td></tr>';
            return;
        }

        tbody.innerHTML = banners.map(b => `
            <tr>
                <td style="font-weight:700;">${b.displayOrder}</td>
                <td><img src="${b.imageUrl}" style="width:120px; height:60px; object-fit:cover; border-radius:4px; border:1px solid #E2E8F0;"></td>
                <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:0.8rem; color:#64748B;">${b.imageUrl}</td>
                <td style="font-size:0.8rem; font-weight:600;">${b.linkUrl}</td>
                <td style="text-align:right;">
                    <button onclick="deletePromoBanner(${b.id})" class="action-btn" style="background:#EF4444;"><i class="ph ph-trash"></i></button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error("Promo banner fetch error:", e);
    }
}

async function handlePromoBannerSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;

    const data = {
        imageUrl: document.getElementById('promoImgUrl').value,
        linkUrl: document.getElementById('promoLinkUrl').value,
        displayOrder: Number(document.getElementById('promoOrder').value)
    };

    try {
        const url = currentPortalRole === 'vendor' ? `${API_BASE}/api/vendor/promo-banners` : `${API_BASE}/api/admin/promo-banners`;
        const res = await adminFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const resData = await res.json();
        if (res.ok) {
            Toast.show("Promo banner added successfully", "success");
            e.target.reset();
            fetchPromoBannersAdmin();
        } else {
            Toast.show(resData.error || "Failed to add banner", "error");
        }
    } catch (err) {
        Toast.show("Connection error", "error");
    } finally {
        btn.disabled = false;
    }
}

async function deletePromoBanner(id) {
    if (confirm("Permanently delete this promo banner?")) {
        try {
            const url = currentPortalRole === 'vendor' ? `${API_BASE}/api/vendor/promo-banners/${id}` : `${API_BASE}/api/admin/promo-banners/${id}`;
            const res = await adminFetch(url, { method: 'DELETE' });
            if (res.ok) {
                Toast.show("Banner deleted", "warning");
                fetchPromoBannersAdmin();
            } else {
                const resData = await res.json();
                Toast.show(resData.error || "Error deleting banner", "error");
            }
        } catch (e) {
            Toast.show("Error deleting banner", "error");
        }
    }
}

window.deletePromoBanner = deletePromoBanner;
window.fetchPromoBannersAdmin = fetchPromoBannersAdmin;

// ==========================================================================
// NEW ECOSYSTEM PLATFORM CONTROLLERS (SUPER ADMIN & VENDOR DASHBOARDS)
// ==========================================================================

// --- FEATURE FLAGS SWITCHBOARD (SUPER ADMIN) ---
async function fetchFeatureFlags() {
    try {
        const res = await fetch('/api/admin/features');
        if (!res.ok) throw new Error("Could not load features.");
        const flags = await res.json();
        
        const grid = document.getElementById('featureFlagsGrid');
        if (!grid) return;
        
        if (flags.length === 0) {
            grid.innerHTML = '<div style="text-align:center; padding:3rem; color:#64748B; grid-column:1/-1;">No feature flags configured in the database.</div>';
            return;
        }
        
        grid.innerHTML = flags.map(flag => {
            return `
                <div class="form-card" style="display:flex; justify-content:space-between; align-items:center; padding:1.5rem; border-radius:12px; border:1px solid #E2E8F0; background:white; max-width: none; margin-bottom: 0; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                    <div>
                        <h4 style="margin:0 0 0.25rem 0; font-size:1.05rem; color:#1E293B;">${flag.label}</h4>
                        <span style="font-size:0.75rem; color:#64748B; font-family:monospace;">Flag ID: ${flag.name}</span>
                    </div>
                    <label class="toggle-switch" style="position: relative; display: inline-block; width: 50px; height: 24px;">
                        <input type="checkbox" ${flag.is_active ? 'checked' : ''} onchange="toggleFeatureFlag(${flag.id}, this.checked)" style="opacity:0; width:0; height:0;">
                        <span class="slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 24px;"></span>
                    </label>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error(e);
        if (window.Toast) Toast.show("Could not load feature switchboard", "error");
    }
}

async function toggleFeatureFlag(id, is_active) {
    try {
        const res = await fetch(`/api/admin/features/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active })
        });
        if (!res.ok) throw new Error("Failed to toggle feature flag.");
        const data = await res.json();
        if (window.Toast) Toast.show(data.message || "Feature flag updated!", "success");
    } catch (e) {
        console.error(e);
        if (window.Toast) Toast.show("Error toggling feature", "error");
        fetchFeatureFlags(); // Reset visual state
    }
}

// --- VENDOR KYC APPROVALS (SUPER ADMIN) ---
async function fetchVendorApprovals() {
    try {
        const res = await adminFetch('/api/admin/vendors');
        if (!res.ok) throw new Error("Could not load vendors.");
        const vendors = await res.json();
        
        const tbody = document.getElementById('vendorApprovalsTableBody');
        if (!tbody) return;
        
        if (vendors.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:3rem; color:#64748B;">No shop onboarding applications found.</td></tr>';
            return;
        }
        
        tbody.innerHTML = vendors.map(v => {
            const hasKyc = v.kyc_document && v.kyc_document.startsWith('http');
            const docHtml = hasKyc 
                ? `<a href="${v.kyc_document}" target="_blank" style="color:var(--primary); font-weight:600; text-decoration:none;"><i class="ph ph-file-pdf"></i> View KYC Document</a>`
                : `<span style="color:#64748B; font-style:italic;">${v.kyc_document || 'No document uploaded'}</span>`;
                
            let statusColor = '#D97706'; // Amber for pending
            let statusBg = '#FEF3C7';
            if (v.status === 'active') { statusColor = '#10B981'; statusBg = '#F0FDF4'; }
            if (v.status === 'suspended') { statusColor = '#EF4444'; statusBg = '#FEF2F2'; }

            return `
                <tr>
                    <td style="font-family:monospace; color:#64748B;">#SHOP_${v.id}</td>
                    <td>
                        <div style="display:flex; align-items:center; gap:0.75rem;">
                            <img src="${v.logo || 'https://placehold.co/40'}" style="width:36px; height:36px; border-radius:8px; object-fit:cover;" onerror="this.src='https://placehold.co/40'">
                            <div>
                                <div style="font-weight:600; color:#1E293B;">${v.name}</div>
                                <div style="font-size:0.75rem; color:#64748B;">${v.description || ''}</div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span style="font-weight:600; color:#1E293B; background:#F1F5F9; border:1px solid #E2E8F0; padding:4px 8px; border-radius:6px; font-size:0.8rem;">
                            ${v.registered_shop || 'N/A'}
                        </span>
                    </td>
                    <td>
                        <div style="font-weight:600; color:#1E293B;">${v.users?.full_name || 'N/A'}</div>
                        <div style="font-size:0.75rem; color:#64748B;">${v.contact_phone || v.users?.phone || ''}</div>
                    </td>
                    <td>${docHtml}</td>
                    <td>
                        <div style="font-size:0.85rem; font-weight:600;">${v.category}</div>
                        <div style="font-size:0.75rem; color:#64748B; margin-bottom:4px;">Rate: ${v.commission_rate !== undefined ? v.commission_rate : 5}%</div>
                        <div style="display:flex; gap:4px; align-items:center;">
                            <input type="number" id="commission-rate-${v.id}" value="${v.commission_rate !== undefined ? v.commission_rate : 5}" style="width:50px; padding:2px 4px; border:1px solid var(--border); border-radius:4px; font-size:0.75rem;" min="0" max="100">
                            <button onclick="updateVendorCommission(${v.id})" style="padding:2px 6px; background:var(--primary); color:white; border:none; border-radius:4px; font-size:0.7rem; font-weight:700; cursor:pointer;">Set</button>
                        </div>
                    </td>
                    <td>
                        <span style="display:inline-block; padding:4px 10px; border-radius:20px; font-size:0.75rem; font-weight:700; background:${statusBg}; color:${statusColor}; text-transform:uppercase;">
                            ${v.status}
                        </span>
                    </td>
                    <td>
                        <div style="display:flex; gap:6px; justify-content:flex-end; padding-right:1rem;">
                            ${v.status !== 'active' ? `
                                <button onclick="updateVendorStatus(${v.id}, 'active')" class="action-btn" style="background:#10B981; font-size:0.75rem; padding:4px 10px; width:auto; height:auto; border-radius:6px; font-weight:700; color:white; border:none; cursor:pointer;" title="Approve Store">
                                    Approve
                                </button>
                            ` : ''}
                            ${v.status !== 'suspended' ? `
                                <button onclick="updateVendorStatus(${v.id}, 'suspended')" class="action-btn" style="background:#EF4444; font-size:0.75rem; padding:4px 10px; width:auto; height:auto; border-radius:6px; font-weight:700; color:white; border:none; cursor:pointer;" title="Suspend Store">
                                    Suspend
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error(e);
        if (window.Toast) Toast.show("Could not load vendor onboarding list", "error");
    }
}

async function updateVendorCommission(id) {
    const rateInput = document.getElementById(`commission-rate-${id}`);
    if (!rateInput) return;
    const rate = parseInt(rateInput.value);
    if (isNaN(rate) || rate < 0 || rate > 100) {
        if (window.Toast) Toast.show("Please enter a valid commission rate percentage (0-100).", "error");
        return;
    }

    try {
        const res = await adminFetch(`/api/admin/vendors/${id}/commission`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ commission_rate: rate })
        });
        if (!res.ok) throw new Error("Failed to update commission rate.");
        const data = await res.json();
        if (window.Toast) Toast.show(data.message || "Commission rate updated!", "success");
        fetchVendorApprovals();
    } catch(e) {
        console.error(e);
        if (window.Toast) Toast.show("Error updating commission rate", "error");
    }
}
window.updateVendorCommission = updateVendorCommission;

async function updateVendorStatus(id, status) {
    if (!confirm(`Are you sure you want to change shop status to: ${status}?`)) return;
    try {
        const res = await adminFetch(`/api/admin/vendors/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        if (!res.ok) throw new Error("Failed to update status.");
        const data = await res.json();
        if (window.Toast) Toast.show(data.message || "Vendor shop status updated!", "success");
        fetchVendorApprovals();
    } catch (e) {
        console.error(e);
        if (window.Toast) Toast.show("Error updating status", "error");
    }
}

// --- VENDOR PORTAL: DASHBOARD OVERVIEW ---
async function fetchVendorDashboardStats() {
    try {
        const res = await adminFetch('/api/vendor/wallet');
        if (!res.ok) throw new Error("Could not load vendor stats.");
        const data = await res.json();
        
        // Fill metrics
        if (document.getElementById('vendorStatWallet')) document.getElementById('vendorStatWallet').innerText = `₹${data.wallet?.balance || 0}`;
        if (document.getElementById('vendorStatSales')) document.getElementById('vendorStatSales').innerText = `₹${data.wallet?.revenue || 0}`;
        if (document.getElementById('vendorStatProducts')) document.getElementById('vendorStatProducts').innerText = data.metrics?.totalProducts || 0;
        if (document.getElementById('vendorStatOrders')) document.getElementById('vendorStatOrders').innerText = data.metrics?.pendingOrders || 0;
        
        // Fetch shop details for quick preview card
        const shopRes = await adminFetch('/api/vendor/shop');
        const shop = await shopRes.json();
        window.vendorShop = shop;
        
        if (shop && !shop.error) {
            if (document.getElementById('vendorShopStatusBadge')) {
                let badge = document.getElementById('vendorShopStatusBadge');
                badge.innerText = `Shop Status: ${shop.status.toUpperCase()}`;
                if (shop.status === 'active') {
                    badge.style.background = '#F0FDF4'; badge.style.color = '#16A34A'; badge.style.borderColor = '#BBF7D0';
                } else {
                    badge.style.background = '#FEF3C7'; badge.style.color = '#D97706'; badge.style.borderColor = '#FDE68A';
                }
            }
            if (document.getElementById('vendorShopQuickName')) document.getElementById('vendorShopQuickName').innerText = shop.name;
            if (document.getElementById('vendorShopQuickDesc')) document.getElementById('vendorShopQuickDesc').innerText = shop.description || 'No description provided';
            if (document.getElementById('vendorShopQuickCategory')) document.getElementById('vendorShopQuickCategory').innerHTML = `<i class="ph ph-tag"></i> ${shop.category}`;
            if (document.getElementById('vendorShopQuickTimings')) document.getElementById('vendorShopQuickTimings').innerHTML = `<i class="ph ph-clock"></i> ${shop.timings || '9:00 AM - 10:00 PM'}`;
            if (document.getElementById('vendorShopQuickPhone')) document.getElementById('vendorShopQuickPhone').innerHTML = `<i class="ph ph-phone"></i> ${shop.contact_phone || ''}`;
            if (document.getElementById('vendorShopQuickLogo')) {
                const img = document.getElementById('vendorShopQuickLogo').querySelector('img');
                if (img) img.src = shop.logo || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=150';
            }

            // Render subscription details
            if (shop.subscription_expires) {
                const expires = new Date(shop.subscription_expires);
                const diffTime = expires - new Date();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (document.getElementById('vendorSubExpiryVal')) {
                    document.getElementById('vendorSubExpiryVal').innerText = expires.toLocaleDateString();
                }
                if (document.getElementById('vendorSubDaysVal')) {
                    if (diffDays <= 0) {
                        document.getElementById('vendorSubDaysVal').innerText = "Expired";
                        document.getElementById('vendorSubDaysVal').style.color = "#EF4444";
                    } else {
                        document.getElementById('vendorSubDaysVal').innerText = `${diffDays} Days`;
                        document.getElementById('vendorSubDaysVal').style.color = diffDays < 15 ? "#F59E0B" : "#10B981";
                    }
                }
            } else {
                if (document.getElementById('vendorSubExpiryVal')) {
                    document.getElementById('vendorSubExpiryVal').innerText = "Never";
                }
                if (document.getElementById('vendorSubDaysVal')) {
                    document.getElementById('vendorSubDaysVal').innerText = "Active";
                    document.getElementById('vendorSubDaysVal').style.color = "#10B981";
                }
            }
        }
    } catch (e) {
        console.error("Failed to load vendor stats", e);
    }
}

// --- VENDOR PORTAL: STORE DETAILS CUSTOMIZER ---
async function fetchVendorShopDetails() {
    try {
        const res = await adminFetch('/api/vendor/shop');
        const shop = await res.json();
        window.vendorShop = shop;
        
        const onboardingMsg = document.getElementById('vendorOnboardingMessage');
        const kycContainer = document.getElementById('kycDocContainer');
        const submitBtn = document.getElementById('vStoreSubmitBtn');
        
        if (res.status === 404 || shop.onboardPending) {
            // Not onboarded yet
            if (onboardingMsg) onboardingMsg.style.display = 'none';
            if (kycContainer) kycContainer.style.display = 'block';
            if (submitBtn) submitBtn.innerText = "Apply for Shop Onboarding";
            
            // Clear inputs
            document.getElementById('vStoreName').value = '';
            document.getElementById('vStoreRegisteredShop').value = '';
            document.getElementById('vStoreDesc').value = '';
            document.getElementById('vStoreLogo').value = '';
            document.getElementById('vStoreBanner').value = '';
            document.getElementById('vStoreTimings').value = '';
            document.getElementById('vStorePhone').value = '';
            document.getElementById('vStoreKyc').value = '';
            
            if (document.getElementById('vStoreActiveToggle')) document.getElementById('vStoreActiveToggle').checked = true;
            if (document.getElementById('vStoreShowOffersToggle')) document.getElementById('vStoreShowOffersToggle').checked = true;
            
            // Check settings to show setup fee card
            try {
                const settingsRes = await fetch(API_BASE + '/api/settings');
                const s = await settingsRes.json();
                window.vendorOnboardingSettings = s; // Save globally
                
                const payCard = document.getElementById('vendorPaymentSummaryCard');
                if (payCard && s.vendor_fee_amount > 0) {
                    payCard.style.display = 'block';
                    document.getElementById('vPayBaseFee').innerText = '₹' + s.vendor_fee_amount;
                    document.getElementById('vPayTotalAmount').innerText = '₹' + s.vendor_fee_amount;
                    document.getElementById('vPayDiscountRow').style.display = 'none';
                    const feedback = document.getElementById('vCouponFeedbackMessage');
                    if (feedback) feedback.style.display = 'none';
                    const input = document.getElementById('vOnboardingCouponInput');
                    if (input) input.value = '';
                    window.appliedOnboardingCoupon = null;
                } else if (payCard) {
                    payCard.style.display = 'none';
                }
            } catch(err) {
                console.error("Failed to load setup settings", err);
            }
        } else {
            // Onboarded
            if (onboardingMsg) onboardingMsg.style.display = shop.status === 'pending' ? 'block' : 'none';
            if (kycContainer) kycContainer.style.display = 'none'; // Lock KYC once created
            if (submitBtn) submitBtn.innerText = "Save Storefront Changes";
            
            const payCard = document.getElementById('vendorPaymentSummaryCard');
            if (payCard) payCard.style.display = 'none';
            
            document.getElementById('vStoreName').value = shop.name;
            document.getElementById('vStoreRegisteredShop').value = shop.registered_shop || '';
            document.getElementById('vStoreCategory').value = shop.category || 'General Store';
            document.getElementById('vStoreDesc').value = shop.description || '';
            document.getElementById('vStoreLogo').value = shop.logo || '';
            document.getElementById('vStoreBanner').value = shop.banner || '';
            document.getElementById('vStoreTimings').value = shop.timings || '';
            document.getElementById('vStorePhone').value = shop.contact_phone || '';
            
            if (document.getElementById('vStoreActiveToggle')) {
                document.getElementById('vStoreActiveToggle').checked = shop.is_active_store !== 0;
            }
            if (document.getElementById('vStoreShowOffersToggle')) {
                document.getElementById('vStoreShowOffersToggle').checked = shop.show_special_offers !== 0;
            }
        }
    } catch (e) {
        console.error(e);
    }
}

function applyOnboardingCoupon() {
    const input = document.getElementById('vOnboardingCouponInput');
    const feedback = document.getElementById('vCouponFeedbackMessage');
    const discountRow = document.getElementById('vPayDiscountRow');
    const discountEl = document.getElementById('vPayDiscount');
    const totalEl = document.getElementById('vPayTotalAmount');
    
    if (!input || !window.vendorOnboardingSettings) return;
    
    const code = input.value.trim().toUpperCase();
    const settings = window.vendorOnboardingSettings;
    
    if (feedback) feedback.style.display = 'block';
    
    if (!code) {
        if (feedback) {
            feedback.innerText = "Please enter a coupon code.";
            feedback.style.color = '#EF4444';
        }
        return;
    }
    
    if (settings.vendor_fee_coupon && code === settings.vendor_fee_coupon.trim().toUpperCase()) {
        const disc = settings.vendor_fee_discount || 0;
        if (feedback) {
            feedback.innerText = `Coupon Applied! ₹${disc} Discount Unlocked.`;
            feedback.style.color = '#16A34A';
        }
        
        if (discountRow) discountRow.style.display = 'flex';
        if (discountEl) discountEl.innerText = `-₹${disc}`;
        
        const finalAmt = Math.max(0, settings.vendor_fee_amount - disc);
        if (totalEl) totalEl.innerText = `₹${finalAmt}`;
        window.appliedOnboardingCoupon = code;
    } else {
        if (feedback) {
            feedback.innerText = "Invalid Coupon Code. Please check spelling.";
            feedback.style.color = '#EF4444';
        }
        
        if (discountRow) discountRow.style.display = 'none';
        if (totalEl) totalEl.innerText = `₹${settings.vendor_fee_amount}`;
        window.appliedOnboardingCoupon = null;
    }
}
window.applyOnboardingCoupon = applyOnboardingCoupon;

async function handleVendorStorefrontSubmit(e) {
    e.preventDefault();
    const isNew = document.getElementById('vStoreSubmitBtn').innerText.includes('Apply');
    
    const payload = {
        name: document.getElementById('vStoreName').value,
        registered_shop: document.getElementById('vStoreRegisteredShop').value,
        category: document.getElementById('vStoreCategory').value,
        description: document.getElementById('vStoreDesc').value,
        logo: document.getElementById('vStoreLogo').value,
        banner: document.getElementById('vStoreBanner').value,
        timings: document.getElementById('vStoreTimings').value,
        contact_phone: document.getElementById('vStorePhone').value,
        is_active_store: document.getElementById('vStoreActiveToggle').checked ? 1 : 0,
        show_special_offers: document.getElementById('vStoreShowOffersToggle').checked ? 1 : 0,
    };
    
    if (isNew) {
        payload.kyc_document = document.getElementById('vStoreKyc').value;
    }
    
    if (isNew && window.vendorOnboardingSettings && window.vendorOnboardingSettings.vendor_fee_amount > 0) {
        const s = window.vendorOnboardingSettings;
        const disc = window.appliedOnboardingCoupon ? s.vendor_fee_discount : 0;
        const finalAmt = Math.max(0, s.vendor_fee_amount - disc);
        
        if (finalAmt > 0) {
            // Initiate Razorpay checkout flow
            try {
                const orderRes = await adminFetch(API_BASE + '/api/vendor/create-registration-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ couponCode: window.appliedOnboardingCoupon || '' })
                });
                
                if (!orderRes.ok) {
                    const err = await orderRes.json();
                    return Toast.show(err.error || "Failed to initialize payment order", "error");
                }
                
                const orderData = await orderRes.json();
                
                // Open Razorpay Checkout modal
                const options = {
                    key: orderData.keyId,
                    amount: orderData.amount * 100, // in paise
                    currency: "INR",
                    name: "ADYANTA Vendor Portal",
                    description: "Vendor Registration & Onboarding Fee",
                    order_id: orderData.orderId,
                    handler: async function (response) {
                        // Payment successful callback
                        payload.razorpay_payment_id = response.razorpay_payment_id;
                        payload.razorpay_order_id = response.razorpay_order_id;
                        payload.razorpay_signature = response.razorpay_signature;
                        payload.couponCode = window.appliedOnboardingCoupon || '';
                        
                        await submitVendorRegistration(payload, true);
                    },
                    prefill: {
                        contact: payload.contact_phone
                    },
                    theme: { color: "#D97706" } // gold color
                };
                
                const rzp1 = new Razorpay(options);
                rzp1.open();
                return;
            } catch (err) {
                console.error(err);
                return Toast.show("Error launching Razorpay checkout popup", "error");
            }
        }
    }
    
    // Default flow: direct submit
    await submitVendorRegistration(payload, isNew);
}

async function submitVendorRegistration(payload, isNew = true) {
    const url = isNew ? '/api/vendor/register' : '/api/vendor/shop';
    const method = isNew ? 'POST' : 'PATCH';
    
    try {
        const res = await adminFetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (res.ok) {
            if (window.Toast) Toast.show(data.message || "Store details submitted successfully!", "success");
            fetchVendorShopDetails();
        } else {
            if (window.Toast) Toast.show(data.error || "Failed to submit store details", "error");
        }
    } catch(err) {
        console.error(err);
        if (window.Toast) Toast.show("Network error submitting storefront details", "error");
    }
}

// --- VENDOR PORTAL: WALLET & BANK PAYOUTS ---
async function fetchVendorWalletDetails() {
    try {
        const res = await adminFetch('/api/vendor/wallet');
        if (!res.ok) throw new Error();
        const data = await res.json();
        
        const bal = data.wallet?.balance || 0;
        const gross = data.wallet?.revenue || 0;
        const comm = Math.round(gross * 0.05);
        
        if (document.getElementById('vendorWalletBal')) document.getElementById('vendorWalletBal').innerText = `₹${bal}`;
        if (document.getElementById('vendorWalletGross')) document.getElementById('vendorWalletGross').innerText = `₹${gross}`;
        if (document.getElementById('vendorWalletComm')) document.getElementById('vendorWalletComm').innerText = `₹${comm}`;
        
        const amountField = document.getElementById('payoutAmt');
        if (amountField) {
            amountField.value = bal;
            amountField.max = bal;
        }
    } catch (e) {}
}

async function handleVendorPayoutSubmit(e) {
    e.preventDefault();
    const amt = Number(document.getElementById('payoutAmt').value);
    if (amt <= 0) return Toast.show("Invalid payout amount.", "error");
    
    // Simulate settlement approval trigger
    if (window.Toast) Toast.show(`Payout of ₹${amt} requested! Bank settlement completed within 24 hours.`, "success");
}

// --- TARGET SHOPS FOR COUPONS ---
async function populateCouponShopsDropdown() {
    const selector = document.getElementById('couponShopId');
    const container = document.getElementById('couponShopTargetGroup');
    if (!selector) return;
    
    if (currentPortalRole === 'vendor') {
        if (container) container.style.display = 'none';
        try {
            const res = await adminFetch('/api/vendor/shop');
            const shop = await res.json();
            if (shop && shop.id) {
                selector.innerHTML = `<option value="${shop.id}">${shop.name}</option>`;
            }
        } catch(e) {}
    } else {
        if (container) container.style.display = 'block';
        try {
            const res = await adminFetch('/api/admin/vendors');
            const shops = await res.json();
            
            selector.innerHTML = '<option value="">Global Marketplace Coupon (All Shops)</option>' + 
                shops.filter(s => s.status === 'active').map(s => {
                    return `<option value="${s.id}">${s.name}</option>`;
                }).join('');
        } catch(e) {
            selector.innerHTML = '<option value="">Global Marketplace Coupon (All Shops)</option>';
        }
    }
}

// --- VENDOR CUSTOMER SUPPORT CHAT PANEL ---
let vendorChats = [];
let activeVendorChatId = null;
let activeVendorChatUserName = '';
let vendorChatPollInterval = null;
let lastVendorMessageCount = 0;

async function loadVendorChats() {
    try {
        const res = await adminFetch(API_BASE + '/api/vendor/support/chats');
        if (!res.ok) return;
        vendorChats = await res.json();
        renderVendorChatsList();
        
        // If there's an active chat, refresh it silently
        if (activeVendorChatId) {
            await fetchActiveChatHistory(true);
        }
    } catch (err) {
        console.error("Failed to load vendor chats:", err);
    }
}

function renderVendorChatsList() {
    const listEl = document.getElementById('vendorChatList');
    if (!listEl) return;
    
    if (vendorChats.length === 0) {
        listEl.innerHTML = '<div style="padding: 2rem 1rem; text-align: center; color: #64748B; font-size: 0.85rem;">No active conversations</div>';
        return;
    }
    
    listEl.innerHTML = vendorChats.map(c => {
        const isActive = c.chat_id === activeVendorChatId;
        const activeBg = isActive ? '#E2E8F0' : '#ffffff';
        const lastMsg = c.last_message || 'No messages';
        const timeStr = c.created_at ? new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const unreadBadge = c.unread_count > 0 ? `<span style="background: #ef4444; color: white; font-size: 0.65rem; font-weight: 700; padding: 2px 6px; border-radius: 10px; min-width: 18px; text-align: center;">${c.unread_count}</span>` : '';
        
        return `
            <div class="chat-item ${isActive ? 'active' : ''}" onclick="selectVendorChat('${c.chat_id}', '${c.user_name.replace(/'/g, "\\'")}')" style="padding: 1rem; border-bottom: 1px solid #E2E8F0; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: background 0.2s; background: ${activeBg};">
                <div style="flex: 1; min-width: 0;">
                    <h5 style="margin: 0; font-size: 0.9rem; font-weight: 700; color: #0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c.user_name}</h5>
                    <p style="margin: 4px 0 0 0; font-size: 0.75rem; color: #64748B; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${lastMsg}</p>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px; margin-left: 8px;">
                    <span style="font-size: 0.65rem; color: #94A3B8;">${timeStr}</span>
                    ${unreadBadge}
                </div>
            </div>
        `;
    }).join('');
}

async function selectVendorChat(chatId, userName) {
    activeVendorChatId = chatId;
    activeVendorChatUserName = userName;
    lastVendorMessageCount = 0; // Force messages redraw
    
    const placeholder = document.getElementById('vendorChatPlaceholder');
    const workspace = document.getElementById('vendorChatWorkspace');
    const userHeader = document.getElementById('vendorActiveChatUser');
    const chatIdInput = document.getElementById('vendorActiveChatId');
    
    if (placeholder) placeholder.style.display = 'none';
    if (workspace) workspace.style.display = 'flex';
    if (userHeader) userHeader.innerText = userName;
    if (chatIdInput) chatIdInput.value = chatId;
    
    // Refresh sidebar highlights
    document.querySelectorAll('.chat-item').forEach(item => {
        item.style.background = '#ffffff';
        item.classList.remove('active');
    });
    
    // Find matching items in sidebar and highlight
    const items = Array.from(document.querySelectorAll('.chat-item'));
    items.forEach(item => {
        const clickAttr = item.getAttribute('onclick') || '';
        if (clickAttr.includes(chatId)) {
            item.style.background = '#E2E8F0';
            item.classList.add('active');
        }
    });
    
    await fetchActiveChatHistory();
    startVendorChatPolling();
}

async function fetchActiveChatHistory(silent = false) {
    if (!activeVendorChatId) return;
    try {
        const res = await adminFetch(API_BASE + `/api/vendor/support/chats/${activeVendorChatId}`);
        if (!res.ok) return;
        const messages = await res.json();
        
        if (messages.length !== lastVendorMessageCount || !silent) {
            lastVendorMessageCount = messages.length;
            renderActiveChatMessages(messages);
            
            // If new messages fetched while open, refresh the unread badges on the left pane silently
            if (silent) {
                const listRes = await adminFetch(API_BASE + '/api/vendor/support/chats');
                if (listRes.ok) {
                    vendorChats = await listRes.json();
                    renderVendorChatsList();
                }
            }
        }
    } catch (err) {
        console.error("Failed to fetch vendor chat history:", err);
    }
}

function renderActiveChatMessages(messages) {
    const container = document.getElementById('vendorChatMessages');
    if (!container) return;
    
    if (messages.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #64748B; font-size: 0.85rem; padding: 2rem;">No messages in this chat.</div>';
        return;
    }
    
    container.innerHTML = messages.map(m => {
        const isVendor = m.sender === 'vendor';
        const bg = isVendor ? '#06341D' : '#E2E8F0'; // Match forest green theme
        const color = isVendor ? 'white' : '#0F172A';
        const align = isVendor ? 'flex-end' : 'flex-start';
        const radius = isVendor ? '14px 14px 2px 14px' : '14px 14px 14px 2px';
        const float = isVendor ? 'right' : 'left';
        
        return `
            <div style="align-self: ${align}; max-width: 70%; background: ${bg}; color: ${color}; padding: 0.75rem 1rem; border-radius: ${radius}; font-size: 0.85rem; line-height: 1.4; box-shadow: 0 1px 2px rgba(0,0,0,0.05); margin-bottom: 2px;">
                <div>${m.message}</div>
                <div style="font-size: 0.6rem; opacity: 0.7; text-align: ${float}; margin-top: 4px;">
                    ${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>
        `;
    }).join('');
    
    container.scrollTop = container.scrollHeight;
}

async function submitVendorReply(event) {
    if (event) event.preventDefault();
    
    const chatIdInput = document.getElementById('vendorActiveChatId');
    const replyInput = document.getElementById('vendorChatReplyInput');
    if (!chatIdInput || !replyInput) return;
    
    const chatId = chatIdInput.value;
    const message = replyInput.value.trim();
    if (!chatId || !message) return;
    
    try {
        const res = await adminFetch(API_BASE + '/api/vendor/support/chats/reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, message })
        });
        
        if (res.ok) {
            replyInput.value = '';
            // Refresh messages
            await fetchActiveChatHistory();
            // Refresh sidebar list
            const chatsRes = await adminFetch(API_BASE + '/api/vendor/support/chats');
            if (chatsRes.ok) {
                vendorChats = await chatsRes.json();
                renderVendorChatsList();
            }
        } else {
            alert("Failed to send reply. Please verify your shop registration.");
        }
    } catch (err) {
        console.error("Error sending vendor reply:", err);
    }
}

function filterVendorChats(query) {
    const listEl = document.getElementById('vendorChatList');
    if (!listEl) return;
    
    const lowerQuery = query.toLowerCase().trim();
    const filtered = vendorChats.filter(c => {
        return (c.user_name || '').toLowerCase().includes(lowerQuery) || (c.last_message || '').toLowerCase().includes(lowerQuery);
    });
    
    if (filtered.length === 0) {
        listEl.innerHTML = '<div style="padding: 2rem 1rem; text-align: center; color: #64748B; font-size: 0.85rem;">No matching conversations</div>';
        return;
    }
    
    listEl.innerHTML = filtered.map(c => {
        const isActive = c.chat_id === activeVendorChatId;
        const activeBg = isActive ? '#E2E8F0' : '#ffffff';
        const lastMsg = c.last_message || 'No messages';
        const timeStr = c.created_at ? new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const unreadBadge = c.unread_count > 0 ? `<span style="background: #ef4444; color: white; font-size: 0.65rem; font-weight: 700; padding: 2px 6px; border-radius: 10px; min-width: 18px; text-align: center;">${c.unread_count}</span>` : '';
        
        return `
            <div class="chat-item ${isActive ? 'active' : ''}" onclick="selectVendorChat('${c.chat_id}', '${c.user_name.replace(/'/g, "\\'")}')" style="padding: 1rem; border-bottom: 1px solid #E2E8F0; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: background 0.2s; background: ${activeBg};">
                <div style="flex: 1; min-width: 0;">
                    <h5 style="margin: 0; font-size: 0.9rem; font-weight: 700; color: #0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c.user_name}</h5>
                    <p style="margin: 4px 0 0 0; font-size: 0.75rem; color: #64748B; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${lastMsg}</p>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px; margin-left: 8px;">
                    <span style="font-size: 0.65rem; color: #94A3B8;">${timeStr}</span>
                    ${unreadBadge}
                </div>
            </div>
        `;
    }).join('');
}

function startVendorChatPolling() {
    stopVendorChatPolling();
    if (!activeVendorChatId) return;
    vendorChatPollInterval = setInterval(() => {
        fetchActiveChatHistory(true);
    }, 3000);
}

function stopVendorChatPolling() {
    if (vendorChatPollInterval) {
        clearInterval(vendorChatPollInterval);
        vendorChatPollInterval = null;
    }
}

// GLOBAL EXPORTS
window.fetchFeatureFlags = fetchFeatureFlags;
window.toggleFeatureFlag = toggleFeatureFlag;
window.fetchVendorApprovals = fetchVendorApprovals;
window.updateVendorStatus = updateVendorStatus;
window.fetchVendorDashboardStats = fetchVendorDashboardStats;
window.fetchVendorShopDetails = fetchVendorShopDetails;
window.handleVendorStorefrontSubmit = handleVendorStorefrontSubmit;
window.fetchVendorWalletDetails = fetchVendorWalletDetails;
window.handleVendorPayoutSubmit = handleVendorPayoutSubmit;
window.populateCouponShopsDropdown = populateCouponShopsDropdown;

window.loadVendorChats = loadVendorChats;
window.selectVendorChat = selectVendorChat;
window.submitVendorReply = submitVendorReply;
window.stopVendorChatPolling = stopVendorChatPolling;
window.filterVendorChats = filterVendorChats;