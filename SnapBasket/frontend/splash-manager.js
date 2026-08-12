function initSplash() {
    const splash = document.getElementById('splashScreen');
    const splashVideo = document.getElementById('splashVideo');
    const skipBtn = document.getElementById('skipSplash');

    const hideSplash = () => {
        if (splash) {
            splash.classList.add('hidden');
            splash.style.pointerEvents = 'none';
            splash.style.display = 'none';
            if (splash.parentNode) splash.parentNode.removeChild(splash);
        }
    };

    if (splash) {
        // Fast dismiss to ensure buttons and UI are immediately interactive
        const splashTimeout = setTimeout(() => {
            hideSplash();
            try { sessionStorage.setItem('splashShown', 'true'); } catch(e){}
        }, 800);
        
        if (splashVideo) {
            splashVideo.onerror = () => {
                clearTimeout(splashTimeout);
                hideSplash();
            };
            splashVideo.onended = () => {
                clearTimeout(splashTimeout);
                hideSplash();
            };
        }

        if (skipBtn) {
            skipBtn.onclick = (e) => {
                if (e) e.stopPropagation();
                clearTimeout(splashTimeout);
                hideSplash();
            };
        }

        splash.onclick = () => {
            clearTimeout(splashTimeout);
            hideSplash();
        };
    }
}

if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", initSplash);
} else {
    initSplash();
}
