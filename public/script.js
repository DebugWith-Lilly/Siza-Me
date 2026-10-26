
import { auth, db } from "./firebase.js";

import {
    signInWithEmailAndPassword,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";

import {
    doc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

const loginForm = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const phoneInput = document.getElementById("phone-number");
const loginButton = document.getElementById("login-button");
const loginMessage = document.getElementById("login-message");
const forgotPasswordLink = document.querySelector(".forgot-password");
const togglePassword = document.getElementById("togglePassword");

console.log("Siza-Me login script loaded!");

const MAX_ATTEMPTS = 3;
const LOCKOUT_TIME = 15 * 60 * 1000;
const ATTEMPTS_KEY = "sizame_failed_login_attempts";
const LOCKOUT_KEY = "sizame_login_lockout_until";

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
        loginButton.disabled = false;
        loginButton.textContent = "Log In";

        if (loginMessage.textContent.startsWith("Login is temporarily locked")) {
            loginMessage.textContent = "";
        }

        return;
    }

    emailInput.disabled = true;
    passwordInput.disabled = true;
    loginButton.disabled = true;

    loginMessage.textContent =
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
        loginMessage.textContent =
            `Incorrect email or password. ` +
            `${MAX_ATTEMPTS - attempts} attempt(s) remaining.`;
    }
}

// Show or hide password.
if (togglePassword) {
    togglePassword.addEventListener("click", () => {
        const showing = passwordInput.type === "password";

        passwordInput.type = showing ? "text" : "password";
        togglePassword.textContent = showing ? "Hide" : "Show";
        togglePassword.setAttribute(
            "aria-label",
            showing ? "Hide password" : "Show password"
        );
    });
}

// Restore an active lockout.
if (getLockoutUntil() > Date.now()) {
    updateLockout();
} else {
    sessionStorage.removeItem(ATTEMPTS_KEY);
    sessionStorage.removeItem(LOCKOUT_KEY);
}

// Log in using the existing Firebase account.
loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (getLockoutUntil() > Date.now()) {
        updateLockout();
        return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const phoneNumber = phoneInput.value.trim();

    if (!email || !password) {
        loginMessage.textContent = "Please enter your email and password.";
        return;
    }

    // Basic format check only; this does not verify ownership.
    if (
        phoneNumber &&
        !/^\+?[0-9\s()-]{7,20}$/.test(phoneNumber)
    ) {
        loginMessage.textContent =
            "Please enter a valid phone number, for example +27 82 123 4567.";
        phoneInput.focus();
        return;
    }

    loginButton.disabled = true;
    loginButton.textContent = "Logging in...";
    loginMessage.textContent = "";

    try {
        const credential = await signInWithEmailAndPassword(
            auth,
            email,
            password
        );

        const user = credential.user;

        sessionStorage.removeItem(ATTEMPTS_KEY);
        sessionStorage.removeItem(LOCKOUT_KEY);

        // Save the number to the signed-in user's own UID document.
        // Leave an existing saved number unchanged if the field is blank.
        if (phoneNumber) {
            loginButton.textContent = "Saving phone number...";

            try {
                await setDoc(
                    doc(db, "users", user.uid),
                    {
                        phoneNumber: phoneNumber,
                        updatedAt: serverTimestamp()
                    },
                    { merge: true }
                );
            } catch (saveError) {
                console.error("Phone number save failed:", saveError);

                loginMessage.textContent =
                    "You logged in, but the phone number could not be saved. " +
                    "Check your Firestore rules.";
                
                // Continue to the dashboard; do not lock the user out.
                await new Promise(resolve => setTimeout(resolve, 1200));
            }
        }

        window.location.href = "dashboard.html";

    } catch (error) {
        console.error("Login error:", error.code, error.message);

        if (
            error.code === "auth/invalid-credential" ||
            error.code === "auth/user-not-found" ||
            error.code === "auth/wrong-password"
        ) {
            recordFailedAttempt();

        } else if (error.code === "auth/invalid-email") {
            loginMessage.textContent = "Please enter a valid email address.";

        } else if (error.code === "auth/too-many-requests") {
            loginMessage.textContent =
                "Too many attempts. Please try again later.";

        } else if (error.code === "auth/network-request-failed") {
            loginMessage.textContent =
                "Connection problem. Please check your internet.";

        } else if (error.code === "auth/operation-not-allowed") {
            loginMessage.textContent =
                "Email/password login is not enabled in Firebase.";

        } else {
            loginMessage.textContent = "Login failed. Please try again.";
        }

        loginButton.disabled = getLockoutUntil() > Date.now();

        if (!loginButton.disabled) {
            loginButton.textContent = "Log In";
        }
    }
});

// Forgot password.
if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", async (event) => {
        event.preventDefault();

        const email = emailInput.value.trim();

        if (!email) {
            loginMessage.textContent =
                "Enter your email address first, then click Forgot Password.";
            emailInput.focus();
            return;
        }

        loginMessage.textContent = "Sending password reset email...";

        try {
            await sendPasswordResetEmail(auth, email);

            loginMessage.textContent =
                "If an account exists for that email, a reset email will be sent.";

        } catch (error) {
            console.error("Password reset error:", error.code, error.message);

            loginMessage.textContent =
                error.code === "auth/invalid-email"
                    ? "Please enter a valid email address."
                    : "Could not send the reset email. Please try again.";
        }
    });
}
