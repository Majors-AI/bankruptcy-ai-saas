// Placeholder for the E-Filing Portal route. Replaces the now-hidden
// 'File a Case' tab. Matches the LegalDepartmentPortal placeholder pattern.

export default function EFilingPortal() {
  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-3xl mx-auto pt-12">
        <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-3">
          E-Filing Portal
        </p>
        <h1
          className="text-3xl font-bold text-white mb-4"
          style={{ fontFamily: "'Georgia', serif" }}
        >
          Coming next phase
        </h1>
        <p className="text-sm text-slate-400 leading-relaxed max-w-xl">
          This portal will replace File a Case for court e-filing. Not wired yet —
          the legacy FileACasePortal route remains intact (hidden from nav).
        </p>
      </div>
    </div>
  );
}
