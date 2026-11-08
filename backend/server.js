import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import crypto from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firebase.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

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

app.use(helmet());
app.use(cors({
    origin: frontendOrigin,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"]
}));
app.use(express.json({ limit: "30kb" }));

const checkoutLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false
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
    if (!process.env.MP_ACCESS_TOKEN || !webhookUrl) {
        return res.status(503).json({
            error: "Configure MP_ACCESS_TOKEN e a URL pública do webhook para habilitar pagamentos."
        });
    }

    const { customer, items } = req.body ?? {};

    if (!customer || typeof customer.name !== "string" ||
        typeof customer.email !== "string" ||
        !customer.name.trim() || customer.name.length > 120 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email) ||
        customer.email.length > 150 ||
        (customer.notes !== undefined &&
         (typeof customer.notes !== "string" || customer.notes.length > 500)) ||
        !Array.isArray(items) || items.length < 1 || items.length > 30) {
        return res.status(400).json({ error: "Confira os dados do cliente e os produtos do pedido." });
    }

    const quantities = new Map();
    for (const item of items) {
        const id = Number(item?.id);
        const quantity = Number(item?.quantity);
        if (!Number.isSafeInteger(id) || id <= 0 ||
            !Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 20) {
            return res.status(400).json({ error: "Produto ou quantidade inválida." });
        }
        quantities.set(id, (quantities.get(id) || 0) + quantity);
    }
    if ([...quantities.values()].some(quantity => quantity > 20)) {
        return res.status(400).json({ error: "O limite é de 20 unidades por produto." });
    }

    const orderId = crypto.randomUUID();
    const orderRef = db.collection("orders").doc(orderId);
    let orderCreated = false;

    try {
        const orderItems = await db.runTransaction(async transaction => {
            const ids = [...quantities.keys()].sort((a, b) => a - b);
            const productRefs = ids.map(id => db.collection("products").doc(String(id)));
            const productDocs = await transaction.getAll(...productRefs);

            if (productDocs.some(document => !document.exists || document.data().active !== true)) {
                return null;
            }

            const preparedItems = productDocs.map(document => {
                const product = document.data();
                const quantity = quantities.get(product.id);
                const unitPrice = Number(product.price);
                return {
                    id: product.id,
                    name: product.name,
                    quantity,
                    unitPrice,
                    subtotal: Number((unitPrice * quantity).toFixed(2))
                };
            });
            const total = Number(preparedItems.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2));

            transaction.create(orderRef, {
                customerName: customer.name.trim(),
                customerEmail: customer.email.trim().toLowerCase(),
                notes: (customer.notes || "").trim(),
                items: preparedItems,
                total,
                status: "pending",
                payment: {
                    provider: "mercado_pago",
                    preferenceId: null,
                    paymentId: null,
                    status: "pending",
                    amount: total
                },
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
            });

            return preparedItems;
        });

        if (!orderItems) {
            return res.status(400).json({ error: "Um ou mais produtos não estão disponíveis." });
        }
        orderCreated = true;

        const preferencePayload = {
            items: orderItems.map(item => ({
                id: String(item.id),
                title: item.name,
                quantity: item.quantity,
                unit_price: item.unitPrice,
                currency_id: "BRL"
            })),
            payer: { name: customer.name.trim(), email: customer.email.trim().toLowerCase() },
            external_reference: orderId,
            back_urls: {
                success: `${frontendBaseUrl}/?pagamento=sucesso`,
                failure: `${frontendBaseUrl}/?pagamento=falhou`,
                pending: `${frontendBaseUrl}/?pagamento=pendente`
            },
            auto_return: "approved",
            notification_url: webhookUrl
        };

        const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.MP_ACCESS_TOKEN}`
            },
            body: JSON.stringify(preferencePayload),
            signal: AbortSignal.timeout(15000)
        });

        const mpData = await mpResponse.json();
        if (!mpResponse.ok || !mpData.id || !mpData.init_point) {
            console.error("Erro Mercado Pago:", mpData);
            await orderRef.update({
                status: "payment_error",
                updatedAt: FieldValue.serverTimestamp()
            });
            return res.status(502).json({ error: "O serviço de pagamento não está disponível. Tente novamente." });
        }

        await orderRef.update({
            "payment.preferenceId": String(mpData.id),
            updatedAt: FieldValue.serverTimestamp()
        });

        res.status(201).json({ orderId, checkoutUrl: mpData.init_point });
    } catch (error) {
        console.error("Erro no checkout:", error);
        if (orderCreated) {
            try {
                await orderRef.update({
                    status: "payment_error",
                    updatedAt: FieldValue.serverTimestamp()
                });
            } catch (updateError) {
                console.error("Erro ao atualizar o status do pedido:", updateError);
            }
        }
        res.status(500).json({ error: "Não foi possível criar seu pedido. Tente novamente." });
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
