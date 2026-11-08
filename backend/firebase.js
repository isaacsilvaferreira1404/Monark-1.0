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
    let serviceAccount;
    try {
        serviceAccount = JSON.parse(serviceAccountJson);
    } catch (error) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON deve conter um JSON válido.", { cause: error });
    }
    credential = cert(serviceAccount);
} else {
    if (serviceAccountPath && !existsSync(serviceAccountPath)) {
        throw new Error("GOOGLE_APPLICATION_CREDENTIALS aponta para um arquivo que não existe.");
    }
    if (!serviceAccountPath && !existsSync(localAdcPath) && !cloudRuntime && process.env.VERCEL !== "1") {
        throw new Error(
            "Credenciais do Firebase ausentes. Configure FIREBASE_SERVICE_ACCOUNT_JSON ou " +
            "GOOGLE_APPLICATION_CREDENTIALS no .env, ou faça login com " +
            "`gcloud auth application-default login`."
        );
    }
    credential = applicationDefault();
}

const firebaseApp = getApps().length
    ? getApps()[0]
    : initializeApp({
        credential,
        projectId
    });

export const db = getFirestore(firebaseApp);
