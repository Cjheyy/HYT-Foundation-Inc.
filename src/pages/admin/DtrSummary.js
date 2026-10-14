import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { DateField } from '../../components/DateField';
import { Icon } from '../../components/icons';
import { showToast } from '../../utils/notifications';
import { printHtmlDocument } from '../../utils/printDocument';
import { buildDtrHtml } from '../../utils/dtrDocument';
import { mergeDtrRows, resolveWorkplace } from '../../utils/dtrRows';
import {
  getAttendanceLogs, getDailyReports, getOjtRecords, getOpportunities, getUsers
} from '../../services/supabaseService';
import './DtrSummary.css';

/** Roles that render hours and therefore have a DTR worth printing. */
const RENDERER_ROLES = ['OJT/INTERN', 'OJT_INTERN', 'INTERN', 'OJT', 'TRAINEE'];

function normalizeRole(role) {
  return String(role ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}

function normalizeName(person) {
  return person?.fullName || person?.full_name || person?.email || person?.id || '';
}

export function DtrSummary() {
  const [people, setPeople] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [reports, setReports] = useState([]);
  const [ojtRecords, setOjtRecords] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [userId, setUserId] = useState('');
  const [mentorName, setMentorName] = useState('');
  const [hrName, setHrName] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [frameHeight, setFrameHeight] = useState(1120);
  const frameRef = useRef(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      // One fetch of each table, then everything is filtered in memory.  A DTR
      // is per-person, so re-picking the person must not hit the network again.
      const [userList, logs, reportList, ojtList, postingList] = await Promise.all([
        getUsers(),
        getAttendanceLogs(),
        getDailyReports(),
        // Only for the "Building / Office" column: attendance → ojt_records →
        // opportunities.location.  These two are decoration on an otherwise
        // complete sheet, so a failure here must NOT blank the DTR — it just
        // leaves the column empty.
        getOjtRecords().catch(() => []),
        getOpportunities().catch(() => [])
      ]);
      setPeople(Array.isArray(userList) ? userList : []);
      setAttendance(Array.isArray(logs) ? logs : []);
      setReports(Array.isArray(reportList) ? reportList : []);
      setOjtRecords(Array.isArray(ojtList) ? ojtList : []);
      setOpportunities(Array.isArray(postingList) ? postingList : []);
    } catch (error) {
      console.error('DTR summary load failed:', error);
      setLoadError(error?.message || 'Failed to load attendance data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const personOptions = useMemo(() => people
    .filter((person) => RENDERER_ROLES.includes(normalizeRole(person.role)))
    .map((person) => ({ value: person.id, label: normalizeName(person) }))
    .sort((a, b) => a.label.localeCompare(b.label)), [people]);

  const selectedPerson = useMemo(
    () => people.find((person) => person.id === userId) || null,
    [people, userId]
  );

  // Every row for the chosen person, merged with their daily reports and
  // narrowed to the date range — the same merge the CSV export uses, so the
  // printed sheet and the spreadsheet can never disagree.
  const rows = useMemo(() => {
    if (!userId) return [];
    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const to = toDate ? new Date(`${toDate}T23:59:59.999`) : null;
    const mine = attendance.filter((row) => (row.userId || row.user_id) === userId);
    const merged = mergeDtrRows(mine, reports);
    if (!from && !to) return merged;
    return merged.filter((row) => {
      const raw = row?.date;
      if (!raw) return false;
      const date = new Date(`${String(raw).slice(0, 10)}T00:00:00`);
      if (Number.isNaN(date.getTime())) return false;
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    });
  }, [attendance, fromDate, reports, toDate, userId]);

  const requiredHours = selectedPerson?.requiredHours ?? selectedPerson?.required_hours ?? 0;

  // The building / office printed in the last column — resolved from the OJT
  // posting this trainee was accepted into, not from the attendance row.
  const workplace = useMemo(
    () => resolveWorkplace(ojtRecords, opportunities, userId),
    [ojtRecords, opportunities, userId]
  );

  // Reset the signature fields whenever the person changes — a leftover mentor
  // name from the previous trainee is exactly the kind of error that gets
  // signed without being noticed.
  useEffect(() => {
    setMentorName('');
    setHrName('');
  }, [userId]);

  // The "generated at" stamp is pinned to the SELECTION, not to every
  // keystroke: otherwise the footer clock ticks over while the admin is still
  // typing a mentor's name, which looks like the document is rewriting itself.
  const [generatedAt, setGeneratedAt] = useState(() => new Date());
  useEffect(() => { setGeneratedAt(new Date()); }, [userId, fromDate, toDate]);

  /**
   * The document itself.  The preview below and the print dialog consume this
   * exact string, so what the admin is looking at cannot drift from what comes
   * out of the printer.
   */
  const dtrHtml = useMemo(() => {
    if (!selectedPerson) return '';
    return buildDtrHtml({
      user: selectedPerson,
      rows,
      requiredHours,
      workplace,
      mentorName,
      hrName,
      generatedAt
    });
  }, [generatedAt, hrName, mentorName, requiredHours, rows, selectedPerson, workplace]);

  // Grow the preview frame to fit the sheet instead of showing an inner
  // scrollbar.  Same-origin srcDoc, so the measurement is safe; anything
  // unexpected just leaves the default height in place.
  const handleFrameLoad = (event) => {
    try {
      const doc = event.currentTarget.contentDocument;
      if (!doc) return;
      const height = doc.documentElement?.scrollHeight || doc.body?.scrollHeight;
      if (height) setFrameHeight(height);
    } catch {
      /* keep the default height */
    }
  };

  const handlePrint = () => {
    if (!selectedPerson) {
      showToast('Select an OJT/trainee first.', 'warning');
      return;
    }
    if (!rows.length) {
      showToast('No attendance records in the selected range.', 'warning');
      return;
    }
    const opened = printHtmlDocument(dtrHtml, {
      title: `DTR — ${normalizeName(selectedPerson)}`
    });
    if (!opened) {
      showToast('Could not open the print dialog. Please try again.', 'error');
    }
  };

  return (
    <div className="dtr-summary-page">
      <div className="page-header">
        <h1 className="page-title">Printable DTR</h1>
      </div>

      <Card className="dtr-controls">
        <div className="dtr-control-grid">
          <Select
            label="OJT / Trainee"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            options={personOptions}
            placeholder={loading ? 'Loading…' : 'Select a trainee'}
          />
          <DateField
            label="From date (optional)"
            name="fromDate"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
          <DateField
            label="To date (optional)"
            name="toDate"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
          />
          <Input
            label="Mentor / Supervisor name"
            value={mentorName}
            onChange={(event) => setMentorName(event.target.value)}
          />
          <Input
            label="HR Representative name"
            value={hrName}
            onChange={(event) => setHrName(event.target.value)}
          />
        </div>

        <div className="dtr-actions">
          <Button onClick={handlePrint} disabled={loading || !selectedPerson || !rows.length}>
            <Icon name="file" size={15} /> Print / Save as PDF
          </Button>
          <Button variant="ghost" onClick={loadAll} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh data'}
          </Button>
          {(fromDate || toDate) && (
            <Button variant="ghost" onClick={() => { setFromDate(''); setToDate(''); }}>
              Clear dates
            </Button>
          )}
        </div>
      </Card>

      {loadError && (
        <Card className="dtr-preview">
          <p className="dtr-empty dtr-error">{loadError}</p>
        </Card>
      )}

      {!loadError && !selectedPerson && (
        <Card className="dtr-preview">
          <p className="dtr-empty">Select an OJT/trainee to see the DTR preview.</p>
        </Card>
      )}

      {!loadError && selectedPerson && (
        <Card className="dtr-preview">
          <div className="card-header">
            <h2 className="card-title">Preview — {normalizeName(selectedPerson)}</h2>
          </div>

          {rows.length === 0 ? (
            <p className="dtr-empty">No attendance records in the selected range.</p>
          ) : (
            <>
              <div className="dtr-frame-wrap">
                <iframe
                  ref={frameRef}
                  className="dtr-frame"
                  title={`DTR preview — ${normalizeName(selectedPerson)}`}
                  srcDoc={dtrHtml}
                  onLoad={handleFrameLoad}
                  style={{ height: `${frameHeight}px` }}
                />
              </div>
              <p className="dtr-note">
                Ito na mismo ang ipi-print na dokumento — awtomatikong nagbabago habang
                tina-type mo ang pangalan ng Mentor at HR o binabago ang date range.
                I-print o i-save bilang PDF kapag tama na ang nakikita mo.
              </p>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

export default DtrSummary;
