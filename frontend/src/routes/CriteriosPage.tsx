import { Card } from "../components/common/Card";
import styles from "./CriteriosPage.module.css";

interface CascadeStep {
  n: number;
  pergunta: string;
  simResultado: string;
  simTipo: "conta" | "nao-conta";
}

const PRODUTOS_ESPECIAIS = [
  { chave: "IN", regra: 'Descrição do produto começa com "IN "' },
  { chave: "FL", regra: 'Descrição do produto começa com "FL "' },
  { chave: "SAZ", regra: 'Descrição do produto começa com "SAZ " (sazonal)' },
  { chave: "GRANEL", regra: 'Descrição do produto começa com "GRANEL "' },
  {
    chave: "Subgrupo especial",
    regra: "Subgrupo do produto é Aqua Plantas, Peixes, Animais, Plantas Aquáticas ou Plantas Naturais",
  },
];

const RUPTURA_CONDICAO = "Produto é de uma categoria especial (como citado acima) OU está marcado como Inativo";

const DDE_CASCADE: CascadeStep[] = [
  {
    n: 1,
    pergunta: "Fornecedor está na lista de exclusão fixa (tabela abaixo)?",
    simResultado: "Não conta no DDE",
    simTipo: "nao-conta",
  },
  {
    n: 2,
    pergunta: "Produto é especial (IN / FL / SAZ) OU inativo, e tem estoque disponível > 0?",
    simResultado: "Conta no DDE",
    simTipo: "conta",
  },
  {
    n: 3,
    pergunta: "Estoque disponível é ≤ 0?",
    simResultado: "Não conta no DDE",
    simTipo: "nao-conta",
  },
  {
    n: 4,
    pergunta: "Produto é especial (IN / FL / SAZ / GRANEL / Subgrupo) OU inativo?",
    simResultado: "Não conta no DDE",
    simTipo: "nao-conta",
  },
];

const FORNECEDORES_EXCLUIDOS_DDE = [
  { codigo: 7781, nome: "FREE MARKET CO LTDA" },
  { codigo: 12491, nome: "GRACEE COMPANY LIMITED" },
  { codigo: 12530, nome: "CHAOZHOU DAXING PORCELAIN CRAFT FTY" },
  { codigo: 13510, nome: "YIXING MINGJUN POTTERY CO LTD" },
  { codigo: 14354, nome: "SHIXIA HOLDING CO LTDA" },
  { codigo: 14850, nome: "COCREATION GRASS CORPORATION" },
  { codigo: 15440, nome: "GUANGZHOU QIHAO ARTIFICIAL FLOWERS" },
];

function CascadeRow({ step, isLast }: { step: CascadeStep; isLast: boolean }) {
  return (
    <div className={styles.cascadeRow}>
      <div className={styles.stepBadge}>{step.n}</div>
      <div className={styles.stepBody}>
        <div className={styles.stepPergunta}>{step.pergunta}</div>
        <div className={styles.stepBranches}>
          <span className={`${styles.branch} ${styles[step.simTipo]}`}>
            SIM → {step.simResultado}
          </span>
          <span className={styles.branchNao}>
            NÃO → {isLast ? "conta no DDE normalmente" : "vai para a regra seguinte ↓"}
          </span>
        </div>
      </div>
    </div>
  );
}

export function CriteriosPage() {
  return (
    <div className={styles.page}>
      <Card title="Critérios de Classificação — Ruptura e DDE">
        <p className={styles.intro}>
          Estas regras rodam direto na base (Oracle), antes dos dados chegarem ao dashboard. Alguns produtos
          — por não seguirem o padrão normal de reposição de uma loja (itens vivos, sazonais, a granel etc.)
          — são propositalmente desconsiderados dos cálculos de <strong>% de Ruptura</strong> e de{" "}
          <strong>DDE (Dias de Estoque)</strong>. Abaixo estão os critérios exatos.
        </p>
      </Card>

      <Card title='1. O que é um "Produto Especial"'>
        <p className={styles.sectionIntro}>
          Um produto entra num destes 5 grupos quando bate em qualquer uma das regras abaixo (não precisa bater
          em todas):
        </p>
        <div className={styles.badgeGrid}>
          {PRODUTOS_ESPECIAIS.map((p) => (
            <div key={p.chave} className={styles.badgeCard}>
              <div className={styles.badgeChave}>{p.chave}</div>
              <div className={styles.badgeRegra}>{p.regra}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="2. Este produto entra no cálculo de % Ruptura?">
        <div className={styles.cascadeRow}>
          <div className={styles.stepBadge}>?</div>
          <div className={styles.stepBody}>
            <div className={styles.stepPergunta}>{RUPTURA_CONDICAO}</div>
            <div className={styles.stepBranches}>
              <span className={`${styles.branch} ${styles["nao-conta"]}`}>SIM → Não entra no cálculo de Ruptura</span>
              <span className={`${styles.branch} ${styles.conta}`}>NÃO → Entra no cálculo de Ruptura normalmente</span>
            </div>
          </div>
        </div>
      </Card>

      <Card title="3. Este produto entra no cálculo de DDE (Dias de Estoque)?">
        <p className={styles.sectionIntro}>
          Aqui a lógica é sequencial — a primeira regra que bater decide o resultado, ignorando as seguintes:
        </p>
        <div className={styles.cascade}>
          {DDE_CASCADE.map((step, i) => (
            <CascadeRow key={step.n} step={step} isLast={i === DDE_CASCADE.length - 1} />
          ))}
        </div>
      </Card>

      <Card title="4. Fornecedores sempre excluídos do DDE">
        <p className={styles.sectionIntro}>
          Independente de qualquer outra regra, produtos destes 7 fornecedores nunca contam no cálculo de DDE
          (regra 1 da cascata acima) — em geral fornecedores importados/de reposição irregular, onde "dias de
          estoque" não é uma métrica confiável.
        </p>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Código</th>
              <th>Fornecedor</th>
            </tr>
          </thead>
          <tbody>
            {FORNECEDORES_EXCLUIDOS_DDE.map((f) => (
              <tr key={f.codigo}>
                <td className={styles.tableCodigo}>{f.codigo}</td>
                <td>{f.nome}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="5. Centro de Distribuição (CD)">
        <p className={styles.sectionIntro}>
          As unidades de código <strong>203</strong> e <strong>300</strong> são o Centro de Distribuição — não
          uma loja de venda ao público. Por isso, em todo o dashboard (Bridge, rankings e listagens de loja),
          essas unidades já são automaticamente excluídas de qualquer cálculo ou ranking por loja.
        </p>
      </Card>
    </div>
  );
}
