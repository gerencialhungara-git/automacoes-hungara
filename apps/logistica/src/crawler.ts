import type { Linha } from "@automacoes/shared";
import { env } from "./env.js";

interface RespostaCrawler {
  linhas: number;
  dados: Linha[] | null;
  dadosUrl?: string;
  arquivo: { chave: string; url: string; bytes: number };
}

/**
 * Pede ao crawler o relatório "Pedidos de venda" do período.
 *
 * Chamada síncrona de propósito: aqui não existe o teto de 30 s do API Gateway (esta
 * Lambda tem 300 s e está rodando fora da requisição HTTP), então esperar os ~45 s de
 * cold start do Chromium é aceitável.
 */
export async function baixarRelatorio(inicio: string, fim: string): Promise<Linha[]> {
  const resposta = await fetch(env().CRAWLER_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": env().CRAWLER_API_KEY },
    body: JSON.stringify({ inicio, fim, relatorio: "pedidos-de-venda" }),
  });

  if (!resposta.ok) {
    const corpo = await resposta.text();
    throw new Error(`o crawler devolveu ${resposta.status}: ${corpo.slice(0, 300)}`);
  }

  const dados = (await resposta.json()) as RespostaCrawler;

  // Período longo passa do limite de resposta do crawler e vira arquivo no S3.
  if (dados.dados === null) {
    if (dados.dadosUrl === undefined) {
      throw new Error("o crawler não devolveu nem os dados nem a URL deles");
    }
    const json = await fetch(dados.dadosUrl);
    if (!json.ok) throw new Error(`não consegui baixar os dados do S3: ${json.status}`);
    return (await json.json()) as Linha[];
  }

  return dados.dados;
}
