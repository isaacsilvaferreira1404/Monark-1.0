import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import dotenv from "dotenv";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

dotenv.config();

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "monark-7d352";
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const localAdcPath = process.env.APPDATA
    ? join(process.env.APPDATA, "gcloud", "application_default_credentials.json")
    : join(homedir(), ".config", "gcloud", "application_default_credentials.json");
const cloudRuntime = process.env.K_SERVICE || process.env.K_REVISION ||
    process.env.GAE_ENV || process.env.GCE_METADATA_HOST;

if (serviceAccountPath && !existsSync(serviceAccountPath)) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS aponta para um arquivo que não existe.");
}
if (!serviceAccountPath && !existsSync(localAdcPath) && !cloudRuntime) {
    throw new Error(
        "Credenciais do Firebase ausentes. Configure GOOGLE_APPLICATION_CREDENTIALS no .env " +
        "ou faça login com `gcloud auth application-default login`."
    );
}

const firebaseApp = getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: applicationDefault(),
        projectId
    });

export const db = getFirestore(firebaseApp);
