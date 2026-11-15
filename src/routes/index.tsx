import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/resumen", replace: true });
  },
  head: () => ({
    meta: [
      { title: "Telúrica — Sismos en Panamá en tiempo real" },
      { name: "description", content: "Sismos reportados en Panamá y su zona marítima, con datos de USGS y EMSC." },
      { property: "og:title", content: "Telúrica" },
      { property: "og:description", content: "Observatorio sísmico de Panamá con datos de fuentes científicas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
