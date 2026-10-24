
"use strict";

/* Siza-Me incident diary.
   Standalone version: no login, OTP or Firebase.
   Records are stored in this browser using IndexedDB.
*/

const DB_NAME = "SizaMeDiaryDB";
const DB_VERSION = 1;

let db;
let selectedImages = [];
let currentEntries = [];
let currentReports = [];

const $ = (id) => document.getElementById(id);

function makeId() {
    return crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now() + "-" + Math.random().toString(16).slice(2);
}

function makeReference() {
    return "SM-" + new Date().getFullYear() + "-" +
        makeId().replace(/-/g, "").slice(0, 8).toUpperCase();
}

function today() {
    const date = new Date();
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString().slice(0, 10);
}

function showStatus(id, message) {
    $(id).textContent = message;
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

function formatDate(value) {
    if (!value) return "Not provided";

    const date = new Date(value + "T12:00:00");

    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleDateString("en-ZA");
}

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const database = request.result;

            if (!database.objectStoreNames.contains("entries")) {
                database.createObjectStore("entries", { keyPath: "id" });
            }

            if (!database.objectStoreNames.contains("reports")) {
                database.createObjectStore("reports", { keyPath: "id" });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function saveRecord(storeName, record) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readwrite");
        transaction.objectStore(storeName).put(record);

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
}

function deleteRecord(storeName, id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readwrite");
        transaction.objectStore(storeName).delete(id);

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
}

function getAllRecords(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readonly");
        const request = transaction.objectStore(storeName).getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/* NAVIGATION */

function showTab(name) {
    const tabs = {
        diary: "diary-section",
        attachments: "attachments-section",
        reports: "reports-section"
    };

    Object.entries(tabs).forEach(([key, id]) => {
        $(id).classList.toggle("hidden", key !== name);
    });
}

document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => showTab(button.dataset.tab));
});

/* IMAGE ATTACHMENTS */

function imageCardHTML(image, index, removable = false) {
    return `
        <div class="image-card">
            <img src="${image.data}" alt="${escapeHTML(image.name)}">
            <p>${escapeHTML(image.name)}</p>
            ${removable ? `
                <button type="button" data-remove-image="${index}">
                    Remove Image
                </button>` : ""}
        </div>
    `;
}

function renderSelectedImages() {
    $("preview-grid").innerHTML = selectedImages
        .map((image, index) => imageCardHTML(image, index, true))
        .join("");
}

$("preview-grid").addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-image]");
    if (!button) return;

    selectedImages.splice(Number(button.dataset.removeImage), 1);
    renderSelectedImages();
});

function readImage(file) {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith("image/")) {
            reject(new Error(file.name + " is not an image."));
            return;
        }

        const reader = new FileReader();

        reader.onload = () => resolve({
            name: file.name,
            type: file.type,
            data: reader.result
        });

        reader.onerror = () => reject(
            new Error("Could not read " + file.name)
        );

        reader.readAsDataURL(file);
    });
}

$("image-upload").addEventListener("change", async (event) => {
    const files = Array.from(event.target.files || []);

    try {
        for (const file of files) {
            selectedImages.push(await readImage(file));
        }

        renderSelectedImages();

        showStatus(
            "diary-status",
            "Image preview ready. Save the record to keep the images."
        );
    } catch (error) {
        showStatus("diary-status", error.message);
    }

    event.target.value = "";
});

/* SAVE AND EDIT INCIDENT RECORDS */

function resetEditor() {
    $("diary-form").reset();
    $("entry-id").value = "";
    $("entry-date").value = today();
    $("editor-heading").textContent = "Create an Incident Record";
    $("save-entry").textContent = "Save Incident Record";

    selectedImages = [];
    renderSelectedImages();
    showStatus("diary-status", "");
}

$("clear-entry").addEventListener("click", resetEditor);

$("diary-form").addEventListener("submit", async (event) => {
    event.preventDefault();

    const title = $("entry-title").value.trim();
    const text = $("entry-text").value.trim();
    const date = $("entry-date").value;
    const existingId = $("entry-id").value;

    if (!title || !text || !date) {
        showStatus("diary-status", "Enter a title, date and detailed statement.");
        return;
    }

    const oldEntry = currentEntries.find((item) => item.id === existingId);

    const entry = {
        id: existingId || makeId(),
        reference: oldEntry ? oldEntry.reference : makeReference(),
        title,
        date,
        time: $("incident-time").value,
        incidentType: $("incident-type").value,
        location: $("incident-location").value.trim(),
        persons: $("persons-involved").value.trim(),
        witnesses: $("witnesses").value.trim(),
        text,
        additionalInfo: $("additional-info").value.trim(),
        images: selectedImages,
        createdAt: oldEntry ? oldEntry.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    try {
        await saveRecord("entries", entry);
        resetEditor();
        await refreshAll();

        showStatus("diary-status", "Incident record saved successfully.");
    } catch (error) {
        console.error(error);

        showStatus(
            "diary-status",
            "Could not save the record. Your browser may be low on storage."
        );
    }
});

$("saved-entries").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const entry = currentEntries.find(
        (item) => item.id === button.dataset.id
    );

    if (!entry) return;

    switch (button.dataset.action) {
        case "edit":
            $("entry-id").value = entry.id;
            $("entry-title").value = entry.title;
            $("entry-date").value = entry.date;
            $("incident-time").value = entry.time || "";
            $("incident-type").value = entry.incidentType || "";
            $("incident-location").value = entry.location || "";
            $("persons-involved").value = entry.persons || "";
            $("witnesses").value = entry.witnesses || "";
            $("entry-text").value = entry.text;
            $("additional-info").value = entry.additionalInfo || "";

            selectedImages = [...(entry.images || [])];

            $("editor-heading").textContent = "Edit Incident Record";
            $("save-entry").textContent = "Update Incident Record";

            renderSelectedImages();
            showTab("diary");
            window.scrollTo({ top: 0, behavior: "smooth" });
            break;

        case "pdf":
            await downloadEntryPDF(entry);
            break;

        case "report":
            await createReport(entry);
            break;

        case "delete":
            if (!confirm("Delete this incident record and its pictures?")) {
                return;
            }

            await deleteRecord("entries", entry.id);
            await refreshAll();
            showStatus("diary-status", "Incident record deleted.");
            break;
    }
});

function renderEntries() {
    if (!currentEntries.length) {
        $("saved-entries").innerHTML = "<p>No saved incident records.</p>";
        return;
    }

    $("saved-entries").innerHTML = currentEntries.map((entry) => `
        <article class="entry">
            <h3>${escapeHTML(entry.title)}</h3>
            <p><strong>Reference:</strong> ${escapeHTML(entry.reference)}</p>
            <p><strong>Date:</strong> ${escapeHTML(formatDate(entry.date))}</p>
            <p><strong>Type:</strong> ${escapeHTML(entry.incidentType || "Not provided")}</p>
            <p>${escapeHTML(entry.text)}</p>

            <div>
                ${(entry.images || []).map((image) =>
                    imageCardHTML(image, 0, false)
                ).join("")}
            </div>

            <button type="button" data-action="edit" data-id="${entry.id}">
                Edit
            </button>

            <button type="button" data-action="pdf" data-id="${entry.id}">
                Download Incident Report PDF
            </button>

            <button type="button" data-action="report" data-id="${entry.id}">
                Create Help Request
            </button>

            <button type="button" data-action="delete" data-id="${entry.id}">
                Delete
            </button>
        </article>
    `).join("");
}

/* ATTACHMENTS TAB */

function renderAttachments() {
    const attachments = currentEntries.flatMap((entry) =>
        (entry.images || []).map((image) => ({
            ...image,
            entryTitle: entry.title,
            entryDate: entry.date
        }))
    );

    if (!attachments.length) {
        $("attachments-grid").innerHTML = "<p>No saved photographs.</p>";
        showStatus("attachments-status", "");
        return;
    }

    $("attachments-grid").innerHTML = attachments.map((image) => `
        <article class="attachment">
            ${imageCardHTML(image, 0, false)}
            <p><strong>Record:</strong> ${escapeHTML(image.entryTitle)}</p>
            <p><strong>Date:</strong> ${escapeHTML(formatDate(image.entryDate))}</p>
        </article>
    `).join("");

    showStatus("attachments-status", attachments.length + " saved photograph(s).");
}

/* HELP REQUESTS */

async function createReport(entry) {
    const description = prompt(
        "Describe the help you need. This request will be saved on this device only."
    );

    if (description === null) return;

    const report = {
        id: makeId(),
        reference: makeReference(),
        entryId: entry ? entry.id : null,
        entryTitle: entry ? entry.title : "",
        date: today(),
        description: description.trim(),
        createdAt: new Date().toISOString(),
        status: "Saved locally — not sent to a helpline"
    };

    try {
        await saveRecord("reports", report);
        await refreshAll();
        showTab("reports");

        showStatus(
            "reports-status",
            "Help request saved locally. It has NOT been sent to a helpline."
        );
    } catch (error) {
        console.error(error);
        alert("Could not save the help request.");
    }
}

$("report-entry").addEventListener("click", async () => {
    const entryId = $("entry-id").value;
    const entry = currentEntries.find((item) => item.id === entryId) || {
        id: null,
        title: $("entry-title").value.trim() || "General Help Request"
    };

    await createReport(entry);
});

$("saved-reports").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const report = currentReports.find(
        (item) => item.id === button.dataset.id
    );

    if (!report) return;

    if (button.dataset.action === "pdf") {
        await downloadReportPDF(report);
    }

    if (button.dataset.action === "delete-report") {
        if (!confirm("Delete this help request?")) return;

        await deleteRecord("reports", report.id);
        await refreshAll();
        showStatus("reports-status", "Help request deleted.");
    }
});

function renderReports() {
    if (!currentReports.length) {
        $("saved-reports").innerHTML = "<p>No saved help requests.</p>";
        return;
    }

    $("saved-reports").innerHTML = currentReports.map((report) => `
        <article class="report">
            <h3>Help Request</h3>
            <p><strong>Reference:</strong> ${escapeHTML(report.reference)}</p>
            <p><strong>Date:</strong> ${escapeHTML(formatDate(report.date))}</p>
            <p><strong>Related record:</strong> ${escapeHTML(report.entryTitle || "None")}</p>
            <p>${escapeHTML(report.description || "No description provided.")}</p>
            <p><strong>Status:</strong> ${escapeHTML(report.status)}</p>

            <button type="button" data-action="pdf" data-id="${report.id}">
                Download Report PDF
            </button>

            <button type="button" data-action="delete-report" data-id="${report.id}">
                Delete
            </button>
        </article>
    `).join("");
}

/* PDF HELPERS */

function createPDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("PDF support did not load. Check your internet connection.");
        return null;
    }

    return new window.jspdf.jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
    });
}

function safeFilename(value) {
    return String(value || "record")
        .replace(/[^a-z0-9_-]/gi, "-")
        .slice(0, 60);
}

function addWrappedText(doc, text, x, y, width = 180, lineHeight = 5) {
    const lines = doc.splitTextToSize(String(text || "Not provided"), width);
    const pageHeight = doc.internal.pageSize.getHeight();

    for (const line of lines) {
        if (y > pageHeight - 18) {
            doc.addPage();
            y = 20;
        }

        doc.text(line, x, y);
        y += lineHeight;
    }

    return y;
}

function addSectionHeading(doc, heading, y) {
    const pageHeight = doc.internal.pageSize.getHeight();

    if (y > pageHeight - 25) {
        doc.addPage();
        y = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    y = addWrappedText(doc, heading, 15, y, 180, 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    return y + 2;
}

function addField(doc, label, value, y) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);

    y = addWrappedText(doc, label + ":", 15, y, 180, 5);

    doc.setFont("helvetica", "normal");

    return addWrappedText(doc, value || "Not provided", 15, y, 180, 5) + 2;
}

function imageFormat(data) {
    if (data.startsWith("data:image/png")) return "PNG";
    if (data.startsWith("data:image/webp")) return "WEBP";
    if (data.startsWith("data:image/gif")) return "GIF";
    return "JPEG";
}

function addFullImage(doc, image, y) {
    return new Promise((resolve) => {
        const picture = new Image();

        picture.onload = () => {
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 15;

            const naturalWidth = picture.naturalWidth || picture.width;
            const naturalHeight = picture.naturalHeight || picture.height;

            if (!naturalWidth || !naturalHeight) {
                resolve(y);
                return;
            }

            // Fit the whole photograph inside the page, preserving its ratio.
            const scale = Math.min(
                (pageWidth - margin * 2) / naturalWidth,
                (pageHeight - margin * 2) / naturalHeight
            );

            const width = naturalWidth * scale;
            const height = naturalHeight * scale;

            if (y + height > pageHeight - margin) {
                doc.addPage();
                y = margin;
            }

            const x = (pageWidth - width) / 2;

            try {
                doc.addImage(
                    image.data,
                    imageFormat(image.data),
                    x,
                    y,
                    width,
                    height
                );

                resolve(y + height + 10);
            } catch (error) {
                console.error("Could not include image:", error);
                resolve(y);
            }
        };

        picture.onerror = () => {
            console.error("Could not read image for PDF:", image.name);
            resolve(y);
        };

        picture.src = image.data;
    });
}

/* FORMAL USER-PREPARED INCIDENT REPORT */

async function addIncidentReportPDF(doc, entry, firstPage = true) {
    if (!firstPage) doc.addPage();

    let y = 18;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    y = addWrappedText(doc, "INCIDENT REPORT", 15, y, 180, 8);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");

    y = addWrappedText(
        doc,
        "SIZA-ME | USER-PREPARED DOCUMENT — NOT AN OFFICIAL SAPS FORM",
        15,
        y + 2,
        180,
        5
    );

    y += 2;

    doc.setDrawColor(80);
    doc.line(15, y, 195, y);
    y += 8;

    y = addSectionHeading(doc, "1. REPORT IDENTIFICATION", y);
    y = addField(doc, "Report reference", entry.reference, y);
    y = addField(doc, "Report created", new Date().toLocaleString("en-ZA"), y);
    y = addField(doc, "Record title", entry.title, y);

    y = addSectionHeading(doc, "2. INCIDENT DETAILS", y);
    y = addField(doc, "Incident type", entry.incidentType, y);
    y = addField(doc, "Date of incident", formatDate(entry.date), y);
    y = addField(doc, "Time of incident", entry.time, y);
    y = addField(doc, "Location", entry.location, y);

    y = addSectionHeading(doc, "3. PEOPLE AND WITNESSES", y);
    y = addField(doc, "People involved", entry.persons, y);
    y = addField(doc, "Witnesses", entry.witnesses, y);

    y = addSectionHeading(doc, "4. INCIDENT STATEMENT", y);
    y = addWrappedText(doc, entry.text, 15, y, 180, 5) + 3;

    y = addSectionHeading(doc, "5. ADDITIONAL INFORMATION", y);
    y = addWrappedText(doc, entry.additionalInfo, 15, y, 180, 5) + 3;

    y = addSectionHeading(doc, "6. ATTACHED PHOTOGRAPHS / EVIDENCE", y);

    const images = entry.images || [];

    if (!images.length) {
        y = addWrappedText(doc, "No photographs attached.", 15, y, 180, 5);
    } else {
        y = addWrappedText(
            doc,
            "The following photographs were attached to this record:",
            15,
            y,
            180,
            5
        ) + 2;

        for (let i = 0; i < images.length; i++) {
            y = addWrappedText(
                doc,
                "Evidence image " + (i + 1) + ": " + images[i].name,
                15,
                y,
                180,
                5
            );

            y = await addFullImage(doc, images[i], y);
        }
    }

    y = addSectionHeading(doc, "7. DECLARATION", y);

    y = addWrappedText(
        doc,
        "This document is a record prepared by the user from information entered into Siza-Me. Its contents have not been independently verified. It is not an official police report, police case number, or confirmation that a complaint has been lodged with SAPS.",
        15,
        y,
        180,
        5
    );

    y += 8;

    y = addWrappedText(doc, "User signature: ______________________________", 15, y, 180, 6);
    y = addWrappedText(doc, "Date: ______________________________________", 15, y, 180, 6);

    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");

    addWrappedText(
        doc,
        "Keep this document and any evidence secure. If you need an official police report, contact SAPS directly.",
        15,
        y + 5,
        180,
        4
    );
}

async function downloadEntryPDF(entry) {
    const doc = createPDF();
    if (!doc) return;

    await addIncidentReportPDF(doc, entry, true);

    doc.save("SizaMe-Incident-Report-" + safeFilename(entry.reference) + ".pdf");
}

async function downloadReportPDF(report) {
    const doc = createPDF();

    if (!doc) return;

    let y = 18;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    y = addWrappedText(doc, "HELP REQUEST REPORT", 15, y, 180, 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    y = addWrappedText(
        doc,
        "SIZA-ME | USER-PREPARED DOCUMENT — NOT AN OFFICIAL POLICE FORM",
        15,
        y + 2,
        180,
        5
    );

    y += 5;

    y = addSectionHeading(doc, "1. REQUEST DETAILS", y);
    y = addField(doc, "Reference", report.reference, y);
    y = addField(doc, "Date", formatDate(report.date), y);
    y = addField(doc, "Related incident", report.entryTitle, y);

    y = addSectionHeading(doc, "2. REQUEST DESCRIPTION", y);
    y = addWrappedText(doc, report.description, 15, y, 180, 5) + 3;

    y = addSectionHeading(doc, "3. REQUEST STATUS", y);
    y = addWrappedText(doc, report.status, 15, y, 180, 5) + 3;

    addWrappedText(
        doc,
        "This request is stored locally. This PDF does not confirm that a helpline, SAPS or any other service has received it.",
        15,
        y,
        180,
        5
    );

    doc.save("SizaMe-Help-Request-" + safeFilename(report.reference) + ".pdf");
}

/* DOWNLOAD ALL RECORDS */

$("download-all").addEventListener("click", async () => {
    const doc = createPDF();
    if (!doc) return;

    if (!currentEntries.length && !currentReports.length) {
        alert("There are no saved records to download.");
        return;
    }

    let first = true;

    for (const entry of currentEntries) {
        await addIncidentReportPDF(doc, entry, first);
        first = false;
    }

    for (const report of currentReports) {
        doc.addPage();

        let y = 18;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        y = addWrappedText(doc, "HELP REQUEST REPORT", 15, y, 180, 8);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);

        y = addField(doc, "Reference", report.reference, y + 4);
        y = addField(doc, "Date", formatDate(report.date), y);
        y = addField(doc, "Related incident", report.entryTitle, y);

        y = addSectionHeading(doc, "REQUEST DESCRIPTION", y);
        y = addWrappedText(doc, report.description, 15, y, 180, 5);

        y = addSectionHeading(doc, "STATUS", y);
        addWrappedText(doc, report.status, 15, y, 180, 5);
    }

    doc.save("SizaMe-All-Incident-Reports.pdf");
});

/* REFRESH AND START */

async function refreshAll() {
    currentEntries = await getAllRecords("entries");
    currentReports = await getAllRecords("reports");

    currentEntries.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    currentReports.sort((a, b) =>
        (b.createdAt || "").localeCompare(a.createdAt || "")
    );

    renderEntries();
    renderAttachments();
    renderReports();
}

async function startDiary() {
    $("entry-date").value = today();

    try {
        db = await openDatabase();
        await refreshAll();
    } catch (error) {
        console.error(error);

        showStatus(
            "diary-status",
            "Could not open the diary database. Try opening the site through your local server."
        );
    }
}

startDiary();
