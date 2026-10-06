/** The deterministic state pipeline from the brief, drawn for the sign-in screen. */
const STEPS = [
  { label: "Cutting", sub: "In progress", className: "border-slate-500 bg-navy-800 text-white" },
  { label: "Pending", sub: "Verification", className: "border-blue-400 bg-blue-700 text-white" },
  { label: "Count QC", sub: "Hard stop", className: "border-amber-300 bg-amber-400 text-slate-900" },
  { label: "Verified", sub: "Signed & timed", className: "border-green-400 bg-green-700 text-white" },
  { label: "Sewing", sub: "Queue", className: "border-slate-500 bg-navy-950 text-white" },
];

export function PipelineDiagram() {
  return (
    <figure aria-label="Manufacturing state machine">
      <ol className="grid grid-cols-5 gap-2">
        {STEPS.map((step) => (
          <li key={step.label} className={`rounded-lg border px-2 py-2.5 text-center ${step.className}`}>
            <span className="block text-xs font-bold">{step.label}</span>
            <span className="block text-[11px]">{step.sub}</span>
          </li>
        ))}
      </ol>
      <figcaption className="mt-3 flex items-center gap-2 text-xs text-red-200">
        <span className="h-px flex-1 border-t border-dashed border-red-300" aria-hidden="true" />
        Rejected (defect / shortage) returns to cutting with a mandatory reason
        <span className="h-px flex-1 border-t border-dashed border-red-300" aria-hidden="true" />
      </figcaption>
    </figure>
  );
}
