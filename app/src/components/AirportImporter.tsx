import { useMemo, useState } from 'react';
import { Airplane24Regular, Dismiss24Regular, Globe24Regular } from '@fluentui/react-icons';
import { AIRPORT_CATALOG, searchCatalog } from '../importer/catalog';
import { IMPORT_PHASES, runImport, type ImportPhase, type ImportProgress } from '../importer/import';
import { tr, useLang } from '../i18n';

const PHASE_LABEL: Record<ImportPhase, string> = {
  gather: 'Finding the airport article',
  facts: 'Gathering airport facts',
  localized: 'Collecting localized descriptions',
  map: 'Downloading real map data (OpenStreetMap)',
  generate: 'Generating sample data',
  validate: 'Validating the data',
  store: 'Storing data in the browser',
  activate: 'Activating the airport',
};

export function AirportImporter({ onClose }: { onClose: () => void }) {
  const { lang } = useLang();
  const [q, setQ] = useState('');
  const [iata, setIata] = useState('');
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const list = useMemo(() => searchCatalog(q), [q]);
  const busy = progress !== null && !done && !error;

  async function start() {
    setError(''); setDone(false); setProgress({ phase: IMPORT_PHASES[0], index: 0, total: IMPORT_PHASES.length, percent: 0 });
    try {
      await runImport(iata, setProgress);
      setDone(true);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <>
      {progress && (
        <div className="import-scrim" role="alertdialog" aria-modal="true" aria-labelledby="imp-title" aria-describedby="imp-phase">
          <div className="import-card">
            <h2 id="imp-title"><Globe24Regular /> {done ? tr('Airport imported') : error ? tr('Import failed') : tr('Importing airport…')}</h2>
            <div className="import-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent} aria-label={tr('Import progress')}>
              <span className={done || error ? 'fill' : 'fill run'} style={{ width: `${done ? 100 : progress.percent}%` }} />
            </div>
            <p id="imp-phase" role="status">{done ? '100%' : `${progress.percent}%`} · {error ? error : done ? tr('All data is stored. Reload to apply.') : tr(PHASE_LABEL[progress.phase])}</p>
            {(done || error) && (
              <div className="row">
                {done && <button onClick={() => location.reload()}>{tr('Reload now')}</button>}
                <button onClick={() => { if (error) setProgress(null); else onClose(); }}>{tr('Close')}</button>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="import-panel card" role="dialog" aria-label={tr('Import airport')}>
        <div className="row spread">
          <h2><Airplane24Regular /> {tr('Import airport')}</h2>
          <button onClick={onClose} aria-label={tr('Close')} disabled={busy}><Dismiss24Regular /></button>
        </div>
        <p className="muted">{tr('Pick an airport anywhere in the world. Public data is gathered from the internet and valid sample data is generated and stored.')}</p>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('Search by name, IATA or ICAO')} aria-label={tr('Search by name, IATA or ICAO')} />
        <ul className="import-list" role="listbox" aria-label={tr('Airports')}>
          {list.map((a) => (
            <li key={a.iata} role="option" aria-selected={iata === a.iata} className={iata === a.iata ? 'sel' : ''} onClick={() => setIata(a.iata)}>
              <strong>{a.labels[lang]}</strong> <small>{a.iata} / {a.icao} · {a.country} · {a.timezone}</small>
            </li>
          ))}
          {list.length === 0 && <li className="muted">{tr('No matching airport ({n} available)', { n: AIRPORT_CATALOG.length })}</li>}
        </ul>
        <button className="primary" onClick={start} disabled={!iata || busy}>{tr('Import selected airport')}</button>
      </div>
    </>
  );
}
