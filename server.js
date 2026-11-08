import express from "express";
import backendApp from "./backend/server.js";

const app = express();
app.use(backendApp);

export default app;
