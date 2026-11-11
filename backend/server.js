import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import crypto from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firebase.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const publicDirectory = join(projectRoot, "public");

const frontendUrl = new URL(
    process.env.FRONTEND_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
    (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
    "http://127.0.0.1:5500"
);
const frontendOrigin = frontendUrl.origin;
const frontendBaseUrl = `${frontendOrigin}${frontendUrl.pathname.replace(/\/+$/, "")}`;
const webhookUrl = process.env.WEBHOOK_URL ||
    ((process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL) &&
        `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL}/api/webhook`);

// Vercel terminates the proxy before Express; trust its single forwarded hop for rate limiting.
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({
    origin: frontendOrigin,
    credentials: true,
    methods: ["GET", "POST", "PATCH"],
    allowedHeaders: ["Content-Type"]
}));
app.use(express.json({ limit: "30kb" }));
app.use(express.static(publicDirectory));

const checkoutLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false
});

const sessionCookie = "monark_session";
const storeCoordinates = { latitude: -23.4965617, longitude: -46.8532208 };
const whatsappNumber = "5511989480983";
const deliveryBaseFee = 5;
const deliveryPerKilometer = 2;

const createSession = async email => {
    const sessionId = crypto.randomUUID();
    await db.collection("sessions").doc(sessionId).set({
        email,
        expiresAt: new Date(Date.now() + cookieOptions.maxAge)
    });
    return sessionId;
};
const cookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24 * 30,
    path: "/"
};

const hashPassword = password => new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
        if (error) return reject(error);
        resolve(`${salt}:${derivedKey.toString("hex")}`);
    });
});

const verifyPassword = (password, storedHash) => new Promise(resolve => {
    const [salt, key] = String(storedHash || "").split(":");
    if (!salt || !key) return resolve(false);
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
        if (error) return resolve(false);
        const expected = Buffer.from(key, "hex");
        resolve(expected.length === derivedKey.length && crypto.timingSafeEqual(expected, derivedKey));
    });
});

const getSession = async req => {
    const rawCookie = req.headers.cookie || "";
    const sessionId = rawCookie.split(";").map(value => value.trim()).find(value => value.startsWith(`${sessionCookie}=`))?.split("=").slice(1).join("=");
    if (!sessionId) return null;
    const session = await db.collection("sessions").doc(sessionId).get();
    if (!session.exists || session.data().expiresAt.toMillis() < Date.now()) return null;
    return session.data();
};

app.post("/api/auth/register", authLimiter, async (req, res) => {
    const name = String(req.body?.name || "").trim();
    const phone = String(req.body?.phone || "").replace(/\D/g, "");
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (name.length < 2 || name.length > 80 || phone.length < 10 || phone.length > 15 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || password.length > 128) {
        return res.status(400).json({ error: "Informe nome, telefone válido, e-mail válido e senha com pelo menos 8 caracteres." });
    }
    try {
        const userRef = db.collection("users").doc(email);
        if ((await userRef.get()).exists) return res.status(409).json({ error: "Este e-mail já está cadastrado." });
        await userRef.set({ name, phone, email, passwordHash: await hashPassword(password), createdAt: FieldValue.serverTimestamp() });
        const sessionId = await createSession(email);
        res.cookie(sessionCookie, sessionId, cookieOptions).status(201).json({ email });
    } catch (error) {
        console.error("Erro ao criar conta:", error);
        res.status(500).json({ error: "Não foi possível criar sua conta." });
    }
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    try {
        const user = await db.collection("users").doc(email).get();
        if (!user.exists || !(await verifyPassword(password, user.data().passwordHash))) {
            return res.status(401).json({ error: "E-mail ou senha inválidos." });
        }
        const sessionId = crypto.randomUUID();
        await db.collection("sessions").doc(sessionId).set({ email, expiresAt: new Date(Date.now() + cookieOptions.maxAge) });
        res.cookie(sessionCookie, sessionId, cookieOptions).json({ email });
    } catch (error) {
        console.error("Erro ao entrar:", error);
        res.status(500).json({ error: "Não foi possível entrar agora." });
    }
});

app.get("/api/auth/me", async (req, res) => {
    try {
        const session = await getSession(req);
        if (!session) return res.json({ user: null });
        const user = await db.collection("users").doc(session.email).get();
        res.json({ user: user.exists ? { email: session.email, name: user.data().name || "", phone: user.data().phone || "" } : null });
    } catch { res.status(500).json({ error: "Não foi possível verificar a sessão." }); }
});

app.patch("/api/auth/profile", async (req, res) => {
    try {
        const session = await getSession(req);
        const name = String(req.body?.name || "").trim();
        const phone = String(req.body?.phone || "").replace(/\D/g, "");
        if (!session) return res.status(401).json({ error: "Faça login para editar seu perfil." });
        if (name.length < 2 || name.length > 80 || phone.length < 10 || phone.length > 15) return res.status(400).json({ error: "Informe nome e telefone válidos." });
        await db.collection("users").doc(session.email).set({ name, phone, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        res.json({ email: session.email, name, phone });
    } catch (error) {
        console.error("Erro ao atualizar perfil:", error);
        res.status(500).json({ error: "Não foi possível atualizar seu perfil." });
    }
});

app.post("/api/auth/logout", async (req, res) => {
    const rawCookie = req.headers.cookie || "";
    const sessionId = rawCookie.split(";").map(value => value.trim()).find(value => value.startsWith(`${sessionCookie}=`))?.split("=").slice(1).join("=");
    if (sessionId) await db.collection("sessions").doc(sessionId).delete().catch(() => {});
    res.clearCookie(sessionCookie, { ...cookieOptions, maxAge: undefined }).json({ ok: true });
});

const lookupDeliveryAddress = async postalCode => {
    const normalizedPostalCode = String(postalCode || "").replace(/\D/g, "");
    if (!/^\d{8}$/.test(normalizedPostalCode)) throw new Error("Informe um CEP válido com 8 dígitos.");
    const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${normalizedPostalCode}`, {
        signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error(response.status === 404 ? "CEP não encontrado." : "Não foi possível consultar o CEP. Tente novamente.");
    const data = await response.json();
    const latitude = Number(data.location?.coordinates?.latitude);
    const longitude = Number(data.location?.coordinates?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error("Não foi possível calcular a distância para este CEP.");
    const toRadians = degrees => degrees * Math.PI / 180;
    const lat1 = toRadians(storeCoordinates.latitude);
    const lat2 = toRadians(latitude);
    const deltaLatitude = lat2 - lat1;
    const deltaLongitude = toRadians(longitude - storeCoordinates.longitude);
    const haversine = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLongitude / 2) ** 2;
    const distanceKm = 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
    const deliveryFee = Math.round((deliveryBaseFee + deliveryPerKilometer * distanceKm) * 100) / 100;
    return {
        postalCode: normalizedPostalCode,
        street: data.street || "",
        neighborhood: data.neighborhood || "",
        city: data.city || "",
        state: data.state || "",
        distanceKm: Math.round(distanceKm * 10) / 10,
        deliveryFee,
        eligible: distanceKm <= 20
    };
};

app.post("/api/delivery/quote", checkoutLimiter, async (req, res) => {
    try {
        const address = await lookupDeliveryAddress(req.body?.postalCode);
        if (!address.eligible) return res.status(422).json({ ...address, error: "Este endereço fica a mais de 20 km da cafeteria e está fora da área de entrega." });
        res.json(address);
    } catch (error) {
        res.status(400).json({ error: error.message || "Não foi possível calcular o frete." });
    }
});

app.get("/api/health", async (req, res) => {
    try {
        await db.collection("products").limit(1).get();
        res.json({ status: "ok", database: "connected" });
    } catch (error) {
        console.error("Erro ao verificar conexão com o Firestore:", error);
        res.status(503).json({ status: "error", database: "disconnected" });
    }
});

app.get("/api/products", async (req, res) => {
    try {
        const snapshot = await db.collection("products").orderBy("id").get();
        const products = snapshot.docs
            .map(document => document.data())
            .filter(product => product.active === true)
            .map(({ id, name, description, price, image, category }) => ({
                id,
                name,
                description,
                price,
                image,
                category
            }));
        res.json(products);
    } catch (error) {
        console.error("Erro ao listar produtos:", error);
        res.status(500).json({ error: "Não foi possível carregar o cardápio." });
    }
});

app.post("/api/checkout", checkoutLimiter, async (req, res) => {
    const { notes, items, postalCode, houseNumber } = req.body ?? {};
    const session = await getSession(req);
    if (!session) return res.status(401).json({ error: "Entre na sua conta antes de finalizar o pedido." });

    const userSnapshot = await db.collection("users").doc(session.email).get();
    const user = userSnapshot.data() || {};
    const customerName = String(user.name || "").trim();
    const customerPhone = String(user.phone || "").replace(/\D/g, "");
    const normalizedHouseNumber = String(houseNumber || "").trim();
    if (!userSnapshot.exists || customerName.length < 2 || customerPhone.length < 10) {
        return res.status(400).json({ error: "Atualize seu nome e telefone na sua conta antes de finalizar." });
    }
    if (!normalizedHouseNumber || normalizedHouseNumber.length > 20 ||
        (typeof notes !== "undefined" && (typeof notes !== "string" || notes.length > 500)) ||
        !Array.isArray(items) || items.length < 1 || items.length > 30) {
        return res.status(400).json({ error: "Confira o endereço, as observações e os produtos do pedido." });
    }

    const quantities = new Map();
    for (const item of items) {
        const id = Number(item?.id);
        const quantity = Number(item?.quantity);
        if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 20) {
            return res.status(400).json({ error: "Produto ou quantidade inválida." });
        }
        quantities.set(id, (quantities.get(id) || 0) + quantity);
    }
    if ([...quantities.values()].some(quantity => quantity > 20)) return res.status(400).json({ error: "O limite é de 20 unidades por produto." });

    try {
        const delivery = await lookupDeliveryAddress(postalCode);
        if (!delivery.eligible) return res.status(422).json({ error: "Este endereço fica a mais de 20 km da cafeteria e está fora da área de entrega." });
        const orderId = crypto.randomUUID();
        const orderRef = db.collection("orders").doc(orderId);
        const orderItems = await db.runTransaction(async transaction => {
            const ids = [...quantities.keys()].sort((a, b) => a - b);
            const refs = ids.map(id => db.collection("products").doc(String(id)));
            const documents = await transaction.getAll(...refs);
            if (documents.some(document => !document.exists || document.data().active !== true)) return null;

            const preparedItems = documents.map(document => {
                const product = document.data();
                const quantity = quantities.get(product.id);
                const unitPrice = Number(product.price);
                return { id: product.id, name: product.name, quantity, unitPrice, subtotal: Number((unitPrice * quantity).toFixed(2)) };
            });
            const productsTotal = Number(preparedItems.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2));
            const total = Number((productsTotal + delivery.deliveryFee).toFixed(2));
            transaction.create(orderRef, {
                customerName,
                customerEmail: session.email,
                customerPhone,
                address: {
                    postalCode: delivery.postalCode,
                    street: delivery.street,
                    neighborhood: delivery.neighborhood,
                    city: delivery.city,
                    state: delivery.state,
                    houseNumber: normalizedHouseNumber
                },
                distanceKm: delivery.distanceKm,
                deliveryFee: delivery.deliveryFee,
                productsTotal,
                notes: (notes || "").trim(),
                items: preparedItems,
                total,
                status: "awaiting_whatsapp_confirmation",
                channel: "whatsapp",
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
            });
            return { preparedItems, productsTotal, total };
        });

        if (!orderItems) return res.status(400).json({ error: "Um ou mais produtos não estão disponíveis." });
        const addressLine = [delivery.street, normalizedHouseNumber, delivery.neighborhood, `${delivery.city} - ${delivery.state}`, `CEP ${delivery.postalCode}`].filter(Boolean).join(", ");
        const messageLines = [
            `Olá! Quero finalizar o pedido ${orderId.slice(0, 8)}.`,
            `Cliente: ${customerName}`,
            `Telefone: ${customerPhone}`,
            `Endereço: ${addressLine}`,
            "",
            "Produtos:",
            ...orderItems.preparedItems.map(item => `${item.quantity}x ${item.name} — ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.subtotal)}`),
            `Subtotal: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(orderItems.productsTotal)}`,
            `Distância: ${delivery.distanceKm} km`,
            `Frete: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(delivery.deliveryFee)}`,
            `Total: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(orderItems.total)}`,
            ...(notes?.trim() ? [`Observações: ${notes.trim()}`] : [])
        ];
        const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(messageLines.join("\n"))}`;
        res.status(201).json({ orderId, whatsappUrl, productsTotal: orderItems.productsTotal, deliveryFee: delivery.deliveryFee, total: orderItems.total });
    } catch (error) {
        console.error("Erro ao preparar pedido para WhatsApp:", error);
        res.status(500).json({ error: error.message || "Não foi possível criar seu pedido. Tente novamente." });
    }
});

function validWebhookSignature(req) {
    const signatureHeader = req.get("x-signature");
    const requestId = req.get("x-request-id");
    const paymentId = String(req.query["data.id"] || req.body?.data?.id || "");

    if (!signatureHeader || !requestId || !/^\d+$/.test(paymentId)) return false;

    const parts = Object.fromEntries(
        signatureHeader.split(",").map(part => {
            const [key, ...value] = part.trim().split("=");
            return [key, value.join("=")];
        })
    );

    const timestamp = parts.ts;
    const received = parts.v1;
    if (!timestamp || !received || !/^[a-f0-9]{64}$/i.test(received)) return false;

    const manifest = `id:${paymentId};request-id:${requestId};ts:${timestamp};`;
    if (!process.env.MP_WEBHOOK_SECRET) return false;

    const expected = crypto.createHmac("sha256", process.env.MP_WEBHOOK_SECRET)
        .update(manifest).digest("hex");
    const receivedBuffer = Buffer.from(received, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");

    return receivedBuffer.length === expectedBuffer.length &&
        crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

app.post("/api/webhook", async (req, res) => {
    if (!process.env.MP_WEBHOOK_SECRET || !process.env.MP_ACCESS_TOKEN) {
        return res.sendStatus(503);
    }
    if (!validWebhookSignature(req)) {
        return res.status(401).send("Assinatura inválida.");
    }

    const paymentId = String(req.query["data.id"] || req.body?.data?.id || "");

    try {
        const mpResponse = await fetch(
            `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
            {
                headers: { "Authorization": `Bearer ${process.env.MP_ACCESS_TOKEN}` },
                signal: AbortSignal.timeout(15000)
            }
        );

        if (!mpResponse.ok) {
            console.error("Falha ao consultar pagamento no Mercado Pago:", mpResponse.status);
            return res.sendStatus(502);
        }

        const payment = await mpResponse.json();
        const orderId = String(payment.external_reference || "");
        if (!/^[\da-f-]{36}$/i.test(orderId)) return res.sendStatus(400);

        const orderRef = db.collection("orders").doc(orderId);
        const paymentRef = db.collection("paymentEvents").doc(paymentId);
        const mappedStatus = String(payment.status || "pending");
        const paymentAmount = Number(payment.transaction_amount);

        const result = await db.runTransaction(async transaction => {
            const [orderDoc, paymentDoc] = await transaction.getAll(orderRef, paymentRef);
            if (!orderDoc.exists) return "not-found";
            if (paymentDoc.exists && paymentDoc.data().orderId !== orderId) return "payment-conflict";

            const order = orderDoc.data();
            const expectedAmount = Number(order.total);
            if (payment.currency_id !== "BRL" ||
                !Number.isFinite(paymentAmount) ||
                paymentAmount.toFixed(2) !== expectedAmount.toFixed(2)) {
                return "amount-mismatch";
            }

            let orderStatus = order.status;
            if (mappedStatus === "approved") orderStatus = "paid";
            else if (mappedStatus === "rejected") orderStatus = "payment_failed";
            else if (mappedStatus === "cancelled") orderStatus = "cancelled";
            else if (mappedStatus === "refunded" || mappedStatus === "charged_back") orderStatus = "refunded";
            else if (["pending", "in_process", "in_mediation"].includes(mappedStatus)) {
                if (order.status !== "paid" && order.status !== "refunded") orderStatus = "pending";
            }

            transaction.set(paymentRef, { orderId, paymentId, status: mappedStatus }, { merge: true });
            transaction.update(orderRef, {
                status: orderStatus,
                "payment.paymentId": paymentId,
                "payment.status": mappedStatus,
                "payment.updatedAt": FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
            });
            return "updated";
        });

        if (result === "not-found") return res.sendStatus(404);
        if (result === "payment-conflict") return res.sendStatus(409);
        if (result === "amount-mismatch") {
            console.error("Valor ou moeda divergente no pagamento", paymentId);
            return res.sendStatus(400);
        }
        return res.sendStatus(200);
    } catch (error) {
        console.error("Erro no webhook:", error);
        return res.sendStatus(500);
    }
});

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: "Erro interno do servidor." });
});

export default app;

if (process.env.VERCEL !== "1") {
    const server = app.listen(PORT, () => {
        console.log(`Monark API disponível em http://localhost:${PORT}`);
    });

    function shutdown() {
        server.close();
    }
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}
