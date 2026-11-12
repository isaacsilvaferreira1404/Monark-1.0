const API_URL = window.MONARK_API_URL || "";

const money = value => Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
});

document.getElementById("current-year").textContent = new Date().getFullYear();

const revealElements = document.querySelectorAll(
    ".features .feature, #cardapio .section-heading, #sobre .about-image, #sobre .about-content, #depoimentos .section-heading, #depoimentos .testimonial-card, #contato .section-heading, #contato .contact-card, .quote-section"
);
const revealObserver = "IntersectionObserver" in window
    ? new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.14, rootMargin: "0px 0px -32px 0px" })
    : null;

revealElements.forEach((element, index) => {
    element.classList.add("reveal-on-scroll");
    element.style.setProperty("--reveal-delay", `${index % 3 * 90}ms`);
    if (revealObserver) revealObserver.observe(element);
    else element.classList.add("is-visible");
});

/* Menu mobile */
const menuToggle = document.getElementById("menu-toggle");
const navbar = document.getElementById("navbar");

menuToggle.addEventListener("click", () => {
    const opened = navbar.classList.toggle("active");
    menuToggle.setAttribute("aria-expanded", String(opened));
    menuToggle.textContent = opened ? "✕" : "☰";
});
document.querySelectorAll(".navbar a").forEach(link => {
    link.addEventListener("click", () => {
        navbar.classList.remove("active");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.textContent = "☰";
    });
});

/* Estado do carrinho */
const cart = new Map();
const cartOverlay = document.getElementById("cart-overlay");
const cartOpen = document.getElementById("cart-open");
const cartClose = document.getElementById("cart-close");
const cartItemsElement = document.getElementById("cart-items");
const cartCountElement = document.getElementById("cart-count");
const cartTotalElement = document.getElementById("cart-total");
const checkoutForm = document.getElementById("checkout-form");
const checkoutButton = document.getElementById("checkout-button");
const checkoutMessage = document.getElementById("checkout-message");
const postalCodeInput = document.getElementById("delivery-postal-code");
const deliveryAddress = document.getElementById("delivery-address");
const deliveryStatus = document.getElementById("delivery-status");
const deliveryFeeElement = document.getElementById("delivery-fee");
const grandTotalElement = document.getElementById("grand-total");
const deliveryHouseNumber = document.getElementById("delivery-house-number");
deliveryHouseNumber.required = false;
let deliveryQuote = null;
let quoteRequest = 0;

function openCart() {
    cartOverlay.classList.add("active");
    cartOverlay.setAttribute("aria-hidden", "false");
}
function closeCart() {
    cartOverlay.classList.remove("active");
    cartOverlay.setAttribute("aria-hidden", "true");
}
cartOpen.addEventListener("click", openCart);
cartClose.addEventListener("click", closeCart);
cartOverlay.addEventListener("click", event => {
    if (event.target === cartOverlay) closeCart();
});
document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeCart();
});

function addToCart(product) {
    const existing = cart.get(product.id);
    if (existing) existing.quantity += 1;
    else cart.set(product.id, { ...product, quantity: 1 });
    renderCart();
}

function changeQuantity(id, change) {
    const item = cart.get(id);
    if (!item) return;
    item.quantity += change;
    if (item.quantity <= 0) cart.delete(id);
    renderCart();
}

function renderCart() {
    cartItemsElement.replaceChildren();
    let total = 0;
    let count = 0;

    if (cart.size === 0) {
        const empty = document.createElement("p");
        empty.className = "cart-empty";
        empty.textContent = "Seu carrinho está vazio.";
        cartItemsElement.appendChild(empty);
    }

    for (const item of cart.values()) {
        const subtotal = item.price * item.quantity;
        total += subtotal;
        count += item.quantity;

        const row = document.createElement("div");
        row.className = "cart-product";

        const info = document.createElement("div");
        const name = document.createElement("h4");
        name.textContent = item.name;
        const price = document.createElement("p");
        price.textContent = money(subtotal);
        info.append(name, price);

        const actions = document.createElement("div");
        actions.className = "cart-actions";

        const minus = document.createElement("button");
        minus.type = "button";
        minus.textContent = "−";
        minus.setAttribute("aria-label", `Diminuir ${item.name}`);
        minus.addEventListener("click", () => changeQuantity(item.id, -1));

        const quantity = document.createElement("span");
        quantity.textContent = item.quantity;

        const plus = document.createElement("button");
        plus.type = "button";
        plus.textContent = "+";
        plus.setAttribute("aria-label", `Aumentar ${item.name}`);
        plus.addEventListener("click", () => {
            if (item.quantity < 20) changeQuantity(item.id, 1);
        });

        actions.append(minus, quantity, plus);
        row.append(info, actions);
        cartItemsElement.appendChild(row);
    }

    cartCountElement.textContent = count;
    cartTotalElement.textContent = money(total);
    const deliveryFee = deliveryQuote?.deliveryFee || 0;
    grandTotalElement.textContent = money(total + deliveryFee);
    deliveryFeeElement.textContent = deliveryQuote ? money(deliveryFee) : "Aguardando CEP";
}

/* Carregar produtos reais da API; preços nunca são confiados ao navegador no checkout */
const productsGrid = document.getElementById("products-grid");
const productsMessage = document.getElementById("products-message");
let allProducts = [];
const categoryNames = {
    cafes: "Cafés",
    bebidas: "Bebidas",
    doces: "Doces",
    salgados: "Salgados"
};

function renderProducts(category = "todos") {
    productsGrid.replaceChildren();

    const filtered = allProducts.filter(product =>
        category === "todos" || product.category === category
    );

    if (filtered.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty-products";
        empty.textContent = "Nenhum produto encontrado nesta categoria.";
        productsGrid.appendChild(empty);
        return;
    }

    filtered.forEach(product => {
        const card = document.createElement("article");
        card.className = "product-card";
        card.style.setProperty("--card-delay", `${productsGrid.children.length * 75}ms`);

        const imageWrap = document.createElement("div");
        imageWrap.className = "product-image";
        const image = document.createElement("img");
        image.src = product.image || "Assets/produto-placeholder.jpg";
        image.alt = product.name;
        image.loading = "lazy";
        image.onerror = () => {
            image.src = "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=700";
            image.onerror = null;
        };
        imageWrap.appendChild(image);

        const info = document.createElement("div");
        info.className = "product-info";

        const categoryLabel = document.createElement("span");
        categoryLabel.className = "product-category";
        categoryLabel.textContent = categoryNames[product.category] || product.category;

        const title = document.createElement("h3");
        title.textContent = product.name;

        const description = document.createElement("p");
        description.textContent = product.description || "";

        const bottom = document.createElement("div");
        bottom.className = "product-bottom";

        const price = document.createElement("strong");
        price.textContent = money(product.price);

        const addButton = document.createElement("button");
        addButton.className = "add-button";
        addButton.type = "button";
        addButton.textContent = "+";
        addButton.setAttribute("aria-label", `Adicionar ${product.name} ao carrinho`);
        addButton.addEventListener("click", () => {
            const current = cart.get(product.id);
            if (current && current.quantity >= 20) return;
            addToCart({
                id: product.id,
                name: product.name,
                price: Number(product.price)
            });
            addButton.textContent = "✓";
            setTimeout(() => addButton.textContent = "+", 650);
        });

        bottom.append(price, addButton);
        info.append(categoryLabel, title, description, bottom);
        card.append(imageWrap, info);
        productsGrid.appendChild(card);
    });
}

async function loadProducts() {
    productsMessage.classList.add("is-loading");
    try {
        const response = await fetch(`${API_URL}/api/products`);
        if (!response.ok) throw new Error("Falha ao consultar cardápio.");
        allProducts = await response.json();
        productsMessage.classList.remove("is-loading");
        productsMessage.textContent = "";
        renderProducts();
    } catch (error) {
        console.error(error);
        productsMessage.classList.remove("is-loading");
        productsMessage.textContent = "Não foi possível carregar o cardápio. Confira a conexão com a API.";
    }
}

/* Filtros */
document.querySelectorAll(".filter-button").forEach(button => {
    button.addEventListener("click", () => {
        document.querySelectorAll(".filter-button").forEach(item =>
            item.classList.remove("active")
        );
        button.classList.add("active");
        renderProducts(button.dataset.filter);
    });
});

async function requestDeliveryQuote() {
    const postalCode = postalCodeInput.value.replace(/\D/g, "");
    deliveryQuote = null;
    deliveryAddress.hidden = true;
    deliveryHouseNumber.required = false;
    deliveryFeeElement.textContent = "Aguardando CEP";
    renderCart();
    if (postalCode.length !== 8) {
        deliveryStatus.textContent = "Digite os 8 dígitos do CEP para consultar o endereço.";
        return;
    }

    const requestId = ++quoteRequest;
    deliveryStatus.textContent = "Consultando CEP e calculando o frete...";
    try {
        const response = await fetch(`${API_URL}/api/delivery/quote`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ postalCode })
        });
        const data = await response.json();
        if (requestId !== quoteRequest || postalCode !== postalCodeInput.value.replace(/\D/g, "")) return;
        if (!response.ok) throw new Error(data.error || "Não foi possível calcular o frete.");
        deliveryQuote = data;
        document.getElementById("delivery-street").value = data.street || "Endereço não informado pelo CEP";
        document.getElementById("delivery-neighborhood").value = data.neighborhood || "";
        document.getElementById("delivery-city").value = `${data.city || ""}${data.state ? ` / ${data.state}` : ""}`;
        document.getElementById("delivery-distance").textContent = `Distância estimada: ${data.distanceKm.toLocaleString("pt-BR")} km em linha reta desde o Centro Comercial Alphaville.`;
        deliveryAddress.hidden = false;
        deliveryHouseNumber.required = true;
        deliveryStatus.textContent = "Endereço encontrado. Informe apenas o número da casa.";
        renderCart();
    } catch (error) {
        if (requestId !== quoteRequest) return;
        deliveryStatus.textContent = error.message;
    }
}

postalCodeInput.addEventListener("input", () => {
    const digits = postalCodeInput.value.replace(/\D/g, "").slice(0, 8);
    postalCodeInput.value = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
    quoteRequest += 1;
    if (digits.length === 8) requestDeliveryQuote();
    else {
        deliveryQuote = null;
        deliveryAddress.hidden = true;
        deliveryHouseNumber.required = false;
        deliveryStatus.textContent = "Digite os 8 dígitos do CEP para consultar o endereço.";
        renderCart();
    }
});

/* Salvar pedido e abrir a conversa do WhatsApp */
checkoutForm.addEventListener("submit", async event => {
    event.preventDefault();
    checkoutMessage.textContent = "";

    if (cart.size === 0) {
        checkoutMessage.textContent = "Adicione pelo menos um produto ao carrinho.";
        return;
    }
    if (!deliveryQuote || !deliveryHouseNumber.value.trim()) {
        checkoutMessage.textContent = "Informe um CEP atendido e o número da casa.";
        return;
    }

    const notes = document.getElementById("customer-notes").value.trim();
    const items = [...cart.values()].map(item => ({ id: item.id, quantity: item.quantity }));
    checkoutButton.disabled = true;
    checkoutButton.textContent = "Preparando seu pedido...";

    try {
        const response = await fetch(`${API_URL}/api/checkout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ notes, items, postalCode: postalCodeInput.value, houseNumber: deliveryHouseNumber.value.trim() })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Não foi possível criar o pedido.");
        const whatsappUrl = new URL(data.whatsappUrl);
        if (whatsappUrl.protocol !== "https:" || whatsappUrl.hostname !== "wa.me") throw new Error("Não foi possível abrir o WhatsApp.");
        window.location.assign(whatsappUrl.href);
    } catch (error) {
        checkoutMessage.textContent = error.message;
        checkoutButton.disabled = false;
        checkoutButton.textContent = "Finalizar compra pelo WhatsApp";
    }
});

renderCart();
loadProducts();
