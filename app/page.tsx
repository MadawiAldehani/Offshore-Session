import Link from "next/link";

/** Landing page — a signpost to the three views. Not used during the event. */
export default function Home() {
  const views = [
    {
      href: "/screen",
      title: "Projector",
      detail: "Open this on the big screen. Shows the QR code, questions and leaderboard.",
      accent: "from-cyan-500/20 to-cyan-500/5 border-cyan-400/30",
    },
    {
      href: "/admin",
      title: "Control panel",
      detail: "Your laptop or phone. Start, lock, reveal and simulate players.",
      accent: "from-amber-500/20 to-amber-500/5 border-amber-400/30",
    },
    {
      href: "/play",
      title: "Player",
      detail: "What the audience sees. Enter a name and play along.",
      accent: "from-slate-400/15 to-slate-400/5 border-white/20",
    },
  ];

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-abyss px-6 py-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,#123a6b_0%,transparent_60%)]" />

      <div className="relative w-full max-w-3xl">
        <p className="mb-3 text-center font-mono text-xs uppercase tracking-[0.42em] text-cyan-300/70">
          Knowledge Sharing Session
        </p>
        <h1 className="text-center text-5xl font-black tracking-tight text-glow sm:text-6xl">
          Offshore Discoveries
        </h1>
        <p className="mt-4 text-center text-base text-slate-400">
          Pick a view to open. Run the projector on the big screen, keep the control panel
          on your laptop.
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {views.map((view) => (
            <Link
              key={view.href}
              href={view.href}
              className={`group rounded-2xl border bg-gradient-to-b p-6 transition hover:scale-[1.03] hover:shadow-2xl ${view.accent}`}
            >
              <h2 className="text-xl font-bold">{view.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{view.detail}</p>
              <span className="mt-4 inline-block font-mono text-xs text-slate-500 transition group-hover:text-slate-300">
                {view.href} →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
