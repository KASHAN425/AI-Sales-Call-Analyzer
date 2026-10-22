// ============================================================
// ONBOARDING & NAVIGATION STEPS GUIDE MODULE
// Automatically guides new registered users through the platform
// ============================================================

(function () {
    let currentStep = 1;
    const totalSteps = 4;

    // Get current logged-in user name if available
    function getUserName() {
        try {
            const userStr = localStorage.getItem("currentUser") || localStorage.getItem("user");
            if (userStr) {
                const user = JSON.parse(userStr);
                if (user && user.name) return user.name;
            }
        } catch (e) {}
        return "Sales Professional";
    }

    // Build the Modal HTML
    function createModalHtml() {
        const userName = getUserName();

        return `
        <div class="onboarding-backdrop" id="onboardingModal" role="dialog" aria-modal="true">
            <div class="onboarding-card">
                
                <!-- HEADER -->
                <div class="onboarding-header">
                    <div class="onboarding-brand">
                        <div class="onboarding-badge-icon">🎯</div>
                        <div class="onboarding-title-group">
                            <h2>Platform Navigation Guide</h2>
                            <p>How to use AI Sales Call Analyzer to close more deals</p>
                        </div>
                    </div>
                    <button class="onboarding-close-btn" id="onboardingCloseBtn" title="Close guide (Esc)">&times;</button>
                </div>

                <!-- PROGRESS BAR & DOTS -->
                <div class="onboarding-progress-bar-container">
                    <div class="onboarding-step-counter" id="onboardingStepCounter">
                        <span>Step 1 of 4</span>
                    </div>
                    <div class="onboarding-step-dots" id="onboardingDots">
                        <div class="onboarding-dot active" data-step="1"></div>
                        <div class="onboarding-dot" data-step="2"></div>
                        <div class="onboarding-dot" data-step="3"></div>
                        <div class="onboarding-dot" data-step="4"></div>
                    </div>
                </div>

                <!-- BODY / SLIDES -->
                <div class="onboarding-body">
                    
                    <!-- SLIDE 1: WELCOME & PLATFORM OVERVIEW -->
                    <div class="onboarding-slide active" data-slide="1">
                        <div class="onboarding-hero-card">
                            <div class="onboarding-hero-icon" style="background:#eff6ff; color:#2563eb;">🚀</div>
                            <div class="onboarding-hero-text">
                                <h3>Welcome, ${userName}!</h3>
                                <p>AI Sales Call Analyzer helps sales teams review conversations, handle tough objections live on Zoom, and generate executive coaching audits powered by Google Gemini AI.</p>
                            </div>
                        </div>

                        <div class="onboarding-steps-list">
                            <div class="onboarding-step-item">
                                <div class="onboarding-step-num">1</div>
                                <div class="onboarding-step-detail">
                                    <strong>Upload & Audit Pre-Recorded Calls</strong>
                                    <span>Upload MP3/WAV files to measure talk-to-listen ratios and rep performance scores (0–100).</span>
                                </div>
                            </div>

                            <div class="onboarding-step-item">
                                <div class="onboarding-step-num">2</div>
                                <div class="onboarding-step-detail">
                                    <strong>Real-Time Live Zoom Copilot</strong>
                                    <span>Get live spoken answers on your screen during active Zoom calls in English and Urdu.</span>
                                </div>
                            </div>

                            <div class="onboarding-step-item">
                                <div class="onboarding-step-num">3</div>
                                <div class="onboarding-step-detail">
                                    <strong>Executive Intelligence Reports</strong>
                                    <span>Access next-step strategies, suggested follow-up emails, and objection breakdowns.</span>
                                </div>
                            </div>
                        </div>

                        <div class="onboarding-callout">
                            <span class="onboarding-callout-icon">💡</span>
                            <span><strong>Quick Tip:</strong> You can revisit this guide anytime by clicking the <strong>"📖 Quick Guide"</strong> button in the navigation bar.</span>
                        </div>
                    </div>

                    <!-- SLIDE 2: UPLOAD & AUDIT PRE-RECORDED CALLS -->
                    <div class="onboarding-slide" data-slide="2">
                        <div class="onboarding-hero-card">
                            <div class="onboarding-hero-icon" style="background:#ecfdf5; color:#059669;">📁</div>
                            <div class="onboarding-hero-text">
                                <h3>Step 1: Uploading Past Call Recordings</h3>
                                <p>Easily analyze recordings from Zoom, Google Meet, Microsoft Teams, or phone systems.</p>
                            </div>
                        </div>

                        <div class="onboarding-steps-list">
                            <div class="onboarding-step-item">
                                <div class="onboarding-step-num">A</div>
                                <div class="onboarding-step-detail">
                                    <strong>Drag & Drop Audio on the Dashboard</strong>
                                    <span>Supports <strong>MP3, WAV, M4A, OGG, and FLAC</strong> audio files directly in the main upload box.</span>
                                </div>
                            </div>

                            <div class="onboarding-step-item">
                                <div class="onboarding-step-num">B</div>
                                <div class="onboarding-step-detail">
                                    <strong>Click "Analyze Sales Call"</strong>
                                    <span>Our AI pipeline processes the audio with speaker turn diarization and objection detection.</span>
                                </div>
                            </div>

                            <div class="onboarding-step-item">
                                <div class="onboarding-step-num">C</div>
                                <div class="onboarding-step-detail">
                                    <strong>Review Executive Scorecard</strong>
                                    <span>Inspect customer buying intent, rep discovery effectiveness, and coaching opportunities.</span>
                                </div>
                            </div>
                        </div>

                        <div class="onboarding-callout">
                            <span class="onboarding-callout-icon">⚡</span>
                            <span><strong>Cloud Speed:</strong> Powered by Gemini audio processing with zero heavy GPU overhead.</span>
                        </div>
                    </div>

                    <!-- SLIDE 3: LIVE ZOOM SALES COPILOT -->
                    <div class="onboarding-slide" data-slide="3">
                        <div class="onboarding-hero-card">
                            <div class="onboarding-hero-icon" style="background:#eff6ff; color:#2563eb;">🎧</div>
                            <div class="onboarding-hero-text">
                                <h3>Step 2: Real-Time Live Zoom Copilot</h3>
                                <p>Get instant sales battlecards and spoken scripts on your screen while talking to customers.</p>
                            </div>
                        </div>

                        <div class="onboarding-steps-list">
                            <div class="onboarding-step-item">
                                <div class="onboarding-step-num">1</div>
                                <div class="onboarding-step-detail">
                                    <strong>Navigate to "⚡ Live Zoom Copilot"</strong>
                                    <span>Click the Live Copilot tab in the left sidebar whenever you start or join a customer meeting.</span>
                                </div>
                            </div>

                            <div class="onboarding-step-item">
                                <div class="onboarding-step-num">2</div>
                                <div class="onboarding-step-detail">
                                    <strong>Automatic Dual-Stream Audio (Zero Tab Switching)</strong>
                                    <span>• <strong>Laptop Mic:</strong> Listens to YOU (Sales Rep) automatically.<br>• <strong>Zoom Tab Share:</strong> Click "Share Zoom Tab" & enable audio to automatically capture the Customer.</span>
                                </div>
                            </div>

                            <div class="onboarding-step-item">
                                <div class="onboarding-step-num">3</div>
                                <div class="onboarding-step-detail">
                                    <strong>"Is Sawal Par Ye Jawab Bolo" HUD</strong>
                                    <span>When the customer asks a question or raises an objection, the right-hand HUD shows an exact spoken script with a <strong>1-Click Copy Script</strong> button!</span>
                                </div>
                            </div>
                        </div>

                        <div class="onboarding-callout">
                            <span class="onboarding-callout-icon">🌐</span>
                            <span><strong>Multilingual:</strong> Fully understands and responds in natural <strong>English, Urdu, and Roman Urdu</strong>.</span>
                        </div>
                    </div>

                    <!-- SLIDE 4: EXECUTIVE REPORTS & ARCHIVE -->
                    <div class="onboarding-slide" data-slide="4">
                        <div class="onboarding-hero-card">
                            <div class="onboarding-hero-icon" style="background:#fef3c7; color:#d97706;">📊</div>
                            <div class="onboarding-hero-text">
                                <h3>Step 3: Executive Reports & Call Archive</h3>
                                <p>Turn every sales call into a structured strategy playbook for your team.</p>
                            </div>
                        </div>

                        <div class="onboarding-steps-list">
                            <div class="onboarding-step-item">
                                <div class="onboarding-step-num">✓</div>
                                <div class="onboarding-step-detail">
                                    <strong>End Call & Generate Executive Report</strong>
                                    <span>When your live meeting finishes, click the red button to generate a comprehensive 9-pillar audit report.</span>
                                </div>
                            </div>

                            <div class="onboarding-step-item">
                                <div class="onboarding-step-num">✓</div>
                                <div class="onboarding-step-detail">
                                    <strong>Actionable Next-Call Strategy</strong>
                                    <span>Get recommended opening lines, follow-up timing, discovery questions, and closing questions.</span>
                                </div>
                            </div>

                            <div class="onboarding-step-item">
                                <div class="onboarding-step-num">✓</div>
                                <div class="onboarding-step-detail">
                                    <strong>Call History Archive</strong>
                                    <span>All calls are stored in <strong>"◷ Call History"</strong> with search and historical performance scores.</span>
                                </div>
                            </div>
                        </div>

                        <div class="onboarding-callout" style="background:#eff6ff; border-color:#bfdbfe; color:#1e40af;">
                            <span class="onboarding-callout-icon">🎉</span>
                            <span><strong>You're All Set!</strong> Ready to start analyzing calls and closing more deals.</span>
                        </div>
                    </div>

                </div>

                <!-- FOOTER -->
                <div class="onboarding-footer">
                    <button class="onboarding-skip-btn" id="onboardingSkipBtn">Skip Tour</button>
                    <div class="onboarding-nav-buttons">
                        <button class="onboarding-btn-secondary" id="onboardingPrevBtn" disabled>&larr; Back</button>
                        <button class="onboarding-btn-primary" id="onboardingNextBtn">Next Step &rarr;</button>
                    </div>
                </div>

            </div>
        </div>
        `;
    }

    // Attach guide to the DOM
    function initGuide() {
        if (!document.getElementById("onboardingModal")) {
            const div = document.createElement("div");
            div.innerHTML = createModalHtml().trim();
            document.body.appendChild(div.firstElementChild);
            bindEvents();
        }
    }

    // Update UI for current step
    function updateStepView() {
        const slides = document.querySelectorAll(".onboarding-slide");
        const dots = document.querySelectorAll(".onboarding-dot");
        const counter = document.getElementById("onboardingStepCounter");
        const prevBtn = document.getElementById("onboardingPrevBtn");
        const nextBtn = document.getElementById("onboardingNextBtn");

        slides.forEach(s => s.classList.remove("active"));
        const targetSlide = document.querySelector(`.onboarding-slide[data-slide="${currentStep}"]`);
        if (targetSlide) targetSlide.classList.add("active");

        dots.forEach((d, idx) => {
            const stepNum = idx + 1;
            d.classList.remove("active", "completed");
            if (stepNum === currentStep) {
                d.classList.add("active");
            } else if (stepNum < currentStep) {
                d.classList.add("completed");
            }
        });

        if (counter) {
            counter.innerHTML = `<span>Step ${currentStep} of ${totalSteps}</span>`;
        }

        if (prevBtn) {
            prevBtn.disabled = currentStep === 1;
        }

        if (nextBtn) {
            if (currentStep === totalSteps) {
                nextBtn.innerHTML = "🚀 Get Started Now";
                nextBtn.style.background = "#059669";
            } else {
                nextBtn.innerHTML = "Next Step &rarr;";
                nextBtn.style.background = "#2563eb";
            }
        }
    }

    function openGuide(step = 1) {
        initGuide();
        currentStep = Math.min(Math.max(1, step), totalSteps);
        updateStepView();
        const modal = document.getElementById("onboardingModal");
        if (modal) {
            modal.classList.add("active");
            document.body.style.overflow = "hidden";
        }
    }

    function closeGuide() {
        const modal = document.getElementById("onboardingModal");
        if (modal) {
            modal.classList.remove("active");
            document.body.style.overflow = "";
        }
        localStorage.setItem("sales_onboarding_guide_seen", "true");
        sessionStorage.removeItem("user_just_registered");
    }

    function bindEvents() {
        const modal = document.getElementById("onboardingModal");
        const closeBtn = document.getElementById("onboardingCloseBtn");
        const skipBtn = document.getElementById("onboardingSkipBtn");
        const prevBtn = document.getElementById("onboardingPrevBtn");
        const nextBtn = document.getElementById("onboardingNextBtn");
        const dots = document.querySelectorAll(".onboarding-dot");

        if (closeBtn) closeBtn.addEventListener("click", closeGuide);
        if (skipBtn) skipBtn.addEventListener("click", closeGuide);

        if (prevBtn) {
            prevBtn.addEventListener("click", () => {
                if (currentStep > 1) {
                    currentStep--;
                    updateStepView();
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener("click", () => {
                if (currentStep < totalSteps) {
                    currentStep++;
                    updateStepView();
                } else {
                    closeGuide();
                }
            });
        }

        dots.forEach(dot => {
            dot.addEventListener("click", () => {
                const step = parseInt(dot.getAttribute("data-step"), 10);
                if (step && step >= 1 && step <= totalSteps) {
                    currentStep = step;
                    updateStepView();
                }
            });
        });

        // Close on backdrop click
        if (modal) {
            modal.addEventListener("click", (e) => {
                if (e.target === modal) {
                    closeGuide();
                }
            });
        }

        // Keyboard navigation (Esc, Left, Right)
        document.addEventListener("keydown", (e) => {
            if (!modal || !modal.classList.contains("active")) return;
            if (e.key === "Escape") {
                closeGuide();
            } else if (e.key === "ArrowRight") {
                if (currentStep < totalSteps) {
                    currentStep++;
                    updateStepView();
                }
            } else if (e.key === "ArrowLeft") {
                if (currentStep > 1) {
                    currentStep--;
                    updateStepView();
                }
            }
        });
    }

    // Expose globally
    window.openOnboardingGuide = openGuide;
    window.closeOnboardingGuide = closeGuide;

    // Check if new user
    document.addEventListener("DOMContentLoaded", () => {
        // Wire up any trigger buttons already on the page
        document.querySelectorAll(".quick-guide-trigger-btn, #openGuideBtn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                openGuide(1);
            });
        });

        const justRegistered = sessionStorage.getItem("user_just_registered") === "true";
        const hasSeenGuide = localStorage.getItem("sales_onboarding_guide_seen") === "true";

        // If user just registered OR first time on dashboard, automatically show guide
        if (justRegistered || !hasSeenGuide) {
            setTimeout(() => {
                openGuide(1);
            }, 600);
        }
    });

})();
