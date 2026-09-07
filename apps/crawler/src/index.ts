import { handle } from "hono/aws-lambda";
import { criarApp } from "./app.js";

export const handler = handle(criarApp());
