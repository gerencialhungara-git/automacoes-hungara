/**
 * Único lugar do projeto que conhece o HTML do Sischef.
 * Tela mudou? É aqui que se mexe — e só aqui.
 *
 * Extraídos da gravação de 06/09/2026 (`npm run gravar`).
 *
 * O Sischef é JSF/PrimeFaces: os ids de verdade são gerados pelo servidor
 * (`j_idt217:0:data1_input`) e mudam de posição quando eles mexem na tela.
 * Por isso ancoramos em papel/texto sempre que dá, e nos campos de data usamos
 * só o SUFIXO do id (`data1_input`), que é a parte com significado.
 */
export const seletores = {
  login: {
    usuario: { role: "textbox", name: "Usuário" },
    senha: { role: "textbox", name: "Senha" },
    entrar: { role: "button", name: "Acessar" },
    /** Aparece depois do login; é como sabemos que a sessão está de pé. */
    marcaLogado: "text=Relatórios",
  },
  pedidosDeVenda: {
    menuRelatorios: "text=bar_chart Relatórios expand_more",
    submenuExcel: { role: "link", name: "table_chart Em excel" },
    grupoVendas: { role: "link", name: "Vendas" },
    relatorio: { role: "link", name: "Pedidos de venda" },
    /** PrimeFaces Calendar: o <input> por trás do calendário, formato dd/MM/aaaa. */
    dataInicio: 'input[id$=":data1_input"]',
    dataFim: 'input[id$=":data2_input"]',
    gerar: { role: "button", name: "Gerar arquivo" },
    baixar: { role: "link", name: "Clique aqui para baixar" },
  },
} as const;

/** URL da tela de exportação. `id=8` é o "Pedidos de venda" no Sischef. */
export const urls = {
  base: "https://sistema.sischef.com/",
  exportacao: "https://sistema.sischef.com/admin/relatorio/exportacao.jsf",
} as const;

export const ID_RELATORIO_PEDIDOS_DE_VENDA = 8;
