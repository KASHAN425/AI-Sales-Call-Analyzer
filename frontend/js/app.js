const API_URL = "http://127.0.0.1:8000";

// ==================================================
// AUTHENTICATION
// ==================================================

function getToken() {
    return localStorage.getItem("access_token");
}

function getAuthHeaders() {
    const token = getToken();

    if (!token) {
        window.location.replace("login.html");
        throw new Error("Please log in first.");
    }

    return {
        Authorization: `Bearer ${token}`
    };
}

// Protect the main dashboard.
if (!getToken()) {
    window.location.replace("login.html");
}

// ==================================================
// ELEMENTS
// ==================================================

const audioFile = document.getElementById("audioFile");
const browseBtn = document.getElementById("browseBtn");
const uploadBox = document.getElementById("uploadBox");

const selectedFile = document.getElementById("selectedFile");
const fileName = document.getElementById("fileName");
const fileSize = document.getElementById("fileSize");

const analyzeBtn = document.getElementById("analyzeBtn");

const processing = document.getElementById("processing");
const processingText = document.getElementById("processingText");

// ==================================================
// HANDLE API ERRORS
// ==================================================

async function readResponse(response) {
    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("currentUser");

        window.location.replace("login.html");

        throw new Error("Your session expired. Please log in again.");
    }

    if (response.status === 403) {
        throw new Error("You do not have access to this resource.");
    }

    if (!response.ok) {
        throw new Error(
            data.detail ||
            data.error ||
            `Request failed with status ${response.status}.`
        );
    }

    return data;
}

// ==================================================
// DASHBOARD STATS
// ==================================================

async function loadDashboardStats() {
    if (!getToken()) return;

    try {
        const response = await fetch(`${API_URL}/dashboard/stats`, {
            method: "GET",
            headers: getAuthHeaders()
        });

        const data = await readResponse(response);

        if (data.success === false) {
            console.error("Dashboard stats error:", data.error);
            return;
        }

        const totalCalls = document.getElementById("totalCalls");
        const averageScore = document.getElementById("averageScore");
        const buyingIntent = document.getElementById("buyingIntent");

        if (totalCalls) {
            totalCalls.textContent = data.total_calls ?? 0;
        }

        if (averageScore) {
            averageScore.textContent = Number(data.total_calls) > 0
                ? Math.round(Number(data.average_score ?? 0))
                : "--";
        }

        if (buyingIntent) {
            if (Number(data.total_calls) === 0) {
                buyingIntent.textContent = "--";
            } else {
                const score = Number(data.average_buying_intent ?? 0);

                buyingIntent.textContent =
                    score >= 0.70 ? "High" :
                    score >= 0.40 ? "Medium" : "Low";
            }
        }
    } catch (error) {
        console.error("Could not load dashboard stats:", error);
    }
}

// ==================================================
// FILE SELECTION
// ==================================================

if (browseBtn && audioFile) {
    browseBtn.addEventListener("click", function () {
        audioFile.click();
    });

    audioFile.addEventListener("change", function () {
        if (this.files && this.files.length > 0) {
            selectFile(this.files[0]);
        }
    });
}

function selectFile(file) {
    if (!file) return;

    if (fileName) {
        fileName.textContent = file.name;
    }

    if (fileSize) {
        fileSize.textContent = formatFileSize(file.size);
    }

    if (selectedFile) {
        selectedFile.style.display = "flex";
    }

    if (analyzeBtn) {
        analyzeBtn.disabled = false;
    }
}

function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ==================================================
// DRAG AND DROP
// ==================================================

if (uploadBox && audioFile) {
    uploadBox.addEventListener("dragover", function (event) {
        event.preventDefault();
        uploadBox.style.borderColor = "#3157d5";
    });

    uploadBox.addEventListener("dragleave", function () {
        uploadBox.style.borderColor = "";
    });

    uploadBox.addEventListener("drop", function (event) {
        event.preventDefault();
        uploadBox.style.borderColor = "";

        const file = event.dataTransfer.files[0];

        if (!file) return;

        // Keep the dropped file in the input for uploading.
        const transfer = new DataTransfer();
        transfer.items.add(file);
        audioFile.files = transfer.files;

        selectFile(file);
    });
}

// ==================================================
// UPLOAD AND ANALYZE
// ==================================================

if (analyzeBtn) {
    analyzeBtn.addEventListener("click", async function () {
        if (!audioFile || !audioFile.files.length) {
            alert("Please select an audio file first.");
            return;
        }

        if (!getToken()) {
            window.location.replace("login.html");
            return;
        }

        const formData = new FormData();
        formData.append("file", audioFile.files[0]);

        if (selectedFile) {
            selectedFile.style.display = "none";
        }

        if (processing) {
            processing.style.display = "block";
        }

        analyzeBtn.disabled = true;

        if (processingText) {
            processingText.textContent = "Uploading audio...";
        }

        try {
            const response = await fetch(`${API_URL}/analyze`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: formData
            });

            const data = await readResponse(response);

            if (data.success === false || !data.job_id) {
                throw new Error(
                    data.detail || data.error || "Upload failed."
                );
            }

            if (processingText) {
                processingText.textContent = "AI analysis is running...";
            }

            await checkStatus(data.job_id);

        } catch (error) {
            console.error("Upload error:", error);

            if (error.message !== "Please log in first.") {
                let msg = error.message || "Upload failed.";
                if (msg.toLowerCase().includes("failed to fetch")) {
                    msg = `Failed to connect to the backend server at ${API_URL}. Please ensure the Python FastAPI backend is running.`;
                }
                alert(msg);
            }

            if (processing) {
                processing.style.display = "none";
            }

            if (selectedFile) {
                selectedFile.style.display = "flex";
            }

            analyzeBtn.disabled = false;
        }
    });
}

// ==================================================
// POLL ANALYSIS STATUS
// ==================================================

async function checkStatus(jobId) {
    try {
        const response = await fetch(
            `${API_URL}/status/${encodeURIComponent(jobId)}`,
            {
                method: "GET",
                headers: getAuthHeaders()
            }
        );

        const data = await readResponse(response);

        if (
            data.status === "processing" ||
            data.status === "queued"
        ) {
            if (processingText) {
                processingText.textContent =
                    data.message || "AI analysis is running...";
            }

            setTimeout(() => checkStatus(jobId), 2000);
            return;
        }

        if (data.status === "completed") {
            if (processingText) {
                processingText.textContent = "Analysis completed!";
            }

            if (data.call_id) {
                window.location.href =
                    `call.html?id=${encodeURIComponent(data.call_id)}`;
                return;
            }

            if (data.report) {
                localStorage.setItem(
                    "latestReport",
                    JSON.stringify(data.report)
                );

                window.location.href = "call.html";
                return;
            }

            throw new Error("Analysis completed, but the report was not returned.");
        }

        if (data.status === "failed") {
            throw new Error(data.message || "Analysis failed.");
        }

        throw new Error(data.message || "Unknown analysis status.");

    } catch (error) {
        console.error("Analysis status error:", error);

        if (
            !error.message.includes("session expired") &&
            !error.message.includes("log in first")
        ) {
            alert(error.message || "Analysis failed.");
        }

        if (processing) {
            processing.style.display = "none";
        }

        if (selectedFile) {
            selectedFile.style.display = "flex";
        }

        if (analyzeBtn) {
            analyzeBtn.disabled = false;
        }
    }
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
}

// ==================================================
// INITIAL LOAD
// ==================================================

if (getToken()) {
    initUserProfile();
    loadDashboardStats();
}