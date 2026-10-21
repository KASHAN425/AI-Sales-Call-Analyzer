// ============================================================
// LIVE ZOOM SALES COPILOT - FRONTEND CONTROLLER
// ============================================================

const API_URL = window.API_URL || "http://127.0.0.1:8000";

let currentSessionId = null;
let liveSocket = null;
let speechRecognizer = null;
let timerInterval = null;
let callSeconds = 0;
let totalBattlecards = 0;

// ============================================================
// AUTHENTICATION CHECK
// ============================================================
function getToken() {
    return localStorage.getItem("access_token") || localStorage.getItem("token");
}

function getAuthHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getToken()}`
    };
}

function checkAuth() {
    const token = getToken();
    if (!token) {
        window.location.replace("login.html");
        return false;
    }
    const userStr = localStorage.getItem("currentUser") || localStorage.getItem("user");
    if (userStr) {
        try {
            const user = JSON.parse(userStr);
            const nameEl = document.getElementById("userName");
            const emailEl = document.getElementById("userEmail");
            const avatarEl = document.getElementById("userAvatar");
            if (nameEl) nameEl.textContent = user.name || "Sales Representative";
            if (emailEl) emailEl.textContent = user.email || "demo@example.com";
            if (avatarEl && user.name) {
                avatarEl.textContent = user.name.charAt(0).toUpperCase();
            }
        } catch (e) {
            console.warn("Could not parse user info", e);
        }
    }
    return true;
}

// ============================================================
// DOM ELEMENTS
// ============================================================
const meetingSetupCard = document.getElementById("meetingSetupCard");
const liveCallWorkspace = document.getElementById("liveCallWorkspace");
const startCallBtn = document.getElementById("startCallBtn");
const endCallBtn = document.getElementById("endCallBtn");
const connectionStatus = document.getElementById("connectionStatus");
const liveTimer = document.getElementById("liveTimer");
const repTalkPct = document.getElementById("repTalkPct");
const custTalkPct = document.getElementById("custTalkPct");
const battlecardsCount = document.getElementById("battlecardsCount");
const repRatioBar = document.getElementById("repRatioBar");
const custRatioBar = document.getElementById("custRatioBar");
const repRatioLabel = document.getElementById("repRatioLabel");
const custRatioLabel = document.getElementById("custRatioLabel");
const ratioStatusText = document.getElementById("ratioStatusText");
const transcriptFeed = document.getElementById("transcriptFeed");
const battlecardContainer = document.getElementById("battlecardContainer");
const battlecardHistory = document.getElementById("battlecardHistory");
const speakerRoleSelect = document.getElementById("speakerRoleSelect");
const manualTurnInput = document.getElementById("manualTurnInput");
const sendTurnBtn = document.getElementById("sendTurnBtn");
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("token");
        localStorage.removeItem("currentUser");
        localStorage.removeItem("user");
        localStorage.removeItem("latestReport");
        window.location.replace("login.html");
    });
}

// ============================================================
// LAUNCH LIVE SESSION
// ============================================================
window.startLiveCall = async function () {
    if (!checkAuth()) return null;

    const clientNameInput = document.getElementById("clientNameInput");
    const zoomMeetingInput = document.getElementById("zoomMeetingInput");
    const audioEngineSelect = document.getElementById("audioEngineSelect");

    const clientName = (clientNameInput && clientNameInput.value) || "Prospective Client";
    const zoomMeeting = (zoomMeetingInput && zoomMeetingInput.value) || "";
    const audioEngine = (audioEngineSelect && audioEngineSelect.value) || "webspeech";

    if (startCallBtn) {
        startCallBtn.disabled = true;
        startCallBtn.textContent = "Connecting to Live Engine...";
    }

    try {
        const res = await fetch(`${API_URL}/live-call/start`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                customer_name: clientName,
                meeting_title: zoomMeeting ? `Zoom Call (${zoomMeeting})` : "Live Sales Consultation"
            })
        });

        const data = await res.json();
        if (!data.success) {
            throw new Error(data.error || "Failed to start live session.");
        }

        currentSessionId = data.session_id;
        window.currentSessionId = currentSessionId;

        // Switch to Active Workspace
        if (meetingSetupCard) meetingSetupCard.style.display = "none";
        if (liveCallWorkspace) liveCallWorkspace.style.display = "block";

        // Start Timer
        callSeconds = 0;
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            callSeconds++;
            const mins = String(Math.floor(callSeconds / 60)).padStart(2, "0");
            const secs = String(callSeconds % 60).padStart(2, "0");
            if (liveTimer) liveTimer.textContent = `${mins}:${secs}`;
        }, 1000);

        // Connect WebSocket
        connectWebSocket(currentSessionId);

        // Initialize Speech Recognition if selected
        if (audioEngine === "webspeech") {
            initSpeechRecognition();
        }

        // Greet in transcript
        addTranscriptBubble({
            speaker: "System",
            role: "SYSTEM",
            text: `Live session initialized for ${clientName}. AI Sales Copilot is active.`,
            time_str: new Date().toLocaleTimeString()
        });

        return currentSessionId;

    } catch (error) {
        console.error("Launch error:", error);
        alert("Could not start live session: " + error.message);
        if (startCallBtn) {
            startCallBtn.disabled = false;
            startCallBtn.textContent = "🟢 Launch Live Zoom Copilot";
        }
        return null;
    }
};

if (startCallBtn) {
    startCallBtn.addEventListener("click", () => {
        window.startLiveCall();
    });
}

// ============================================================
// WEBSOCKET CLIENT
// ============================================================
function connectWebSocket(sessionId) {
    try {
        const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
        const parsedUrl = new URL(API_URL);
        const wsUrl = `${wsProto}//${parsedUrl.host}/ws/live-copilot/${sessionId}`;

        liveSocket = new WebSocket(wsUrl);

        liveSocket.onopen = function () {
            console.log("[WS] Live Copilot connected successfully.");
            connectionStatus.innerHTML = '<span style="width:8px; height:8px; border-radius:50%; background:#10b981; display:inline-block;"></span> Live Streaming';
            connectionStatus.style.color = "#059669";
        };

        liveSocket.onmessage = function (event) {
            try {
                const data = JSON.parse(event.data);
                handleIncomingMessage(data);
            } catch (err) {
                console.error("WS message parse error:", err);
            }
        };

        liveSocket.onclose = function () {
            console.warn("[WS] Socket closed. Falling back to REST endpoints.");
            connectionStatus.innerHTML = '<span style="width:8px; height:8px; border-radius:50%; background:#d97706; display:inline-block;"></span> HTTP Mode';
            connectionStatus.style.color = "#d97706";
        };

        liveSocket.onerror = function (err) {
            console.error("[WS] Socket error:", err);
        };
    } catch (e) {
        console.warn("[WS] Could not initialize WebSocket, REST mode will be used:", e);
    }
}

function handleIncomingMessage(data) {
    if (data.type === "turn_processed") {
        if (data.turn) {
            addTranscriptBubble(data.turn);
        }
        if (data.talk_stats) {
            updateTalkRatio(data.talk_stats);
        }
        if (data.battlecard) {
            renderActiveBattlecard(data.battlecard);
        }
    } else if (data.type === "finalized") {
        if (data.report) {
            localStorage.setItem("latestReport", JSON.stringify(data.report));
        }
        const targetId = data.call_id || currentSessionId;
        window.location.href = `call.html?id=${encodeURIComponent(targetId)}`;
    }
}

// ============================================================
// SUBMIT TURN (REST & WS)
// ============================================================
async function sendTurn(role, text) {
    if (!text || !text.trim() || !currentSessionId) return;

    const payload = {
        session_id: currentSessionId,
        role: role,
        text: text.trim()
    };

    if (liveSocket && liveSocket.readyState === WebSocket.OPEN) {
        liveSocket.send(JSON.stringify({
            type: "turn",
            role: role,
            text: text.trim()
        }));
    } else {
        // Fallback to REST
        try {
            const res = await fetch(`${API_URL}/live-call/turn`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                handleIncomingMessage({
                    type: "turn_processed",
                    turn: data.turn,
                    talk_stats: data.talk_stats,
                    battlecard: data.battlecard
                });
            }
        } catch (e) {
            console.error("Failed to send turn:", e);
        }
    }
}

if (sendTurnBtn && manualTurnInput) {
    sendTurnBtn.addEventListener("click", () => {
        const text = manualTurnInput.value;
        const role = speakerRoleSelect.value;
        sendTurn(role, text);
        manualTurnInput.value = "";
    });

    manualTurnInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            sendTurnBtn.click();
        }
    });
}

// Quick Simulator Function exposed globally
window.simulateObjection = function (text) {
    if (!currentSessionId) {
        alert("Please click 'Launch Live Zoom Copilot' first to activate the session.");
        return;
    }
    sendTurn("CUSTOMER", text);
};

// ============================================================
// UI RENDERING: TRANSCRIPT BUBBLES
// ============================================================
function addTranscriptBubble(turn) {
    const isRep = turn.role === "SALES REPRESENTATIVE";
    const isSys = turn.role === "SYSTEM";

    const bubble = document.createElement("div");
    bubble.className = `transcript-bubble ${isRep ? 'bubble-rep' : (isSys ? '' : 'bubble-cust')}`;
    if (isSys) {
        bubble.style.background = "#f1f5f9";
        bubble.style.borderLeft = "3px solid #64748b";
        bubble.style.alignSelf = "center";
        bubble.style.color = "#475569";
    }

    bubble.innerHTML = `
        <div class="bubble-header">
            <span>${turn.speaker || (isRep ? 'Sales Rep' : 'Customer')}</span>
            <span>${turn.time_str || ''}</span>
        </div>
        <div>${turn.text}</div>
    `;

    // Clear placeholder on first real bubble
    if (transcriptFeed.children.length === 1 && transcriptFeed.children[0].textContent.includes("Waiting for conversation")) {
        transcriptFeed.innerHTML = "";
    }

    transcriptFeed.appendChild(bubble);
    transcriptFeed.scrollTop = transcriptFeed.scrollHeight;
}

// ============================================================
// UI RENDERING: TALK-TO-LISTEN GAUGE
// ============================================================
function updateTalkRatio(stats) {
    if (!stats) return;

    const repPct = stats.rep_percentage || 50;
    const custPct = stats.customer_percentage || 50;

    repTalkPct.textContent = `${repPct}%`;
    custTalkPct.textContent = `${custPct}%`;

    repRatioLabel.textContent = `${repPct}%`;
    custRatioLabel.textContent = `${custPct}%`;

    repRatioBar.style.width = `${repPct}%`;
    custRatioBar.style.width = `${custPct}%`;

    if (ratioStatusText) {
        ratioStatusText.textContent = stats.status || "Balanced Ratio";
        if (stats.color === "red") ratioStatusText.style.color = "#dc2626";
        else if (stats.color === "amber") ratioStatusText.style.color = "#d97706";
        else ratioStatusText.style.color = "#059669";
    }
}

// ============================================================
// UI RENDERING: LIVE BATTLECARDS HUD
// ============================================================
function renderActiveBattlecard(bc) {
    if (!bc) return;

    totalBattlecards++;
    battlecardsCount.textContent = totalBattlecards;

    const card = document.createElement("div");
    card.className = "battlecard-active";
    card.id = bc.id || `bc_${Date.now()}`;

    card.innerHTML = `
        <div class="battlecard-badge">
            ⚡ ${bc.category || 'Live Guidance'}
        </div>
        <div style="font-size:12px; font-weight:700; color:#475569; margin-bottom:4px;">
            CUSTOMER CONCERN: <span style="color:#0f172a;">${bc.customer_concern || 'Customer hesitation'}</span>
        </div>
        <div style="font-size:11.5px; font-weight:700; color:#2563eb; text-transform:uppercase; margin-top:8px;">
            Suggested Live Script (Click to Copy):
        </div>
        <div class="rebuttal-script" onclick="copyRebuttalText('${escapeQuotes(bc.what_to_say)}')">
            "${bc.what_to_say}"
            <span style="position:absolute; right:10px; bottom:8px; font-size:11px; color:#2563eb; font-weight:600;">📋 Copy</span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; font-size:12px;">
            <span style="color:#059669; font-weight:600;">💡 Key Stat: ${bc.key_stat || '99.9% Uptime SLA'}</span>
            <button onclick="dismissBattlecard('${card.id}', '${escapeQuotes(bc.category)}', '${escapeQuotes(bc.what_to_say)}')" style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:5px; padding:4px 8px; font-size:11px; cursor:pointer; font-weight:600;">
                ✓ Handled
            </button>
        </div>
    `;

    battlecardContainer.innerHTML = "";
    battlecardContainer.appendChild(card);
}

window.escapeQuotes = function (str) {
    return (str || "").replace(/'/g, "\\'").replace(/"/g, '&quot;');
};

window.copyRebuttalText = function (text) {
    navigator.clipboard.writeText(text);
    alert("Rebuttal script copied to clipboard!");
};

window.dismissBattlecard = function (cardId, category, script) {
    const card = document.getElementById(cardId);
    if (card) card.remove();

    battlecardContainer.innerHTML = `
        <div style="background:#ffffff; border:1px dashed #cbd5e1; border-radius:10px; padding:35px 20px; text-align:center; color:#64748b; font-size:13.5px;">
            <div style="font-size:28px; margin-bottom:8px;">💡</div>
            <strong>AI Copilot Standing By</strong>
            <p style="margin:4px 0 0 0; font-size:12.5px; color:#94a3b8;">When the customer raises an objection or asks a question, actionable spoken rebuttals will pop up here in real time.</p>
        </div>
    `;

    // Add to history list
    const historyItem = document.createElement("div");
    historyItem.style.cssText = "background:#ffffff; border:1px solid #e2e8f0; border-radius:6px; padding:8px 10px; font-size:12px;";
    historyItem.innerHTML = `
        <strong style="color:#2563eb;">${category || 'Objection'}:</strong>
        <span style="color:#334155;">"${(script || '').slice(0, 70)}..."</span>
    `;

    if (battlecardHistory.children[0] && battlecardHistory.children[0].textContent.includes("No past battlecards")) {
        battlecardHistory.innerHTML = "";
    }
    battlecardHistory.prepend(historyItem);
};

// ============================================================
// END MEETING & GENERATE REPORT
// ============================================================
if (endCallBtn) {
    endCallBtn.addEventListener("click", async function () {
        if (!confirm("Are you sure you want to end this Zoom consultation call and generate the executive AI audit report?")) {
            return;
        }

        endCallBtn.disabled = true;
        endCallBtn.textContent = "⏳ Generating Executive Call Audit Report...";

        clearInterval(timerInterval);
        if (speechRecognizer) {
            try { speechRecognizer.stop(); } catch (e) {}
        }

        try {
            const res = await fetch(`${API_URL}/live-call/finalize`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({ session_id: currentSessionId })
            });

            const data = await res.json();
            if (data.success) {
                if (data.report) {
                    localStorage.setItem("latestReport", JSON.stringify(data.report));
                }
                const targetId = data.call_id || currentSessionId;
                window.location.href = `call.html?id=${encodeURIComponent(targetId)}`;
            } else {
                throw new Error(data.error || "Failed to finalize call report.");
            }
        } catch (error) {
            console.error("Finalize error:", error);
            alert("Error finalizing call: " + error.message);
            endCallBtn.disabled = false;
            endCallBtn.textContent = "🛑 End Call & Generate Executive Audit Report";
        }
    });
}

// ============================================================
// BROWSER SPEECH RECOGNITION (WEB SPEECH API)
// ============================================================
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn("Web Speech API not supported in this browser. Use manual/demo mode.");
        return;
    }

    speechRecognizer = new SpeechRecognition();
    speechRecognizer.continuous = true;
    speechRecognizer.interimResults = false;
    speechRecognizer.lang = "en-US";

    speechRecognizer.onresult = function (event) {
        const lastResultIndex = event.results.length - 1;
        const transcript = event.results[lastResultIndex][0].transcript.trim();

        if (transcript) {
            const currentRole = speakerRoleSelect.value;
            sendTurn(currentRole, transcript);
        }
    };

    speechRecognizer.onerror = function (event) {
        console.warn("Speech recognition notice:", event.error);
    };

    speechRecognizer.onend = function () {
        // Auto-restart if call is still active
        if (currentSessionId && liveCallWorkspace.style.display !== "none") {
            try { speechRecognizer.start(); } catch (e) {}
        }
    };

    try {
        speechRecognizer.start();
        console.log("Speech recognition started.");
    } catch (e) {
        console.warn("Could not start speech recognition:", e);
    }
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
    checkAuth();
});
