const API_URL = "http://127.0.0.1:8000";

let fullConversation = [];

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

    const exportPdfBtn = document.getElementById("exportPdfBtn");
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener("click", function () {
            window.print();
        });
    }
}

// ==================================================
// SCRIPT CLIPBOARD COPY
// ==================================================

window.copyScriptText = function (btn) {
    const card = btn.closest(".script-card");
    if (!card) return;
    const textEl = card.querySelector(".script-text");
    if (!textEl) return;
    const text = textEl.innerText || textEl.textContent;

    navigator.clipboard.writeText(text).then(() => {
        const originalText = btn.textContent;
        btn.textContent = "Copied! ✓";
        btn.classList.add("copied");
        setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove("copied");
        }, 2000);
    }).catch(err => {
        console.error("Clipboard copy failed:", err);
    });
};

// ==================================================
// LOAD REPORT
// ==================================================

const urlParams = new URLSearchParams(window.location.search);
const callId = urlParams.get("id");

async function loadReport() {
    try {
        let report;

        if (callId) {
            const response = await fetch(`${API_URL}/calls/${callId}`, {
                headers: getAuthHeaders()
            });

            if (response.status === 401) {
                localStorage.removeItem("access_token");
                localStorage.removeItem("currentUser");
                window.location.replace("login.html");
                return;
            }

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || "Report not found.");
            }

            report = data.report;
        } else {
            const savedReport = localStorage.getItem("latestReport");
            if (!savedReport) {
                showError("No call report found. Please analyze a call first.");
                return;
            }
            report = JSON.parse(savedReport);
        }

        displayReport(report);

    } catch (error) {
        console.error("Report loading error:", error);
        showError(error.message || "Could not load report.");
    }
}

// ==================================================
// DISPLAY REPORT
// ==================================================

function displayReport(report) {
    if (!report) {
        showError("Invalid report data received.");
        return;
    }

    const callInfo = report.call_information || {};
    const customer = report.customer_analysis || {};
    const salesperson = report.salesperson_analysis || {};
    const metrics = salesperson.metrics || {};
    fullConversation = report.conversation || [];

    // Audio Filename in header
    const audioName = callInfo.audio_file || "Call Recording";
    const titleEl = document.getElementById("reportTitle");
    if (titleEl) {
        titleEl.textContent = `Call Analysis: ${audioName}`;
    }
    document.title = `Analysis: ${audioName} | AI Sales Analyzer`;

    // 1. Performance Score
    const scoreVal = salesperson.performance_score ?? "--";
    const scoreEl = document.getElementById("salesScore");
    if (scoreEl) {
        scoreEl.textContent = scoreVal;
        if (Number(scoreVal) >= 70) scoreEl.style.color = "#059669";
        else if (Number(scoreVal) >= 50) scoreEl.style.color = "#d97706";
        else if (scoreVal !== "--") scoreEl.style.color = "#dc2626";
    }

    setText("salespersonScore", `${scoreVal}/100`);

    // 2. Sentiment
    const sentimentLabel = customer.overall_sentiment || getOverallSentiment(customer.sentiment);
    setText("sentiment", formatLabel(sentimentLabel));
    setText("customerSentiment", formatLabel(sentimentLabel));

    // 3. Buying Intent
    let intentLabel = customer.buying_intent;
    if (!intentLabel) {
        const intentScore = customer.buying_intent_score ?? 0.5;
        intentLabel = intentScore >= 0.7 ? "High" : (intentScore >= 0.4 ? "Medium" : "Low");
    }
    setText("buyingIntent", formatLabel(intentLabel));
    setText("customerIntent", formatLabel(intentLabel));

    // 4. Primary Need
    const needVal = customer.primary_need || getMainNeed(customer.intent);
    setText("customerNeed", formatLabel(needVal));

    // 5. Salesperson Metrics
    const repTalk = metrics.salesperson_talk_percentage != null ? `${Math.round(metrics.salesperson_talk_percentage)}%` : "55%";
    const custTalk = metrics.customer_talk_percentage != null ? `${Math.round(metrics.customer_talk_percentage)}%` : "45%";
    setText("communicationScore", repTalk);
    setText("engagementScore", custTalk);

    // 6. Duration
    const durSec = callInfo.duration || getDuration(fullConversation);
    setText("duration", formatDuration(durSec));

    // 7. Needs, Objections, Questions
    renderNeeds(customer);
    renderObjections(customer);
    renderQuestions(customer);

    // 8. Recommendations & Coaching
    renderRecommendations(report);
    renderNextCallStrategy(report);
    renderRecommendedConversation(report);
    renderSalesCoaching(report);
    renderFollowUpActions(report);

    // 9. Full Conversation Transcript
    renderTranscript(fullConversation);
}

// ==================================================
// RENDER CUSTOMER NEEDS
// ==================================================

function renderNeeds(customer) {
    const container = document.getElementById("needs");
    if (!container) return;

    let needs = [];
    if (Array.isArray(customer.pain_points) && customer.pain_points.length > 0) {
        needs = customer.pain_points;
    } else if (customer.primary_need) {
        needs = [customer.primary_need];
    } else if (Array.isArray(customer.intent)) {
        needs = customer.intent.map(i => i.customer_need || i.intent).filter(Boolean);
    }

    if (!needs.length) {
        needs = ["General Inquiry & Pricing"];
    }

    container.innerHTML = needs.map(n => `<span class="tag">${escapeHTML(n)}</span>`).join("");
}

// ==================================================
// RENDER OBJECTIONS
// ==================================================

function renderObjections(customer) {
    const container = document.getElementById("objections");
    if (!container) return;

    let objections = customer.objections || [];
    if (!Array.isArray(objections) || objections.length === 0) {
        container.innerHTML = `<span class="tag positive">✓ No strong objections detected</span>`;
        return;
    }

    container.innerHTML = objections.map(obj => {
        if (typeof obj === "string") {
            return `<span class="tag warning">${escapeHTML(obj)}</span>`;
        }
        const text = obj.objection || obj.text || "Objection detected";
        const rebuttal = obj.recommended_rebuttal || obj.rebuttal || "";
        return `
            <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:6px; padding:10px 14px; width:100%; margin-bottom:6px;">
                <strong style="color:#92400e; font-size:13px; display:block;">Objection: ${escapeHTML(text)}</strong>
                ${rebuttal ? `<p style="font-size:12.5px; color:#475569; margin-top:4px;"><strong>Recommended Counter-Response:</strong> ${escapeHTML(rebuttal)}</p>` : ""}
            </div>
        `;
    }).join("");
}

// ==================================================
// RENDER QUESTIONS
// ==================================================

function renderQuestions(customer) {
    const container = document.getElementById("questions");
    if (!container) return;

    let questions = customer.questions || [];
    if (!Array.isArray(questions) || questions.length === 0) {
        container.innerHTML = `<p style="font-size:13px; color:var(--text-muted);">No direct customer questions identified.</p>`;
        return;
    }

    container.innerHTML = questions.map(q => {
        if (typeof q === "string") {
            return `<div class="feature-item"><p>${escapeHTML(q)}</p></div>`;
        }
        const type = q.question_type ? `[${formatLabel(q.question_type)}] ` : "";
        const text = q.text || q.question || "";
        const answer = q.rep_answer ? `<p style="font-size:12px; color:#64748b; margin-top:4px;"><strong>Rep Response:</strong> ${escapeHTML(q.rep_answer)}</p>` : "";
        return `
            <div class="feature-item">
                <strong style="color:#1e40af;">${escapeHTML(type)}Customer Question</strong>
                <p>${escapeHTML(text)}</p>
                ${answer}
            </div>
        `;
    }).join("");
}

// ==================================================
// RENDER RECOMMENDATIONS
// ==================================================

function renderRecommendations(report) {
    const container = document.getElementById("recommendations");
    if (!container) return;

    let recs = report.recommendations;
    if (!Array.isArray(recs) || recs.length === 0) {
        const salesperson = report.salesperson_analysis || {};
        recs = salesperson.recommendations || [];
    }

    if (!Array.isArray(recs) || recs.length === 0) {
        recs = [
            "Follow up promptly with clear product packages and pricing.",
            "Ask more open-ended qualification questions in early conversation stages.",
            "Proactively establish mutual calendar appointments before concluding the call."
        ];
    }

    container.innerHTML = recs.map(r => `<li>${escapeHTML(r)}</li>`).join("");
}

// ==================================================
// STRATEGIC NEXT CALL PLAN
// ==================================================

function renderNextCallStrategy(report) {
    const container = document.getElementById("nextCallStrategy");
    if (!container) return;

    const strategy = report.next_call_strategy || {
        suggested_timing: "Within 24 to 48 hours",
        objective: "Follow up regarding discussed customer requirements and present tailored proposal.",
        priority: "Clarify any pricing or feature questions before decision milestone.",
        checklist: [
            "Prepare tailored package breakdown and transparent pricing.",
            "Send meeting recap email with key discussion points.",
            "Lock in decision-maker calendar appointment."
        ]
    };

    const timing = strategy.suggested_timing || "Within 24-48 hours";
    const objective = strategy.objective || "Follow up on customer requirements";
    const priority = strategy.priority || "Provide detailed pricing options";
    const checklist = Array.isArray(strategy.checklist) ? strategy.checklist : [];

    container.innerHTML = `
        <div class="feature-item">
            <strong>Suggested Timing</strong>
            <p>${escapeHTML(timing)}</p>
        </div>
        <div class="feature-item">
            <strong>Core Objective</strong>
            <p>${escapeHTML(objective)}</p>
        </div>
        <div class="feature-item">
            <strong>Key Priority</strong>
            <p>${escapeHTML(priority)}</p>
        </div>
        ${checklist.length ? `
            <div class="feature-item">
                <strong>Preparation Checklist</strong>
                <ul>
                    ${checklist.map(item => `<li>${escapeHTML(item)}</li>`).join("")}
                </ul>
            </div>
        ` : ""}
    `;
}

// ==================================================
// RECOMMENDED CONVERSATION SCRIPT (WITH ONE-CLICK COPY)
// ==================================================

function renderRecommendedConversation(report) {
    const container = document.getElementById("recommendedConversation");
    if (!container) return;

    const script = report.recommended_conversation || {
        opening: "Hi! Thanks for speaking earlier. I'm following up with the specific details and options we discussed.",
        discovery_question: "Regarding your priorities, what timeline are you targeting for this project?",
        objection_handling: "Our solution is flexible and built to offer measurable value based directly on your needs.",
        value_proposition: "We deliver streamlined, high-performance solutions that simplify your workflow.",
        closing_question: "Would tomorrow afternoon at 2 PM work for a brief 10-minute walkthrough?"
    };

    const scriptRows = [
        ["Call Opening", script.opening],
        ["Discovery Question", script.discovery_question],
        ["Value Proposition", script.value_proposition],
        ["Objection Handling", script.objection_handling],
        ["Closing Question", script.closing_question]
    ];

    container.innerHTML = scriptRows.map(([title, text]) => `
        <div class="feature-item script-card">
            <div class="script-header">
                <strong>${escapeHTML(title)}</strong>
                <button type="button" class="copy-script-btn" onclick="copyScriptText(this)">Copy Script</button>
            </div>
            <p class="script-text">${escapeHTML(text || "No script available.")}</p>
        </div>
    `).join("");
}

// ==================================================
// SALES COACHING
// ==================================================

function renderSalesCoaching(report) {
    const container = document.getElementById("salesCoaching");
    if (!container) return;

    let coaching = report.sales_coaching;
    if (!Array.isArray(coaching) || coaching.length === 0) {
        coaching = [
            { area: "Discovery", advice: "Deepen early discovery questions to uncover budget, authority, and explicit timelines." },
            { area: "Closing", advice: "Always agree on a concrete next calendar date before concluding the interaction." }
        ];
    }

    container.innerHTML = coaching.map(item => {
        if (typeof item === "string") {
            return `<div class="feature-item"><strong>Coaching Focus</strong><p>${escapeHTML(item)}</p></div>`;
        }
        const area = item.area || item.title || "Sales Coaching";
        const advice = item.advice || item.suggestion || item.detail || "";
        return `
            <div class="feature-item">
                <strong>${escapeHTML(area)}</strong>
                <p>${escapeHTML(advice)}</p>
            </div>
        `;
    }).join("");
}

// ==================================================
// FOLLOW-UP ACTION ITEMS
// ==================================================

function renderFollowUpActions(report) {
    const container = document.getElementById("followUpActions");
    if (!container) return;

    let actions = report.follow_up_actions;
    if (!Array.isArray(actions) || actions.length === 0) {
        actions = [
            { action: "Send tailored proposal", detail: "Email comprehensive overview and pricing breakdown within 24 hours." },
            { action: "Confirm calendar invite", detail: "Send calendar invitation for follow-up review." }
        ];
    }

    container.innerHTML = actions.map((item, idx) => {
        if (typeof item === "string") {
            return `
                <div class="feature-item" style="display:flex; align-items:flex-start; gap:10px;">
                    <input type="checkbox" style="margin-top:4px; width:16px; height:16px; accent-color:var(--primary);">
                    <div><p>${escapeHTML(item)}</p></div>
                </div>
            `;
        }
        const act = item.action || `Action ${idx + 1}`;
        const detail = item.detail || item.description || "";
        return `
            <div class="feature-item" style="display:flex; align-items:flex-start; gap:12px;">
                <input type="checkbox" style="margin-top:4px; width:16px; height:16px; accent-color:var(--primary); cursor:pointer;">
                <div>
                    <strong>${escapeHTML(act)}</strong>
                    <p>${escapeHTML(detail)}</p>
                </div>
            </div>
        `;
    }).join("");
}

// ==================================================
// FULL TRANSCRIPT
// ==================================================

function renderTranscript(conversation) {
    const container = document.getElementById("transcript");
    if (!container) return;

    if (!conversation || conversation.length === 0) {
        container.innerHTML = `<p style="color:var(--text-muted); font-size:13.5px;">No transcript turns available.</p>`;
        return;
    }

    container.innerHTML = conversation.map(item => {
        const role = item.role || item.speaker_id || "Speaker";
        const isSales = role.toLowerCase().includes("sales") || role.toLowerCase().includes("speaker 0") || role.toLowerCase() === "salesperson";
        const roleBadge = isSales ? "Sales Representative" : "Customer";
        const roleColor = isSales ? "#1e40af" : "#065f46";
        const start = formatDuration(item.start || 0);
        const end = formatDuration(item.end || 0);

        return `
            <div class="transcript-item">
                <div class="transcript-meta">
                    <strong style="color:${roleColor};">${roleBadge}</strong>
                    <span>${start} - ${end}</span>
                </div>
                <p>${escapeHTML(item.text || "")}</p>
            </div>
        `;
    }).join("");
}

// Transcript Live Filter
const transcriptSearch = document.getElementById("transcriptSearch");
if (transcriptSearch) {
    transcriptSearch.addEventListener("input", function () {
        const query = this.value.toLowerCase().trim();
        if (!query) {
            renderTranscript(fullConversation);
            return;
        }

        const filtered = fullConversation.filter(item => {
            const txt = (item.text || "").toLowerCase();
            const role = (item.role || item.speaker_id || "").toLowerCase();
            return txt.includes(query) || role.includes(query);
        });

        renderTranscript(filtered);
    });
}

// ==================================================
// HELPERS
// ==================================================

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? "--";
}

function getOverallSentiment(sentiments) {
    if (!sentiments || !sentiments.length) return "Neutral";
    if (typeof sentiments === "string") return sentiments;
    const labels = sentiments.map(s => s.label).filter(Boolean);
    if (!labels.length) return "Neutral";
    const counts = {};
    labels.forEach(l => { counts[l] = (counts[l] || 0) + 1; });
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
}

function getMainNeed(intents) {
    if (!intents || !intents.length) return "Product and Pricing Inquiry";
    for (const item of intents) {
        if (item.customer_need) return item.customer_need;
        if (item.need) return item.need;
    }
    return "Product Inquiry";
}

function getDuration(conversation) {
    if (!conversation || !conversation.length) return 0;
    const last = conversation[conversation.length - 1];
    return Math.round(last.end || 0);
}

function formatLabel(val) {
    if (!val) return "--";
    return val.toString().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function formatDuration(seconds) {
    seconds = Number(seconds) || 0;
    const min = Math.floor(seconds / 60);
    const sec = Math.round(seconds % 60);
    return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function escapeHTML(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showError(msg) {
    document.body.innerHTML = `
        <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; padding:30px; text-align:center; background:#f1f5f9; color:#0f172a; font-family:var(--font-family);">
            <div style="max-width:440px; background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:32px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.07);">
                <h2 style="font-size:18px; margin-bottom:8px; font-weight:600;">${escapeHTML(msg)}</h2>
                <p style="color:#64748b; font-size:13.5px; margin-bottom:20px;">Return to dashboard and try again.</p>
                <a href="dashboard.html" class="btn-primary" style="display:inline-block;">Back to Call History</a>
            </div>
        </div>
    `;
}

// ==================================================
// INITIALIZE
// ==================================================

initUserProfile();
loadReport();