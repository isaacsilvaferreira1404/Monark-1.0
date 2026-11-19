(() => {
    const overlay = document.getElementById("auth-overlay");
    const form = document.getElementById("auth-form");
    const submit = document.getElementById("auth-submit");
    const message = document.getElementById("auth-message");
    const title = document.getElementById("auth-title");
    const description = document.getElementById("auth-description");
    const switchButton = document.getElementById("auth-switch");
    const openButton = document.getElementById("auth-open");
    const profileControls = document.getElementById("profile-controls");
    const profileName = document.getElementById("profile-name");
    const profilePhone = document.getElementById("profile-phone");
    const profileSave = document.getElementById("profile-save");
    const logoutButton = document.getElementById("auth-logout");
    const adminProductOpen = document.getElementById("admin-product-open");
    const adminProductPanel = document.getElementById("admin-product-panel");
    const adminProductBack = document.getElementById("admin-product-back");
    const adminProductForm = document.getElementById("admin-product-form");
    const adminProductSubmit = document.getElementById("admin-product-submit");
    const adminProductFeedback = document.getElementById("admin-product-feedback");
    const productImageInput = document.getElementById("admin-product-image-url");
    const productImagePreview = document.getElementById("admin-product-image-preview");
    const productImagePlaceholder = document.getElementById("admin-product-image-placeholder");
    const apiUrl = window.MONARK_API_URL || "";
    const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    let registerMode = false;
    let currentUser = null;
    let productImagePreviewUrl = "";

    const setMessage = text => { message.textContent = text; };
    const setProductFeedback = text => { adminProductFeedback.textContent = text; };

    const clearProductImagePreview = () => {
        if (productImagePreviewUrl) URL.revokeObjectURL(productImagePreviewUrl);
        productImagePreviewUrl = "";
        productImagePreview.removeAttribute("src");
        productImagePreview.hidden = true;
        productImagePlaceholder.hidden = false;
    };

    const showAccountPanel = () => {
        adminProductPanel.hidden = true;
        profileControls.hidden = !currentUser;
        form.hidden = Boolean(currentUser);
        switchButton.hidden = Boolean(currentUser);
        title.textContent = currentUser ? "Minha conta" : (registerMode ? "Crie sua conta" : "Entre na sua conta");
        description.textContent = currentUser
            ? "Acompanhe seus pedidos e atualize seus dados."
            : "Acompanhe seus pedidos e agilize suas próximas compras.";
    };

    const open = () => {
        overlay.setAttribute("aria-hidden", "false");
        showAccountPanel();
        if (currentUser) profileName.focus();
        else document.getElementById("auth-email").focus();
    };

    const close = () => {
        overlay.setAttribute("aria-hidden", "true");
        adminProductPanel.hidden = true;
        setMessage("");
        setProductFeedback("");
    };

    const syncMode = () => {
        title.textContent = registerMode ? "Crie sua conta" : "Entre na sua conta";
        description.textContent = "Acompanhe seus pedidos e agilize suas próximas compras.";
        submit.textContent = registerMode ? "Criar conta" : "Entrar";
        switchButton.textContent = registerMode ? "Já tenho uma conta" : "Ainda não tenho conta";
        document.querySelectorAll(".register-only").forEach(field => {
            field.hidden = !registerMode;
            field.required = registerMode;
        });
    };

    const syncUser = user => {
        currentUser = user;
        const loggedIn = Boolean(user);
        form.hidden = loggedIn;
        switchButton.hidden = loggedIn;
        profileControls.hidden = !loggedIn;
        adminProductOpen.hidden = !user?.isAdmin;
        if (!user?.isAdmin) adminProductPanel.hidden = true;
        openButton.textContent = loggedIn ? "Minha conta" : "Entrar";
        document.getElementById("checkout-account-note").textContent = loggedIn
            ? `Pedido em nome de ${user.name || "seu perfil"}.`
            : "Entre na sua conta para continuar.";
        if (loggedIn) {
            profileName.value = user.name || "";
            profilePhone.value = user.phone || "";
            title.textContent = "Minha conta";
            description.textContent = "Acompanhe seus pedidos e atualize seus dados.";
        } else {
            showAccountPanel();
        }
    };

    const refreshUser = async () => {
        const response = await fetch(`${apiUrl}/api/auth/me`, { credentials: "include" });
        if (!response.ok) throw new Error("Não foi possível verificar a sessão.");
        syncUser((await response.json()).user);
    };

    openButton.addEventListener("click", open);
    document.getElementById("auth-close").addEventListener("click", close);
    overlay.addEventListener("click", event => { if (event.target === overlay) close(); });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && overlay.getAttribute("aria-hidden") === "false") close();
    });
    switchButton.addEventListener("click", () => { registerMode = !registerMode; syncMode(); });

    form.addEventListener("submit", async event => {
        event.preventDefault();
        submit.disabled = true;
        setMessage("Aguarde...");
        try {
            const response = await fetch(`${apiUrl}/api/auth/${registerMode ? "register" : "login"}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    name: document.getElementById("auth-name").value,
                    phone: document.getElementById("auth-phone").value,
                    email: document.getElementById("auth-email").value,
                    password: document.getElementById("auth-password").value
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Não foi possível concluir.");
            await refreshUser();
            setMessage(registerMode ? "Conta criada com sucesso." : "Login realizado com sucesso.");
            setTimeout(close, 900);
        } catch (error) {
            setMessage(error.message);
        } finally {
            submit.disabled = false;
        }
    });

    profileSave.addEventListener("click", async () => {
        profileSave.disabled = true;
        try {
            const response = await fetch(`${apiUrl}/api/auth/profile`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ name: profileName.value, phone: profilePhone.value })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Não foi possível salvar o perfil.");
            syncUser(data);
            setMessage("Dados da conta salvos com sucesso.");
        } catch (error) {
            setMessage(error.message);
        } finally {
            profileSave.disabled = false;
        }
    });

    logoutButton.addEventListener("click", async () => {
        await fetch(`${apiUrl}/api/auth/logout`, { method: "POST", credentials: "include" });
        syncUser(null);
        close();
    });

    adminProductOpen.addEventListener("click", () => {
        if (!currentUser?.isAdmin) return;
        form.hidden = true;
        switchButton.hidden = true;
        profileControls.hidden = true;
        adminProductPanel.hidden = false;
        title.textContent = "Cadastrar produto";
        description.textContent = "Preencha os detalhes para publicar um novo item no cardápio.";
        setMessage("");
        setProductFeedback("");
        document.getElementById("admin-product-name").focus();
    });

    adminProductBack.addEventListener("click", () => {
        showAccountPanel();
        setProductFeedback("");
        adminProductOpen.focus();
    });

    productImageInput.addEventListener("input", () => {
        setProductFeedback("");
        clearProductImagePreview();
        try {
            const url = new URL(productImageInput.value.trim());
            if (url.protocol !== "https:") return;
            productImagePreview.src = url.href;
            productImagePreview.hidden = false;
            productImagePlaceholder.hidden = true;
        } catch { /* Aguarda um endereço válido. */ }
    });
    productImagePreview.addEventListener("error", () => {
        productImagePreview.hidden = true;
        productImagePlaceholder.hidden = false;
    });

    adminProductForm.addEventListener("submit", async event => {
        event.preventDefault();
        if (!currentUser?.isAdmin) {
            setProductFeedback("Somente o administrador pode cadastrar produtos.");
            return;
        }

        if (!adminProductForm.reportValidity()) return;
        adminProductSubmit.disabled = true;
        adminProductSubmit.textContent = "Enviando produto...";
        setProductFeedback("Salvando produto no cardápio...");
        try {
            const response = await fetch(`${apiUrl}/api/admin/products`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(Object.fromEntries(new FormData(adminProductForm)))
            });
            const data = await response.json().catch(() => ({}));
            if (response.status === 401 || response.status === 403) {
                await refreshUser().catch(() => syncUser(null));
                throw new Error("Acesso restrito: entre com a conta do administrador.");
            }
            if (!response.ok) throw new Error(data.error || "Não foi possível cadastrar o produto.");
            adminProductForm.reset();
            clearProductImagePreview();
            setProductFeedback("Produto cadastrado e publicado no cardápio.");
            window.dispatchEvent(new Event("monark:products-updated"));
        } catch (error) {
            setProductFeedback(error.message);
        } finally {
            adminProductSubmit.disabled = false;
            adminProductSubmit.textContent = "Cadastrar produto";
        }
    });

    syncMode();
    refreshUser().catch(() => {});
})();
