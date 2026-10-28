
import { auth, db } from "./firebase.js";

import {
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";

// ---------------------------------------
// PAGE ELEMENTS
// ---------------------------------------

const sosButton = document.getElementById("sos-button");
const sosScanner = document.getElementById("sos-scanner");
const sosStatus = document.getElementById("sos-status");
const locationStatus = document.getElementById("location-status");
const safeCircleStatus = document.getElementById("safe-circle-status");
const deliveryList = document.getElementById("delivery-status-list");
const stopTrackingButton = document.getElementById("stop-tracking-button");
const openMapLink = document.getElementById("open-map-link");

// ---------------------------------------
// STATE
// ---------------------------------------

let currentUser = null;
let authReadyResolved = false;
let activationInProgress = false;

let trackingActive = false;
let watchId = null;
let firstLocationTimeout = null;

let map = null;
let userMarker = null;
let accuracyCircle = null;

let latestLocation = null;
let locationLink = "";

let resolveAuthReady;

const authReady = new Promise(resolve => {
    resolveAuthReady = resolve;
});

// ---------------------------------------
// FIREBASE AUTHENTICATION
// ---------------------------------------

onAuthStateChanged(auth, user => {
    currentUser = user;

    if (!authReadyResolved) {
        authReadyResolved = true;
        resolveAuthReady();
    }

    if (!user) {
        sosStatus.textContent =
            "Please sign in to use Siza-Me SOS.";

        safeCircleStatus.textContent =
            "Sign in to load your saved trusted contacts.";
    } else {
        sosStatus.textContent =
            "SIZA is ready. Press the button to activate SOS options.";
    }
});

// ---------------------------------------
// INITIALISE THE MAP
// ---------------------------------------

function initialiseMap() {
    if (map || !window.L) return;

    map = L.map("sos-map").setView([-29.8587, 31.0218], 12);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
    }).addTo(map);

    L.control.scale().addTo(map);

    L.marker([-29.8587, 31.0218])
        .addTo(map)
        .bindPopup("Waiting for your GPS location.");
}

initialiseMap();

window.addEventListener("load", () => {
    if (map) {
        setTimeout(() => map.invalidateSize(), 150);
    }
});

// ---------------------------------------
// LOAD TRUSTED CONTACTS
// ---------------------------------------

async function loadTrustedContacts() {
    if (!currentUser) {
        throw new Error("Please sign in to access trusted contacts.");
    }

    const contactsRef = collection(
        db,
        "users",
        currentUser.uid,
        "trustedContacts"
    );

    const snapshot = await getDocs(contactsRef);

    return snapshot.docs.map(document => ({
        id: document.id,
        ...document.data()
    }));
}

// ---------------------------------------
// NORMALISE PHONE NUMBERS
// ---------------------------------------

function normaliseSouthAfricanPhone(phone) {
    const original = String(phone || "").trim();
    const digits = original.replace(/\D/g, "");

    // Example: 0821234567 -> +27821234567
    if (/^0[0-9]{9}$/.test(digits)) {
        return "+27" + digits.substring(1);
    }

    // Example: 27821234567 -> +27821234567
    if (/^27[0-9]{9}$/.test(digits)) {
        return "+" + digits;
    }

    // Other international numbers saved in + format
    if (/^\+[1-9][0-9]{7,14}$/.test(original)) {
        return original;
    }

    return null;
}

function whatsappPhoneNumber(phone) {
    const normalised = normaliseSouthAfricanPhone(phone);

    // wa.me requires the international number without + or spaces.
    return normalised ? normalised.replace(/\D/g, "") : null;
}

// ---------------------------------------
// BUILD SOS MESSAGE
// ---------------------------------------

function buildSOSMessage() {
    if (latestLocation && locationLink) {
        return (
            "🚨 SIZA-ME SOS EMERGENCY 🚨\n\n" +
            "I need help. Please contact me as soon as possible.\n\n" +
            "My latest available GPS location:\n" +
            locationLink +
            "\n\nGPS accuracy: approximately " +
            Math.round(latestLocation.accuracy) +
            " metres.\n\n" +
            "Please open the map link to see my location."
        );
    }

    return (
        "🚨 SIZA-ME SOS EMERGENCY 🚨\n\n" +
        "I need help. My GPS location is currently unavailable. " +
        "Please contact me as soon as possible."
    );
}

// ---------------------------------------
// UPDATE GPS MAP
// ---------------------------------------

function updateMapPosition(position) {
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    const accuracy = position.coords.accuracy;

    latestLocation = {
        latitude,
        longitude,
        accuracy,
        updatedAt: new Date()
    };

    locationLink =
        `https://www.google.com/maps?q=${latitude},${longitude}`;

    openMapLink.href = locationLink;

    if (!map) initialiseMap();

    if (map && window.L) {
        const coordinates = [latitude, longitude];

        if (!userMarker) {
            userMarker = L.marker(coordinates)
                .addTo(map)
                .bindPopup("Your current GPS location");
        } else {
            userMarker.setLatLng(coordinates);
        }

        userMarker.setPopupContent(
            `Your current GPS location<br>Accuracy: approximately ${Math.round(accuracy)} metres`
        );

        if (!accuracyCircle) {
            accuracyCircle = L.circle(coordinates, {
                radius: accuracy,
                color: "#c06346",
                fillColor: "#c06346",
                fillOpacity: 0.12,
                weight: 2
            }).addTo(map);
        } else {
            accuracyCircle.setLatLng(coordinates);
            accuracyCircle.setRadius(accuracy);
        }

        map.setView(coordinates, Math.max(map.getZoom(), 16));
    }

    locationStatus.replaceChildren();

    const accuracyText = document.createElement("p");
    accuracyText.textContent =
        `GPS location updated. Accuracy: approximately ${Math.round(accuracy)} metres.`;

    const coordinatesText = document.createElement("p");
    coordinatesText.textContent =
        `Latitude: ${latitude.toFixed(6)} | Longitude: ${longitude.toFixed(6)}`;

    const updateText = document.createElement("p");
    updateText.className = "small-note";
    updateText.textContent =
        `Last updated: ${latestLocation.updatedAt.toLocaleTimeString()}`;

    locationStatus.append(accuracyText, coordinatesText, updateText);

    // Keep individual SMS links updated as the user moves.
    updateContactMessageLinks();
}

// ---------------------------------------
// START LIVE GPS TRACKING
// ---------------------------------------

function startLiveTracking() {
    return new Promise(resolve => {
        if (!navigator.geolocation) {
            locationStatus.textContent =
                "GPS is not supported by this browser.";

            resolve(null);
            return;
        }

        if (trackingActive && watchId !== null) {
            resolve(latestLocation);
            return;
        }

        trackingActive = true;
        stopTrackingButton.disabled = false;

        locationStatus.textContent =
            "Requesting GPS location. Please allow location access.";

        let firstLocationReceived = false;

        firstLocationTimeout = setTimeout(() => {
            if (!firstLocationReceived) {
                firstLocationReceived = true;
                firstLocationTimeout = null;

                locationStatus.textContent =
                    "GPS is taking too long. Check location permission and try again.";

                resolve(null);
            }
        }, 20000);

        watchId = navigator.geolocation.watchPosition(
            position => {
                updateMapPosition(position);

                if (!firstLocationReceived) {
                    firstLocationReceived = true;

                    if (firstLocationTimeout !== null) {
                        clearTimeout(firstLocationTimeout);
                        firstLocationTimeout = null;
                    }

                    resolve(latestLocation);
                }

                if (trackingActive) {
                    sosStatus.textContent =
                        "Your SOS options are ready. Live GPS tracking is active.";
                }
            },

            error => {
                console.error("GPS error:", error);

                if (error.code === error.PERMISSION_DENIED) {
                    locationStatus.textContent =
                        "Location permission was denied. Enable location access in your browser settings.";
                } else if (error.code === error.POSITION_UNAVAILABLE) {
                    locationStatus.textContent =
                        "Your GPS location is currently unavailable.";
                } else {
                    locationStatus.textContent =
                        "Could not obtain GPS location. Check your location settings and try again.";
                }

                if (!firstLocationReceived) {
                    firstLocationReceived = true;

                    if (firstLocationTimeout !== null) {
                        clearTimeout(firstLocationTimeout);
                        firstLocationTimeout = null;
                    }

                    resolve(null);
                }
            },

            {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 15000
            }
        );
    });
}

// ---------------------------------------
// STOP LIVE TRACKING
// ---------------------------------------

function stopLiveTracking() {
    if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
    }

    if (firstLocationTimeout !== null) {
        clearTimeout(firstLocationTimeout);
        firstLocationTimeout = null;
    }

    watchId = null;
    trackingActive = false;
    stopTrackingButton.disabled = true;

    if (latestLocation) {
        locationStatus.replaceChildren();

        const message = document.createElement("p");
        message.textContent =
            "Live tracking stopped. The map shows your last recorded location.";

        const coordinates = document.createElement("p");
        coordinates.textContent =
            `Latitude: ${latestLocation.latitude.toFixed(6)} | Longitude: ${latestLocation.longitude.toFixed(6)}`;

        locationStatus.append(message, coordinates);

        sosStatus.textContent =
            "Live tracking stopped. Your last available location is still available.";
    } else {
        locationStatus.textContent =
            "Live tracking stopped. No GPS location was obtained.";
    }
}

// ---------------------------------------
// INDIVIDUAL SMS LINKS
// ---------------------------------------

function updateContactMessageLinks() {
    const messageButtons = deliveryList.querySelectorAll(".sms-button");

    messageButtons.forEach(button => {
        const phone = button.dataset.phone;

        if (!phone) return;

        button.href =
            `sms:${phone}?body=${encodeURIComponent(buildSOSMessage())}`;
    });
}

// ---------------------------------------
// WHATSAPP SHARE OPTION
// ---------------------------------------

function createWhatsAppShareCard() {
    const item = document.createElement("li");
    item.className = "bulk-share-card";

    const heading = document.createElement("span");
    heading.className = "contact-name";
    heading.textContent = "📲 Share SOS with your trusted circle";

    const description = document.createElement("span");
    description.className = "contact-details";
    description.textContent =
        "Share your emergency message and latest available GPS location using your phone's sharing menu.";

    const actions = document.createElement("div");
    actions.className = "contact-actions";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "action-button whatsapp-button";
    button.textContent = "Share SOS via WhatsApp";

    const status = document.createElement("span");
    status.className = "contact-details";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    button.addEventListener("click", async () => {
        const message = buildSOSMessage();

        if (navigator.share) {
            try {
                await navigator.share({
                    title: "Siza-Me SOS Emergency",
                    text: message
                });

                status.textContent =
                    "The sharing menu was opened. Choose WhatsApp, select your recipients, and send the message.";
            } catch (error) {
                if (error.name === "AbortError") {
                    status.textContent = "Sharing cancelled.";
                    return;
                }

                openWhatsAppFallback(message, status);
            }
        } else {
            openWhatsAppFallback(message, status);
        }
    });

    actions.appendChild(button);
    item.append(heading, description, actions, status);

    return item;
}

function openWhatsAppFallback(message, status) {
    const whatsappURL =
        `https://wa.me/?text=${encodeURIComponent(message)}`;

    const newWindow = window.open(
        whatsappURL,
        "_blank",
        "noopener,noreferrer"
    );

    if (!newWindow) {
        status.textContent =
            "Your browser blocked the new window. Allow pop-ups or try the individual WhatsApp buttons below.";
        return;
    }

    status.textContent =
        "WhatsApp opened. Choose your recipients and tap Send.";
}

// ---------------------------------------
// CREATE INDIVIDUAL CONTACT CARD
// ---------------------------------------

function createContactCard(contact) {
    const item = document.createElement("li");

    const name = document.createElement("span");
    name.className = "contact-name";
    name.textContent = contact.name || "Trusted contact";

    const phoneText = document.createElement("span");
    phoneText.className = "contact-details";
    phoneText.textContent = contact.phone || "No phone number saved";

    item.append(name, phoneText);

    if (contact.relationship) {
        const relationship = document.createElement("span");
        relationship.className = "contact-details";
        relationship.textContent =
            `Relationship: ${contact.relationship}`;

        item.appendChild(relationship);
    }

    const phone = normaliseSouthAfricanPhone(contact.phone);
    const actions = document.createElement("div");
    actions.className = "contact-actions";

    if (phone) {
        // Call contact
        const callButton = document.createElement("a");
        callButton.className = "call-button";
        callButton.href = `tel:${phone}`;
        callButton.textContent = `Call ${contact.name || "contact"}`;

        // Prepare SMS for this contact
        const smsButton = document.createElement("a");
        smsButton.className = "message-button sms-button";
        smsButton.dataset.phone = phone;
        smsButton.href =
            `sms:${phone}?body=${encodeURIComponent(buildSOSMessage())}`;
        smsButton.textContent = "Prepare SOS SMS";

        actions.append(callButton, smsButton);

        // Open WhatsApp chat with this individual contact
        const waNumber = whatsappPhoneNumber(contact.phone);

        if (waNumber) {
            const whatsappButton = document.createElement("a");
            whatsappButton.className = "message-button";
            whatsappButton.href =
                `https://wa.me/${waNumber}?text=${encodeURIComponent(buildSOSMessage())}`;
            whatsappButton.target = "_blank";
            whatsappButton.rel = "noopener noreferrer";
            whatsappButton.textContent = "WhatsApp contact";

            actions.appendChild(whatsappButton);
        }
    } else {
        const warning = document.createElement("span");
        warning.className = "contact-details";
        warning.textContent =
            "A valid phone number is needed before calling or messaging this contact.";

        actions.appendChild(warning);
    }

    item.appendChild(actions);

    return item;
}

// ---------------------------------------
// ACTIVATE SOS
// ---------------------------------------

async function activateSOS() {
    if (activationInProgress) return;

    activationInProgress = true;

    sosButton.disabled = true;
    sosScanner.classList.add("searching");
    sosButton.textContent = "SOS";

    sosStatus.textContent = "Preparing your SOS options...";
    safeCircleStatus.textContent = "Loading your trusted contacts...";
    deliveryList.replaceChildren();

    try {
        await authReady;

        if (!currentUser) {
            sosStatus.textContent =
                "Please sign in before using SOS.";

            safeCircleStatus.textContent =
                "Sign in to access your saved trusted contacts.";

            const loginLink = document.createElement("a");
            loginLink.href = "login.html";
            loginLink.textContent = "Go to login";
            loginLink.className = "action-button primary";

            safeCircleStatus.appendChild(loginLink);
            return;
        }

        // Start GPS while contacts load.
        const locationPromise = startLiveTracking();

        let contacts;

        try {
            contacts = await loadTrustedContacts();
        } catch (error) {
            console.error("Could not load trusted contacts:", error);

            sosStatus.textContent =
                "Could not load your trusted contacts.";

            safeCircleStatus.textContent =
                "Check your internet connection and Firestore permissions.";

            return;
        }

        await locationPromise;

        if (contacts.length === 0) {
            sosStatus.textContent =
                "No trusted contacts were found.";

            safeCircleStatus.textContent =
                "Add trusted contacts first, then return to SOS.";

            const addContactsLink = document.createElement("a");
            addContactsLink.href = "live-location.html";
            addContactsLink.textContent = "Open trusted contacts";
            addContactsLink.className = "action-button primary";

            safeCircleStatus.appendChild(addContactsLink);
            return;
        }

        // Add the WhatsApp share option first.
        deliveryList.appendChild(createWhatsAppShareCard());

        // Keep all individual contact actions.
        contacts.forEach(contact => {
            deliveryList.appendChild(createContactCard(contact));
        });

        updateContactMessageLinks();

        const validContacts = contacts.filter(contact =>
            normaliseSouthAfricanPhone(contact.phone)
        ).length;

        safeCircleStatus.textContent =
            `${contacts.length} trusted contact(s) loaded. ${validContacts} have valid phone numbers.`;

        if (latestLocation) {
            sosStatus.textContent =
                "Your SOS options are ready. Your latest GPS location is available.";
        } else {
            sosStatus.textContent =
                "Your contacts are ready, but GPS could not obtain your location.";
        }
    } catch (error) {
        console.error("SOS setup error:", error);

        sosStatus.textContent =
            "Something went wrong while preparing SOS.";

        safeCircleStatus.textContent =
            error.message || "Please try again.";
    } finally {
        activationInProgress = false;
        sosButton.disabled = false;
        sosButton.textContent = "SIZA";
        sosScanner.classList.remove("searching");
    }
}

// ---------------------------------------
// BUTTON EVENTS
// ---------------------------------------

sosButton.addEventListener("click", activateSOS);

stopTrackingButton.addEventListener("click", stopLiveTracking);
