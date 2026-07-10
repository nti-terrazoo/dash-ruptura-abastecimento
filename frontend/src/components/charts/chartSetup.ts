import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  Filler,
);

// Replica a config global do dashboard legado (Chart.defaults.*).
Chart.defaults.color = "rgba(26,46,34,.45)";
Chart.defaults.borderColor = "rgba(45,107,74,.1)";
Chart.defaults.font.family = "'DM Mono',monospace";
Chart.defaults.font.size = 10;
