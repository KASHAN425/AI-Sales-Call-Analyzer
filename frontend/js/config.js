// ============================================================
// CENTRAL API CONFIGURATION
// ============================================================
// When running locally on 127.0.0.1 or localhost, it connects to http://127.0.0.1:8000
// When deployed on Vercel, it connects to your live Railway domain
// ============================================================

const RAILWAY_API_URL = "https://ai-sales-call-analyzer-production.up.railway.app";

const getResolvedApiUrl = () => {
    // 1. Check manual localStorage override
    const saved = localStorage.getItem("API_URL_OVERRIDE");
    if (saved) return saved.replace(/\/+$/, "");

    // 2. Local development fallback
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "") {
        return "http://127.0.0.1:8000";
    }

    // 3. Production Railway URL
    return RAILWAY_API_URL.replace(/\/+$/, "");
};

window.API_URL = getResolvedApiUrl();
