/* ==============================
   PRODUCTS AND PRICES
============================== */
const products = [
    {
        id: "tshirt",
        name: "Siza-Me T-Shirt",
        category: "Clothing",
        price: 150,
        description: "Siza-Me branded T-shirt.",
        image: "tshirt.png"
    },
    {
        id: "bucket-hat",
        name: "Siza-Me Bucket Hat",
        category: "Clothing",
        price: 200,
        description: "Siza-Me branded bucket hat.",
        image: "bucket-hat.jpg"
    },
    {
        id: "cap",
        name: "Siza-Me Cap",
        category: "Clothing",
        price: 100,
        description: "Siza-Me branded cap.",
        image: "cap.jpg"
    },
    {
        id: "stanley",
        name: "Siza-Me Stanley",
        category: "Accessories",
        price: 250,
        description: "Siza-Me branded drink tumbler.",
        image: "tumbler.jpg"
    },
    {
        id: "tracker",
        name: "Siza-Me Tracking Device",
        category: "Safety Devices",
        price: 600,
        description: "Safety-tracking device for Siza-Me.",
        image: "tracker.jpg"
    },
    {
        id: "tracker-stickers",
        name: "Siza-Me Tracker Stickers (30 Pack)",
        category: "Accessories",
        price: 300,
        description: "Pack of 30 Siza-Me tracker stickers.",
        image: "sticker.jpg"
    }
];
/* ==============================
   PROFESSIONAL SUPPORT DIRECTORY
============================== */
const providers = [
    {
        category: "Psychologist",
        name: "Lauren Calder",
        company: "Lauren Calder & Associates",
        venue: "Lincoln on the Lake",
        address: "2 The High Street, Umhlanga, Durban, KwaZulu-Natal, 4319",
        phone: "0647905048",
        email: "calderpractice@gmail.com",
        website: "https://www.laurencalder.co.za/",
        hours: "Contact the practice to confirm current opening hours.",
        service: "Psychological services and consultations.",
        image: "lauren-calder.jpg"
    },
    {
        category: "Psychologist",
        name: "Andiswa Sitole",
        company: "MultiMedics Umhlanga",
        venue: "The Madison, Suite 26, Level 3",
        address: "Corner of 22 Gateway Boulevard and 5 East Row, opposite Gateway Hospital, Umhlanga Rocks",
        phone: "0315661603",
        email: "",
        website: "https://multimedicsumhlanga.co.za/clinical-psychologist/",
        hours: "Previously listed: Monday-Friday, 09:00-17:00; Saturday, 09:00-13:00. Confirm current hours.",
        service: "Psychological services and consultations."
    },
    {
        category: "Lawyer",
        name: "Attorney name not confirmed",
        company: "Irwin & Co. Attorneys",
        venue: "2 Ncondo Place",
        address: "Umhlanga Ridge, Durban, KwaZulu-Natal, 4319",
        phone: "0311400447",
        email: "info@irwinandcolaw.com",
        website: "https://www.irwinandcolaw.com/",
        booking: "https://www.irwinandcolaw.com/contact.php",
        hours: "Previously listed: Monday-Friday, 08:00-18:00; Saturday by appointment. Confirm current hours.",
        service: "Legal services and consultations.",
        image: "irwin.jpg"
    },
    {
        category: "Insurance Company",
        name: "Representative name not confirmed",
        company: "Pomsun & Associates",
        venue: "Umhlanga office; exact venue not confirmed",
        address: "Umhlanga, KwaZulu-Natal. Confirm the full street address before visiting.",
        phone: "",
        email: "info@pomsun.co.za",
        website: "https://www.pomsun.co.za/Home/",
        hours: "Previously listed: Monday-Thursday, 08:00-16:30; Friday, 08:00-16:00. Confirm current hours.",
        service: "Insurance services and enquiries.",
        image: "pomsun.jpg"
    },
    {
        category: "Insurance Company",
        name: "Broker name not confirmed",
        company: "IJ Duncan Insurance Brokers",
        venue: "Unit 6, Armstrong House",
        address: "94 Armstrong Avenue, La Lucia Ridge, Umhlanga, 4319",
        phone: "0313051410",
        email: "info@duncaninsurance.co.za",
        website: "https://duncaninsurance.co.za/",
        booking: "https://duncaninsurance.co.za/contact-us/",
        hours: "Not confirmed. Contact the company before visiting.",
        service: "Insurance brokerage and enquiries.",
        image: "ij-duncan.jpg"
    },
    {
        category: "Private Security",
        name: "Local representative not confirmed",
        company: "AURA",
        venue: "Local office or response location not confirmed",
        address: "Contact AURA to confirm local coverage and the appropriate address.",
        phone: "",
        email: "",
        website: "https://www.aurasos.com/en-za/",
        hours: "Contact AURA to confirm service availability and operating arrangements.",
        service: "Private security and emergency response services. Confirm availability in your area."
    },
    {
        category: "Dermatologist",
        name: "Specialist name not confirmed",
        company: "Dermatology Clinic Umhlanga",
        venue: "Umhlanga Medical Centre",
        address: "Umhlanga, Durban, KwaZulu-Natal, 4319",
        phone: "",
        email: "",
        website: "",
        hours: "Contact practice to confirm hours.",
        service: "Dermatology and skin care consultations.",
        image: "dermatology.jpg"
    }
];
/* ==============================
   HELPER FUNCTIONS
============================== */
function getElement(id) {
    return document.getElementById(id);
}
function formatPrice(amount) {
    return new Intl.NumberFormat("en-ZA", {
        style: "currency",
        currency: "ZAR"
    }).format(amount);
}
function makeElement(tag, text) {
    const element = document.createElement(tag);
    if (text !== undefined) {
        element.textContent = text;
    }
    return element;
}
function makeLink(text, url) {
    const link = makeElement("a", text);
    link.href = url;
    if (url.startsWith("https://")) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
    }
    return link;
}
function addDetail(container, label, value) {
    const paragraph = makeElement("p");
    const strong = makeElement("strong", label + ": ");
    paragraph.appendChild(strong);
    paragraph.appendChild(
        document.createTextNode(
            value && value.trim() ? value : "Not confirmed"
        )
    );
    container.appendChild(paragraph);
}
/* ==============================
   DISPLAY PRODUCTS
============================== */
function renderProducts() {
    const list = getElement("product-list");
    if (!list) return;
    const search = getElement("product-search");
    const term = search ? search.value.trim().toLowerCase() : "";
    list.replaceChildren();
    const filtered = products.filter(function (product) {
        return [
            product.name,
            product.category,
            product.description
        ].join(" ").toLowerCase().includes(term);
    });
    if (filtered.length === 0) {
        list.appendChild(makeElement("p", "No products found."));
        return;
    }
    filtered.forEach(function (product) {
        const card = makeElement("article");
        if (product.image) {
            const img = makeElement("img");
            img.src = product.image;
            img.alt = product.name;
            card.appendChild(img);
        }
        card.appendChild(makeElement("h3", product.name));
        card.appendChild(makeElement("p", product.category));
        card.appendChild(makeElement("p", product.description));
        card.appendChild(
            makeElement("p", "Price: " + formatPrice(product.price))
        );
        const button = makeElement("button", "Add to Cart");
        button.type = "button";
        button.addEventListener("click", function () {
            addToCart(product.id);
        });
        card.appendChild(button);
        list.appendChild(card);
    });
}
/* ==============================
   DISPLAY SERVICE PROVIDERS
============================== */
function renderProviders() {
    const list = getElement("service-list");
    if (!list) return;
    const category = getElement("service-category").value;
    const search = getElement("service-search");
    const term = search ? search.value.trim().toLowerCase() : "";
    list.replaceChildren();
    const filtered = providers.filter(function (provider) {
        const matchesCategory =
            category === "all" || provider.category === category;
        const searchableText = [
            provider.name,
            provider.company,
            provider.category,
            provider.venue,
            provider.address,
            provider.phone,
            provider.email,
            provider.service
        ].join(" ").toLowerCase();
        return matchesCategory && searchableText.includes(term);
    });
    if (filtered.length === 0) {
        list.appendChild(
            makeElement("p", "No providers match your search.")
        );
        return;
    }
    filtered.forEach(function (provider) {
        const card = makeElement("article");
        if (provider.image) {
            const img = makeElement("img");
            img.src = provider.image;
            img.alt = provider.company || provider.category;
            card.appendChild(img);
        }
        card.appendChild(makeElement("h3", provider.category));
        card.appendChild(makeElement("p", provider.service));
        addDetail(card, "Professional / Contact name", provider.name);
        addDetail(card, "Company / Practice", provider.company);
        addDetail(card, "Venue", provider.venue);
        addDetail(card, "Physical address", provider.address);
        addDetail(card, "Phone number", provider.phone);
        addDetail(card, "Email address", provider.email);
        addDetail(card, "Opening hours", provider.hours);
        const links = makeElement("div");
        if (provider.phone) {
            links.appendChild(
                makeLink("Call Provider", "tel:" + provider.phone)
            );
        }
        if (provider.email) {
            links.appendChild(
                makeLink("Email Provider", "mailto:" + provider.email)
            );
        }
        if (provider.website) {
            links.appendChild(
                makeLink("Official Website", provider.website)
            );
        }
        if (provider.booking) {
            links.appendChild(
                makeLink("Contact / Booking", provider.booking)
            );
        }
        card.appendChild(links);
        list.appendChild(card);
    });
}
/* ==============================
   SHOPPING CART
============================== */
const cart = new Map();
function addToCart(productId) {
    const product = products.find(function (item) {
        return item.id === productId;
    });
    if (!product) return;
    const item = cart.get(productId);
    if (item) {
        item.quantity++;
    } else {
        cart.set(productId, {
            product: product,
            quantity: 1
        });
    }
    renderCart();
    const message = getElement("cart-message");
    if (message) {
        message.textContent = product.name + " added to your cart.";
    }
}
function changeQuantity(productId, amount) {
    const item = cart.get(productId);
    if (!item) return;
    item.quantity += amount;
    if (item.quantity <= 0) {
        cart.delete(productId);
    }
    renderCart();
}
function removeFromCart(productId) {
    cart.delete(productId);
    renderCart();
}
function clearCart() {
    cart.clear();
    renderCart();
    const message = getElement("cart-message");
    if (message) {
        message.textContent = "Your cart has been cleared.";
    }
}
function renderCart() {
    const list = getElement("cart-items");
    const count = getElement("cart-count");
    const subtotal = getElement("cart-subtotal");
    const checkout = getElement("open-checkout");
    let itemCount = 0;
    let total = 0;
    cart.forEach(function (item) {
        itemCount += item.quantity;
        total += item.product.price * item.quantity;
    });
    if (count) count.textContent = String(itemCount);
    if (subtotal) subtotal.textContent = formatPrice(total);
    if (checkout) {
        checkout.disabled = true;
        checkout.textContent = "Checkout unavailable";
    }
    if (!list) return;
    list.replaceChildren();
    if (cart.size === 0) {
        list.appendChild(makeElement("p", "Your cart is empty."));
        return;
    }
    cart.forEach(function (item, id) {
        const row = makeElement("article");
        if (item.product.image) {
            const img = makeElement("img");
            img.src = item.product.image;
            img.alt = item.product.name;
            row.appendChild(img);
        }
        row.appendChild(makeElement("h3", item.product.name));
        row.appendChild(
            makeElement("p", "Unit price: " + formatPrice(item.product.price))
        );
        row.appendChild(
            makeElement("p", "Quantity: " + item.quantity)
        );
        row.appendChild(
            makeElement(
                "p",
                "Item total: " +
                    formatPrice(item.product.price * item.quantity)
            )
        );
        const decrease = makeElement("button", "Decrease");
        decrease.type = "button";
        decrease.addEventListener("click", function () {
            changeQuantity(id, -1);
        });
        const increase = makeElement("button", "Increase");
        increase.type = "button";
        increase.addEventListener("click", function () {
            changeQuantity(id, 1);
        });
        const remove = makeElement("button", "Remove");
        remove.type = "button";
        remove.addEventListener("click", function () {
            removeFromCart(id);
        });
        row.appendChild(decrease);
        row.appendChild(increase);
        row.appendChild(remove);
        list.appendChild(row);
    });
    const message = getElement("cart-message");
    if (message) {
        message.textContent =
            "Subtotal: " + formatPrice(total) +
            ". Checkout is not yet available.";
    }
}
/* ==============================
   TAB NAVIGATION
============================== */
function openTab(tabId) {
    const tabs = ["products-tab", "services-tab", "cart-tab"];
    if (!tabs.includes(tabId)) return;
    document.querySelectorAll(".shop-tab").forEach(function (button) {
        const active = button.dataset.tab === tabId;
        button.setAttribute("aria-selected", String(active));
    });
    tabs.forEach(function (id) {
        const section = getElement(id);
        if (section) {
            section.hidden = id !== tabId;
        }
    });
    if (tabId === "products-tab") renderProducts();
    if (tabId === "services-tab") renderProviders();
    if (tabId === "cart-tab") renderCart();
}
/* ==============================
   INITIALISE
============================== */
document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".shop-tab").forEach(function (button) {
        button.addEventListener("click", function () {
            openTab(button.dataset.tab);
        });
    });
    getElement("product-search")?.addEventListener("input", renderProducts);
    getElement("service-search")?.addEventListener("input", renderProviders);
    getElement("service-category")?.addEventListener("change", renderProviders);
    getElement("clear-cart")?.addEventListener("click", clearCart);
    getElement("cancel-checkout")?.addEventListener("click", function () {
        getElement("checkout-section").hidden = true;
    });
    renderProducts();
    renderProviders();
    renderCart();
    openTab("products-tab");
});