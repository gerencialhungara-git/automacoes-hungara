import { z } from "zod";

const EnvSchema = z.object({
  /** Function URL do crawler, com barra no fim. */
  CRAWLER_URL: z.string().url(),
  /** Chave do crawler em texto — esta Lambda é cliente dele. */
  CRAWLER_API_KEY: z.string().min(1),
  /** SHA-256 das chaves que ESTA Lambda aceita. Nunca a chave em si. */
  API_KEYS_SHA256: z.string().min(64),
  DADOS_BUCKET: z.string().min(1),
  APP_VERSION: z.string().default("dev"),
  /** A Lambda injeta sozinha; usada para invocar a si mesma. */
  AWS_LAMBDA_FUNCTION_NAME: z.string().default("automacoes-hungara-logistica"),
});

export type Env = z.infer<typeof EnvSchema>;

let cache: Env | undefined;

/** Valida uma vez, no cold start, e falha alto se faltar alguma coisa. */
export function env(): Env {
  if (!cache) cache = EnvSchema.parse(process.env);
  return cache;
}
