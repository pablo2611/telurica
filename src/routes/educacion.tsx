import { createFileRoute } from "@tanstack/react-router";
import { TracingBeam } from "@/components/ui/tracing-beam";
import { BlurFade } from "@/components/ui/blur-fade";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/educacion")({
  head: () => ({
    meta: [
      { title: "Guía sísmica · Telúrica" },
      { name: "description", content: "Qué es un sismo, cómo leer magnitud y profundidad, y qué hacer antes, durante y después de un terremoto en Panamá." },
      { property: "og:title", content: "Guía para entender y prepararse ante sismos en Panamá" },
      { property: "og:description", content: "Conceptos básicos, preparación familiar y avisos de tsunami, con enlaces a fuentes oficiales." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Educacion,
});

const TOC = [
  ["sismo", "Qué es un sismo"],
  ["epicentro", "Epicentro y profundidad"],
  ["magnitud", "Magnitud e intensidad"],
  ["panama", "Por qué tiembla en Panamá"],
  ["fases", "Antes, durante y después"],
  ["kit", "Kit de emergencia"],
  ["tsunami", "Costa y tsunamis"],
  ["oficial", "Información oficial"],
  ["preguntas", "Preguntas frecuentes"],
] as const;

function CrossSection() {
  return (
    <figure className="my-10">
      <svg viewBox="0 0 640 300" className="w-full" role="img" aria-label="Corte transversal: el hipocentro está bajo tierra y el epicentro es el punto de la superficie justo encima">
        <rect x="0" y="70" width="640" height="230" className="fill-ink/5" />
        <path d="M0 70 Q160 58 320 70 T640 66" className="fill-none stroke-ink" strokeWidth="2" />
        {[0, 1, 2, 3].map((i) => <circle key={i} cx="320" cy="220" r={30 + i * 34} className="fill-none stroke-ink/25" strokeDasharray="4 5" />)}
        <line x1="320" y1="70" x2="320" y2="220" className="stroke-ink" strokeDasharray="3 4" />
        <circle cx="320" cy="220" r="7" className="fill-mag-5" />
        <circle cx="320" cy="68" r="6" className="fill-ink" />
        <text x="334" y="50" className="fill-ink font-mono text-[13px]">EPICENTRO</text>
        <text x="334" y="226" className="fill-ink font-mono text-[13px]">HIPOCENTRO (foco)</text>
        <text x="250" y="150" className="fill-ink/70 font-mono text-[12px]">profundidad</text>
        <text x="16" y="96" className="fill-ink/60 font-mono text-[11px]">SUPERFICIE</text>
      </svg>
      <figcaption className="mt-2 text-sm text-ink/60">Figura 1. El sismo se origina en el hipocentro; el epicentro es su proyección en la superficie.</figcaption>
    </figure>
  );
}

function MagnitudeScale() {
  const rows = [3, 4, 5, 6, 7];
  return (
    <figure className="my-10">
      <div className="space-y-2" role="img" aria-label="Cada punto de magnitud libera unas 32 veces más energía">
        {rows.map((m, i) => (
          <div key={m} className="flex items-center gap-4">
            <span className="w-10 font-mono text-sm">M{m}</span>
            <div className="h-4 bg-ink/80" style={{ width: `${Math.max(0.6, (Math.pow(32, i) / Math.pow(32, 4)) * 100)}%` }} />
            <span className="font-mono text-xs text-ink/60">×{i === 0 ? "1" : Math.pow(32, i).toLocaleString("es-PA")}</span>
          </div>
        ))}
      </div>
      <figcaption className="mt-3 text-sm text-ink/60">Figura 2. Energía relativa liberada. Cada punto de magnitud equivale a unas 32 veces más energía (USGS).</figcaption>
    </figure>
  );
}

function H2({ id, n, children }: { id: string; n: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 pt-16 font-display text-4xl leading-tight">
      <span className="mr-3 font-mono text-base align-middle text-ink/40">{n}</span>{children}
    </h2>
  );
}

function Educacion() {
  return (
    <main className="bg-paper text-ink">
      <header className="mx-auto max-w-[1300px] px-4 pb-16 pt-16 lg:px-8">
        <BlurFade>
          <p className="font-mono text-xs tracking-[0.25em] text-ink/60">GUÍA · LECTURA DE 12 MINUTOS</p>
          <h1 className="mt-6 max-w-5xl font-display text-[clamp(2.4rem,7vw,6.5rem)] font-light leading-[0.95]">
            Entender un sismo, <em>y saber qué hacer</em> cuando ocurre.
          </h1>
        </BlurFade>
        <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink/75">
          Conceptos para leer los datos de este observatorio y recomendaciones generales de preparación, basadas en SINAPROC, USGS y NOAA.
          Las órdenes de evacuación y los avisos oficiales corresponden siempre a las autoridades.
        </p>
      </header>

      <div className="mx-auto grid max-w-[1300px] gap-12 border-t border-ink/15 px-4 pb-24 lg:grid-cols-[14rem_minmax(0,1fr)] lg:px-8">
        <nav aria-label="Índice" className="hidden lg:block">
          <ol className="sticky top-24 space-y-2 pt-16 text-sm">
            {TOC.map(([id, label], i) => (
              <li key={id}><a href={`#${id}`} className="flex gap-3 text-ink/60 hover:text-ink"><span className="font-mono text-xs">{String(i + 1).padStart(2, "0")}</span>{label}</a></li>
            ))}
          </ol>
        </nav>

        <TracingBeam className="px-2">
          <article className="max-w-[68ch] text-[1.075rem] leading-[1.75] text-ink/85">
            <H2 id="sismo" n="01">Qué es un sismo</H2>
            <p className="mt-6">Un sismo es la vibración del terreno producida por la liberación repentina de energía acumulada en las rocas, casi siempre por el desplazamiento de una falla geológica. Esa energía viaja en forma de ondas sísmicas que se registran en sismógrafos de todo el mundo.</p>
            <p className="mt-4">Las agencias calculan la ubicación, la hora, la profundidad y la magnitud a partir de esos registros. Por eso los primeros datos pueden cambiar durante las horas siguientes: se revisan con más estaciones.</p>

            <H2 id="epicentro" n="02">Epicentro y profundidad</H2>
            <p className="mt-6">El <strong>hipocentro</strong> o foco es el punto bajo tierra donde comienza la ruptura. El <strong>epicentro</strong> es el punto de la superficie situado justo encima. La <strong>profundidad</strong> es la distancia entre ambos, en kilómetros.</p>
            <CrossSection />
            <p>Un sismo somero (menos de 70 km) de magnitud moderada puede sentirse con más fuerza que uno más profundo de magnitud similar. Cuando una agencia no determina la profundidad, este observatorio la muestra como «No determinada», nunca como cero.</p>

            <H2 id="magnitud" n="03">Magnitud e intensidad</H2>
            <p className="mt-6">La <strong>magnitud</strong> mide la energía liberada en el origen y es un solo número por sismo. Existen varios tipos (Mw, mb, ML, Md) según el método; cada agencia indica cuál utilizó, por eso dos agencias pueden publicar valores algo distintos.</p>
            <MagnitudeScale />
            <p>La <strong>intensidad</strong> describe lo que se siente y los daños en un lugar concreto (escala de Mercalli Modificada). Un mismo sismo tiene una magnitud pero muchas intensidades: mayor cerca del epicentro y menor a medida que nos alejamos.</p>

            <H2 id="panama" n="04">Por qué tiembla en Panamá</H2>
            <p className="mt-6">El istmo está rodeado por la interacción de las placas de Cocos, Nazca, Caribe y el bloque de Panamá. La Zona de Fractura de Panamá, al sur de Chiriquí, y el Cinturón Deformado del Norte de Panamá, en el Caribe, concentran buena parte de la actividad. Por eso muchos sismos ocurren en el mar, frente a Chiriquí, Veraguas, Darién o Bocas del Toro, y este observatorio los muestra en la zona marítima próxima.</p>

            <H2 id="fases" n="05">Antes, durante y después</H2>
            <div className="mt-8 space-y-12">
              {[
                ["Antes", ["Identifique en casa, escuela y trabajo los lugares seguros: junto a muros de carga, lejos de ventanas y objetos que puedan caer.", "Fije a la pared estantes, televisores y calentadores.", "Acuerde con su familia un punto de reunión y un contacto fuera de la ciudad.", "Prepare un kit de emergencia y revíselo cada seis meses."]],
                ["Durante", ["Agáchese, cúbrase y sujétese: protéjase la cabeza y el cuello bajo una mesa firme.", "Si está en la calle, aléjese de edificios, postes y cables.", "Si conduce, deténgase en un lugar seguro y permanezca dentro del vehículo.", "No use ascensores ni corra hacia las escaleras mientras tiembla."]],
                ["Después", ["Revise si hay personas heridas y preste primeros auxilios si sabe hacerlo.", "Si huele a gas, no encienda luces ni fósforos; cierre la llave y salga.", "Espere réplicas y salga con calma si el edificio presenta daños.", "Infórmese solo por canales oficiales y use el teléfono únicamente para emergencias."]],
              ].map(([title, items], i) => (
                <section key={title as string} className="grid gap-4 sm:grid-cols-[6rem_1fr]">
                  <div className="font-display text-7xl font-light leading-none text-ink/25">{i + 1}</div>
                  <div>
                    <h3 className="font-display text-2xl">{title as string}</h3>
                    <ul className="mt-3 space-y-2">
                      {(items as string[]).map((it) => <li key={it} className="border-t border-ink/10 pt-2">{it}</li>)}
                    </ul>
                  </div>
                </section>
              ))}
            </div>

            <H2 id="kit" n="06">Kit de emergencia familiar</H2>
            <p className="mt-6">Prepare una mochila por hogar, pensada para al menos 72 horas: agua (unos 4 litros por persona y día), alimentos no perecederos, linterna y radio de pilas, botiquín y medicamentos habituales, copias de documentos en bolsa impermeable, silbato, cargador portátil, dinero en efectivo y artículos de higiene. Incluya lo necesario para niños, personas mayores y mascotas.</p>

            <H2 id="tsunami" n="07">Si está cerca de la costa</H2>
            <p className="mt-6">Un sismo fuerte o largo, que dificulte mantenerse en pie, puede ser una señal natural de tsunami, igual que un retiro repentino del mar o un ruido fuerte desde el océano. En esa situación, aléjese de la playa hacia zonas altas o tierra adentro sin esperar un aviso, y siga las instrucciones de SINAPROC.</p>
            <p className="mt-4">Los centros de NOAA emiten boletines con niveles distintos: <em>mensaje informativo</em> (no se espera amenaza), <em>vigilancia</em> (posible amenaza en evaluación), <em>aviso</em> (posibles corrientes peligrosas) y <em>alerta</em> (tsunami peligroso posible o confirmado). La magnitud de un sismo, por sí sola, no indica si habrá tsunami; este observatorio nunca lo deduce.</p>

            <H2 id="oficial" n="08">Dónde consultar información oficial</H2>
            <ul className="mt-6 divide-y divide-ink/10 border-y border-ink/10">
              {[
                ["SINAPROC — Sistema Nacional de Protección Civil", "https://www.sinaproc.gob.pa/alertas/", "Alertas y órdenes oficiales en Panamá."],
                ["Instituto de Geociencias — Universidad de Panamá", "https://sismosgeociencias.up.ac.pa/", "Red sismológica nacional y reportes locales."],
                ["NOAA — Centros de Alerta de Tsunami", "https://www.tsunami.gov/", "Boletines de tsunami para el Pacífico y el Caribe."],
                ["USGS — Programa de Riesgos Sísmicos", "https://earthquake.usgs.gov/", "Catálogo mundial y explicación de magnitudes."],
              ].map(([n, u, d]) => (
                <li key={u} className="py-3"><a href={u} target="_blank" rel="noreferrer" className="font-medium underline decoration-ink/30 underline-offset-4 hover:decoration-ink">{n}</a><p className="text-sm text-ink/60">{d}</p></li>
              ))}
            </ul>

            <H2 id="preguntas" n="09">Preguntas frecuentes</H2>
            <Accordion type="single" collapsible className="mt-6">
              {([
                ["¿Se pueden predecir los terremotos?", "No. Ningún método científico permite predecir la fecha, el lugar y la magnitud de un sismo. Se pueden estimar probabilidades a largo plazo, pero no anticipar un evento concreto."],
                ["¿Por qué USGS y EMSC dan magnitudes distintas?", "Usan estaciones, métodos y tipos de magnitud diferentes. Este observatorio agrupa los reportes del mismo sismo y muestra todas las mediciones sin sobrescribirlas."],
                ["¿Por qué un sismo aparece unos minutos después?", "Las agencias necesitan registrar las ondas en varias estaciones y calcular la solución. Los sismos pequeños pueden tardar más o no publicarse."],
                ["¿Qué significa «zona marítima próxima»?", "Epicentros en el mar a no más de 150 km del límite nacional de Panamá. Se muestran aparte porque no ocurrieron en territorio terrestre panameño."],
                ["¿Las alertas de esta plataforma son oficiales?", "No. Son notificaciones informativas basadas en reportes ya publicados. Las alertas oficiales las emite SINAPROC."],
              ] as [string, string][]).map(([q, a]) => (
                <AccordionItem key={q} value={q} className="border-ink/15">
                  <AccordionTrigger className="text-left font-display text-lg hover:no-underline">{q}</AccordionTrigger>
                  <AccordionContent className="text-base leading-relaxed text-ink/75">{a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            <p className="mt-16 border-t-2 border-ink pt-4 text-sm text-ink/70">
              Esta guía es informativa y general. Telúrica no predice terremotos ni reemplaza los sistemas oficiales de alerta y protección civil.
            </p>
          </article>
        </TracingBeam>
      </div>
    </main>
  );
}
