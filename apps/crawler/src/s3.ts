import { PutObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./env.js";

const s3 = new S3Client({});

/** 15 minutos: tempo de baixar, curto o bastante para uma URL vazada envelhecer. */
const VALIDADE_URL_S = 900;

export async function guardar(
  chave: string,
  conteudo: Buffer | string,
  contentType: string,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: env().REPORTS_BUCKET,
      Key: chave,
      Body: conteudo,
      ContentType: contentType,
    }),
  );
}

/**
 * URL temporária de download. Não guardamos essa URL em lugar nenhum: ela é uma
 * credencial ao portador, e é gerada de novo a cada resposta.
 */
export function urlTemporaria(chave: string): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: env().REPORTS_BUCKET, Key: chave }), {
    expiresIn: VALIDADE_URL_S,
  });
}

export const validadeUrlSegundos = VALIDADE_URL_S;
