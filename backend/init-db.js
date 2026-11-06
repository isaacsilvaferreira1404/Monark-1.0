import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { db } from "./firebase.js";

async function initializeDatabase() {
    const productsPath = fileURLToPath(new URL("./products.json", import.meta.url));
    const products = JSON.parse(await readFile(productsPath, "utf8"));
    const productRefs = products.map(product =>
        db.collection("products").doc(String(product.id))
    );

    const added = await db.runTransaction(async transaction => {
        const snapshots = await transaction.getAll(...productRefs);
        let count = 0;

        snapshots.forEach((snapshot, index) => {
            if (!snapshot.exists) {
                transaction.create(productRefs[index], products[index]);
                count += 1;
            }
        });

        return count;
    });

    console.log(`Firestore inicializado: ${added} produtos adicionados; produtos existentes foram preservados.`);
}

initializeDatabase().catch(error => {
    console.error("Falha ao inicializar o Firestore:", error.message);
    process.exitCode = 1;
});
