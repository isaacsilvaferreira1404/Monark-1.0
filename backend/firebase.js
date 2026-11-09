import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import dotenv from "dotenv";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

dotenv.config();

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "monark-7d352";
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const localAdcPath = process.env.APPDATA
    ? join(process.env.APPDATA, "gcloud", "application_default_credentials.json")
    : join(homedir(), ".config", "gcloud", "application_default_credentials.json");
const cloudRuntime = process.env.K_SERVICE || process.env.K_REVISION ||
    process.env.GAE_ENV || process.env.GCE_METADATA_HOST;

let credential;
if (serviceAccountJson) {
    let normalizedValue = serviceAccountJson.trim();
    normalizedValue = normalizedValue.replace(/^FIREBASE_SERVICE_ACCOUNT_JSON\s*=\s*/, "");
    if ((normalizedValue.startsWith("'") && normalizedValue.endsWith("'")) ||
        (normalizedValue.startsWith('"') && normalizedValue.endsWith('"'))) {
        normalizedValue = normalizedValue.slice(1, -1);
    }

    let serviceAccount;
    try {
        const candidates = [
            normalizedValue,
            normalizedValue.replace(/^['"]|['"]$/g, ""),
            normalizedValue.replace(/\\\\(["'])/g, "$1"),
        ];

        for (const candidate of candidates) {
            try {
                const parsedValue = JSON.parse(candidate);
                serviceAccount = typeof parsedValue === "string" ? JSON.parse(parsedValue) : parsedValue;
                break;
            } catch {
                const jsonLikeValue = candidate
                    .replace(/([{,])\s*'([^']+)'\s*:/g, '$1"$2":')
                    .replace(/:\s*'([^']*)'/g, ':"$1"');
                try {
                    serviceAccount = JSON.parse(jsonLikeValue);
                    break;
                } catch {
                    continue;
                }
            }
        }

        if (!serviceAccount) {
            throw new Error("Formato JSON não reconhecido");
        }
    } catch (error) {
        throw new Error(
            "FIREBASE_SERVICE_ACCOUNT_JSON deve conter o JSON completo da conta de serviço.",
            { cause: error },
        );
    }
    credential = cert(serviceAccount);
} else {
    if (serviceAccountPath && !existsSync(serviceAccountPath)) {
        throw new Error("GOOGLE_APPLICATION_CREDENTIALS aponta para um arquivo que não existe.");
    }
    const hasApplicationCredentials = serviceAccountPath || existsSync(localAdcPath) || cloudRuntime || process.env.VERCEL === "1";
    credential = hasApplicationCredentials ? applicationDefault() : undefined;
}

const firebaseApp = getApps().length
    ? getApps()[0]
    : initializeApp({
        ...(credential ? { credential } : {}),
        projectId
    });

export const db = getFirestore(firebaseApp);
