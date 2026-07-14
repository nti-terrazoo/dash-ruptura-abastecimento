import { Suspense, lazy } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { Skeleton } from "./components/common/Skeleton";
import { SEGMENTOS } from "./lib/segmentos";

// Code-splitting por rota: o bundle inicial so carrega a Visao Geral.
const OverviewPage = lazy(() => import("./routes/OverviewPage").then((m) => ({ default: m.OverviewPage })));
const LojasPage = lazy(() => import("./routes/LojasPage").then((m) => ({ default: m.LojasPage })));
const FornecedoresPage = lazy(() => import("./routes/FornecedoresPage").then((m) => ({ default: m.FornecedoresPage })));
const BridgePage = lazy(() => import("./routes/BridgePage").then((m) => ({ default: m.BridgePage })));
const SegmentosPage = lazy(() => import("./routes/SegmentosPage").then((m) => ({ default: m.SegmentosPage })));

function RouteFallback() {
  return <Skeleton height={400} />;
}

/** <Navigate to="/segmentos/X" /> com uma string simples NAO preserva o
 * ?date= atual (o mesmo problema do NavLink na Sidebar) - monta o destino a
 * partir da location atual para nao perder a data selecionada. */
function SegmentosIndexRedirect() {
  const location = useLocation();
  return <Navigate to={{ pathname: `/segmentos/${SEGMENTOS[0]}`, search: location.search }} replace />;
}

export function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<OverviewPage />} />
          <Route path="lojas" element={<LojasPage />} />
          <Route path="fornecedores" element={<FornecedoresPage />} />
          <Route path="bridge" element={<BridgePage />} />
          <Route path="segmentos" element={<SegmentosIndexRedirect />} />
          <Route path="segmentos/:segmento" element={<SegmentosPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
