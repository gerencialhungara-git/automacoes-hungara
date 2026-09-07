import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { chaveValida } from "../src/chaveApi.js";

const hash = (s: string) => createHash("sha256").update(s).digest("hex");

describe("chaveValida", () => {
  it("aceita a chave cujo hash está na lista", () => {
    expect(chaveValida("segredo", hash("segredo"))).toBe(true);
  });

  it("recusa chave errada, vazia e ausente", () => {
    expect(chaveValida("outra", hash("segredo"))).toBe(false);
    expect(chaveValida("", hash("segredo"))).toBe(false);
    expect(chaveValida(undefined, hash("segredo"))).toBe(false);
  });

  it("aceita qualquer uma das chaves durante a rotação", () => {
    const lista = `${hash("antiga")}, ${hash("nova")}`;
    expect(chaveValida("antiga", lista)).toBe(true);
    expect(chaveValida("nova", lista)).toBe(true);
    expect(chaveValida("terceira", lista)).toBe(false);
  });

  it("não estoura com hash malformado na lista", () => {
    expect(chaveValida("segredo", `naoehhex, ${hash("segredo")}`)).toBe(true);
  });
});
