
import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";

import {
    collection,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

const personSelect = document.getElementById("person-select");
const trackerStatus = document.getElementById("tracker-status");
const selectedMessage = document.getElementById("selected-person-message");
const phoneButton = document.getElementById("phone-to-phone-button");
const gpsButton = document.getElementById("phone-to-gps-button");
const requestStatus = document.getElementById("tracker-request-status");

let members = [];

function updateSelection() {
    const member = members.find(
        item => item.id === personSelect.value
    );

    if (!member) {
        selectedMessage.textContent =
            "Select a Safe Circle member to request their location.";
        return;
    }

    selectedMessage.textContent = `Selected: ${member.name}`;
}

personSelect.addEventListener("change", updateSelection);

// Phone-to-Phone: a linked contact is required.
phoneButton.addEventListener("click", () => {
    const member = members.find(
        item => item.id === personSelect.value
    );

    if (!member) {
        requestStatus.textContent =
            "Please select a Safe Circle member first.";
        return;
    }

    if (!member.uid) {
        requestStatus.textContent =
            "This contact does not have a linked Firebase user ID yet.";
        return;
    }

    const params = new URLSearchParams({
        contactId: member.id,
        contactName: member.name,
        contactUid: member.uid
    });

    window.location.href =
        `phone-to-phone.html?${params.toString()}`;
});

// Phone-to-GPS: opens independently of Safe Circle loading.
gpsButton.addEventListener("click", () => {
    const member = members.find(
        item => item.id === personSelect.value
    );

    const params = new URLSearchParams();

    if (member) {
        params.set("contactId", member.id);
        params.set("contactName", member.name);

        if (member.uid) {
            params.set("contactUid", member.uid);
        }
    }

    window.location.href =
        `phone-to-gps.html${params.size ? "?" + params.toString() : ""}`;
});

// Load the current user's Safe Circle.
onAuthStateChanged(auth, user => {
    members = [];
    personSelect.innerHTML =
        '<option value="">Choose a member</option>';

    if (!user) {
        trackerStatus.textContent =
            "You are not logged in. Log in to load your Safe Circle.";
        personSelect.disabled = true;
        return;
    }

    trackerStatus.textContent = "Loading your Safe Circle...";
    personSelect.disabled = true;

    onSnapshot(
        collection(db, "users", user.uid, "trustedContacts"),

        snapshot => {
            members = snapshot.docs.map(item => {
                const data = item.data();

                return {
                    id: item.id,
                    name:
                        data.displayName ||
                        data.contactName ||
                        data.name ||
                        data.fullName ||
                        "Safe Circle member",
                    uid:
                        data.uid ||
                        data.contactUid ||
                        data.userId ||
                        data.linkedUserId ||
                        data.memberUid ||
                        data.firebaseUid ||
                        ""
                };
            });

            personSelect.innerHTML =
                '<option value="">Choose a member</option>';

            members.forEach(member => {
                const option = document.createElement("option");
                option.value = member.id;
                option.textContent = member.name;
                personSelect.appendChild(option);
            });

            personSelect.disabled = members.length === 0;

            trackerStatus.textContent = members.length
                ? `${members.length} Safe Circle member(s) loaded.`
                : "No members found in your Safe Circle yet.";

            updateSelection();
        },

        error => {
            console.error("Safe Circle loading error:", error);

            trackerStatus.textContent =
                "Could not load Safe Circle. Check your Firebase connection and Firestore rules.";

            personSelect.disabled = true;
        }
    );
});
