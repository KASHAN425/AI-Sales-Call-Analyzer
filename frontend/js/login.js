const API_URL = "http://127.0.0.1:8000";

const loginForm = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");
const loginMessage = document.getElementById("loginMessage");

loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = document.getElementById("email").value.trim().toLowerCase();
    const password = document.getElementById("password").value;

    loginBtn.disabled = true;
    loginBtn.textContent = "Logging in...";
    loginMessage.textContent = "";
    loginMessage.style.color = "#c0392b";

    try {
        // Backend's current FastAPI endpoint accepts email/password
        // as query parameters.
        const params = new URLSearchParams({ email, password });

        const response = await fetch(
            `${API_URL}/auth/login?${params.toString()}`,
            { method: "POST" }
        );

        const data = await response.json();

        if (!response.ok || data.success === false) {
            throw new Error(
                data.detail || data.error || "Login failed. Check your credentials."
            );
        }

        // Support either common token field name.
        const token = data.access_token || data.token;

        if (!token) {
            throw new Error(
                "Login response did not contain a token. Check the backend response."
            );
        }

        localStorage.setItem("access_token", token);

        if (data.user) {
            localStorage.setItem("currentUser", JSON.stringify(data.user));
        }

        loginMessage.style.color = "#16804a";
        loginMessage.textContent = "Login successful. Opening dashboard...";

        window.location.href = "index.html";

    } catch (error) {
        console.error("Login error:", error);
        loginMessage.textContent = error.message || "Could not connect to the backend.";
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = "Log In";
    }
});