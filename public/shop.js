
import { auth, db } from "./firebase.js";

import {
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";

// =======================================
// PAGE ELEMENTS
// =======================================

const sosButton = document.getElementById("sos-button");
const sosScanner = document.getElementById("sos-scanner");
const sosStatus = document.getElementById("sos-status");
const locationStatus = document.getElementById("location-status");
const safeCircleStatus = document.getElementById("safe-circle-status");
const deliveryList = document.getElementById("delivery-status-list");
const stopTrackingButton = document.getElementById("stop-tracking-button");
const openMapLink = document.getElementById("open-map-link");

// =======================================
// APPLICATION STATE
// =======================================

let currentUser = null;
let activationInProgress = false;

let trackingActive = false;
let watchId = null;

let map = null;
let userMarker = null;
let accuracyCircle = null;

let latestLocation = null;
let locationLink = "";
let authReadyResolved = false;

let resolveAuthReady;

const authReady = new Promise(resolve => {
    resolveAuthReady = resolve;
});

// =======================================
// FIREBASE AUTHENTICATION
// =======================================

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
            "SIZA is ready. Press the button to prepare your SOS options.";
    }
});

// =======================================
// INITIALISE MAP
// =======================================

function initialiseMap() {
    if (map || !window.L) {
        return;
    }

    // This is only the initial map view, not the user's GPS position.
    map = L.map("sos-map").setView([-30.5595, 22.9375], 5);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
    }).addTo(map);

    L.control.scale().addTo(map);
}

initialiseMap();

// =======================================
// LOAD TRUSTED CONTACTS FROM FIRESTORE
// =======================================

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

// =======================================
// NORMALISE PHONE NUMBERS
// =======================================

function normaliseSouthAfricanPhone(phone) {
    const digits = String(phone || "").replace(/\D/g, "");

    // South African local number: 0821234567
    if (/^0[0-9]{9}$/.test(digits)) {
        return "+27" + digits.substring(1);
    }

    // South African international number without plus: 27821234567
    if (/^27[0-9]{9}$/.test(digits)) {
        return "+" + digits;
    }

    // Other international numbers stored with a plus.
    const trimmed = String(phone || "").trim();

    if (/^\+[1-9][0-9]{7,14}$/.test(trimmed)) {
        return trimmed;
    }

    return null;
}

// =======================================
// UPDATE THE GPS MAP
// =======================================

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

    // Latest location link used in newly prepared SMS messages.
    locationLink =
        `https://www.google.com/maps?q=${latitude},${longitude}`;

    openMapLink.href = locationLink;

    if (!map) {
        initialiseMap();
    }

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
            `Your current GPS location<br>
             Accuracy: approximately ${Math.round(accuracy)} metres`
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

    // Show GPS status and coordinates.
    locationStatus.replaceChildren();

    const accuracyText = document.createElement("p");
    accuracyText.textContent =
        `GPS detected. Accuracy: approximately ${Math.round(accuracy)} metres.`;

    const coordinatesText = document.createElement("p");
    coordinatesText.textContent =
        `Latitude: ${latitude.toFixed(6)} | Longitude: ${longitude.toFixed(6)}`;

    const updatedText = document.createElement("p");
    updatedText.className = "small-note";
    updatedText.textContent =
        `Last location update: ${latestLocation.updatedAt.toLocaleTimeString()}`;

    locationStatus.append(
        accuracyText,
        coordinatesText,
        updatedText
    );

    // Newly prepared messages use the newest available location.
    updateContactMessageLinks();
}

// =======================================
// START LIVE GPS TRACKING
// =======================================

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
            "Requesting your GPS location. Please allow location access.";

        let firstLocationReceived = false;

        const firstLocationTimeout = setTimeout(() => {
            if (!firstLocationReceived) {
                firstLocationReceived = true;

                locationStatus.textContent =
                    "GPS is taking too long. Check your location permission and try again.";

                resolve(null);
            }
        }, 20000);

        watchId = navigator.geolocation.watchPosition(
            position => {
                updateMapPosition(position);

                if (!firstLocationReceived) {
                    firstLocationReceived = true;
                    clearTimeout(firstLocationTimeout);
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
                    clearTimeout(firstLocationTimeout);
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

// =======================================
// STOP LIVE GPS TRACKING
// =======================================

function stopLiveTracking() {
    if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
    }

    watchId = null;
    trackingActive = false;

    stopTrackingButton.disabled = true;

    if (latestLocation) {
        locationStatus.replaceChildren();

        const stoppedText = document.createElement("p");
        stoppedText.textContent =
            "Live tracking stopped. The map shows your last recorded location.";

        const coordinatesText = document.createElement("p");
        coordinatesText.textContent =
            `Latitude: ${latestLocation.latitude.toFixed(6)} | Longitude: ${latestLocation.longitude.toFixed(6)}`;

        locationStatus.append(stoppedText, coordinatesText);

        sosStatus.textContent =
            "Live tracking stopped. You can still prepare SOS messages.";
    } else {
        locationStatus.textContent =
            "Live tracking stopped. No GPS location was obtained.";
    }
}

// =======================================
// BUILD THE SOS MESSAGE
// =======================================

function buildSOSMessage() {
    if (latestLocation && locationLink) {
        return (
            "SOS! I need help. Please contact me as soon as possible.\n\n" +
            "My latest available GPS location:\n" +
            locationLink +
            "\n\nGPS accuracy: approximately " +
            Math.round(latestLocation.accuracy) +
            " metres.\n\n" +
            "Please open the map link to see my location."
        );
    }

    return (
        "SOS! I need help. Please contact me as soon as possible.\n\n" +
        "My GPS location is currently unavailable. Please contact me."
    );
}

// =======================================
// UPDATE PREPARED SMS LINKS
// =======================================

function updateContactMessageLinks() {
    const messageButtons = deliveryList.querySelectorAll(
        ".message-button"
    );

    messageButtons.forEach(button => {
        const phone = button.dataset.phone;

        if (!phone) {
            return;
        }

        const message = buildSOSMessage();

        button.href =
            `sms:${phone}?body=${encodeURIComponent(message)}`;
    });
}

// =======================================
// CREATE A TRUSTED CONTACT CARD
// =======================================

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
        const callButton = document.createElement("a");
        callButton.className = "call-button";
        callButton.href = `tel:${phone}`;
        callButton.textContent =
            `Call ${contact.name || "contact"}`;

        callButton.setAttribute(
            "aria-label",
            `Call ${contact.name || "trusted contact"}`
        );

        const messageButton = document.createElement("a");
        messageButton.className = "message-button";
        messageButton.dataset.phone = phone;
        messageButton.textContent = "Prepare SOS message";

        messageButton.setAttribute(
            "aria-label",
            `Prepare an SOS SMS for ${contact.name || "trusted contact"}. You must tap Send yourself.`
        );

        actions.append(callButton, messageButton);
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

// =======================================
// ACTIVATE SOS
// =======================================

async function activateSOS() {
    if (activationInProgress) {
        return;
    }

    activationInProgress = true;

    sosButton.disabled = true;
    sosButton.textContent = "SOS";
    sosScanner.classList.add("searching");

    sosStatus.textContent =
        "Preparing your SOS options...";

    safeCircleStatus.textContent =
        "Loading your trusted contacts...";

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
            loginLink.textContent = " Go to login";

            safeCircleStatus.appendChild(loginLink);
            return;
        }

        // Begin GPS tracking while loading contacts.
        const locationPromise = startLiveTracking();

        let contacts;

        try {
            contacts = await loadTrustedContacts();
        } catch (error) {
            console.error(
                "Could not load trusted contacts:",
                error
            );

            sosStatus.textContent =
                "Could not load your trusted contacts.";

            safeCircleStatus.textContent =
                "Check your internet connection and Firebase Firestore permissions.";

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
            addContactsLink.textContent =
                " Open trusted contacts";

            safeCircleStatus.appendChild(addContactsLink);
            return;
        }

        contacts.forEach(contact => {
            deliveryList.appendChild(
                createContactCard(contact)
            );
        });

        // Add the most recent location to every prepared message link.
        updateContactMessageLinks();

        safeCircleStatus.textContent =
            `${contacts.length} trusted contact(s) loaded. Choose a contact and prepare an SOS message.`;

        if (latestLocation) {
            sosStatus.textContent =
                "SOS options are ready. Your latest GPS location is available.";
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

// =======================================
// BUTTON EVENTS
// =======================================

sosButton.addEventListener("click", activateSOS);

stopTrackingButton.addEventListener(
    "click",
    stopLiveTracking
);

// Ensure the map displays correctly after the page loads.
window.addEventListener("load", () => {
    if (map) {
        setTimeout(() => map.invalidateSize(), 150);
    }
});
