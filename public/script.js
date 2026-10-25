
import { auth } from "./firebase.js";

import {
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    signOut
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";

// Get login page elements
const loginForm = document.querySelector(".login-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const forgotPasswordLink = document.querySelector(".forgot-password");

console.log("Siza-Me login script loaded!");


// Lock login for 15 minutes after 3 failed attempts.
const MAX_ATTEMPTS = 3;
const LOCKOUT_TIME = 15 * 60 * 1000;
const ATTEMPTS_KEY = "sizame_failed_login_attempts";
const LOCKOUT_KEY = "sizame_login_lockout_until";

if (!loginForm || !emailInput || !passwordInput) {
    console.error("Login form or input fields could not be found.");
} else {

    // Create a message area
    let message = document.getElementById("login-message");

    if (!message) {
        message = document.createElement("p");
        message.id = "login-message";
        message.setAttribute("role", "status");
        message.setAttribute("aria-live", "polite");
        loginForm.appendChild(message);
    }

    // Get the login button and manage the lockout.
    const loginButton = loginForm.querySelector('button[type="submit"]');

    function getFailedAttempts() {
        return Number(sessionStorage.getItem(ATTEMPTS_KEY) || 0);
    }

    function getLockoutUntil() {
        return Number(sessionStorage.getItem(LOCKOUT_KEY) || 0);
    }

    function updateLockout() {
        const remaining = getLockoutUntil() - Date.now();

        if (remaining <= 0) {
            sessionStorage.removeItem(ATTEMPTS_KEY);
            sessionStorage.removeItem(LOCKOUT_KEY);

            emailInput.disabled = false;
            passwordInput.disabled = false;
            if (loginButton) loginButton.disabled = false;

            message.textContent = "";
            return;
        }

        emailInput.disabled = true;
        passwordInput.disabled = true;
        if (loginButton) loginButton.disabled = true;

        message.textContent =
            `Login is temporarily locked after 3 failed attempts. ` +
            `Please try again in ${Math.ceil(remaining / 60000)} minute(s).`;

        window.setTimeout(updateLockout, 1000);
    }

    function recordFailedAttempt() {
        const attempts = getFailedAttempts() + 1;
        sessionStorage.setItem(ATTEMPTS_KEY, String(attempts));

        if (attempts >= MAX_ATTEMPTS) {
            sessionStorage.setItem(
                LOCKOUT_KEY,
                String(Date.now() + LOCKOUT_TIME)
            );
            updateLockout();
        } else {
            message.textContent =
                `Incorrect email or password. ` +
                `${MAX_ATTEMPTS - attempts} attempt(s) remaining.`;
        }
    }

    
    // Restore an active lockout after refreshing the page.
    if (getLockoutUntil() > Date.now()) {
        updateLockout();
    } else {
        sessionStorage.removeItem(ATTEMPTS_KEY);
        sessionStorage.removeItem(LOCKOUT_KEY);
    }

    // Login
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        
        // Stop login attempts during the lockout.
        if (getLockoutUntil() > Date.now()) {
            updateLockout();
            return;
        }

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            message.textContent =
                "Please enter your email and password.";
            return;
        }

        message.textContent = "Logging in...";

        try {
            const credential = await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

            
            // Reset the counter after successful authentication.
            sessionStorage.removeItem(ATTEMPTS_KEY);
            sessionStorage.removeItem(LOCKOUT_KEY);

            const user = credential.user;

            // Temporary step: send the user to the OTP page.
            // The real OTP sending and verification backend
            // still needs to be connected.

            const userEmail = encodeURIComponent(user.email);

            message.textContent = "Login successful. Opening OTP page...";

            window.location.href = `otp.html?email=${userEmail}`;

        } catch (error) {
            console.error("Login error:", error.code, error.message);

            if (
                error.code === "auth/invalid-credential" ||
                error.code === "auth/user-not-found" ||
                error.code === "auth/wrong-password"
            ) {
                
                // Count failed Firebase login attempts.
                recordFailedAttempt();

            } else if (error.code === "auth/invalid-email") {
                message.textContent = "Please enter a valid email address.";
            } else if (error.code === "auth/too-many-requests") {
                message.textContent =
                    "Too many attempts. Please try again later.";
            } else if (error.code === "auth/network-request-failed") {
                message.textContent =
                    "Connection problem. Please check your internet.";
            } else if (error.code === "auth/operation-not-allowed") {
                message.textContent =
                    "Email/password login is not enabled in Firebase.";
            } else {
                message.textContent = "Login failed. Please try again.";
            }
        }
    });

    // Forgot password
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener("click", async (event) => {
            event.preventDefault();

            const email = emailInput.value.trim();

            if (!email) {
                message.textContent =
                    "Enter your email address first, then click Forgot Password.";
                emailInput.focus();
                return;
            }

            message.textContent = "Sending password reset email...";

            try {
                await sendPasswordResetEmail(auth, email);

                message.textContent =
                    "If an account exists for that email, a reset email will be sent.";
            } catch (error) {
                console.error("Password reset error:", error.code, error.message);

                message.textContent =
                    error.code === "auth/invalid-email"
                        ? "Please enter a valid email address."
                        : "Could not send the reset email. Please try again.";
            }
        });
    }
}
