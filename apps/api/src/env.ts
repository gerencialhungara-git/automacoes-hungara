import { z } from "zod";

const EnvSchema = z.object({
  SISCHEF_USUARIO: z.string().min(1),
  SISCHEF_SENHA: z.string().min(1),
  /** SHA-256 (hex) das chaves aceitas, separados por vírgula. Nunca a chave em si. */
  API_KEYS_SHA256: z.string().min(64),
  REPORTS_BUCKET: z.string().min(1),
  APP_VERSION: z.string().default("dev"),
});

export type Env = z.infer<typeof EnvSchema>;

let cache: Env | undefined;

/** Valida uma vez, na primeira chamada, e falha alto se faltar alguma coisa. */
export function env(): Env {
  if (!cache) cache = EnvSchema.parse(process.env);
  return cache;
}
