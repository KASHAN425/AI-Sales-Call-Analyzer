const API_URL = window.API_URL || "http://127.0.0.1:8000";

let allCalls = [];

function getAuthHeaders() {
    const token = localStorage.getItem("access_token");

    if (!token) {
        window.location.replace("login.html");
        throw new Error("Please log in first.");
    }

    return {
        Authorization: `Bearer ${token}`
    };
}

// ==================================================
// ELEMENTS
// ==================================================

const totalCalls = document.getElementById("totalCalls");
const averageScore = document.getElementById("averageScore");
const buyingIntent = document.getElementById("buyingIntent");

const latestScore = document.getElementById("latestScore");
const latestSentiment = document.getElementById("latestSentiment");
const latestBuyingIntent = document.getElementById("latestBuyingIntent");
const latestNeed = document.getElementById("latestNeed");

const callHistory = document.getElementById("callHistory");
const viewLatestBtn = document.getElementById("viewLatestBtn");
const searchCallsInput = document.getElementById("searchCallsInput");

// ==================================================
// USER PROFILE & LOGOUT
// ==================================================

function initUserProfile() {
    try {
        const userStr = localStorage.getItem("currentUser");
        if (userStr) {
            const user = JSON.parse(userStr);
            const nameEl = document.getElementById("userName");
            const emailEl = document.getElementById("userEmail");
            const avatarEl = document.getElementById("userAvatar");
            if (nameEl && user.name) nameEl.textContent = user.name;
            if (emailEl && user.email) emailEl.textContent = user.email;
            if (avatarEl && user.name) avatarEl.textContent = user.name.charAt(0).toUpperCase();
        }
    } catch (e) {
        console.warn("Could not parse currentUser from localStorage", e);
    }

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", function () {
            localStorage.removeItem("access_token");
            localStorage.removeItem("currentUser");
            window.location.replace("login.html");
        });
    }
}

// ==================================================
// LOAD DASHBOARD
// ==================================================

async function loadDashboard() {
    try {
        const headers = getAuthHeaders();

        const [statsResponse, callsResponse] = await Promise.all([
            fetch(`${API_URL}/dashboard/stats`, { headers }),
            fetch(`${API_URL}/calls`, { headers })
        ]);

        if (statsResponse.status === 401 || callsResponse.status === 401) {
            localStorage.removeItem("access_token");
            localStorage.removeItem("currentUser");
            window.location.replace("login.html");
            return;
        }

        const stats = await statsResponse.json();
        const callsData = await callsResponse.json();

        if (stats.success) {
            updateStats(stats);
        }

        if (callsData.success) {
            allCalls = callsData.calls || [];
            updateHistory(allCalls);
        }

    } catch (error) {
        console.error("Dashboard loading error:", error);
        showHistoryError();
    }
}

// ==================================================
// UPDATE STATS
// ==================================================

function updateStats(stats) {
    if (totalCalls) {
        totalCalls.textContent = stats.total_calls ?? 0;
    }

    if (averageScore) {
        if (stats.total_calls > 0) {
            averageScore.textContent = Math.round(stats.average_score);
        } else {
            averageScore.textContent = "--";
        }
    }

    if (buyingIntent) {
        if (stats.total_calls === 0) {
            buyingIntent.textContent = "--";
        } else {
            buyingIntent.textContent = getBuyingIntentLabel(stats.average_buying_intent);
        }
    }
}

// ==================================================
// UPDATE HISTORY
// ==================================================

function updateHistory(calls) {
    if (!callHistory) return;

    if (!calls || calls.length === 0) {
        callHistory.innerHTML = `
            <div class="history-empty">
                <div class="empty-icon">◷</div>
                <h3>No calls analyzed yet</h3>
                <p>Upload a sales call from the dashboard to see it here.</p>
                <a href="index.html" class="btn-primary" style="display:inline-block; margin-top:12px;">Upload First Call</a>
            </div>
        `;
        resetLatest();
        return;
    }

    // Latest call
    updateLatest(calls[0]);

    // Render history items
    callHistory.innerHTML = calls.map(call => createHistoryItem(call)).join("");

    // Add view buttons listeners
    document.querySelectorAll(".history-view").forEach(button => {
        button.addEventListener("click", function () {
            const id = this.dataset.id;
            window.location.href = `call.html?id=${id}`;
        });
    });
}

// ==================================================
// LATEST CALL
// ==================================================

function updateLatest(call) {
    const scoreVal = call.score ?? call.performance_score;
    if (latestScore) {
        latestScore.textContent = scoreVal ?? "--";
    }

    if (latestSentiment) {
        latestSentiment.textContent = formatLabel(call.sentiment);
    }

    if (latestBuyingIntent) {
        latestBuyingIntent.textContent = call.buying_intent || "--";
    }

    if (latestNeed) {
        const needVal = call.customer_need ?? call.need;
        latestNeed.textContent = formatLabel(needVal);
    }

    if (viewLatestBtn) {
        viewLatestBtn.style.display = "inline-flex";
        viewLatestBtn.onclick = function () {
            window.location.href = `call.html?id=${call.id}`;
        };
    }
}

function resetLatest() {
    if (latestScore) latestScore.textContent = "--";
    if (latestSentiment) latestSentiment.textContent = "--";
    if (latestBuyingIntent) latestBuyingIntent.textContent = "--";
    if (latestNeed) latestNeed.textContent = "--";
    if (viewLatestBtn) viewLatestBtn.style.display = "none";
}

// ==================================================
// HISTORY ITEM
// ==================================================

function createHistoryItem(call) {
    const date = formatDate(call.created_at);
    const duration = formatDuration(call.duration);
    const scoreVal = call.score ?? call.performance_score ?? "--";
    const needVal = call.customer_need ?? call.need ?? "General Inquiry";

    let scoreColor = "#059669";
    if (Number(scoreVal) < 60) scoreColor = "#dc2626";
    else if (Number(scoreVal) < 75) scoreColor = "#d97706";

    return `
        <div class="history-item">
            <div class="history-main">
                <div class="history-icon">✆</div>
                <div class="history-info">
                    <strong>${escapeHTML(call.audio_file || "call_recording.wav")}</strong>
                    <small>${date} • Requirement: ${escapeHTML(needVal)}</small>
                </div>
            </div>

            <div class="history-details">
                <div class="history-detail">
                    <span>Score</span>
                    <strong style="color:${scoreColor}; font-size:16px;">${scoreVal}/100</strong>
                </div>

                <div class="history-detail">
                    <span>Sentiment</span>
                    <strong>${formatLabel(call.sentiment)}</strong>
                </div>

                <div class="history-detail">
                    <span>Intent</span>
                    <strong>${call.buying_intent || "--"}</strong>
                </div>

                <div class="history-detail">
                    <span>Duration</span>
                    <strong>${duration}</strong>
                </div>

                <button class="history-view" data-id="${call.id}">
                    View Analysis →
                </button>
            </div>
        </div>
    `;
}

// ==================================================
// SEARCH FILTER
// ==================================================

if (searchCallsInput) {
    searchCallsInput.addEventListener("input", function () {
        const query = this.value.toLowerCase().trim();
        if (!query) {
            updateHistory(allCalls);
            return;
        }

        const filtered = allCalls.filter(call => {
            const file = (call.audio_file || "").toLowerCase();
            const need = (call.customer_need || call.need || "").toLowerCase();
            const sent = (call.sentiment || "").toLowerCase();
            const intent = (call.buying_intent || "").toLowerCase();
            return file.includes(query) || need.includes(query) || sent.includes(query) || intent.includes(query);
        });

        updateHistory(filtered);
    });
}

// ==================================================
// HELPERS
// ==================================================

function getBuyingIntentLabel(score) {
    if (score >= 0.70) return "High";
    if (score >= 0.40) return "Medium";
    return "Low";
}

function formatLabel(value) {
    if (!value) return "--";
    return value.toString().toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

function formatDate(value) {
    if (!value) return "--";
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    return date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function formatDuration(seconds) {
    seconds = Number(seconds) || 0;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function escapeHTML(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showHistoryError() {
    if (!callHistory) return;
    callHistory.innerHTML = `
        <div class="history-empty">
            <div class="empty-icon">!</div>
            <h3>Could not load call history</h3>
            <p>Ensure the FastAPI backend is running on http://127.0.0.1:8000.</p>
        </div>
    `;
}

// ==================================================
// START
// ==================================================

initUserProfile();
loadDashboard();
