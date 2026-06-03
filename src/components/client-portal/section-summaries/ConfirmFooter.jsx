import React, { useState } from "react";

/* Shared confirm footer used by every section-summary component.
   Self-scoped under .cf-root — no dependency on any ancestor class.

   Props:
     confirmed            — boolean, controls the summary-confirm checkbox
     onConfirm            — function | undefined; omit (or undefined) to hide the row
     communityConfirmed   — boolean, controls the community-property checkbox
     onCommunityConfirm   — function | undefined; omit to hide the row
     sectionLabel         — string inserted into the community confirm sentence
                            (e.g. "non-priority debts", "petition and filing details")
                            defaults to "this section"

   Renders null when neither callback is a function.
*/
export default function ConfirmFooter({
  confirmed,
  onConfirm,
  communityConfirmed,
  onCommunityConfirm,
  sectionLabel = "this section",
}) {
  const [communityWarning, setCommunityWarning] = useState(false);
  const showConfirm  = typeof onConfirm          === "function";
  const showCommunity = typeof onCommunityConfirm === "function";

  if (!showConfirm && !showCommunity) return null;

  return (
    <div className="cf-root">
      <CfStyle />
      <div className="cf-hd">
        <p className="cf-title">Section Summary — Please Review</p>
        <p className="cf-sub">Review the summary above before continuing. If anything looks wrong, scroll up and correct it.</p>
      </div>
      <div className="cf-body">
        {showConfirm && (
          <ConfirmRow id="cf_summary_confirm" checked={!!confirmed} onChange={onConfirm}>
            I have reviewed the summary above and confirm that all information is{" "}
            <strong className="cf-strong">true, accurate, and complete</strong> to the best of my
            knowledge. I understand that the information provided will be used to prepare my official
            bankruptcy documents filed with the federal court.
          </ConfirmRow>
        )}
        {showCommunity && (
          <>
            <ConfirmRow
              id="cf_community_confirm"
              checked={!!communityConfirmed}
              onChange={(v) => {
                setCommunityWarning(!v);
                onCommunityConfirm(v);
              }}
            >
              I confirm that the {sectionLabel} listed above includes{" "}
              <strong className="cf-strong">all community property</strong> — all community
              income, assets, and debts belonging to me and my non-filing spouse — and that nothing
              has been omitted.
            </ConfirmRow>
            {communityWarning && !communityConfirmed && (
              <div className="cf-warn">
                <svg className="cf-warn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                </svg>
                <div>
                  <p className="cf-warn-title">Missing Community Property?</p>
                  <p>If any community income, assets, or debts are missing, please{" "}
                    <strong className="cf-strong">scroll up and re-enter the missing information</strong>{" "}
                    before confirming. Filing incomplete information can affect your case or result in legal consequences.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ConfirmRow({ id, checked, onChange, children }) {
  return (
    <label htmlFor={id} className={`cf-row ${checked ? "cf-row-checked" : "cf-row-unchecked"}`}>
      <div
        className={`cf-box ${checked ? "cf-box-checked" : "cf-box-unchecked"}`}
        onClick={() => onChange(!checked)}
      >
        {checked && (
          <svg className="cf-check-svg" fill="currentColor" viewBox="0 0 12 12">
            <path d="M10 3L5 8.5 2 5.5 1 6.5l4 4 6-6.5z"/>
          </svg>
        )}
      </div>
      <div className="cf-text">{children}</div>
    </label>
  );
}

function CfStyle() {
  return <style>{`
    .cf-root * { box-sizing:border-box; }
    .cf-root {
      --cf-accent:#fbbf24;
      --cf-warn:#fcd34d;
      --cf-warn-bg:rgba(251,191,36,.10);
      margin-top:24px;
      border:1px solid #1e293b;
      border-radius:16px;
      overflow:hidden;
      font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
    }
    .cf-hd { background:#111827; padding:12px 20px; border-bottom:1px solid #1e293b; }
    .cf-title { margin:0; font-family:'Fraunces',ui-serif,Georgia,'Times New Roman',serif; font-weight:700; font-size:14px; color:#fff; }
    .cf-sub { margin:2px 0 0; color:#94a3b8; font-size:12px; }
    .cf-body { background:#030712; padding:16px 20px; display:flex; flex-direction:column; gap:10px; }
    .cf-row { display:flex; align-items:flex-start; gap:12px; padding:12px; border-radius:12px; border:1px solid #1e293b; cursor:pointer; transition:border-color .15s,background .15s; }
    .cf-row-checked { border-color:rgba(34,197,94,.40); background:rgba(74,222,128,.05); }
    .cf-row-unchecked:hover { border-color:#334155; }
    .cf-box { width:20px; height:20px; border-radius:4px; border:2px solid #475569; flex-shrink:0; margin-top:2px; display:flex; align-items:center; justify-content:center; transition:all .15s; }
    .cf-box-checked { border-color:var(--cf-accent); background:var(--cf-accent); }
    .cf-box-unchecked { background:transparent; }
    .cf-check-svg { width:12px; height:12px; color:#1c1407; }
    .cf-text { font-size:14px; color:#cbd5e1; line-height:1.6; }
    .cf-strong { color:#fff; font-weight:700; }
    .cf-warn { margin-top:4px; display:flex; gap:12px; background:var(--cf-warn-bg); border:1px solid rgba(251,191,36,.40); border-radius:12px; padding:12px 16px; font-size:12px; color:#fde68a; line-height:1.5; }
    .cf-warn-icon { width:16px; height:16px; color:var(--cf-accent); flex-shrink:0; margin-top:2px; }
    .cf-warn-title { font-weight:700; color:var(--cf-warn); margin-bottom:4px; }
  `}</style>;
}
