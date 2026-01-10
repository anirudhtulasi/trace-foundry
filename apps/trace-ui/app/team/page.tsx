export default function TeamPage() {
  return (
    <section className="space-y-4 pt-8 text-slate-300">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-500/70 font-mono">Access</p>
        <h1 className="text-3xl font-extralight tracking-tight text-white">Team roster</h1>
        <p className="text-sm text-slate-500">User management hooks will ship after auth is wired into the UI.</p>
      </div>
      <div className="bento-card p-6">
        <p className="text-sm text-slate-400">Only the default viewer account is available in this build.</p>
      </div>
    </section>
  );
}
