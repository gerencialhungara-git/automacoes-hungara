import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./env.js";

const s3 = new S3Client({});

/** 15 minutos: tempo de baixar, curto o bastante para uma URL vazada envelhecer. */
export const VALIDADE_URL_S = 900;

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const chaveJob = (jobId: string) => `logistica/jobs/${jobId}.json`;
export const chavePlanilha = (jobId: string, nome: string) => `logistica/${jobId}/${nome}`;

export async function guardarJson(chave: string, valor: unknown): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: env().DADOS_BUCKET,
      Key: chave,
      Body: JSON.stringify(valor),
      ContentType: "application/json",
    }),
  );
}

export async function lerJson<T>(chave: string): Promise<T | undefined> {
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: env().DADOS_BUCKET, Key: chave }));
    const texto = await r.Body?.transformToString();
    return texto === undefined ? undefined : (JSON.parse(texto) as T);
  } catch (erro) {
    if ((erro as { name?: string }).name === "NoSuchKey") return undefined;
    throw erro;
  }
}

export async function guardarPlanilha(chave: string, conteudo: Buffer): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: env().DADOS_BUCKET,
      Key: chave,
      Body: conteudo,
      ContentType: XLSX,
    }),
  );
}

/**
 * URL temporária de download. Não é guardada em lugar nenhum: uma URL pré-assinada é
 * credencial ao portador, e deixá-la parada num JSON no S3 seria vazamento em espera.
 */
export function urlTemporaria(chave: string, nomeArquivo: string): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: env().DADOS_BUCKET,
      Key: chave,
      ResponseContentDisposition: `attachment; filename="${nomeArquivo}"`,
    }),
    { expiresIn: VALIDADE_URL_S },
  );
}
