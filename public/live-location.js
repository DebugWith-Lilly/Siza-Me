
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
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";

// ========================================
// GET PAGE ELEMENTS
// ========================================

const contactForm = document.getElementById("contact-form");
const contactName = document.getElementById("contact-name");
const contactPhone = document.getElementById("contact-phone");
const contactRelationship = document.getElementById("contact-relationship");

const contactsList = document.getElementById("trusted-contacts-list");
const emptyMessage = document.getElementById("contacts-empty-message");
const formStatus = document.getElementById("contact-form-status");
const safeCircleStatus = document.getElementById("safe-circle-status");
const addButton = document.getElementById("add-contact-button");

let currentUser = null;
let authReady = false;

// Keep the contact form hidden until authentication is checked.
contactForm.hidden = true;

// ========================================
// GET CURRENT USER'S CONTACTS
// ========================================

function contactsCollection() {
    if (!currentUser) {
        throw new Error("No authenticated user.");
    }

    return collection(
        db,
        "users",
        currentUser.uid,
        "trustedContacts"
    );
}

// ========================================
// LOAD CONTACTS
// ========================================

async function loadContacts() {
    if (!currentUser) return;

    contactsList.replaceChildren();
    emptyMessage.hidden = false;
    emptyMessage.textContent = "Loading trusted contacts...";
    formStatus.textContent = "";

    try {
        const snapshot = await getDocs(contactsCollection());

        // Authentication may have changed during the request.
        if (!currentUser) return;

        contactsList.replaceChildren();

        if (snapshot.empty) {
            emptyMessage.hidden = false;
            emptyMessage.textContent =
                "You have not added any trusted contacts yet.";
            return;
        }

        emptyMessage.hidden = true;

        snapshot.forEach((contactDocument) => {
            const contact = contactDocument.data();

            const card = document.createElement("div");

            const name = document.createElement("h3");
            name.textContent = contact.name || "";

            const phone = document.createElement("p");
            phone.textContent = `Phone: ${contact.phone || ""}`;

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

contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!authReady || !currentUser) {
        formStatus.textContent =
            "Please log in before adding trusted contacts.";
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

        const duplicate = existingContacts.docs.some((item) => {
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

        formStatus.textContent =
            "Trusted contact saved successfully.";

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
    if (!currentUser) {
        formStatus.textContent = "Please log in again.";
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

        formStatus.textContent =
            "Trusted contact removed successfully.";

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

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    authReady = true;

    if (!user) {
        contactForm.hidden = true;
        contactsList.replaceChildren();

        emptyMessage.hidden = false;
        emptyMessage.textContent =
            "Please log in to view your trusted contacts.";

        if (safeCircleStatus) {
            safeCircleStatus.textContent =
                "Redirecting you to login...";
        }

        // Send signed-out users to the existing login page.
        window.location.replace("login.html");
        return;
    }

    contactForm.hidden = false;

    if (safeCircleStatus) {
        safeCircleStatus.textContent =
            "Your trusted contacts are managed here.";
    }

    await loadContacts();
});
