import { useState, useRef, useCallback } from 'react';
import {
  Upload, Plus, X, ChevronDown, ChevronUp, FileText,
  CheckCircle2, AlertTriangle, RefreshCw, Search,
  Download, UserPlus, FolderOpen, Trash2, ArrowRight,
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ── Types ─────────────────────────────────────────────────────────────────────

type ImportStatus = 'pending_review' | 'active' | 'closed' | 'on_hold';
type DocStatus    = 'pending' | 'uploaded' | 'needs_scan' | 'organized' | 'missing';
type DocCategory  =
  | 'petition' | 'schedules' | 'means_test' | 'paystubs'
  | 'bank_statements' | 'tax_returns' | 'creditor_matrix'
  | 'court_notices' | 'retainer' | 'other';

interface LegacyClient {
  id:                   string;
  import_batch_id:      string;
  imported_by:          string;
  source_system:        string;
  legacy_client_id:     string | null;
  full_name:            string;
  email:                string | null;
  phone:                string | null;
  address:              string | null;
  city:                 string | null;
  state:                string | null;
  zip:                  string | null;
  dob:                  string | null;
  ssn_last4:            string | null;
  chapter:              number;
  case_type:            string;
  case_number:          string | null;
  filed_date:           string | null;
  discharge_date:       string | null;
  attorney_fee:         number | null;
  court_filing_fee:     number | null;
  assigned_attorney:    string | null;
  assigned_paralegal:   string | null;
  status:               ImportStatus;
  notes:                string | null;
  bci_raw_data:         Record<string, string> | null;
  accounting_client_id: string | null;
  promoted_at:          string | null;
  created_at:           string;
}

interface LegacyDoc {
  id:           string;
  import_id:    string;
  doc_category: DocCategory;
  doc_label:    string;
  file_name:    string | null;
  file_path:    string | null;
  status:       DocStatus;
  notes:        string | null;
  created_at:   string;
}

// ── BCI CSV row shape ─────────────────────────────────────────────────────────
// CommCred_complete.csv: Creditor Name,Address Line 1,...,Last Updated
// CommCred.CSV: Name,Address,City,State,ZIP,Type
// Client BCI rows typically: ClientID,LastName,FirstName,Email,Phone,Address,City,State,Zip,DOB,Chapter,...
interface BciRow { [key: string]: string }

// ── Constants ─────────────────────────────────────────────────────────────────

const CASE_TYPES = [
  { value: 'ch7_regular',    label: 'Ch. 7 Regular' },
  { value: 'ch7_bifurcated', label: 'Ch. 7 Bifurcated' },
  { value: 'ch13_flat_fee',  label: 'Ch. 13 Flat Fee' },
  { value: 'limited_scope',  label: 'Limited Scope' },
];

const DOC_CATEGORIES: { value: DocCategory; label: string }[] = [
  { value: 'petition',        label: 'Petition' },
  { value: 'schedules',       label: 'Schedules (A–J)' },
  { value: 'means_test',      label: 'Means Test (122A/B)' },
  { value: 'paystubs',        label: 'Pay Stubs' },
  { value: 'bank_statements', label: 'Bank Statements' },
  { value: 'tax_returns',     label: 'Tax Returns' },
  { value: 'creditor_matrix', label: 'Creditor Matrix' },
  { value: 'court_notices',   label: 'Court Notices' },
  { value: 'retainer',        label: 'Retainer / Fee Agreement' },
  { value: 'other',           label: 'Other' },
];

const DOC_STATUS_CONFIG: Record<DocStatus, { label: string; color: string }> = {
  pending:    { label: 'Pending',      color: '#B45309' },
  uploaded:   { label: 'Uploaded',     color: '#15803D' },
  needs_scan: { label: 'Needs Scan',   color: '#991B1B' },
  organized:  { label: 'Organized',    color: '#1E3A2F' },
  missing:    { label: 'Missing',      color: '#991B1B' },
};

const STATUS_CONFIG: Record<ImportStatus, { label: string; color: string }> = {
  pending_review: { label: 'Pending Review', color: '#B45309' },
  active:         { label: 'Active',         color: '#15803D' },
  closed:         { label: 'Closed',         color: '#6B6B66' },
  on_hold:        { label: 'On Hold',        color: '#991B1B' },
};

const STAFF_NAMES = [
  'Linda Park', 'Carlos Reyes', 'Sarah Mitchell', 'David Chen', 'Maria Lopez',
];

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

// ── API helpers ───────────────────────────────────────────────────────────────

async function sbGet<T>(path: string): Promise<T[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  return r.ok ? r.json() : [];
}

async function sbPost<T>(table: string, body: object): Promise<T | null> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  const arr = await r.json();
  return Array.isArray(arr) ? arr[0] : arr;
}

async function sbPatch(table: string, id: string, body: object) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  });
}

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseCsv(text: string): BciRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  // Parse header respecting quoted fields
  const parseRow = (line: string): string[] => {
    const fields: string[] = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; }
      else if (c === ',' && !inQ) { fields.push(cur.trim()); cur = ''; }
      else { cur += c; }
    }
    fields.push(cur.trim());
    return fields;
  };
  const headers = parseRow(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseRow(line);
    const row: BciRow = {};
    headers.forEach((h, i) => { row[h.trim()] = (vals[i] ?? '').trim(); });
    return row;
  }).filter(r => Object.values(r).some(v => v));
}

// Map BCI CSV columns to our client fields (best-effort, user can correct)
function mapBciRow(row: BciRow): Partial<LegacyClient> {
  // Try multiple common BCI column naming conventions
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const val = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()];
      if (val) return val;
    }
    return '';
  };
  const firstName  = get('FirstName', 'First Name', 'first_name', 'First');
  const lastName   = get('LastName', 'Last Name', 'last_name', 'Last');
  const fullName   = firstName && lastName ? `${firstName} ${lastName}` : get('Name', 'Client Name', 'full_name', 'FullName');
  const chapterRaw = get('Chapter', 'chapter', 'BK Type', 'Filing Chapter');
  const chapter    = chapterRaw.includes('13') ? 13 : 7;

  return {
    legacy_client_id:  get('ClientID', 'Client ID', 'ID', 'client_id'),
    full_name:         fullName,
    email:             get('Email', 'email', 'Email Address'),
    phone:             get('Phone', 'phone', 'Cell', 'Mobile', 'Phone Number'),
    address:           get('Address', 'address', 'Street', 'Address Line 1'),
    city:              get('City', 'city'),
    state:             get('State', 'state')?.slice(0, 2).toUpperCase() || null,
    zip:               get('Zip', 'ZIP', 'zip', 'Postal Code'),
    case_number:       get('CaseNumber', 'Case Number', 'case_number', 'BK Case Number'),
    chapter,
    bci_raw_data:      row,
  };
}

// ── Shared design tokens ──────────────────────────────────────────────────────

const BG   = '#0F0F0E';
const SURF = '#111111';
const S2   = '#0a0a0a';
const BDR  = '#2A2A28';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', 'Courier New', monospace" };

const inputStyle = (err?: boolean): React.CSSProperties => ({
  width: '100%', height: 36, background: S2,
  border: `1px solid ${err ? '#991B1B' : BDR}`,
  borderRadius: 4, padding: '0 10px', fontSize: 13,
  color: '#FAFAF7', outline: 'none', boxSizing: 'border-box',
  fontFamily: "'Inter', system-ui, sans-serif",
});

const labelSt: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 500,
  textTransform: 'uppercase', letterSpacing: '0.06em',
  color: '#6B6B66', marginBottom: 5,
};

const btn = (accent = '#111111'): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: accent, color: '#FAFAF7', border: 'none',
  borderRadius: 4, padding: '8px 14px', fontSize: 13,
  fontWeight: 500, cursor: 'pointer', transition: 'background 150ms ease-out',
  fontFamily: "'Inter', system-ui, sans-serif",
});

const ghostBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: 'transparent', color: '#6B6B66',
  border: `1px solid ${BDR}`, borderRadius: 4,
  padding: '7px 14px', fontSize: 13, fontWeight: 500,
  cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif",
};

function StatusBadge({ status, config }: { status: string; config: { label: string; color: string } }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 500, textTransform: 'uppercase',
      letterSpacing: '0.04em', border: `1px solid ${config.color}`,
      color: config.color, background: 'transparent',
      borderRadius: 2, padding: '2px 7px', whiteSpace: 'nowrap',
    }}>
      {config.label}
    </span>
  );
}

// ── Empty ClientForm state ────────────────────────────────────────────────────

function emptyClient(): Partial<LegacyClient> {
  return {
    full_name: '', email: '', phone: '', address: '', city: '',
    state: '', zip: '', dob: null, ssn_last4: '',
    legacy_client_id: '', chapter: 7, case_type: 'ch7_regular',
    case_number: '', filed_date: null, discharge_date: null,
    attorney_fee: null, court_filing_fee: null,
    assigned_attorney: '', assigned_paralegal: '',
    status: 'pending_review', notes: '', source_system: 'BCI',
  };
}

// ── Client Form ───────────────────────────────────────────────────────────────

interface ClientFormProps {
  initial: Partial<LegacyClient>;
  importedBy: string;
  batchId: string;
  onSaved: (c: LegacyClient) => void;
  onCancel: () => void;
}

function ClientForm({ initial, importedBy, batchId, onSaved, onCancel }: ClientFormProps) {
  const [f, setF] = useState<Partial<LegacyClient>>(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (k: keyof LegacyClient, v: unknown) =>
    setF(p => ({ ...p, [k]: v }));

  async function save() {
    if (!f.full_name?.trim()) { setErr('Full name is required.'); return; }
    setSaving(true); setErr('');
    try {
      const payload = {
        ...f,
        imported_by:     importedBy,
        import_batch_id: batchId,
        full_name:       f.full_name?.trim(),
        status:          f.status ?? 'pending_review',
      };
      const saved = await sbPost<LegacyClient>('legacy_client_imports', payload);
      if (saved) onSaved(saved);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Save failed.');
    } finally { setSaving(false); }
  }

  const fg = (label: string, key: keyof LegacyClient, type = 'text', opts?: { placeholder?: string; half?: boolean }) => (
    <div style={{ gridColumn: opts?.half ? 'span 1' : 'span 2' }}>
      <label style={labelSt}>{label}</label>
      <input
        type={type}
        style={inputStyle()}
        value={(f[key] as string) ?? ''}
        onChange={e => set(key, e.target.value)}
        placeholder={opts?.placeholder}
      />
    </div>
  );

  return (
    <div style={{ background: SURF, border: `1px solid ${BDR}`, borderRadius: 4, padding: 24 }}>
      <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: 20, letterSpacing: '-0.02em', color: '#FAFAF7', marginBottom: 20 }}>
        {initial.full_name ? `Edit: ${initial.full_name}` : 'Add Legacy Client'}
      </h3>

      {err && (
        <div style={{ border: '1px solid #991B1B', borderRadius: 4, padding: '8px 12px', marginBottom: 16, fontSize: 13, color: '#991B1B' }}>{err}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* Identity */}
        <div style={{ gridColumn: 'span 2' }}>
          <p style={{ fontSize: 11, color: '#6B6B66', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, borderBottom: `1px solid ${BDR}`, paddingBottom: 6 }}>Identity</p>
        </div>
        {fg('Full Name *', 'full_name', 'text', { placeholder: 'Last, First' })}
        {fg('Legacy / Old System ID', 'legacy_client_id', 'text', { half: true })}
        <div style={{ gridColumn: 'span 1' }}>
          <label style={labelSt}>Source System</label>
          <select style={inputStyle()} value={f.source_system ?? 'BCI'} onChange={e => set('source_system', e.target.value)}>
            {['BCI', 'CasePacer', 'MyCase', 'Clio', 'AbacusLaw', 'Other'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        {fg('Date of Birth', 'dob', 'date', { half: true })}
        {fg('SSN Last 4 Only', 'ssn_last4', 'text', { half: true, placeholder: 'XXXX' })}

        {/* Contact */}
        <div style={{ gridColumn: 'span 2', marginTop: 8 }}>
          <p style={{ fontSize: 11, color: '#6B6B66', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, borderBottom: `1px solid ${BDR}`, paddingBottom: 6 }}>Contact</p>
        </div>
        {fg('Email', 'email', 'email', { half: true, placeholder: 'client@example.com' })}
        {fg('Phone', 'phone', 'tel', { half: true, placeholder: '(555) 000-0000' })}
        {fg('Address', 'address', 'text', { placeholder: '123 Main St' })}
        {fg('City', 'city', 'text', { half: true })}
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 8, gridColumn: 'span 1' }}>
          <div>
            <label style={labelSt}>State</label>
            <select style={inputStyle()} value={f.state ?? ''} onChange={e => set('state', e.target.value)}>
              <option value="">—</option>
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={labelSt}>ZIP</label>
            <input style={inputStyle()} value={f.zip ?? ''} onChange={e => set('zip', e.target.value)} placeholder="00000" />
          </div>
        </div>

        {/* Case */}
        <div style={{ gridColumn: 'span 2', marginTop: 8 }}>
          <p style={{ fontSize: 11, color: '#6B6B66', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, borderBottom: `1px solid ${BDR}`, paddingBottom: 6 }}>Case Details</p>
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={labelSt}>Chapter</label>
          <select style={inputStyle()} value={f.chapter ?? 7} onChange={e => set('chapter', parseInt(e.target.value))}>
            <option value={7}>Chapter 7</option>
            <option value={13}>Chapter 13</option>
          </select>
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={labelSt}>Case Type</label>
          <select style={inputStyle()} value={f.case_type ?? 'ch7_regular'} onChange={e => set('case_type', e.target.value)}>
            {CASE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        {fg('Court Case Number', 'case_number', 'text', { half: true, placeholder: 'e.g. 25-12345' })}
        {fg('Filed Date', 'filed_date', 'date', { half: true })}
        {fg('Discharge Date', 'discharge_date', 'date', { half: true })}
        <div style={{ gridColumn: 'span 1' }}>
          <label style={labelSt}>Status</label>
          <select style={inputStyle()} value={f.status ?? 'pending_review'} onChange={e => set('status', e.target.value as ImportStatus)}>
            <option value="pending_review">Pending Review</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
            <option value="on_hold">On Hold</option>
          </select>
        </div>

        {/* Fees */}
        <div style={{ gridColumn: 'span 2', marginTop: 8 }}>
          <p style={{ fontSize: 11, color: '#6B6B66', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, borderBottom: `1px solid ${BDR}`, paddingBottom: 6 }}>Fees</p>
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={labelSt}>Attorney Fee</label>
          <input type="number" style={inputStyle()} value={f.attorney_fee ?? ''} onChange={e => set('attorney_fee', e.target.value ? parseFloat(e.target.value) : null)} placeholder="0.00" />
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={labelSt}>Court Filing Fee</label>
          <input type="number" style={inputStyle()} value={f.court_filing_fee ?? ''} onChange={e => set('court_filing_fee', e.target.value ? parseFloat(e.target.value) : null)} placeholder="338.00" />
        </div>

        {/* Assignment */}
        <div style={{ gridColumn: 'span 2', marginTop: 8 }}>
          <p style={{ fontSize: 11, color: '#6B6B66', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, borderBottom: `1px solid ${BDR}`, paddingBottom: 6 }}>Assignment</p>
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={labelSt}>Assigned Attorney</label>
          <select style={inputStyle()} value={f.assigned_attorney ?? ''} onChange={e => set('assigned_attorney', e.target.value)}>
            <option value="">— Unassigned —</option>
            {STAFF_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: 'span 1' }}>
          <label style={labelSt}>Assigned Paralegal</label>
          <select style={inputStyle()} value={f.assigned_paralegal ?? ''} onChange={e => set('assigned_paralegal', e.target.value)}>
            <option value="">— Unassigned —</option>
            {STAFF_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        {/* Notes */}
        <div style={{ gridColumn: 'span 2', marginTop: 8 }}>
          <label style={labelSt}>Import Notes</label>
          <textarea
            style={{ ...inputStyle(), height: 72, padding: '8px 10px', resize: 'vertical' }}
            value={f.notes ?? ''}
            onChange={e => set('notes', e.target.value)}
            placeholder="Any notes about this import, discrepancies, or pending actions..."
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button
          onClick={save}
          disabled={saving}
          style={{ ...btn(), opacity: saving ? 0.5 : 1 }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1E3A2F'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#111111'; }}
        >
          {saving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
          {saving ? 'Saving...' : 'Save Client'}
        </button>
        <button onClick={onCancel} style={ghostBtn}>Cancel</button>
      </div>
    </div>
  );
}

// ── Document Manager ──────────────────────────────────────────────────────────

function DocManager({ client }: { client: LegacyClient }) {
  const [docs, setDocs]         = useState<LegacyDoc[]>([]);
  const [loaded, setLoaded]     = useState(false);
  const [open, setOpen]         = useState(false);
  const [adding, setAdding]     = useState(false);
  const [newCat, setNewCat]     = useState<DocCategory>('other');
  const [newLabel, setNewLabel] = useState('');
  const [newStatus, setNewStatus] = useState<DocStatus>('pending');
  const [newNote, setNewNote]   = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function load() {
    const d = await sbGet<LegacyDoc>(`legacy_import_documents?import_id=eq.${client.id}&order=created_at.asc`);
    setDocs(d);
    setLoaded(true);
  }

  async function toggle() {
    if (!open && !loaded) await load();
    setOpen(o => !o);
  }

  async function addDoc() {
    if (!newLabel.trim()) return;
    const doc = await sbPost<LegacyDoc>('legacy_import_documents', {
      import_id: client.id, doc_category: newCat,
      doc_label: newLabel.trim(), status: newStatus,
      notes: newNote.trim() || null,
    });
    if (doc) setDocs(d => [...d, doc]);
    setAdding(false); setNewLabel(''); setNewNote(''); setNewCat('other'); setNewStatus('pending');
  }

  async function updateDocStatus(id: string, status: DocStatus) {
    await sbPatch('legacy_import_documents', id, { status });
    setDocs(d => d.map(x => x.id === id ? { ...x, status } : x));
  }

  async function handleFileUpload(docId: string, file: File) {
    setUploading(true);
    try {
      const path = `legacy-imports/${client.id}/${docId}/${file.name}`;
      const formData = new FormData(); formData.append('', file);
      await fetch(`${SUPABASE_URL}/storage/v1/object/client-documents/${path}`, {
        method: 'POST',
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
        body: formData,
      });
      await sbPatch('legacy_import_documents', docId, { file_name: file.name, file_path: path, status: 'uploaded' });
      await load();
    } catch { /* non-blocking */ }
    finally { setUploading(false); }
  }

  const pendingCount = docs.filter(d => d.status === 'pending' || d.status === 'needs_scan' || d.status === 'missing').length;

  return (
    <div style={{ marginTop: 8, borderTop: `1px solid ${BDR}` }}>
      <button
        onClick={toggle}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', background: 'transparent', border: 'none', cursor: 'pointer' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#FAFAF7' }}>
          <FolderOpen size={14} strokeWidth={1.5} />
          Documents
          {loaded && (
            <span style={{ ...mono, fontSize: 11, color: '#6B6B66' }}>{docs.length} total</span>
          )}
          {pendingCount > 0 && (
            <span style={{ fontSize: 11, fontWeight: 500, border: '1px solid #B45309', color: '#B45309', borderRadius: 2, padding: '1px 6px' }}>
              {pendingCount} pending
            </span>
          )}
        </span>
        {open ? <ChevronUp size={14} strokeWidth={1.5} color="#6B6B66" /> : <ChevronDown size={14} strokeWidth={1.5} color="#6B6B66" />}
      </button>

      {open && (
        <div style={{ paddingBottom: 12 }}>
          {/* Doc list */}
          {docs.length === 0 && !adding && (
            <p style={{ fontSize: 13, color: '#6B6B66', padding: '8px 0' }}>No documents on file. Add document records below.</p>
          )}

          {docs.map(doc => {
            const cfg = DOC_STATUS_CONFIG[doc.status];
            return (
              <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: `1px solid ${BDR}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileText size={13} strokeWidth={1.5} color="#6B6B66" />
                    <span style={{ fontSize: 13, color: '#FAFAF7' }}>{doc.doc_label}</span>
                    <span style={{ fontSize: 11, color: '#6B6B66' }}>
                      {DOC_CATEGORIES.find(c => c.value === doc.doc_category)?.label}
                    </span>
                  </div>
                  {doc.notes && <p style={{ fontSize: 11, color: '#6B6B66', marginTop: 2, paddingLeft: 21 }}>{doc.notes}</p>}
                  {doc.file_name && <p style={{ ...mono, fontSize: 11, color: '#15803D', marginTop: 2, paddingLeft: 21 }}>{doc.file_name}</p>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <StatusBadge status={doc.status} config={cfg} />
                  <select
                    style={{ ...inputStyle(), width: 130, height: 28, fontSize: 11 }}
                    value={doc.status}
                    onChange={e => updateDocStatus(doc.id, e.target.value as DocStatus)}
                  >
                    {Object.entries(DOC_STATUS_CONFIG).map(([v, c]) => (
                      <option key={v} value={v}>{c.label}</option>
                    ))}
                  </select>
                  {/* Upload trigger */}
                  <input
                    ref={fileRef}
                    type="file"
                    style={{ display: 'none' }}
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) handleFileUpload(doc.id, f);
                    }}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    style={{ ...ghostBtn, padding: '3px 8px', fontSize: 11 }}
                    title="Upload file"
                  >
                    <Upload size={11} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Add doc form */}
          {adding ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, marginTop: 10, alignItems: 'end' }}>
              <div>
                <label style={labelSt}>Category</label>
                <select style={inputStyle()} value={newCat} onChange={e => setNewCat(e.target.value as DocCategory)}>
                  {DOC_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Label</label>
                <input style={inputStyle()} value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="e.g. 2024 Tax Return" />
              </div>
              <div>
                <label style={labelSt}>Status</label>
                <select style={inputStyle()} value={newStatus} onChange={e => setNewStatus(e.target.value as DocStatus)}>
                  {Object.entries(DOC_STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={addDoc} style={btn()}>Add</button>
                <button onClick={() => setAdding(false)} style={ghostBtn}>✕</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} style={{ ...ghostBtn, marginTop: 10, fontSize: 12 }}>
              <Plus size={12} strokeWidth={1.5} /> Add document record
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Client Row ────────────────────────────────────────────────────────────────

function ClientRow({ client, onUpdate }: { client: LegacyClient; onUpdate: (c: LegacyClient) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing]   = useState(false);
  const [promoting, setPromoting] = useState(false);

  const statusCfg = STATUS_CONFIG[client.status] ?? { label: client.status, color: '#6B6B66' };

  async function promote() {
    if (!confirm(`Promote ${client.full_name} to active client? This will create records in intake_leads and accounting_clients.`)) return;
    setPromoting(true);
    try {
      // Create intake lead
      const lead = await sbPost<{ id: string }>('intake_leads', {
        full_name:        client.full_name,
        email:            client.email,
        phone:            client.phone,
        source:           `Legacy Import — ${client.source_system}`,
        chapter_interest: client.chapter,
        status:           'retained',
        assigned_name:    client.assigned_attorney || client.assigned_paralegal || null,
        state:            client.state,
        notes:            `Imported from ${client.source_system}. Legacy ID: ${client.legacy_client_id ?? 'N/A'}. ${client.notes ?? ''}`.trim(),
        bot_followup_enabled: false,
        bot_followup_count:   0,
      });
      // Create accounting client
      const ac = await sbPost<{ id: string }>('accounting_clients', {
        client_id:          `IMPORT-${client.id.slice(0, 8).toUpperCase()}`,
        full_name:          client.full_name,
        email:              client.email,
        phone:              client.phone,
        state:              client.state,
        chapter:            client.chapter,
        case_type:          client.case_type,
        status:             client.status === 'closed' ? 'closed' : 'active',
        case_number:        client.case_number,
        filed_date:         client.filed_date,
        discharge_date:     client.discharge_date,
        assigned_attorney:  client.assigned_attorney,
        assigned_paralegal: client.assigned_paralegal,
        notes:              `Legacy import from ${client.source_system}. Original ID: ${client.legacy_client_id ?? 'N/A'}`,
        intake_review_status: 'not_submitted',
      });
      // Mark as promoted
      await sbPatch('legacy_client_imports', client.id, {
        accounting_client_id: ac?.id ?? null,
        intake_lead_id:       lead?.id ?? null,
        promoted_at:          new Date().toISOString(),
        status:               'active',
      });
      onUpdate({ ...client, accounting_client_id: ac?.id ?? null, promoted_at: new Date().toISOString(), status: 'active' });
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Promotion failed.');
    } finally { setPromoting(false); }
  }

  if (editing) {
    return (
      <ClientForm
        initial={client}
        importedBy={client.imported_by}
        batchId={client.import_batch_id}
        onSaved={updated => { onUpdate(updated); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div style={{ borderBottom: `1px solid ${BDR}` }}>
      {/* Row */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#FAFAF7' }}>{client.full_name}</span>
            <StatusBadge status={client.status} config={statusCfg} />
            <span style={{ ...mono, fontSize: 11, color: '#6B6B66' }}>Ch. {client.chapter}</span>
            {client.case_number && (
              <span style={{ ...mono, fontSize: 11, color: '#6B6B66' }}>{client.case_number}</span>
            )}
            {client.promoted_at && (
              <span style={{ fontSize: 11, color: '#15803D' }}>Promoted</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 3 }}>
            {client.email && <span style={{ fontSize: 12, color: '#6B6B66' }}>{client.email}</span>}
            {client.phone && <span style={{ fontSize: 12, color: '#6B6B66' }}>{client.phone}</span>}
            {client.assigned_attorney && <span style={{ fontSize: 12, color: '#6B6B66' }}>{client.assigned_attorney}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          {!client.promoted_at && (
            <button
              onClick={promote}
              disabled={promoting}
              style={{ ...btn('#1E3A2F'), fontSize: 12, padding: '6px 12px' }}
              title="Promote to active client"
            >
              {promoting ? <RefreshCw size={12} className="animate-spin" /> : <ArrowRight size={12} strokeWidth={1.5} />}
              Promote
            </button>
          )}
          <button onClick={() => setEditing(true)} style={{ ...ghostBtn, padding: '5px 10px', fontSize: 12 }}>Edit</button>
          {expanded
            ? <ChevronUp size={14} strokeWidth={1.5} color="#6B6B66" />
            : <ChevronDown size={14} strokeWidth={1.5} color="#6B6B66" />
          }
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ paddingBottom: 12, paddingLeft: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px 24px', fontSize: 12, marginBottom: 12 }}>
            {[
              ['Source', client.source_system],
              ['Legacy ID', client.legacy_client_id],
              ['City / State', `${client.city ?? ''}${client.city && client.state ? ', ' : ''}${client.state ?? ''}`],
              ['DOB', client.dob],
              ['Filed', client.filed_date],
              ['Discharged', client.discharge_date],
              ['Atty Fee', client.attorney_fee != null ? `$${client.attorney_fee.toLocaleString()}` : null],
              ['Filing Fee', client.court_filing_fee != null ? `$${client.court_filing_fee.toLocaleString()}` : null],
              ['Paralegal', client.assigned_paralegal],
              ['Case Type', CASE_TYPES.find(t => t.value === client.case_type)?.label],
            ].filter(([, v]) => v).map(([label, val]) => (
              <div key={String(label)}>
                <span style={{ color: '#6B6B66' }}>{label}: </span>
                <span style={{ ...mono, color: '#FAFAF7' }}>{String(val)}</span>
              </div>
            ))}
          </div>
          {client.notes && (
            <p style={{ fontSize: 12, color: '#6B6B66', borderLeft: '2px solid #2A2A28', paddingLeft: 10, marginBottom: 8 }}>{client.notes}</p>
          )}
          <DocManager client={client} />
        </div>
      )}
    </div>
  );
}

// ── CSV Import Modal ──────────────────────────────────────────────────────────

interface CsvImportModalProps {
  importedBy: string;
  batchId:    string;
  onImported: (clients: LegacyClient[]) => void;
  onClose:    () => void;
}

function CsvImportModal({ importedBy, batchId, onImported, onClose }: CsvImportModalProps) {
  const [rows, setRows]       = useState<BciRow[]>([]);
  const [mapped, setMapped]   = useState<Partial<LegacyClient>[]>([]);
  const [step, setStep]       = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [progress, setProgress] = useState(0);
  const [imported, setImported] = useState<LegacyClient[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const parsed = parseCsv(text);
      setRows(parsed);
      setMapped(parsed.map(mapBciRow));
      setStep('preview');
    };
    reader.readAsText(file);
  }

  async function runImport() {
    setStep('importing');
    const results: LegacyClient[] = [];
    for (let i = 0; i < mapped.length; i++) {
      try {
        const row = mapped[i];
        if (!row.full_name?.trim()) continue;
        const saved = await sbPost<LegacyClient>('legacy_client_imports', {
          ...row,
          imported_by: importedBy,
          import_batch_id: batchId,
          status: row.status ?? 'pending_review',
        });
        if (saved) results.push(saved);
      } catch { /* skip bad rows */ }
      setProgress(Math.round(((i + 1) / mapped.length) * 100));
    }
    setImported(results);
    setStep('done');
    onImported(results);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(17,17,17,0.6)', padding: 24 }}>
      <div style={{ background: SURF, border: `1px solid ${BDR}`, borderRadius: 4, width: '100%', maxWidth: 680, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${BDR}` }}>
          <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: 18, color: '#FAFAF7' }}>
            Import from BCI / CSV
          </h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6B6B66' }}>
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

          {step === 'upload' && (
            <div>
              <p style={{ fontSize: 13, color: '#6B6B66', marginBottom: 20 }}>
                Upload a BCI export CSV file. The importer supports both CommCred and client-list formats.
                Column headers are auto-detected. You can review and correct before importing.
              </p>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? '#1E3A2F' : BDR}`,
                  borderRadius: 4, padding: '40px 24px',
                  textAlign: 'center', cursor: 'pointer',
                  background: dragOver ? '#0d1a0f' : S2,
                  transition: 'all 150ms ease-out',
                }}
              >
                <Upload size={24} strokeWidth={1.5} color={dragOver ? '#1E3A2F' : '#6B6B66'} style={{ margin: '0 auto 12px' }} />
                <p style={{ fontSize: 14, color: '#FAFAF7', marginBottom: 6 }}>Drop BCI CSV file here</p>
                <p style={{ fontSize: 12, color: '#6B6B66' }}>or click to browse — .csv files only</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
              </div>

              <div style={{ marginTop: 16, border: `1px solid ${BDR}`, borderRadius: 4, padding: '12px 16px', background: S2 }}>
                <p style={{ fontSize: 12, color: '#6B6B66', lineHeight: 1.7 }}>
                  <strong style={{ color: '#FAFAF7' }}>Supported column names:</strong> FirstName/Last Name, Email, Phone,
                  Address, City, State, Zip, Chapter, CaseNumber, ClientID. Extra columns are preserved as raw data.
                  Missing columns can be filled in after import.
                </p>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <p style={{ fontSize: 13, color: '#6B6B66' }}>
                  <span style={{ ...mono, color: '#FAFAF7' }}>{rows.length}</span> rows detected.
                  Review the mapping below before importing.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setStep('upload')} style={ghostBtn}>Back</button>
                  <button
                    onClick={runImport}
                    style={btn()}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1E3A2F'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#111111'; }}
                  >
                    Import {rows.length} clients
                  </button>
                </div>
              </div>

              {/* Preview table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${BDR}` }}>
                      {['Full Name', 'Email', 'Phone', 'State', 'Ch.', 'Case #', 'Old ID'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: '#6B6B66', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mapped.slice(0, 50).map((m, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid #1a1a18` }}>
                        <td style={{ padding: '7px 10px', color: '#FAFAF7' }}>{m.full_name || <span style={{ color: '#991B1B' }}>Missing</span>}</td>
                        <td style={{ padding: '7px 10px', color: '#6B6B66' }}>{m.email ?? '—'}</td>
                        <td style={{ padding: '7px 10px', color: '#6B6B66' }}>{m.phone ?? '—'}</td>
                        <td style={{ ...mono, padding: '7px 10px', color: '#6B6B66' }}>{m.state ?? '—'}</td>
                        <td style={{ ...mono, padding: '7px 10px', color: '#6B6B66' }}>{m.chapter}</td>
                        <td style={{ ...mono, padding: '7px 10px', color: '#6B6B66' }}>{m.case_number ?? '—'}</td>
                        <td style={{ ...mono, padding: '7px 10px', color: '#6B6B66' }}>{m.legacy_client_id ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 50 && (
                  <p style={{ fontSize: 11, color: '#6B6B66', padding: '8px 10px' }}>
                    Showing first 50 of {rows.length} rows. All will be imported.
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <RefreshCw size={28} strokeWidth={1.5} color="#1E3A2F" style={{ margin: '0 auto 16px', display: 'block', animation: 'spin 1s linear infinite' }} />
              <p style={{ fontSize: 14, color: '#FAFAF7', marginBottom: 8 }}>Importing clients...</p>
              <div style={{ width: 240, height: 2, background: BDR, borderRadius: 2, margin: '0 auto' }}>
                <div style={{ height: '100%', background: '#1E3A2F', width: `${progress}%`, transition: 'width 150ms ease-out' }} />
              </div>
              <p style={{ ...mono, fontSize: 12, color: '#6B6B66', marginTop: 8 }}>{progress}%</p>
            </div>
          )}

          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ width: 44, height: 44, border: '1px solid #15803D', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <CheckCircle2 size={20} strokeWidth={1.5} color="#15803D" />
              </div>
              <p style={{ fontSize: 16, color: '#FAFAF7', marginBottom: 6 }}>Import complete</p>
              <p style={{ ...mono, fontSize: 13, color: '#6B6B66', marginBottom: 20 }}>
                {imported.length} of {rows.length} clients imported successfully
              </p>
              <button onClick={onClose} style={btn()}>Done — view imported clients</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function LegacyClientImport() {
  const [clients, setClients]   = useState<LegacyClient[]>([]);
  const [loaded, setLoaded]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState<ImportStatus | 'all'>('all');
  const [showAddForm, setShowAddForm]   = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [importedBy, setImportedBy]     = useState(STAFF_NAMES[0]);
  const [batchId, setBatchId]           = useState(() => `BATCH-${new Date().toISOString().slice(0,10)}`);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await sbGet<LegacyClient>('legacy_client_imports?order=created_at.desc');
    setClients(data);
    setLoaded(true);
    setLoading(false);
  }, []);

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.full_name.toLowerCase().includes(q)
      || (c.email ?? '').toLowerCase().includes(q)
      || (c.case_number ?? '').toLowerCase().includes(q)
      || (c.legacy_client_id ?? '').toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total:          clients.length,
    pending_review: clients.filter(c => c.status === 'pending_review').length,
    active:         clients.filter(c => c.status === 'active').length,
    promoted:       clients.filter(c => c.promoted_at).length,
  };

  return (
    <div style={{ minHeight: '100vh', background: BG, color: '#FAFAF7' }}>
      {/* Top bar */}
      <div style={{ height: 56, background: BG, borderBottom: `1px solid ${BDR}`, display: 'flex', alignItems: 'center', padding: '0 28px', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: 18, letterSpacing: '-0.02em', color: '#FAFAF7' }}>
            Legacy Client Import
          </span>
          <span style={{ fontSize: 13, color: '#6B6B66', marginLeft: 12 }}>Migrate existing clients from BCI or another system</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => load()} style={ghostBtn}>
            <RefreshCw size={13} strokeWidth={1.5} /> Refresh
          </button>
          <button onClick={() => setShowCsvModal(true)} style={{ ...btn(), background: '#111' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1E3A2F'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#111'; }}
          >
            <Upload size={14} strokeWidth={1.5} /> Import BCI / CSV
          </button>
          <button
            onClick={() => { setShowAddForm(true); if (!loaded) load(); }}
            style={btn()}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1E3A2F'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#111111'; }}
          >
            <Plus size={14} strokeWidth={1.5} /> Add client manually
          </button>
        </div>
      </div>

      <div className="pt-7 pb-20 px-4 sm:px-7" style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Session controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <div>
            <label style={labelSt}>Importing as</label>
            <select style={{ ...inputStyle(), width: 180 }} value={importedBy} onChange={e => setImportedBy(e.target.value)}>
              {STAFF_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label style={labelSt}>Batch ID</label>
            <input style={{ ...inputStyle(), width: 200, ...mono }} value={batchId} onChange={e => setBatchId(e.target.value)} />
          </div>
        </div>

        {/* Stats row */}
        {loaded && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Total Imported',   val: stats.total,          accent: '#6B6B66' },
              { label: 'Pending Review',   val: stats.pending_review, accent: '#B45309' },
              { label: 'Active',           val: stats.active,         accent: '#15803D' },
              { label: 'Promoted to CMS',  val: stats.promoted,       accent: '#1E3A2F' },
            ].map(s => (
              <div key={s.label} style={{ border: `1px solid ${BDR}`, borderRadius: 4, padding: '16px 20px', background: SURF }}>
                <p style={{ fontSize: 12, color: '#6B6B66', marginBottom: 6 }}>{s.label}</p>
                <p style={{ ...mono, fontSize: 28, fontWeight: 400, color: s.accent, lineHeight: 1 }}>{s.val}</p>
              </div>
            ))}
          </div>
        )}

        {/* Manual add form */}
        {showAddForm && (
          <div style={{ marginBottom: 24 }}>
            <ClientForm
              initial={emptyClient()}
              importedBy={importedBy}
              batchId={batchId}
              onSaved={c => { setClients(prev => [c, ...prev]); setShowAddForm(false); }}
              onCancel={() => setShowAddForm(false)}
            />
          </div>
        )}

        {/* Search + filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} strokeWidth={1.5} color="#6B6B66" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              style={{ ...inputStyle(), paddingLeft: 32 }}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email, case number, or legacy ID..."
            />
          </div>
          <div>
            <select
              style={{ ...inputStyle(), width: 160 }}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as ImportStatus | 'all')}
            >
              <option value="all">All statuses</option>
              {Object.entries(STATUS_CONFIG).map(([v, c]) => (
                <option key={v} value={v}>{c.label}</option>
              ))}
            </select>
          </div>
          {!loaded && (
            <button
              onClick={load}
              style={btn()}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1E3A2F'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#111111'; }}
            >
              {loading ? <RefreshCw size={14} className="animate-spin" /> : null}
              Load clients
            </button>
          )}
        </div>

        {/* Client list */}
        {!loaded && !loading && !showAddForm && (
          <div style={{ padding: '32px 0' }}>
            <p style={{ fontSize: 14, color: '#6B6B66' }}>
              Use "Import BCI / CSV" to bulk-import from your old system, or "Add client manually" for individual records.
            </p>
            <p style={{ fontSize: 13, color: '#3A3A36', marginTop: 6 }}>
              Click "Load clients" to view previously imported records.
            </p>
          </div>
        )}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '24px 0', color: '#6B6B66', fontSize: 13 }}>
            <RefreshCw size={14} strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite' }} /> Loading...
          </div>
        )}

        {loaded && filtered.length === 0 && (
          <div style={{ padding: '32px 0', borderTop: `1px solid ${BDR}` }}>
            <p style={{ fontSize: 14, color: '#6B6B66' }}>{search || statusFilter !== 'all' ? 'No clients match the current filter.' : 'No clients imported yet.'}</p>
          </div>
        )}

        {filtered.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, borderBottom: `1px solid ${BDR}`, paddingBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#6B6B66' }}>
                Showing <span style={{ ...mono, color: '#FAFAF7' }}>{filtered.length}</span> of {clients.length} clients
              </span>
              <button
                onClick={() => {
                  const csv = [
                    ['Name','Email','Phone','State','Chapter','Case Number','Status','Legacy ID','Filed','Assigned Attorney'].join(','),
                    ...filtered.map(c => [
                      `"${c.full_name}"`, c.email ?? '', c.phone ?? '',
                      c.state ?? '', c.chapter, c.case_number ?? '',
                      c.status, c.legacy_client_id ?? '',
                      c.filed_date ?? '', c.assigned_attorney ?? '',
                    ].join(',')),
                  ].join('\n');
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
                  a.download = `legacy-import-${batchId}.csv`;
                  a.click();
                }}
                style={{ ...ghostBtn, fontSize: 12, padding: '5px 10px' }}
              >
                <Download size={12} strokeWidth={1.5} /> Export list
              </button>
            </div>
            {filtered.map(c => (
              <ClientRow
                key={c.id}
                client={c}
                onUpdate={updated => setClients(prev => prev.map(x => x.id === updated.id ? updated : x))}
              />
            ))}
          </div>
        )}
      </div>

      {/* CSV modal */}
      {showCsvModal && (
        <CsvImportModal
          importedBy={importedBy}
          batchId={batchId}
          onImported={newClients => {
            setClients(prev => [...newClients, ...prev]);
            setLoaded(true);
          }}
          onClose={() => setShowCsvModal(false)}
        />
      )}
    </div>
  );
}
