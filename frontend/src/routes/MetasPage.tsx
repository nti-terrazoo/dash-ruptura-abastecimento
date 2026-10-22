import { useMetasDde } from "../api/queries";
import { Card } from "../components/common/Card";
import { ErrorState } from "../components/common/ErrorState";
import { Skeleton } from "../components/common/Skeleton";
import { useSelectedDate } from "../hooks/useSelectedDate";
import { segmentColor } from "../lib/segmentos";
import styles from "./MetasPage.module.css";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function MetasPage() {
  const { selectedDate } = useSelectedDate();
  const metasQuery = useMetasDde(selectedDate);

  if (metasQuery.isError) return <ErrorState error={metasQuery.error} />;
  const data = metasQuery.data;

  return (
    <div className={styles.page}>
      <Card title="Metas de DDE (Dias de Estoque) por Segmento">
        <p className={styles.intro}>
          A meta de DDE é o número máximo de dias de estoque esperado para cada segmento. Ela é cadastrada mês
          a mês e usada na aba <strong>Rupt. Segmentos</strong>{" "}
          e na Apresentação Comitê: DDE acima da meta aparece como alerta.
        </p>
        <p className={styles.intro}>
          <strong>As metas valem por ano.</strong> Cada linha da tabela pertence a um ano, e o dashboard só usa
          as metas do ano da data selecionada na barra lateral. Se não houver metas cadastradas para esse ano,
          nenhuma meta é exibida.
        </p>
      </Card>

      <Card title={data ? `Metas de ${data.ano}` : "Metas"}>
        {!data ? (
          <Skeleton height={320} />
        ) : data.segmentos.length === 0 ? (
          <p className={styles.empty}>
            Nenhuma meta de DDE cadastrada para {data.ano}. Enquanto a tabela não tiver linhas desse ano, o
            dashboard não exibe meta de DDE.
          </p>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Segmento</th>
                    {MESES.map((mes, i) => (
                      <th key={mes} className={i + 1 === data.mes_referencia ? styles.mesAtual : undefined}>
                        {mes}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.segmentos.map((seg) => (
                    <tr key={seg.segmento} className={seg.exibido_no_dashboard ? undefined : styles.foraDash}>
                      <td className={styles.segNome}>
                        <span className={styles.dot} style={{ background: segmentColor(seg.segmento) }} />
                        {seg.segmento}
                      </td>
                      {seg.meses.map((m) => (
                        <td
                          key={m.mes}
                          className={[
                            styles.valor,
                            m.mes === data.mes_referencia ? styles.mesAtual : "",
                            m.herdada_de_marco ? styles.herdada : "",
                          ].join(" ")}
                          title={m.herdada_de_marco ? "Sem valor cadastrado: usa a meta de março" : undefined}
                        >
                          {m.aplicada != null ? `${Math.round(m.aplicada)}` : "—"}
                          {m.herdada_de_marco && <sup>*</sup>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.legend}>
              <span>
                <span className={`${styles.swatch} ${styles.mesAtual}`} /> Mês da data selecionada
              </span>
              <span>
                <sup>*</sup> Valor herdado de março (regra abaixo)
              </span>
              {data.segmentos.some((s) => !s.exibido_no_dashboard) && (
                <span className={styles.foraDash}>Linhas apagadas: segmentos cadastrados que o dashboard não exibe</span>
              )}
            </div>
          </>
        )}
      </Card>

      <Card title="Regra: janeiro e fevereiro usam a meta de março">
        <p className={styles.intro}>
          Quando a meta de <strong>janeiro</strong> ou <strong>fevereiro</strong> não está preenchida na tabela
          (vazia ou 0), o dashboard repete a meta de <strong>março</strong> do mesmo ano. Se o mês tiver um
          valor cadastrado, vale o valor cadastrado. Nos demais meses não há essa substituição: mês vazio ou 0
          fica sem meta.
        </p>
        <p className={styles.intro}>
          Essa regra veio do projeto de base enviado anteriormente. Lá, as metas começavam em março, e qualquer data de janeiro ou
          fevereiro usava a meta de março. A regra foi mantida aqui para o comportamento continuar igual.
        </p>
      </Card>
    </div>
  );
}
