/* Envuelve `vite build` con un número de hilos y un heap seguros.
   Evita que Rolldown agote la memoria en equipos con poca RAM. */

import { spawnSync } from "node:child_process";

const env = {
  ...process.env,
  RAYON_NUM_THREADS: process.env.RAYON_NUM_THREADS ?? "2",
};

const comando = process.platform === "win32" ? "npx.cmd" : "npx";
const resultado = spawnSync(comando, ["vite", "build"], {
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});

process.exit(resultado.status ?? 1);
