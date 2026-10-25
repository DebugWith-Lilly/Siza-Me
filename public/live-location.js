
import { auth, db } from "./firebase.js";

import {
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

import {
    onAuthStateChanged,
    EmailAuthProvider,
    reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";


// DEMO ONLY: The PIN is stored in this browser and is not production security.

const contactForm = document.getElementById("contact-form");
const contactName = document.getElementById("contact-name");
const contactPhone = document.getElementById("contact-phone");
const contactRelationship = document.getElementById("contact-relationship");

const contactsList = document.getElementById("trusted-contacts-list");
const emptyMessage = document.getElementById("contacts-empty-message");
const formStatus = document.getElementById("contact-form-status");
const safeCircleStatus = document.getElementById("safe-circle-status");
const addButton = document.getElementById("add-contact-button");

const addContactSection = document.getElementById("add-contact-section");
const trustedContactsSection = document.getElementById("trusted-contacts-section");

let currentUser = null;
let authReady = false;
let contactsUnlocked = false;

// — reliably hide/show sections even when CSS overrides [hidden].
function setSectionVisible(element, visible) {
    if (!element) return;

    element.hidden = !visible;

    if (visible) {
        element.style.removeProperty("display");
    } else {
        element.style.setProperty("display", "none", "important");
    }
}

// verification screen styling.
const verificationStyle = document.createElement("style");

verificationStyle.textContent = `
    #trusted-verification-gate {
        background: #fffaf5;
        border: 1px solid #ebd9c5;
        border-radius: 22px;
        padding: 24px;
        margin-bottom: 20px;
        box-shadow: 0 4px 15px rgba(43, 66, 42, 0.05);
    }

    #trusted-verification-gate h2 {
        color: #1e261d;
        font-size: 1.1rem;
        margin-bottom: 8px;
    }

    #trusted-verification-gate p {
        color: #594d3f;
        font-size: 0.85rem;
        line-height: 1.5;
        margin-bottom: 14px;
    }

    #trusted-verification-gate label {
        display: block;
        color: #2b3829;
        font-size: 0.82rem;
        font-weight: 600;
        margin: 12px 0 6px;
    }

    #trusted-verification-gate input {
        width: 100%;
        padding: 12px 16px;
        border-radius: 14px;
        border: 1px solid #ebd9c5;
        background: #f6efe6;
        font-family: Poppins, sans-serif;
        font-size: 0.9rem;
        box-sizing: border-box;
    }

    #trusted-verification-gate button {
        width: 100%;
        padding: 14px;
        margin-top: 16px;
        border: none;
        border-radius: 14px;
        background: #c06346;
        color: white;
        font-family: Poppins, sans-serif;
        font-weight: 600;
        cursor: pointer;
    }

    #trusted-verification-gate button:disabled {
        opacity: 0.6;
        cursor: wait;
    }

    #trusted-verification-status {
        margin-top: 12px;
        color: #c06346;
        font-size: 0.82rem;
    }
`;

document.head.appendChild(verificationStyle);

//create the verification screen.
const verificationGate = document.createElement("section");
verificationGate.id = "trusted-verification-gate";

verificationGate.innerHTML = `
    <h2>Verify Your Identity</h2>

    <p id="trusted-verification-instructions">
        Verify your password and six-digit PIN to continue.
    </p>

    <form id="trusted-verification-form">
        <label for="trusted-account-password">
            Siza-Me Account Password
        </label>

        <input
            id="trusted-account-password"
            type="password"
            autocomplete="current-password"
            required
        >

        <div id="trusted-pin-setup-fields">
            <label for="trusted-pin-new">Create a Six-Digit PIN</label>

            <input
                id="trusted-pin-new"
                type="password"
                inputmode="numeric"
                pattern="[0-9]{6}"
                minlength="6"
                maxlength="6"
                autocomplete="new-password"
            >

            <label for="trusted-pin-confirm">Confirm Your PIN</label>

            <input
                id="trusted-pin-confirm"
                type="password"
                inputmode="numeric"
                pattern="[0-9]{6}"
                minlength="6"
                maxlength="6"
                autocomplete="new-password"
            >
        </div>

        <div id="trusted-pin-entry-field">
            <label for="trusted-pin-entry">Six-Digit PIN</label>

            <input
                id="trusted-pin-entry"
                type="password"
                inputmode="numeric"
                pattern="[0-9]{6}"
                minlength="6"
                maxlength="6"
                autocomplete="off"
            >
        </div>

        <button id="trusted-verification-button" type="submit">
            Verify and Continue
        </button>

        <p id="trusted-verification-status"
           role="status"
           aria-live="polite"></p>
    </form>
`;

//  use main when available, otherwise use the page body.
const mainElement = document.querySelector("main") || document.body;
mainElement.prepend(verificationGate);

const verificationForm =
    document.getElementById("trusted-verification-form");

const passwordInput =
    document.getElementById("trusted-account-password");

const pinSetupFields =
    document.getElementById("trusted-pin-setup-fields");

const pinNewInput =
    document.getElementById("trusted-pin-new");

const pinConfirmInput =
    document.getElementById("trusted-pin-confirm");

const pinEntryField =
    document.getElementById("trusted-pin-entry-field");

const pinEntryInput =
    document.getElementById("trusted-pin-entry");

const verificationStatus =
    document.getElementById("trusted-verification-status");

const verificationButton =
    document.getElementById("trusted-verification-button");

const verificationInstructions =
    document.getElementById("trusted-verification-instructions");

//lock protected content immediately.
setSectionVisible(verificationGate, false);
setSectionVisible(contactForm, false);
setSectionVisible(addContactSection, false);
setSectionVisible(trustedContactsSection, false);

function pinStorageKey() {
    return `sizame_demo_pin_${currentUser.uid}`;
}

function contactsCollection() {
    if (!currentUser) {
        throw new Error("No authenticated user.");
    }

    return collection(db, "users", currentUser.uid, "trustedContacts");
}

//hash the demo PIN before browser storage.
async function hashPin(pin) {
    const bytes = new TextEncoder().encode(pin);
    const digest = await crypto.subtle.digest("SHA-256", bytes);

    return Array.from(new Uint8Array(digest))
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
}

function showVerificationGate() {
    contactsUnlocked = false;

    setSectionVisible(contactForm, false);
    setSectionVisible(addContactSection, false);
    setSectionVisible(trustedContactsSection, false);
    setSectionVisible(verificationGate, true);

    const pinExists = Boolean(
        localStorage.getItem(pinStorageKey())
    );

    setSectionVisible(pinSetupFields, !pinExists);
    setSectionVisible(pinEntryField, pinExists);

    pinNewInput.required = !pinExists;
    pinConfirmInput.required = !pinExists;
    pinEntryInput.required = pinExists;

    verificationInstructions.textContent = pinExists
        ? "Enter your account password and your existing six-digit PIN."
        : "Enter your account password, then create and confirm a six-digit PIN.";

    verificationForm.reset();
    verificationStatus.textContent = "";
}

//verify account password and PIN.
verificationForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (!authReady || !currentUser) {
        verificationStatus.textContent = "Please log in first.";
        return;
    }

    verificationButton.disabled = true;
    verificationStatus.textContent = "Verifying...";

    try {
        if (!currentUser.email) {
            throw new Error(
                "Password verification requires an email/password account."
            );
        }

        const credential = EmailAuthProvider.credential(
            currentUser.email,
            passwordInput.value
        );

        await reauthenticateWithCredential(currentUser, credential);

        const savedPinHash = localStorage.getItem(pinStorageKey());

        if (!savedPinHash) {
            const pin = pinNewInput.value;
            const confirmation = pinConfirmInput.value;

            if (!/^[0-9]{6}$/.test(pin)) {
                verificationStatus.textContent =
                    "Your PIN must contain exactly six digits.";
                return;
            }

            if (pin !== confirmation) {
                verificationStatus.textContent = "The PINs do not match.";
                return;
            }

            localStorage.setItem(pinStorageKey(), await hashPin(pin));
        } else {
            const enteredPin = pinEntryInput.value;

            if (!/^[0-9]{6}$/.test(enteredPin)) {
                verificationStatus.textContent = "Enter your six-digit PIN.";
                return;
            }

            const enteredPinHash = await hashPin(enteredPin);

            if (enteredPinHash !== savedPinHash) {
                verificationStatus.textContent =
                    "The six-digit PIN is incorrect.";
                return;
            }
        }

        contactsUnlocked = true;
        setSectionVisible(verificationGate, false);
        setSectionVisible(addContactSection, true);
        setSectionVisible(trustedContactsSection, true);
        setSectionVisible(contactForm, true);

        verificationStatus.textContent = "Verification successful.";

        if (safeCircleStatus) {
            safeCircleStatus.textContent =
                "Your trusted contacts are managed here.";
        }

        await loadContacts();

    } catch (error) {
        console.error("Verification failed:", error);

        if (
            error.code === "auth/invalid-credential" ||
            error.code === "auth/wrong-password" ||
            error.code === "auth/invalid-login-credentials"
        ) {
            verificationStatus.textContent =
                "The account password is incorrect.";
        } else {
            verificationStatus.textContent =
                error.message || "Verification failed. Please try again.";
        }
    } finally {
        verificationButton.disabled = false;
    }
});

// ========================================
// LOAD CONTACTS
// ========================================

async function loadContacts() {
    if (!currentUser || !contactsUnlocked) return;

    contactsList.replaceChildren();
    emptyMessage.hidden = false;
    emptyMessage.textContent = "Loading trusted contacts...";
    formStatus.textContent = "";

    try {
        const snapshot = await getDocs(contactsCollection());

        if (!currentUser || !contactsUnlocked) return;

        contactsList.replaceChildren();

        if (snapshot.empty) {
            emptyMessage.hidden = false;
            emptyMessage.textContent =
                "You have not added any trusted contacts yet.";
            return;
        }

        emptyMessage.hidden = true;

        snapshot.forEach(contactDocument => {
            const contact = contactDocument.data();
            const card = document.createElement("div");

            const name = document.createElement("h3");
            name.textContent = contact.name || "";

            //show only the last four phone-number characters.
            const phone = document.createElement("p");
            const fullPhone = String(contact.phone || "");
            const visibleDigits = 4;

            const maskedPhone = fullPhone.length > visibleDigits
                ? "•".repeat(fullPhone.length - visibleDigits) +
                  fullPhone.slice(-visibleDigits)
                : "•".repeat(fullPhone.length);

            phone.textContent = `Phone: ${maskedPhone}`;

            const relationship = document.createElement("p");
            relationship.textContent =
                `Relationship: ${contact.relationship || ""}`;

            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.textContent = "Remove Contact";

            removeButton.addEventListener("click", async () => {
                await removeContact(contactDocument.id);
            });

            card.append(name, phone, relationship, removeButton);
            contactsList.appendChild(card);
        });

    } catch (error) {
        console.error("Could not load contacts:", error);

        emptyMessage.hidden = false;
        emptyMessage.textContent =
            "Could not load contacts. Please try again.";

        formStatus.textContent =
            "Unable to load contacts. Check your Firebase connection and Firestore rules.";
    }
}

// ========================================
// ADD A TRUSTED CONTACT
// ========================================

contactForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (!authReady || !currentUser || !contactsUnlocked) {
        formStatus.textContent =
            "Please verify before adding trusted contacts.";
        return;
    }

    const name = contactName.value.trim();
    const phone = contactPhone.value.trim();
    const relationship = contactRelationship.value;

    if (!name || !phone || !relationship) {
        formStatus.textContent = "Please complete all the fields.";
        return;
    }

    addButton.disabled = true;
    formStatus.textContent = "Saving trusted contact...";

    try {
        const existingContacts = await getDocs(contactsCollection());

        const duplicate = existingContacts.docs.some(item => {
            return item.data().phone === phone;
        });

        if (duplicate) {
            formStatus.textContent =
                "This phone number is already in your Safe Circle.";
            return;
        }

        await addDoc(contactsCollection(), {
            name,
            phone,
            relationship,
            createdAt: serverTimestamp()
        });

        contactForm.reset();
        formStatus.textContent = "Trusted contact saved successfully.";

        await loadContacts();

    } catch (error) {
        console.error("Could not save contact:", error);

        formStatus.textContent =
            "Contact could not be saved. Check the Console for the error.";
    } finally {
        addButton.disabled = false;
    }
});

// ========================================
// REMOVE A TRUSTED CONTACT
// ========================================

async function removeContact(contactId) {
    if (!currentUser || !contactsUnlocked) {
        formStatus.textContent =
            "Please verify before removing a contact.";
        return;
    }

    const confirmed = window.confirm(
        "Are you sure you want to remove this trusted contact?"
    );

    if (!confirmed) return;

    try {
        await deleteDoc(
            doc(
                db,
                "users",
                currentUser.uid,
                "trustedContacts",
                contactId
            )
        );

        formStatus.textContent = "Trusted contact removed successfully.";

        await loadContacts();

    } catch (error) {
        console.error("Could not remove contact:", error);

        formStatus.textContent =
            "Contact could not be removed. Please try again.";
    }
}

// ========================================
// CHECK AUTHENTICATION
// ========================================

onAuthStateChanged(auth, user => {
    currentUser = user;
    authReady = true;
    contactsUnlocked = false;

    if (!user) {
        setSectionVisible(verificationGate, false);
        setSectionVisible(contactForm, false);
        setSectionVisible(addContactSection, false);
        setSectionVisible(trustedContactsSection, false);

        if (contactsList) contactsList.replaceChildren();

        if (emptyMessage) {
            emptyMessage.hidden = false;
            emptyMessage.textContent =
                "Please log in to view your trusted contacts.";
        }

        if (safeCircleStatus) {
            safeCircleStatus.textContent = "Redirecting you to login...";
        }

        window.location.replace("login.html");
        return;
    }

    showVerificationGate();
});

