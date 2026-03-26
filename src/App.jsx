import { useEffect, useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { NOTIFICATION_TEMPLATE_DAY_1 } from "./notificationTemplateDay1.js";
import { NOTIFICATION_TEMPLATE_DAY_2 } from "./notificationTemplateDay2.js";

const API_GET  = "https://adecon-backend-8y4v.onrender.com/api/user/all";
const API_POST = "https://adecon-backend-8y4v.onrender.com/api/user";
const API_ACTIVITIES = "https://adecon-backend-8y4v.onrender.com/api/activity/all";

const FIELDS = ["email", "fullname", "mobileno", "city", "state", "country", "type"];

const PLACEHOLDERS = {
  email:    "Email address",
  fullname: "Full name",
  mobileno: "Mobile number",
  city:     "City",
  state:    "State",
  country:  "Country",
  type:     "Type ",
};

const ICONS = {
  email:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
  fullname: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>,
  mobileno: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>,
  city:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>,
  state:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/></svg>,
  country:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>,
  type:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>,
};

const EMPTY_FORM = { email: "", fullname: "", mobileno: "", city: "", state: "", country: "", type: "" };

const TEMPLATES = {
  day1: { label: "Day 1", template: NOTIFICATION_TEMPLATE_DAY_1, subject: "Reminder To Join ADECON 2026" },
  day2: { label: "Day 2", template: NOTIFICATION_TEMPLATE_DAY_2, subject: "Reminder To Join ADECON 2026" },
};

const EXPORT_FILTER_FIELDS = [
  { value: "none",    label: "No Filter" },
  { value: "type",    label: "Type" },
  { value: "city",    label: "City" },
  { value: "state",   label: "State" },
  { value: "country", label: "Country" },
];

// ── CSV export helper ─────────────────────────────────────────────────────────
function exportCSV(rows, filename) {
  const cols    = ["fullname","email","mobileno","city","state","country","type"];
  const headers = ["Full Name","Email","Mobile","City","State","Country","Type"];
  const esc     = (v) => `"${String(v ?? "").replace(/"/g,'""')}"`;
  const csv     = [headers.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  const blob    = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Activity CSV export helper ────────────────────────────────────────────────
function exportActivitiesCSV(rows, filename) {
  const cols    = ["email","firstLogin","lastLogin","firstView","lastView","stalls"];
  const headers = ["Email","First Login","Last Login","First View","Last View","Stalls"];
  const esc     = (v) => `"${String(v ?? "").replace(/"/g,'""')}"`;
  const csv     = [
    headers.join(","),
    ...rows.map((r) =>
      cols.map((c) => {
        const val = c === "stalls" ? (Array.isArray(r[c]) ? r[c].join("; ") : (r[c] || "")) : (r[c] || "");
        return esc(val);
      }).join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Shared modal CSS ──────────────────────────────────────────────────────────
const MODAL_CSS = `
  .modal-overlay {
    position:fixed; inset:0; background:rgba(10,10,10,0.45);
    backdrop-filter:blur(3px); z-index:500;
    display:flex; align-items:center; justify-content:center;
    animation:fadeIn 0.15s ease;
  }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  .modal {
    background:var(--surface); border:1px solid var(--border); border-radius:14px;
    box-shadow:0 20px 60px rgba(0,0,0,0.18),0 4px 16px rgba(0,0,0,0.08);
    width:440px; max-width:calc(100vw - 32px);
    animation:slideUp 0.18s ease; overflow:hidden;
  }
  @keyframes slideUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  .modal-header { padding:20px 24px 0; display:flex; align-items:flex-start; justify-content:space-between; }
  .modal-title  { font-size:16px; font-weight:600; color:var(--text); }
  .modal-subtitle { font-size:12.5px; color:var(--text-muted); margin-top:3px; }
  .modal-close {
    width:28px; height:28px; border:1px solid var(--border); border-radius:6px;
    background:transparent; cursor:pointer;
    display:flex; align-items:center; justify-content:center;
    color:var(--text-muted); transition:all 0.12s; flex-shrink:0;
  }
  .modal-close:hover { background:var(--bg); color:var(--text); }
  .modal-body   { padding:20px 24px; }
  .modal-footer { padding:0 24px 20px; display:flex; gap:10px; justify-content:flex-end; }
  .btn-cancel {
    padding:9px 18px; font-family:'DM Sans',sans-serif; font-size:13.5px; font-weight:500;
    border:1px solid var(--border); border-radius:var(--radius-sm);
    background:transparent; color:var(--text-muted); cursor:pointer; transition:all 0.12s;
  }
  .btn-cancel:hover { background:var(--bg); color:var(--text); }
  .template-options { display:flex; flex-direction:column; gap:10px; }
  .template-option {
    border:1.5px solid var(--border); border-radius:10px; padding:14px 16px;
    cursor:pointer; transition:all 0.15s; display:flex; align-items:center; gap:14px;
    background:var(--bg);
  }
  .template-option:hover { border-color:var(--accent); background:var(--accent-light); }
  .template-option.selected { border-color:var(--accent); background:var(--accent-light); box-shadow:0 0 0 3px rgba(37,99,235,0.1); }
  .template-radio { width:18px; height:18px; border-radius:50%; border:2px solid var(--border); flex-shrink:0; display:flex; align-items:center; justify-content:center; transition:all 0.12s; }
  .template-option.selected .template-radio { border-color:var(--accent); background:var(--accent); }
  .template-radio-dot { width:6px; height:6px; border-radius:50%; background:#fff; opacity:0; transition:opacity 0.12s; }
  .template-option.selected .template-radio-dot { opacity:1; }
  .template-label { font-size:14px; font-weight:600; color:var(--text); }
  .template-desc  { font-size:12px; color:var(--text-muted); margin-top:2px; }
  .template-day-tag { margin-left:auto; font-family:'DM Mono',monospace; font-size:10.5px; font-weight:500; padding:3px 9px; border-radius:20px; flex-shrink:0; }
  .tag-day1 { background:#eff4ff; color:var(--accent);  border:1px solid #c7d9ff; }
  .tag-day2 { background:#f0fdf4; color:var(--success); border:1px solid #bbf7d0; }
  .btn-action {
    padding:9px 20px; font-family:'DM Sans',sans-serif; font-size:13.5px; font-weight:600;
    border:none; border-radius:var(--radius-sm); color:#fff;
    cursor:pointer; transition:background 0.12s;
    display:flex; align-items:center; gap:7px;
  }
  .btn-action.accent { background:var(--accent); }
  .btn-action.accent:not(:disabled):hover { background:var(--accent-hover); }
  .btn-action.green  { background:var(--success); }
  .btn-action.green:not(:disabled):hover  { background:#15803d; }
  .btn-action:disabled { opacity:0.45; cursor:not-allowed; }
  .send-count-badge { background:rgba(255,255,255,0.2); border-radius:10px; padding:1px 7px; font-size:11px; }
`;

// ─── Template Picker Modal ────────────────────────────────────────────────────
function TemplatePicker({ mode, user, userCount, onConfirm, onClose }) {
  const [selected, setSelected] = useState(null);
  const [sending,  setSending]  = useState(false);

  const handleConfirm = async () => {
    if (!selected) return;
    setSending(true);
    await onConfirm(selected);
    setSending(false);
  };

  return (
    <>
      <style>{MODAL_CSS}</style>
      <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal">
          <div className="modal-header">
            <div>
              <div className="modal-title">{mode === "all" ? "Send Notification to All" : "Send Notification"}</div>
            </div>
            <button className="modal-close" onClick={onClose}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="modal-body">
            <div className="template-options">
              {Object.entries(TEMPLATES).map(([key, tpl]) => (
                <div key={key} className={`template-option${selected===key?" selected":""}`} onClick={()=>setSelected(key)}>
                  <div className="template-radio"><div className="template-radio-dot"/></div>
                  <div>
                    <div className="template-label">{tpl.label} Template</div>
                    <div className="template-desc">{tpl.subject}</div>
                  </div>
                  <span className={`template-day-tag ${key==="day1"?"tag-day1":"tag-day2"}`}>{tpl.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn-cancel" onClick={onClose}>Cancel</button>
            <button className="btn-action accent" disabled={!selected||sending} onClick={handleConfirm}>
              {sending
                ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{animation:"spin 0.7s linear infinite"}}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Sending…</>
                : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>Send{mode==="all"&&<span className="send-count-badge">{userCount}</span>}</>
              }
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Export Modal (Users) ─────────────────────────────────────────────────────
function ExportModal({ users, onClose }) {
  const [filterField, setFilterField] = useState("none");
  const [filterValue, setFilterValue] = useState("");

  const uniqueValues = useMemo(() => {
    if (filterField === "none") return [];
    return [...new Set(users.map((u) => (u[filterField] || "").trim()).filter(Boolean))].sort();
  }, [filterField, users]);

  const preview = useMemo(() => {
    if (filterField === "none" || !filterValue) return users;
    return users.filter((u) => (u[filterField] || "").toLowerCase() === filterValue.toLowerCase());
  }, [users, filterField, filterValue]);

  const handleExport = () => {
    const suffix = filterField !== "none" && filterValue ? `_${filterField}-${filterValue}` : "_all";
    exportCSV(preview, `adecon_users${suffix}.csv`);
    onClose();
  };

  return (
    <>
      <style>{`
        ${MODAL_CSS}
        .export-modal { width:480px; }
        .filter-section { display:flex; flex-direction:column; gap:16px; }
        .filter-section-label { font-size:11.5px; font-weight:600; color:var(--text-muted); letter-spacing:0.4px; text-transform:uppercase; margin-bottom:8px; }
        .filter-chips { display:flex; flex-wrap:wrap; gap:8px; }
        .filter-chip {
          padding:7px 14px; font-size:13px; font-weight:500;
          border:1.5px solid var(--border); border-radius:20px;
          background:var(--bg); color:var(--text-muted);
          cursor:pointer; transition:all 0.13s;
        }
        .filter-chip:hover { border-color:var(--accent); color:var(--accent); }
        .filter-chip.active { border-color:var(--accent); background:var(--accent-light); color:var(--accent); font-weight:600; }
        .filter-value-wrap { display:flex; flex-direction:column; gap:6px; }
        .filter-select, .filter-input-txt {
          padding:9px 12px; font-family:'DM Sans',sans-serif; font-size:13.5px;
          border:1px solid var(--border); border-radius:var(--radius-sm);
          background:var(--bg); color:var(--text); outline:none;
          transition:border-color 0.15s,box-shadow 0.15s; width:100%;
        }
        .filter-select:focus, .filter-input-txt:focus { border-color:var(--accent); box-shadow:0 0 0 3px rgba(37,99,235,0.08); }
        .export-preview-bar {
          padding:12px 14px; background:var(--bg);
          border:1px solid var(--border-light); border-radius:var(--radius-sm);
          display:flex; align-items:center; justify-content:space-between;
        }
        .export-preview-lbl { font-size:12px; color:var(--text-muted); }
        .export-preview-count { font-family:'DM Mono',monospace; font-size:14px; font-weight:700; color:var(--text); }
        .export-preview-sub  { font-size:11px; color:var(--text-subtle); }
      `}</style>
      <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal export-modal">
          <div className="modal-header">
            <div>
              <div className="modal-title">Export as CSV</div>
         
            </div>
            <button className="modal-close" onClick={onClose}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div className="modal-body">
            <div className="filter-section">
              <div>
                <div className="filter-section-label">Filter by field</div>
                <div className="filter-chips">
                  {EXPORT_FILTER_FIELDS.map((f) => (
                    <button
                      key={f.value}
                      className={`filter-chip${filterField===f.value?" active":""}`}
                      onClick={() => { setFilterField(f.value); setFilterValue(""); }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {filterField !== "none" && (
                <div className="filter-value-wrap">
                  <div className="filter-section-label">Select value</div>
                  {uniqueValues.length > 0 ? (
                    <select className="filter-select" value={filterValue} onChange={(e) => setFilterValue(e.target.value)}>
                      <option value="">All</option>
                      {uniqueValues.map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="filter-input-txt"
                      placeholder={`Enter ${filterField} to filter by…`}
                      value={filterValue}
                      onChange={(e) => setFilterValue(e.target.value)}
                    />
                  )}
                </div>
              )}

              <div className="export-preview-bar">
                <div>
                  <div className="export-preview-lbl">Rows to export</div>
                  <div className="export-preview-sub">
                    {filterField === "none"
                      ? "All"
                      : filterValue
                        ? `Filtered by ${filterField} = "${filterValue}"`
                        : `All`}
                  </div>
                </div>
                <div className="export-preview-count">{preview.length} / {users.length}</div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button className="btn-cancel" onClick={onClose}>Cancel</button>
            <button className="btn-action green" onClick={handleExport} disabled={preview.length === 0}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export {preview.length} rows
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Activity Export Modal ────────────────────────────────────────────────────
function ActivityExportModal({ activities, onClose }) {
  const [selectedStalls, setSelectedStalls] = useState([]);

  // Collect all unique stall names across all activity records
  const allStalls = useMemo(() => {
    const set = new Set();
    activities.forEach((a) => {
      const stalls = Array.isArray(a.stalls) ? a.stalls : [];
      stalls.forEach((s) => { if (s) set.add(String(s).trim()); });
    });
    return [...set].sort();
  }, [activities]);

  const toggleStall = (stall) => {
    setSelectedStalls((prev) =>
      prev.includes(stall) ? prev.filter((s) => s !== stall) : [...prev, stall]
    );
  };

  const preview = useMemo(() => {
    if (selectedStalls.length === 0) return activities;
    // Keep rows whose stalls array contains ALL selected stalls
    return activities.filter((a) => {
      const rowStalls = (Array.isArray(a.stalls) ? a.stalls : []).map((s) => String(s).trim());
      return selectedStalls.every((sel) => rowStalls.includes(sel));
    });
  }, [activities, selectedStalls]);

  const handleExport = () => {
    const suffix = selectedStalls.length > 0 ? `_stalls-filtered` : "_all";
    exportActivitiesCSV(preview, `adecon_activities${suffix}.csv`);
    onClose();
  };

  return (
    <>
      <style>{`
        ${MODAL_CSS}
        .act-export-modal { width:520px; max-height:90vh; display:flex; flex-direction:column; }
        .act-export-modal .modal-body { overflow-y:auto; flex:1; }
        .filter-section { display:flex; flex-direction:column; gap:16px; }
        .filter-section-label { font-size:11.5px; font-weight:600; color:var(--text-muted); letter-spacing:0.4px; text-transform:uppercase; margin-bottom:8px; }
        .stall-grid { display:flex; flex-wrap:wrap; gap:8px; max-height:200px; overflow-y:auto; padding:2px; }
        .stall-chip {
          padding:7px 14px; font-size:12.5px; font-weight:500;
          border:1.5px solid var(--border); border-radius:20px;
          background:var(--bg); color:var(--text-muted);
          cursor:pointer; transition:all 0.13s; display:flex; align-items:center; gap:6px;
          user-select:none;
        }
        .stall-chip:hover { border-color:var(--accent); color:var(--accent); }
        .stall-chip.active { border-color:var(--accent); background:var(--accent-light); color:var(--accent); font-weight:600; }
        .stall-chip-check { width:14px; height:14px; border-radius:3px; border:1.5px solid currentColor; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .stall-chip.active .stall-chip-check { background:var(--accent); border-color:var(--accent); }
        .stall-chip.active .stall-chip-check svg { display:block; }
        .stall-chip-check svg { display:none; }
        .no-stalls-note { font-size:13px; color:var(--text-muted); padding:12px; background:var(--bg); border-radius:var(--radius-sm); border:1px dashed var(--border); }
        .selected-stalls-info { font-size:12px; color:var(--text-muted); margin-top:4px; }
        .selected-stalls-info span { color:var(--accent); font-weight:600; }
        .clear-stalls-btn { font-size:12px; color:var(--text-muted); background:none; border:none; cursor:pointer; padding:0; text-decoration:underline; }
        .clear-stalls-btn:hover { color:var(--error); }
        .export-preview-bar {
          padding:12px 14px; background:var(--bg);
          border:1px solid var(--border-light); border-radius:var(--radius-sm);
          display:flex; align-items:center; justify-content:space-between;
        }
        .export-preview-lbl { font-size:12px; color:var(--text-muted); }
        .export-preview-count { font-family:'DM Mono',monospace; font-size:14px; font-weight:700; color:var(--text); }
        .export-preview-sub  { font-size:11px; color:var(--text-subtle); }
      `}</style>
      <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal act-export-modal">
          <div className="modal-header">
            <div>
              <div className="modal-title">Export as CSV</div>
            </div>
            <button className="modal-close" onClick={onClose}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div className="modal-body">
            <div className="filter-section">
              <div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"8px"}}>
                  <div className="filter-section-label" style={{margin:0}}>Filter by stalls</div>
                  {selectedStalls.length > 0 && (
                    <button className="clear-stalls-btn" onClick={() => setSelectedStalls([])}>Clear all</button>
                  )}
                </div>
                {allStalls.length === 0 ? (
                  <div className="no-stalls-note">No stall data available in activities.</div>
                ) : (
                  <>
                    <div className="stall-grid">
                      {allStalls.map((stall) => (
                        <button
                          key={stall}
                          className={`stall-chip${selectedStalls.includes(stall) ? " active" : ""}`}
                          onClick={() => toggleStall(stall)}
                        >
                          <span className="stall-chip-check">
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>
                          </span>
                          {stall}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="export-preview-bar">
                <div>
                  <div className="export-preview-lbl">Rows to export</div>
                  <div className="export-preview-sub">
                    {selectedStalls.length === 0
                      ? "All"
                      : `Must include/contain : ${selectedStalls.join(", ")}`}
                  </div>
                </div>
                <div className="export-preview-count">{preview.length} / {activities.length}</div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button className="btn-cancel" onClick={onClose}>Cancel</button>
            <button className="btn-action green" onClick={handleExport} disabled={preview.length === 0}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export {preview.length} rows
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [users,           setUsers]           = useState([]);
  const [activities,      setActivities]      = useState([]);
  const [loading,         setLoading]         = useState(false);
  const [loadingAct,      setLoadingAct]      = useState(false);
  const [formData,        setFormData]        = useState(EMPTY_FORM);
  const [importData,      setImportData]      = useState([]);
  const [uploading,       setUploading]       = useState(false);
  const [search,          setSearch]          = useState("");
  const [actSearch,       setActSearch]       = useState("");
  const [activeTab,       setActiveTab]       = useState("users");
  const [notifSent,       setNotifSent]       = useState({});
  const [toast,           setToast]           = useState(null);
  const [pickerMode,      setPickerMode]      = useState(null);
  const [pickerUser,      setPickerUser]      = useState(null);
  const [pickerIdx,       setPickerIdx]       = useState(null);
  const [sendingAll,      setSendingAll]      = useState(false);
  const [exportOpen,      setExportOpen]      = useState(false);
  const [actExportOpen,   setActExportOpen]   = useState(false);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res  = await fetch(API_GET);
      const data = await res.json();
      if (data.status === "success") setUsers(data.message);
    } catch { showToast("Failed to fetch users", "error"); }
    finally  { setLoading(false); }
  };

  const fetchActivities = async () => {
    setLoadingAct(true);
    try {
      const res  = await fetch(API_ACTIVITIES);
      const data = await res.json();
      if (data.status === "success") setActivities(data.message);
    } catch { showToast("Failed to fetch activities", "error"); }
    finally  { setLoadingAct(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  // Fetch activities when tab is first opened
  useEffect(() => {
    if (activeTab === "activities" && activities.length === 0) {
      fetchActivities();
    }
  }, [activeTab]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res  = await fetch(API_POST, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.status === "success") {
        showToast("User created successfully");
        setFormData(EMPTY_FORM);
        fetchUsers();
        setActiveTab("users");
      }
    } catch { showToast("Failed to create user", "error"); }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb  = XLSX.read(new Uint8Array(evt.target.result), { type: "array" });
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws);
      setImportData(raw.map((r) => ({
        email: r.email||"", fullname: r.fullname||"", mobileno: r.mobileno||"",
        city: r.city||"", state: r.state||"", country: r.country||"", type: r.type||"",
      })));
    };
    reader.readAsArrayBuffer(file);
  };

  const handleBulkUpload = async () => {
    if (!importData.length) return;
    setUploading(true);
    try {
      for (const user of importData) {
        await fetch(API_POST, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(user) });
      }
      showToast(`${importData.length} users uploaded`);
      setImportData([]); fetchUsers(); setActiveTab("users");
    } catch { showToast("Upload failed","error"); }
    finally   { setUploading(false); }
  };

  const sendNotification = async (user, tKey) => {
    const { template, subject } = TEMPLATES[tKey];
    await fetch("https://sadmin-api.onference.in/support/outlook/new", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ toRecipients:user.email, subject, htmlBody:template.replace("{{NAME}}",user.fullname), ccRecipients:"", bccRecipients:"" }),
    });
  };

  const openSinglePicker = (user,idx) => { setPickerUser(user); setPickerIdx(idx); setPickerMode("single"); };
  const openAllPicker    = ()           => setPickerMode("all");

  const handleSingleConfirm = async (tKey) => {
    try {
      await sendNotification(pickerUser, tKey);
      setNotifSent((p) => ({...p,[pickerIdx]:true}));
      showToast(`Notification sent to ${pickerUser.fullname}`);
      setTimeout(()=>setNotifSent((p)=>({...p,[pickerIdx]:false})),4000);
    } catch { showToast("Failed to send notification","error"); }
    setPickerMode(null);
  };

  const handleAllConfirm = async (tKey) => {
    setSendingAll(true); setPickerMode(null);
    let ok=0, fail=0;
    for (let i=0;i<filtered.length;i++) {
      try { await sendNotification(filtered[i],tKey); setNotifSent((p)=>({...p,[i]:true})); ok++; }
      catch { fail++; }
    }
    setSendingAll(false);
    fail===0 ? showToast(`Sent to all ${ok} users (${TEMPLATES[tKey].label} template)`)
             : showToast(`${ok} sent, ${fail} failed`,"error");
    setTimeout(()=>setNotifSent({}),5000);
  };

  // ── Type badge colour (deterministic hash) ────────────────────────────────
  const typeColor = (type="") => {
    if (!type) return { bg:"var(--bg)", color:"var(--text-subtle)", border:"var(--border)" };
    const palette = [
      {bg:"#eff4ff",color:"#2563eb",border:"#c7d9ff"},
      {bg:"#f0fdf4",color:"#16a34a",border:"#bbf7d0"},
      {bg:"#fdf4ff",color:"#9333ea",border:"#e9d5ff"},
      {bg:"#fff7ed",color:"#ea580c",border:"#fed7aa"},
      {bg:"#fefce8",color:"#ca8a04",border:"#fde68a"},
      {bg:"#f0f9ff",color:"#0284c7",border:"#bae6fd"},
    ];
    let h=0; for (const c of type.toLowerCase()) h=(h*31+c.charCodeAt(0))&0xff;
    return palette[h % palette.length];
  };

  const filtered = users.filter((u) =>
    FIELDS.some((k) => (u[k]||"").toLowerCase().includes(search.toLowerCase()))
  );

  // ── Activity search filter ─────────────────────────────────────────────────
  const ACT_SEARCH_FIELDS = ["email","firstLogin","lastLogin","firstView","lastView"];
  const filteredActivities = activities.filter((a) => {
    if (!actSearch) return true;
    const q = actSearch.toLowerCase();
    const inFields = ACT_SEARCH_FIELDS.some((k) => (a[k]||"").toLowerCase().includes(q));
    const inStalls = Array.isArray(a.stalls) && a.stalls.some((s) => String(s).toLowerCase().includes(q));
    return inFields || inStalls;
  });

  // ── Format datetime string nicely ─────────────────────────────────────────
  const fmtDate = (val) => {
    if (!val) return <span style={{color:"var(--text-subtle)",fontSize:"12px"}}>—</span>;
    return <span style={{fontFamily:"'DM Mono',monospace",fontSize:"12px"}}>{val}</span>;
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{
          --bg:#f7f6f3;--surface:#ffffff;--border:#e8e6e1;--border-light:#f0ede8;
          --text:#1a1917;--text-muted:#8a8780;--text-subtle:#b5b2ac;
          --accent:#2563eb;--accent-light:#eff4ff;--accent-hover:#1d4ed8;
          --success:#16a34a;--success-light:#f0fdf4;
          --error:#dc2626;--warn:#d97706;--warn-light:#fffbeb;
          --shadow-sm:0 1px 3px rgba(0,0,0,0.06),0 1px 2px rgba(0,0,0,0.04);
          --shadow:0 4px 12px rgba(0,0,0,0.08),0 1px 3px rgba(0,0,0,0.04);
          --radius:10px;--radius-sm:6px;
        }
        body{background:var(--bg);font-family:'DM Sans',sans-serif;color:var(--text)}
        .app{display:flex;flex-direction:column;height:100vh;overflow:hidden}

        /* HEADER */
        .header{background:var(--surface);border-bottom:1px solid var(--border);padding:0 32px;display:flex;align-items:center;justify-content:space-between;height:60px;flex-shrink:0}
        .header-brand{display:flex;align-items:center;gap:10px}
        .header-dot{width:8px;height:8px;background:var(--accent);border-radius:50%}
        .header-title{font-size:15px;font-weight:600;letter-spacing:-0.2px}
        .header-count{font-family:'DM Mono',monospace;font-size:12px;color:var(--text-muted);background:var(--bg);border:1px solid var(--border);border-radius:20px;padding:3px 10px}

        /* TABS */
        .nav{display:flex;align-items:center;gap:2px;background:var(--surface);border-bottom:1px solid var(--border);padding:0 32px;flex-shrink:0}
        .nav-tab{padding:10px 16px;font-size:13px;font-weight:500;color:var(--text-muted);border:none;background:transparent;cursor:pointer;border-bottom:2px solid transparent;transition:all 0.15s;display:flex;align-items:center;gap:6px;margin-bottom:-1px}
        .nav-tab:hover{color:var(--text)}
        .nav-tab.active{color:var(--accent);border-bottom-color:var(--accent)}
        .nav-tab-badge{font-family:'DM Mono',monospace;font-size:10px;background:var(--accent-light);color:var(--accent);border-radius:10px;padding:1px 6px}

        /* MAIN */
        .main{flex:1;overflow:hidden;display:flex;flex-direction:column}
        .users-panel{display:flex;flex-direction:column;height:100%;overflow:hidden}

        /* TOOLBAR */
        .toolbar{padding:14px 32px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border-light);flex-shrink:0;flex-wrap:wrap}
        .search-wrap{position:relative;flex:1;min-width:200px;max-width:380px}
        .search-icon{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-subtle);pointer-events:none}
        .search-input{width:100%;padding:9px 12px 9px 36px;font-family:'DM Sans',sans-serif;font-size:13.5px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface);color:var(--text);outline:none;transition:border-color 0.15s,box-shadow 0.15s}
        .search-input::placeholder{color:var(--text-subtle)}
        .search-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(37,99,235,0.08)}
        .result-count{font-size:12.5px;color:var(--text-muted);white-space:nowrap}
        .toolbar-right{display:flex;align-items:center;gap:8px;margin-left:auto}

        /* EXPORT BUTTON */
        .btn-export{
          display:flex;align-items:center;gap:6px;padding:8px 14px;
          font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;
          border:1.5px solid var(--border);border-radius:var(--radius-sm);
          background:var(--surface);color:var(--text);
          cursor:pointer;transition:all 0.15s;white-space:nowrap;
        }
        .btn-export:hover{border-color:var(--success);color:var(--success);background:var(--success-light)}
        .btn-export:disabled{opacity:0.45;cursor:not-allowed}

        /* SEND ALL BUTTON */
        .btn-send-all{
          display:flex;align-items:center;gap:7px;padding:8px 14px;
          font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;
          border:none;border-radius:var(--radius-sm);
          background:var(--accent);color:#fff;
          cursor:pointer;transition:background 0.15s;white-space:nowrap;
        }
        .btn-send-all:hover{background:var(--accent-hover)}
        .btn-send-all:disabled{opacity:0.5;cursor:not-allowed}
        .btn-send-all-count{background:rgba(255,255,255,0.22);border-radius:10px;padding:1px 7px;font-size:11px;font-family:'DM Mono',monospace}

        /* TABLE */
        .table-wrap{flex:1;overflow-y:auto;padding:0 32px 24px}
        table{width:100%;border-collapse:collapse}
        thead{position:sticky;top:0;z-index:10;background:var(--bg)}
        thead tr{border-bottom:1px solid var(--border)}
        th{text-align:left;padding:10px 14px;font-size:11px;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;color:var(--text-subtle)}
        td{padding:11px 14px;font-size:13.5px;color:var(--text);border-bottom:1px solid var(--border-light)}
        tr:hover td{background:rgba(37,99,235,0.015)}
        tr:last-child td{border-bottom:none}
        .td-email{font-family:'DM Mono',monospace;font-size:12.5px;color:var(--text-muted)}
        .td-name{font-weight:500}
        .type-badge{display:inline-block;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;border-width:1px;border-style:solid;white-space:nowrap}

        /* NOTIFY BUTTON */
        .btn-notif{padding:6px 14px;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:500;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--surface);color:var(--text);cursor:pointer;transition:all 0.15s;white-space:nowrap;display:flex;align-items:center;gap:5px}
        .btn-notif:hover{border-color:var(--accent);color:var(--accent);background:var(--accent-light)}
        .btn-notif.sent{border-color:var(--success);color:var(--success);background:var(--success-light);pointer-events:none}

        .empty{padding:64px 0;text-align:center;color:var(--text-subtle);font-size:13.5px}
        .empty svg{display:block;margin:0 auto 12px;opacity:0.3}

        /* FORM */
        .form-panel{flex:1;overflow-y:auto;padding:32px;display:flex;justify-content:center}
        .form-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow-sm);padding:32px;width:100%;max-width:600px;height:fit-content}
        .form-card-title{font-size:16px;font-weight:600;margin-bottom:18px}
        .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        .form-group{display:flex;flex-direction:column;gap:5px}
        .form-group.full{grid-column:1/-1}
        .form-label{font-size:11.5px;font-weight:600;color:var(--text-muted);letter-spacing:0.4px;text-transform:uppercase}
        .input-wrap{position:relative}
        .input-icon{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--text-subtle);pointer-events:none}
        .form-input{width:100%;padding:9px 12px 9px 34px;font-family:'DM Sans',sans-serif;font-size:13.5px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text);outline:none;transition:border-color 0.15s,box-shadow 0.15s}
        .form-input::placeholder{color:var(--text-subtle)}
        .form-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(37,99,235,0.08);background:var(--surface)}
        .btn-primary{margin-top:22px;width:100%;padding:11px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;background:var(--accent);color:#fff;border:none;border-radius:var(--radius-sm);cursor:pointer;transition:background 0.15s}
        .btn-primary:hover{background:var(--accent-hover)}

        /* IMPORT */
        .import-panel{flex:1;overflow-y:auto;padding:32px;display:flex;gap:24px;align-items:flex-start;justify-content:center}
        .import-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow-sm);padding:28px;width:320px;flex-shrink:0}
        .import-card-title{font-size:15px;font-weight:600;margin-bottom:6px}
        .import-card-sub{font-size:12.5px;color:var(--text-muted);margin-bottom:20px;line-height:1.6}
        .dropzone{border:2px dashed var(--border);border-radius:var(--radius-sm);padding:32px 16px;text-align:center;cursor:pointer;transition:border-color 0.15s,background 0.15s;position:relative}
        .dropzone:hover{border-color:var(--accent);background:var(--accent-light)}
        .dropzone input{position:absolute;inset:0;opacity:0;cursor:pointer}
        .dropzone-icon{color:var(--text-subtle);margin-bottom:8px}
        .dropzone-text{font-size:13px;color:var(--text-muted)}
        .dropzone-hint{font-size:11.5px;color:var(--text-subtle);margin-top:4px}
        .preview-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow-sm);flex:1;max-width:940px;overflow:hidden}
        .preview-header{padding:16px 20px;border-bottom:1px solid var(--border-light);display:flex;align-items:center;justify-content:space-between}
        .preview-title{font-size:14px;font-weight:600}
        .preview-badge{font-family:'DM Mono',monospace;font-size:11px;background:var(--warn-light);color:var(--warn);border:1px solid #fde68a;border-radius:10px;padding:2px 8px}
        .preview-table-wrap{max-height:340px;overflow-y:auto}
        .preview-footer{padding:14px 20px;border-top:1px solid var(--border-light);display:flex;justify-content:flex-end}
        .btn-upload{padding:9px 22px;font-family:'DM Sans',sans-serif;font-size:13.5px;font-weight:600;background:var(--accent);color:#fff;border:none;border-radius:var(--radius-sm);cursor:pointer;transition:background 0.15s;display:flex;align-items:center;gap:6px}
        .btn-upload:hover{background:var(--accent-hover)}
        .btn-upload:disabled{opacity:0.5;cursor:not-allowed}

        /* STALL PILLS */
        .stall-pills{display:flex;flex-wrap:wrap;gap:4px}
        .stall-pill{font-size:11px;font-weight:500;padding:2px 9px;border-radius:20px;background:#f0f9ff;color:#0284c7;border:1px solid #bae6fd;white-space:nowrap}

        /* REFRESH BUTTON */
        .btn-refresh{
          display:flex;align-items:center;gap:6px;padding:8px 12px;
          font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;
          border:1.5px solid var(--border);border-radius:var(--radius-sm);
          background:var(--surface);color:var(--text-muted);
          cursor:pointer;transition:all 0.15s;white-space:nowrap;
        }
        .btn-refresh:hover{border-color:var(--accent);color:var(--accent);background:var(--accent-light)}
        .btn-refresh:disabled{opacity:0.45;cursor:not-allowed}

        /* TOAST */
        .toast{position:fixed;bottom:24px;right:24px;padding:12px 18px;border-radius:var(--radius-sm);font-size:13.5px;font-weight:500;box-shadow:var(--shadow);z-index:1000;animation:slideIn 0.2s ease;display:flex;align-items:center;gap:8px}
        .toast.success{background:#1a1917;color:#f7f6f3}
        .toast.error{background:var(--error);color:#fff}
        @keyframes slideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .spinner{width:20px;height:20px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 0.7s linear infinite;margin:48px auto;display:block}
        @keyframes spin{to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{width:6px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
      `}</style>

      <div className="app">
        {/* HEADER */}
        <header className="header">
          <div className="header-brand">
            <div className="header-dot"/>
            <span className="header-title">Onference - Adecon</span>
          </div>
        
        </header>

        {/* TABS */}
        <nav className="nav">
          {[
            {id:"users",      label:"All Users"},
            {id:"activities", label:"All Activities"},
            {id:"create",     label:"Create User"},
            {id:"import",     label:"Import", badge:importData.length||null},
          ].map((tab)=>(
            <button key={tab.id} className={`nav-tab${activeTab===tab.id?" active":""}`} onClick={()=>setActiveTab(tab.id)}>
              {tab.label}
              {tab.badge?<span className="nav-tab-badge">{tab.badge}</span>:null}
            </button>
          ))}
        </nav>

        <main className="main">

          {/* ═══ USERS ═══ */}
          {activeTab==="users"&&(
            <div className="users-panel">
              <div className="toolbar">
                <div className="search-wrap">
                  <span className="search-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  </span>
                  <input className="search-input" placeholder="Search" value={search} onChange={(e)=>setSearch(e.target.value)}/>
                </div>
                <span className="result-count">
                  {search?`${filtered.length} of ${users.length}`:users.length} results
                </span>
                <div className="toolbar-right">
                  <button className="btn-export" onClick={()=>setExportOpen(true)} disabled={users.length===0}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Export CSV
                  </button>
                  <button className="btn-send-all" onClick={openAllPicker} disabled={sendingAll||filtered.length===0}>
                    {sendingAll?(
                      <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{animation:"spin 0.7s linear infinite"}}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Sending…</>
                    ):(
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                        Send All
                        {filtered.length>0&&<span className="btn-send-all-count">{filtered.length}</span>}
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="table-wrap">
                {loading?<span className="spinner"/>:filtered.length===0?(
                  <div className="empty">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
                    {search?"No users match your search":"No Users"}
                  </div>
                ):(
                  <table>
                    <thead>
                      <tr>
                        <th>Full Name</th><th>Email</th><th>Mobile</th>
                        <th>City</th><th>State</th><th>Country</th>
                        <th>Type</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((u,i)=>{
                        const tc=typeColor(u.type);
                        return(
                          <tr key={i}>
                            <td className="td-name">{u.fullname}</td>
                            <td className="td-email">{u.email}</td>
                            <td>{u.mobileno}</td>
                            <td>{u.city}</td>
                            <td>{u.state}</td>
                            <td>{u.country}</td>
                            <td>
                              {u.type
                                ?<span className="type-badge" style={{background:tc.bg,color:tc.color,borderColor:tc.border}}>{u.type}</span>
                                :<span style={{color:"var(--text-subtle)",fontSize:"12px"}}>—</span>
                              }
                            </td>
                            <td>
                              <button className={`btn-notif${notifSent[i]?" sent":""}`} onClick={()=>!notifSent[i]&&openSinglePicker(u,i)}>
                                {notifSent[i]
                                  ?<><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Sent</>
                                  :<><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>Send Notification</>
                                }
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ═══ ACTIVITIES ═══ */}
          {activeTab==="activities"&&(
            <div className="users-panel">
              <div className="toolbar">
                <div className="search-wrap">
                  <span className="search-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  </span>
                  <input className="search-input" placeholder="Search " value={actSearch} onChange={(e)=>setActSearch(e.target.value)}/>
                </div>
                <span className="result-count">
                  {actSearch?`${filteredActivities.length} of ${activities.length}`:activities.length} results
                </span>
                <div className="toolbar-right">
                  <button className="btn-refresh" onClick={fetchActivities} disabled={loadingAct}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={loadingAct?{animation:"spin 0.7s linear infinite"}:{}}><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
                    Refresh
                  </button>
                  <button className="btn-export" onClick={()=>setActExportOpen(true)} disabled={activities.length===0}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Export CSV
                  </button>
                </div>
              </div>

              <div className="table-wrap">
                {loadingAct?<span className="spinner"/>:filteredActivities.length===0?(
                  <div className="empty">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 6v6l4 2"/></svg>
                    {actSearch?"No activities match your search":"No Activities "}
                  </div>
                ):(
                  <table>
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>First Login</th>
                        <th>Last Login</th>
                        <th>First View</th>
                        <th>Last View</th>
                        <th>Stalls Visited</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredActivities.map((a, i) => {
                        const stalls = Array.isArray(a.stalls) ? a.stalls : [];
                        return (
                          <tr key={i}>
                            <td className="td-email">{a.email || <span style={{color:"var(--text-subtle)",fontSize:"12px"}}>—</span>}</td>
                            <td>{fmtDate(a.firstLogin)}</td>
                            <td>{fmtDate(a.lastLogin)}</td>
                            <td>{fmtDate(a.firstView)}</td>
                            <td>{fmtDate(a.lastView)}</td>
                            <td>
                              {stalls.length > 0 ? (
                                <div className="stall-pills">
                                  {stalls.map((s, si) => (
                                    <span key={si} className="stall-pill">{s}</span>
                                  ))}
                                </div>
                              ) : (
                                <span style={{color:"var(--text-subtle)",fontSize:"12px"}}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ═══ CREATE ═══ */}
          {activeTab==="create"&&(
            <div className="form-panel">
              <div className="form-card">
                <div className="form-card-title">New User</div>
                <form onSubmit={handleSubmit}>
                  <div className="form-grid">
                    {FIELDS.map((key)=>(
                      <div key={key} className={`form-group${key==="email"||key==="type"?" full":""}`}>
                        <label className="form-label">{PLACEHOLDERS[key]}{key!=="type"&&<span style={{color:"var(--error)",marginLeft:2}}>*</span>}</label>
                        <div className="input-wrap">
                          <span className="input-icon">{ICONS[key]}</span>
                          <input
                            className="form-input"
                            type="text"
                            name={key}
                            placeholder={PLACEHOLDERS[key]}
                            value={formData[key]}
                            onChange={handleChange}
                            required={key!=="type"}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <button type="submit" className="btn-primary">Create User</button>
                </form>
              </div>
            </div>
          )}

          {/* ═══ IMPORT ═══ */}
          {activeTab==="import"&&(
            <div className="import-panel">
              <div className="import-card">
                <div className="import-card-title">Import File</div>
                <div className="import-card-sub">
                  Upload an Excel (.xlsx, .xls) or CSV file. Columns: email, fullname, mobileno, city, state, country, type.
                </div>
                <div className="dropzone">
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload}/>
                  <div className="dropzone-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  </div>
                  <div className="dropzone-text">Click to choose a file</div>
                  <div className="dropzone-hint">.xlsx · .xls · .csv</div>
                </div>
              </div>

              {importData.length>0&&(
                <div className="preview-card">
                  <div className="preview-header">
                    <span className="preview-title">Preview</span>
                    <span className="preview-badge">{importData.length} rows</span>
                  </div>
                  <div className="preview-table-wrap">
                    <table>
                      <thead>
                        <tr><th>Full Name</th><th>Email</th><th>Mobile</th><th>City</th><th>State</th><th>Country</th><th>Type</th></tr>
                      </thead>
                      <tbody>
                        {importData.map((row,i)=>{
                          const tc=typeColor(row.type);
                          return(
                            <tr key={i}>
                              <td className="td-name">{row.fullname}</td>
                              <td className="td-email">{row.email}</td>
                              <td>{row.mobileno}</td>
                              <td>{row.city}</td>
                              <td>{row.state}</td>
                              <td>{row.country}</td>
                              <td>
                                {row.type
                                  ?<span className="type-badge" style={{background:tc.bg,color:tc.color,borderColor:tc.border}}>{row.type}</span>
                                  :<span style={{color:"var(--text-subtle)",fontSize:"12px"}}>—</span>
                                }
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="preview-footer">
                    <button className="btn-upload" onClick={handleBulkUpload} disabled={uploading}>
                      {uploading?<>Uploading…</>:<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Confirm & Upload</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* MODALS */}
      {pickerMode&&(
        <TemplatePicker
          mode={pickerMode} user={pickerUser} userCount={filtered.length}
          onConfirm={pickerMode==="single"?handleSingleConfirm:handleAllConfirm}
          onClose={()=>setPickerMode(null)}
        />
      )}
      {exportOpen&&<ExportModal users={users} onClose={()=>setExportOpen(false)}/>}
      {actExportOpen&&<ActivityExportModal activities={activities} onClose={()=>setActExportOpen(false)}/>}

      {/* TOAST */}
      {toast&&(
        <div className={`toast ${toast.type}`}>
          {toast.type==="success"
            ?<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            :<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          }
          {toast.msg}
        </div>
      )}
    </>
  );
}