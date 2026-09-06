// Sobe a API local, para testar o contrato sem AWS:
//   npm run dev -w @crawler/api
import { serve } from "@hono/node-server";
import { criarApp } from "./app.js";

const port = Number(process.env.PORT ?? 3778);
serve({ fetch: criarApp().fetch, port });
console.log(`API local em http://localhost:${port}`);
