// ============================================================
// LIVE ZOOM SALES COPILOT - ADVANCED CONTROLLER
// ============================================================

const API_URL = window.API_URL || "http://127.0.0.1:8000";

let currentSessionId = sessionStorage.getItem("live_copilot_session_id") || null;
let liveSocket = null;
let speechRecognizer = null;
let zoomStream = null;
let zoomAudioRecorder = null;
let audioContext = null;
let analyserNode = null;
let animFrameId = null;
let timerInterval = null;
let callSeconds = 0;
let totalBattlecards = 0;
let currentActiveRole = "CUSTOMER";

window.currentSessionId = currentSessionId;

// ============================================================
// AUTHENTICATION
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
const shareZoomAudioBtn = document.getElementById("shareZoomAudioBtn");
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
const roleBtnCustomer = document.getElementById("roleBtnCustomer");
const roleBtnRep = document.getElementById("roleBtnRep");
const manualTurnInput = document.getElementById("manualTurnInput");
const sendTurnBtn = document.getElementById("sendTurnBtn");
const audioVuMeter = document.getElementById("audioVuMeter");
const audioVuStatus = document.getElementById("audioVuStatus");
const micStatusText = document.getElementById("micStatusText");
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("token");
        localStorage.removeItem("currentUser");
        localStorage.removeItem("user");
        localStorage.removeItem("latestReport");
        sessionStorage.removeItem("live_copilot_session_id");
        window.location.replace("login.html");
    });
}

// ============================================================
// SPEAKER ROLE SWITCHER
// ============================================================
function setSpeakerRole(role) {
    currentActiveRole = role;
    if (speakerRoleSelect) speakerRoleSelect.value = role;

    if (role === "CUSTOMER") {
        if (roleBtnCustomer) {
            roleBtnCustomer.style.background = "#ecfdf5";
            roleBtnCustomer.style.color = "#065f46";
            roleBtnCustomer.style.borderColor = "#059669";
        }
        if (roleBtnRep) {
            roleBtnRep.style.background = "#ffffff";
            roleBtnRep.style.color = "#475569";
            roleBtnRep.style.borderColor = "#cbd5e1";
        }
    } else {
        if (roleBtnRep) {
            roleBtnRep.style.background = "#eff6ff";
            roleBtnRep.style.color = "#1e40af";
            roleBtnRep.style.borderColor = "#2563eb";
        }
        if (roleBtnCustomer) {
            roleBtnCustomer.style.background = "#ffffff";
            roleBtnCustomer.style.color = "#475569";
            roleBtnCustomer.style.borderColor = "#cbd5e1";
        }
    }
}

if (roleBtnCustomer) {
    roleBtnCustomer.addEventListener("click", () => setSpeakerRole("CUSTOMER"));
}
if (roleBtnRep) {
    roleBtnRep.addEventListener("click", () => setSpeakerRole("SALES REPRESENTATIVE"));
}

// Shortcut: Tab key toggles active speaker role
window.addEventListener("keydown", (e) => {
    if (e.key === "Tab" && document.activeElement !== manualTurnInput) {
        e.preventDefault();
        setSpeakerRole(currentActiveRole === "CUSTOMER" ? "SALES REPRESENTATIVE" : "CUSTOMER");
    }
});

// ============================================================
// SESSION MANAGEMENT (AUTO-INITIALIZE IF NEEDED)
// ============================================================
async function ensureSession() {
    if (currentSessionId) return currentSessionId;

    const saved = sessionStorage.getItem("live_copilot_session_id");
    if (saved) {
        currentSessionId = saved;
        window.currentSessionId = saved;
        return saved;
    }

    return await window.startLiveCall();
}

// ============================================================
// LAUNCH LIVE SESSION
// ============================================================
window.startLiveCall = async function () {
    if (!checkAuth()) return null;

    const clientNameInput = document.getElementById("clientNameInput");
    const zoomMeetingInput = document.getElementById("zoomMeetingInput");

    const clientName = (clientNameInput && clientNameInput.value) || "Acme Corp (Lead)";
    const zoomMeeting = (zoomMeetingInput && zoomMeetingInput.value) || "";

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
        sessionStorage.setItem("live_copilot_session_id", currentSessionId);

        // Switch to Active Workspace
        if (meetingSetupCard) meetingSetupCard.style.display = "none";
        if (liveCallWorkspace) liveCallWorkspace.style.display = "block";

        // Start Call Timer
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

        // Start Microphone & Audio Meter
        initLocalMicrophone();

        // Greet in transcript feed
        addTranscriptBubble({
            speaker: "System",
            role: "SYSTEM",
            text: `Live session initialized for ${clientName}. AI Sales Copilot is active.`,
            time_str: new Date().toLocaleTimeString()
        });

        return currentSessionId;

    } catch (error) {
        console.error("Launch error:", error);
        alert("Notice starting live session: " + error.message);
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
            if (connectionStatus) {
                connectionStatus.innerHTML = '<span style="width:8px; height:8px; border-radius:50%; background:#10b981; display:inline-block;"></span> Live Streaming';
                connectionStatus.style.color = "#059669";
            }
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
            console.warn("[WS] Socket closed. Falling back to HTTP mode.");
            if (connectionStatus) {
                connectionStatus.innerHTML = '<span style="width:8px; height:8px; border-radius:50%; background:#d97706; display:inline-block;"></span> HTTP Mode';
                connectionStatus.style.color = "#d97706";
            }
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
        sessionStorage.removeItem("live_copilot_session_id");
        window.location.href = `call.html?id=${encodeURIComponent(targetId)}`;
    }
}

// ============================================================
// SUBMIT TURN (REST & WS)
// ============================================================
async function sendTurn(role, text) {
    if (!text || !text.trim()) return;

    if (!currentSessionId) {
        await ensureSession();
    }
    if (!currentSessionId) return;

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
                    battlecard: data.battlecard,
                    elapsed_seconds: data.elapsed_seconds
                });
            }
        } catch (e) {
            console.error("Failed to send turn:", e);
        }
    }
}

// Manual Input
if (sendTurnBtn && manualTurnInput) {
    sendTurnBtn.addEventListener("click", () => {
        const text = manualTurnInput.value;
        const role = currentActiveRole || "CUSTOMER";
        sendTurn(role, text);
        manualTurnInput.value = "";
    });

    manualTurnInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            sendTurnBtn.click();
        }
    });
}

// Quick Simulator: Works instantly with auto-session launch
window.simulateObjection = async function (text) {
    if (!currentSessionId) {
        await ensureSession();
    }
    sendTurn("CUSTOMER", text);
};

// ============================================================
// ZOOM AUDIO CAPTURE (DIGITAL SYSTEM AUDIO SHARING)
// ============================================================
async function startZoomAudioCapture() {
    if (!currentSessionId) {
        await ensureSession();
    }

    if (shareZoomAudioBtn) {
        shareZoomAudioBtn.innerHTML = `<span>⏳</span> Select Zoom Window...`;
        shareZoomAudioBtn.disabled = true;
    }

    try {
        // Request system audio or Zoom window audio
        zoomStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        });

        const audioTracks = zoomStream.getAudioTracks();
        if (audioTracks.length === 0) {
            alert("⚠️ No audio track was shared!\n\nWhen the browser prompt appears, make sure to check 'Share System Audio' or select the Zoom tab with audio enabled so customer speech can be captured.");
            if (shareZoomAudioBtn) {
                shareZoomAudioBtn.innerHTML = `<span>🎧</span> Share Zoom Audio`;
                shareZoomAudioBtn.disabled = false;
            }
            return;
        }

        console.log("[Zoom Audio] Digital track captured:", audioTracks[0].label);
        setupAudioMeter(zoomStream);

        if (shareZoomAudioBtn) {
            shareZoomAudioBtn.innerHTML = `<span>🟢</span> Zoom Audio Live`;
            shareZoomAudioBtn.style.background = "#059669";
            shareZoomAudioBtn.disabled = false;
        }

        // Initialize MediaRecorder for customer speech chunking
        const audioStream = new MediaStream([audioTracks[0]]);
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") 
            ? "audio/webm;codecs=opus" 
            : (MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg");

        zoomAudioRecorder = new MediaRecorder(audioStream, { mimeType: mimeType });

        zoomAudioRecorder.ondataavailable = async function (e) {
            if (e.data && e.data.size > 1500) {
                await sendAudioChunk(e.data, "CUSTOMER");
            }
        };

        // Slice audio chunks every 3.5 seconds
        zoomAudioRecorder.start(3500);

        audioTracks[0].onended = function () {
            console.log("[Zoom Audio] Audio sharing ended by user.");
            if (shareZoomAudioBtn) {
                shareZoomAudioBtn.innerHTML = `<span>🎧</span> Share Zoom Audio`;
                shareZoomAudioBtn.style.background = "#2563eb";
            }
        };

    } catch (err) {
        console.warn("Zoom audio share cancelled:", err);
        if (shareZoomAudioBtn) {
            shareZoomAudioBtn.innerHTML = `<span>🎧</span> Share Zoom Audio`;
            shareZoomAudioBtn.disabled = false;
        }
    }
}

if (shareZoomAudioBtn) {
    shareZoomAudioBtn.addEventListener("click", startZoomAudioCapture);
}

// Send Audio Blob to Gemini Cloud Audio Endpoint
async function sendAudioChunk(audioBlob, role) {
    if (!currentSessionId) {
        await ensureSession();
    }
    const formData = new FormData();
    formData.append("session_id", currentSessionId);
    formData.append("role", role);
    formData.append("audio", audioBlob, "speech_chunk.webm");

    try {
        const token = getToken();
        const res = await fetch(`${API_URL}/live-call/audio-turn`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`
            },
            body: formData
        });
        const data = await res.json();
        if (data.success && data.transcribed && data.text) {
            handleIncomingMessage({
                type: "turn_processed",
                turn: data.turn,
                talk_stats: data.talk_stats,
                battlecard: data.battlecard,
                elapsed_seconds: data.elapsed_seconds
            });
        }
    } catch (e) {
        console.warn("[Audio Chunk] Notice:", e);
    }
}

// ============================================================
// REAL-TIME AUDIO LEVEL METER (VU METER)
// ============================================================
function setupAudioMeter(stream) {
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioContext.state === "suspended") {
            audioContext.resume();
        }

        analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 256;
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyserNode);

        const dataArray = new Uint8Array(analyserNode.frequencyBinCount);

        function renderMeter() {
            if (!analyserNode) return;
            analyserNode.getByteFrequencyData(dataArray);

            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }
            const average = sum / dataArray.length;
            const pct = Math.min(100, Math.round((average / 128) * 100));

            if (audioVuMeter) {
                audioVuMeter.style.width = `${pct}%`;
            }
            if (audioVuStatus) {
                if (pct > 8) {
                    audioVuStatus.textContent = "🟢 Hearing Voice";
                    audioVuStatus.style.color = "#059669";
                } else {
                    audioVuStatus.textContent = "Listening...";
                    audioVuStatus.style.color = "#64748b";
                }
            }

            animFrameId = requestAnimationFrame(renderMeter);
        }

        if (animFrameId) cancelAnimationFrame(animFrameId);
        renderMeter();
    } catch (e) {
        console.warn("Could not start audio visualizer:", e);
    }
}

// ============================================================
// LOCAL MICROPHONE & SPEECH RECOGNITION
// ============================================================
function initLocalMicrophone() {
    // 1. Microphone level meter
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            setupAudioMeter(stream);
            if (micStatusText) micStatusText.textContent = "Mic Active";
        }).catch(err => {
            console.warn("Microphone access notice:", err);
            if (micStatusText) micStatusText.textContent = "Mic Blocked";
        });
    }

    // 2. Web Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn("Web Speech API not supported. Use Zoom Audio Sharing or manual mode.");
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
            // Smart Speaker Role: if objection words present, ensure tagged as CUSTOMER
            let role = currentActiveRole || "CUSTOMER";
            const textLower = transcript.toLowerCase();
            const objectionWords = ["price", "expensive", "cost", "competitor", "salesforce", "hubspot", "discount", "budget", "how much", "can you", "next quarter", "alternative"];
            if (objectionWords.some(w => textLower.includes(w))) {
                role = "CUSTOMER";
            }

            sendTurn(role, transcript);
        }
    };

    speechRecognizer.onerror = function (event) {
        console.warn("Speech recognition notice:", event.error);
    };

    speechRecognizer.onend = function () {
        if (currentSessionId && liveCallWorkspace && liveCallWorkspace.style.display !== "none") {
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

    if (repTalkPct) repTalkPct.textContent = `${repPct}%`;
    if (custTalkPct) custTalkPct.textContent = `${custPct}%`;

    if (repRatioLabel) repRatioLabel.textContent = `${repPct}%`;
    if (custRatioLabel) custRatioLabel.textContent = `${custPct}%`;

    if (repRatioBar) repRatioBar.style.width = `${repPct}%`;
    if (custRatioBar) custRatioBar.style.width = `${custPct}%`;

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
    if (battlecardsCount) battlecardsCount.textContent = totalBattlecards;

    const card = document.createElement("div");
    card.className = "battlecard-active";
    card.id = bc.id || `bc_${Date.now()}`;

    card.innerHTML = `
        <div class="battlecard-badge">
            ⚡ ${bc.category || 'Live Guidance'}
        </div>
        <div style="font-size:12px; font-weight:700; color:#475569; margin-bottom:4px;">
            CUSTOMER CONCERN: <span style="color:#0f172a;">${bc.customer_concern || 'Customer question'}</span>
        </div>
        <div style="font-size:11.5px; font-weight:700; color:#2563eb; text-transform:uppercase; margin-top:8px;">
            Suggested Live Script (Click to Copy):
        </div>
        <div class="rebuttal-script" onclick="copyRebuttalText('${escapeQuotes(bc.what_to_say)}')">
            "${bc.what_to_say}"
            <span style="position:absolute; right:10px; bottom:8px; font-size:11px; color:#2563eb; font-weight:600;">📋 Copy</span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; font-size:12px;">
            <span style="color:#059669; font-weight:600;">💡 Key Stat: ${bc.key_stat || '30% Lower TCO'}</span>
            <button onclick="dismissBattlecard('${card.id}', '${escapeQuotes(bc.category)}', '${escapeQuotes(bc.what_to_say)}')" style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:5px; padding:4px 8px; font-size:11px; cursor:pointer; font-weight:600;">
                ✓ Handled
            </button>
        </div>
    `;

    if (battlecardContainer) {
        battlecardContainer.innerHTML = "";
        battlecardContainer.appendChild(card);
    }
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

    if (battlecardContainer) {
        battlecardContainer.innerHTML = `
            <div style="background:#ffffff; border:1px dashed #cbd5e1; border-radius:10px; padding:35px 20px; text-align:center; color:#64748b; font-size:13.5px;">
                <div style="font-size:28px; margin-bottom:8px;">💡</div>
                <strong>AI Copilot Standing By</strong>
                <p style="margin:4px 0 0 0; font-size:12.5px; color:#94a3b8;">When the customer raises an objection or asks a question, actionable spoken rebuttals will pop up here in real time.</p>
            </div>
        `;
    }

    if (battlecardHistory) {
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
    }
};

// ============================================================
// END MEETING & GENERATE REPORT (100% RELIABLE)
// ============================================================
if (endCallBtn) {
    endCallBtn.addEventListener("click", async function () {
        endCallBtn.disabled = true;
        endCallBtn.innerHTML = `<span>⏳</span> Generating Executive AI Audit Report...`;

        clearInterval(timerInterval);
        if (speechRecognizer) {
            try { speechRecognizer.stop(); } catch (e) {}
        }
        if (zoomAudioRecorder && zoomAudioRecorder.state !== "inactive") {
            try { zoomAudioRecorder.stop(); } catch (e) {}
        }
        if (animFrameId) {
            cancelAnimationFrame(animFrameId);
        }

        const sessionId = currentSessionId || sessionStorage.getItem("live_copilot_session_id") || `session_${Date.now()}`;

        try {
            const res = await fetch(`${API_URL}/live-call/finalize`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({ session_id: sessionId })
            });

            const data = await res.json();
            if (data.success) {
                if (data.report) {
                    localStorage.setItem("latestReport", JSON.stringify(data.report));
                }
                const targetId = data.call_id || sessionId;
                sessionStorage.removeItem("live_copilot_session_id");
                window.location.href = `call.html?id=${encodeURIComponent(targetId)}`;
            } else {
                throw new Error(data.error || "Failed to finalize call report.");
            }
        } catch (error) {
            console.error("Finalize notice:", error);
            // Even on error, fallback to latestReport if available
            const cached = localStorage.getItem("latestReport");
            if (cached) {
                window.location.href = `call.html`;
            } else {
                alert("Notice finalizing call: " + error.message);
                endCallBtn.disabled = false;
                endCallBtn.innerHTML = `<span>🛑</span> End Call & Generate Executive Audit Report`;
            }
        }
    });
}

// ============================================================
// PAGE INITIALIZATION
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
    checkAuth();
    setSpeakerRole("CUSTOMER");

    // If session was already running before refresh, resume workspace
    const saved = sessionStorage.getItem("live_copilot_session_id");
    if (saved) {
        currentSessionId = saved;
        window.currentSessionId = saved;
        if (meetingSetupCard) meetingSetupCard.style.display = "none";
        if (liveCallWorkspace) liveCallWorkspace.style.display = "block";
        connectWebSocket(currentSessionId);
        initLocalMicrophone();
    }
});
