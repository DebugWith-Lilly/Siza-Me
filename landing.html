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

    // Login
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

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
                message.textContent = "Incorrect email or password.";
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
