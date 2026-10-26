// ========================================
// SIZA-ME SOS
// Location retrieval and alert preparation
// ========================================

const sosButton = document.getElementById("sos-button");
const sosScanner = document.getElementById("sos-scanner");

const sosStatus = document.getElementById("sos-status");
const locationStatus = document.getElementById("location-status");

const safeCircleStatus = document.getElementById("safe-circle-status");
const deliveryStatusList = document.getElementById("delivery-status-list");

// Stores the prepared emergency alert for future backend integration.
let currentSOSAlert = null;
let isSOSActive = false;


// ========================================
// UPDATE THE SOS STATUS
// ========================================

function updateSOSStatus(message) {
    sosStatus.textContent = message;
}


// ========================================
// UPDATE THE LOCATION STATUS
// ========================================

function updateLocationStatus(message) {
    locationStatus.textContent = message;
}


// ========================================
// DISPLAY A CONTACT DELIVERY STATUS
// Ready for future Safe Circle integration
// ========================================

function showContactStatus(contactName, status) {
    const listItem = document.createElement("li");

    listItem.textContent = `${status} to ${contactName}`;

    deliveryStatusList.appendChild(listItem);
}


// ========================================
// RESET PREVIOUS DELIVERY STATUS MESSAGES
// ========================================

function clearDeliveryStatuses() {
    deliveryStatusList.replaceChildren();
}


// ========================================
// HANDLE SUCCESSFUL LOCATION RETRIEVAL
// ========================================

function handleLocationSuccess(position) {
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    const accuracy = Math.round(position.coords.accuracy);

    const timestamp = new Date().toISOString();

    // Prepare the emergency alert data.
    currentSOSAlert = {
        type: "SOS",
        timestamp: timestamp,

        location: {
            latitude: latitude,
            longitude: longitude,
            accuracy: accuracy,

            mapLink:
                `https://maps.google.com/?q=${latitude},${longitude}`
        }
    };

    // Location has been obtained successfully.
    updateLocationStatus("Location obtained successfully.");

    // Contacts and messaging have not been connected yet.
    safeCircleStatus.textContent =
        "Your Safe Circle is not connected yet.";

    updateSOSStatus(
        "Location ready. No emergency messages have been sent."
    );

    // Make the prepared alert available for debugging.
    console.log("Prepared SOS alert:", currentSOSAlert);

    finishSOS();
}


// ========================================
// HANDLE LOCATION ERRORS
// ========================================

function handleLocationError(error) {
    currentSOSAlert = null;

    switch (error.code) {
        case error.PERMISSION_DENIED:
            updateLocationStatus(
                "Location permission was denied."
            );
            break;

        case error.POSITION_UNAVAILABLE:
            updateLocationStatus(
                "Your location is currently unavailable."
            );
            break;

        case error.TIMEOUT:
            updateLocationStatus(
                "Location request timed out. Please try again."
            );
            break;

        default:
            updateLocationStatus(
                "Unable to retrieve your location."
            );
    }

    safeCircleStatus.textContent =
        "Your Safe Circle is not connected yet.";

    updateSOSStatus(
        "Siza could not prepare your location. No messages have been sent."
    );

    finishSOS();
}


// ========================================
// FINISH THE LOCATION REQUEST
// ========================================

function finishSOS() {
    isSOSActive = false;

    sosButton.disabled = false;
    sosButton.textContent = "SOS";

    sosScanner.classList.remove("is-scanning");
}


// ========================================
// ACTIVATE SOS
// ========================================

function activateSOS() {
    // Prevent multiple requests from the same tap.
    if (isSOSActive) {
        return;
    }

    isSOSActive = true;
    currentSOSAlert = null;

    clearDeliveryStatuses();

    sosButton.disabled = true;

    // The frontend developer can animate this class.
    sosScanner.classList.add("is-scanning");

    updateSOSStatus("Activating Siza...");

    updateLocationStatus("Getting your location...");

    safeCircleStatus.textContent =
        "Preparing emergency alert.";

    // Check browser support.
    if (!("geolocation" in navigator)) {
        updateLocationStatus(
            "Your browser does not support location services."
        );

        updateSOSStatus(
            "Siza could not retrieve your location. No messages have been sent."
        );

        finishSOS();
        return;
    }

    // Request the user's current location.
    navigator.geolocation.getCurrentPosition(
        handleLocationSuccess,
        handleLocationError,
        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        }
    );
}


// ========================================
// SOS BUTTON EVENT
// ========================================

sosButton.addEventListener("click", activateSOS);


// ========================================
// FUTURE SAFE CIRCLE INTEGRATION
// ========================================

// Later, connect this page to track.html and Firebase.
//
// When the backend processes an emergency alert:
//
// 1. Retrieve the user's saved trusted contacts.
// 2. Send the SOS message and location to each contact.
// 3. Display the actual result for each recipient.
//
// Example usage after backend integration:
//
// showContactStatus("Mom", "Message sent");
//
// IMPORTANT:
// Do not call showContactStatus("Mom", "Message sent")
// until the backend confirms the relevant delivery status.
