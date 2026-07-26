/**
 * ADYANTA Theme Manager & Global Support Bot
 * Handles Dark Mode persistence, theme toggling, and ADYANTA Support AI Bot on all pages.
 */

(function() {
    // 1. Immediate Theme Application (Avoid Flash of Light)
    const savedTheme = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = savedTheme === 'dark' || (!savedTheme && systemDark);
    
    if (isDark) {
        document.documentElement.classList.add('dark-theme');
    }

    // Global placeholder redirect for legacy service stability
    window.addEventListener('error', function(e) {
        if (e.target && e.target.tagName === 'IMG' && e.target.src && e.target.src.includes('via.placeholder.com')) {
            const oldSrc = e.target.src;
            e.target.src = oldSrc.replace('via.placeholder.com', 'placehold.co');
            console.warn('Redirected broken placeholder:', oldSrc, '->', e.target.src);
        }
    }, true);

    // 2. Global AI Support Bot Injector & Event Handler
    function initGlobalSupportBot() {
        // Remove old customer support symbol if present
        const oldSymbol = document.getElementById('supportSymbol');
        if (oldSymbol) oldSymbol.remove();

        // Inject ADYANTA Support Bot if missing on this page
        if (!document.getElementById('aiChatbotBubble')) {
            const botHTML = `
                <div id="aiChatbotWidget" class="ai-chatbot-widget">
                    <div class="ai-chatbot-header">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <div class="ai-chatbot-avatar">
                                <i class="ph-fill ph-robot" style="color: white;"></i>
                                <span class="online-badge"></span>
                            </div>
                            <div class="ai-chatbot-header-info">
                                <h4 style="margin: 0; color: white; font-size: 1rem; font-weight: 700;">ADYANTA Support Bot</h4>
                                <span style="font-size: 0.75rem; color: #E2E8F0; opacity: 0.9;">Active Marketplace Assistant</span>
                            </div>
                        </div>
                        <button id="closeChatbotBtn" style="background: none; border: none; color: white; font-size: 1.4rem; cursor: pointer; opacity: 0.85; transition: opacity 0.2s;">
                            <i class="ph ph-x"></i>
                        </button>
                    </div>
                    <div id="chatbotMessages" class="ai-chatbot-messages">
                        <div class="ai-bubble-bot">
                            👋 Hello! Welcome to ADYANTA Multi-Vendor Marketplace. I am your AI Support Bot! How can I help you today?
                            <div style="margin-top: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem;">
                                <button class="chat-suggest-btn" onclick="window.sendChatbotSuggestion ? window.sendChatbotSuggestion('🔍 Show active shops in Nellore') : null">
                                    <i class="ph ph-storefront"></i> Show active shops in Nellore
                                </button>
                                <button class="chat-suggest-btn" onclick="window.sendChatbotSuggestion ? window.sendChatbotSuggestion('🎁 Give me active coupons') : null">
                                    <i class="ph ph-ticket"></i> Give me active coupons
                                </button>
                                <button class="chat-suggest-btn" onclick="window.sendChatbotSuggestion ? window.sendChatbotSuggestion('⚡ What is the fastest delivery store?') : null">
                                    <i class="ph ph-lightning"></i> What is the fastest delivery store?
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="ai-chatbot-input-bar">
                        <input type="text" id="chatbotInput" placeholder="Ask anything about stores & products..." />
                        <button id="sendChatbotMsgBtn" class="ai-chatbot-send-btn">
                            <i class="ph-fill ph-paper-plane-tilt" style="font-size: 1.1rem; color: white;"></i>
                        </button>
                    </div>
                </div>

                <div id="aiChatbotBubble" class="ai-chatbot-bubble-trigger">
                    <i class="ph-fill ph-robot" id="chatBubbleIcon" style="color: white;"></i>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', botHTML);
        }

        bindBotEvents();
    }

    function bindBotEvents() {
        const bubble = document.getElementById('aiChatbotBubble');
        const widget = document.getElementById('aiChatbotWidget');
        const closeBtn = document.getElementById('closeChatbotBtn');
        const sendBtn = document.getElementById('sendChatbotMsgBtn');
        const input = document.getElementById('chatbotInput');
        const messages = document.getElementById('chatbotMessages');

        if (!bubble || !widget) return;
        if (bubble.dataset.globalBound === 'true') return;
        bubble.dataset.globalBound = 'true';

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

        const handleSend = () => {
            if (!input || !input.value.trim() || !messages) return;
            const userText = input.value.trim();
            input.value = '';

            messages.innerHTML += `
                <div class="ai-bubble-user">
                    ${userText}
                </div>
            `;
            messages.scrollTop = messages.scrollHeight;

            const loaderId = `chat-loader-${Date.now()}`;
            messages.innerHTML += `
                <div id="${loaderId}" class="ai-bubble-bot" style="display: flex; align-items: center; gap: 0.35rem; padding: 0.8rem 1.2rem; min-height: 38px;">
                    <span style="width: 7px; height: 7px; background: var(--primary); border-radius: 50%; display: inline-block; animation: bounce 1.2s infinite ease-in-out;"></span>
                    <span style="width: 7px; height: 7px; background: var(--primary); border-radius: 50%; display: inline-block; animation: bounce 1.2s infinite ease-in-out 0.2s;"></span>
                    <span style="width: 7px; height: 7px; background: var(--primary); border-radius: 50%; display: inline-block; animation: bounce 1.2s infinite ease-in-out 0.4s;"></span>
                </div>
            `;
            messages.scrollTop = messages.scrollHeight;

            setTimeout(() => {
                const loader = document.getElementById(loaderId);
                if (loader) loader.remove();

                let botReply = "I am the ADYANTA Support Bot! How can I help you today?";
                const query = userText.toLowerCase();

                if (query.includes('shop') || query.includes('store') || query.includes('browse') || query.includes('nellore')) {
                    botReply = `📍 <strong>Active ADYANTA Partner Stores:</strong><br>• Adyanta Organic Farm Store (15-30 mins)<br>• QuickMart Express Grocery (10-20 mins)<br>• Adyanta Juice & Nectars (10-25 mins)<br>• Adyanta Pharmacy & Wellness (10-20 mins)<br><br><a href="stores.html" style="color: var(--primary); font-weight:700;">Click here to browse all stores</a>`;
                } else if (query.includes('coupon') || query.includes('discount') || query.includes('code') || query.includes('offer')) {
                    botReply = `🎁 <strong>Active Platform Coupons:</strong><br>• <code>WELCOME10</code>: 10% OFF on all grocery orders<br>• <code>FIRSTSAVE100</code>: ₹100 OFF on orders above ₹500`;
                } else if (query.includes('delivery') || query.includes('fast') || query.includes('time')) {
                    botReply = `⚡ <strong>Fastest Delivery Stores:</strong><br>• <strong>QuickMart Express</strong>: 10-20 mins<br>• <strong>Adyanta Pharmacy</strong>: 10-15 mins`;
                } else if (query.includes('help') || query.includes('support') || query.includes('contact')) {
                    botReply = `📞 <strong>Customer Support:</strong><br>You can reach our 24/7 help desk at support@adyanta.com or call +91 98765 43210. Or visit our <a href="support.html" style="color: var(--primary); font-weight:700;">Support Page</a>.`;
                }

                messages.innerHTML += `
                    <div class="ai-bubble-bot">
                        ${botReply}
                    </div>
                `;
                messages.scrollTop = messages.scrollHeight;
            }, 600);
        };

        if (sendBtn) sendBtn.addEventListener('click', handleSend);
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') handleSend();
            });
        }

        window.sendChatbotSuggestion = function(text) {
            if (input) {
                input.value = text;
                handleSend();
            }
        };
    }

    // 3. Global Setup Function
    window.setupThemeToggle = function() {
        initGlobalSupportBot();

        const toggleBtns = document.querySelectorAll('.theme-toggle-btn');
        if (!toggleBtns.length) return;

        const applyTheme = (isDark) => {
            document.body.classList.toggle('dark-theme', isDark);
            document.documentElement.classList.toggle('dark-theme', isDark);
            
            toggleBtns.forEach(btn => {
                const icon = btn.querySelector('i');
                if (icon) {
                    if (isDark) {
                        icon.classList.remove('ph-moon');
                        icon.classList.add('ph-sun');
                    } else {
                        icon.classList.remove('ph-sun');
                        icon.classList.add('ph-moon');
                    }
                }
            });
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        };

        // Sync icons and body class on load
        const currentIsDark = document.documentElement.classList.contains('dark-theme');
        if (currentIsDark) document.body.classList.add('dark-theme');
        
        toggleBtns.forEach(btn => {
            const icon = btn.querySelector('i');
            if (icon) {
                if (currentIsDark) {
                    icon.classList.remove('ph-moon');
                    icon.classList.add('ph-sun');
                } else {
                    icon.classList.remove('ph-sun');
                    icon.classList.add('ph-moon');
                }
            }
            
            btn.addEventListener('click', () => {
                const isNowDark = !document.documentElement.classList.contains('dark-theme');
                applyTheme(isNowDark);
            });
        });
    };

    // 4. Initialization
    document.addEventListener('DOMContentLoaded', () => {
        if (localStorage.getItem('theme') === 'dark') {
            document.body.classList.add('dark-theme');
        }
        window.setupThemeToggle();
    });
})();
