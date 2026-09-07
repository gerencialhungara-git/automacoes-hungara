// Sobe a API local, para testar o contrato sem AWS:
//   npm run dev -w @automacoes/logistica-lambda
import { serve } from "@hono/node-server";
import { criarApp } from "./app.js";

const port = Number(process.env.PORT ?? 3779);
serve({ fetch: criarApp().fetch, port });
console.log(`API da Logística local em http://localhost:${port}`);
