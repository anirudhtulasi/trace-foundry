export default function SettingsPage() {
  return (
    <section className="space-y-4 pt-8 text-slate-300">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-500/70 font-mono">Configuration</p>
        <h1 className="text-3xl font-extralight tracking-tight text-white">Workspace settings</h1>
        <p className="text-sm text-slate-500">Role gating, payload policies, and tokens will live here.</p>
      </div>
      <div className="bento-card p-6">
        <p className="text-sm text-slate-400">Settings management is still under construction. For now, update `.env` and compose configs.</p>
      </div>
    </section>
  );
}
