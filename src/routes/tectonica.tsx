import { createFileRoute, Link } from "@tanstack/react-router";
import { FAULTS, PLATES, STRATA, type FaultKind } from "@/data/tectonics";

export const Route = createFileRoute("/tectonica")({
  head: () => ({ meta: [{ title: "Tectónica de Panamá · Telúrica" }] }),
  component: Tectonica,
});

function FaultGroup({ kind, title }: { kind: FaultKind; title: string }) {
  return (
    <section className="space-y-4">
      <h2 className="font-display text-2xl">{title}</h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FAULTS.filter((fault) => fault.k === kind).map((fault) => (
          <li key={fault.id}>
            <Link to="/monitor" search={{ fault: fault.id }} className="glass block h-full rounded-xl border border-hairline p-5 hover:border-primary">
              <h3 className="font-display text-lg">{fault.n}</h3>
              <p className="meta mt-2">{fault.t}{fault.r && ` · ${fault.r}`}</p>
              <p className="mt-2 text-sm text-muted-foreground">{fault.d}</p>
              <span className="mt-3 block text-sm text-primary">Ubicar en el mapa</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Tectonica() {
  return (
    <main className="mx-auto max-w-[1600px] space-y-10 px-4 py-10 lg:px-8">
      <header>
        <p className="meta">Geología regional</p>
        <h1 className="mt-2 font-display text-4xl sm:text-6xl">Tectónica de Panamá</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">Explora las placas, sus límites y las fallas corticales. Las trazas están simplificadas a escala regional.</p>
      </header>
      <section className="space-y-4">
        <h2 className="font-display text-2xl">Placas y microplacas</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PLATES.map((plate) => (
            <li key={plate.id}>
              <Link to="/monitor" search={{ plate: plate.id }} className="glass block h-full rounded-xl border border-hairline p-5 hover:border-primary">
                <h3 className="font-display text-lg"><span aria-hidden className="mr-2 inline-block size-2 rounded-full" style={{ background: plate.c }} />{plate.n}</h3>
                <p className="meta mt-2">{plate.motion}</p>
                <p className="mt-2 text-sm text-muted-foreground">{plate.body}</p>
                <span className="mt-3 block text-sm text-primary">Ubicar en el mapa</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <FaultGroup kind="limite" title="Límites de placa" />
      <FaultGroup kind="cortical" title="Fallas en tierra" />
      <section className="space-y-4">
        <h2 className="font-display text-2xl">Capas del subsuelo</h2>
        <figure className="overflow-hidden rounded-xl border border-hairline">
          <ol>
            {STRATA.map((layer) => (
              <li key={layer.a} className="flex min-h-12 flex-wrap items-center gap-x-5 px-4 py-3 text-white"
                style={{ backgroundColor: `rgb(${layer.c.join(" ")})`, minHeight: Math.max(48, (layer.b - layer.a) * 4) }}>
                <span className="font-mono text-sm">{layer.a}–{layer.b} km</span><span>{layer.n}</span>
              </li>
            ))}
          </ol>
          <figcaption className="p-4 text-sm text-muted-foreground">Perfil esquemático. Los intervalos de profundidad son orientativos.</figcaption>
        </figure>
      </section>
    </main>
  );
}
