import { useEffect, useState } from 'react';
import type { MutableRefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { bareForm } from '../pdf/pdfTarget';
import { LANGUAGES } from '../pdf/translate';
import { averagePageSeconds } from '../pdf/pageTimes';
import type { ArxivCommands, ArxivMode, ArxivTranslation } from './arxivLayout';
import './projectsHud.css';

interface Props {
  target: string | null; // the paper being shown
  page: number;
  pages: number; // 0 until the document has loaded
  error: string | null; // why the paper could not be shown
  mode: ArxivMode; // the overview, the side-by-side comparison, or one paper in focus
  onPage: (n: number) => void;
  onMode: (mode: ArxivMode) => void;
  onFocusBox: () => void; // a click on the box (not on a control) focuses the camera on it
  translation: ArxivTranslation; // how the translation is going
  commands: MutableRefObject<ArxivCommands>; // how to start and stop it
}

const formatDuration = (seconds: number) => (seconds < 90 ? `${Math.round(seconds)} s` : `${Math.round(seconds / 60)} min`);

/**
 * The controls of the arXiv view. The papers themselves are in the 3D scene (see ArxivPapers); this
 * box holds the address, the page buttons, the translation and the button for the side-by-side
 * comparison. It stands in the scene under the papers (see Css3dPanels).
 */
export default function ArxivHud({ target, page, pages, error, mode, onPage, onMode, onFocusBox, translation, commands }: Props) {
  const navigate = useNavigate();
  const [addr, setAddr] = useState(target ? bareForm(target) : '');
  useEffect(() => {
    setAddr(target ? bareForm(target) : '');
  }, [target]);

  // The language to translate into: the one picked, or a code typed in for any other
  const [lang, setLang] = useState('zh-CN');
  const [custom, setCustom] = useState('');
  const effectiveLang = (custom.trim() || lang).trim();
  const running = translation.state === 'running';
  // Changing the language drops the translation made so far: the right paper shows the original again
  const pickLang = (next: string, isCustom: boolean) => {
    commands.current.reset();
    if (isCustom) setCustom(next);
    else setLang(next);
  };
  const avg = averagePageSeconds();
  const avgText = avg === null ? 'Usually 20–30 s per page' : `Average ${Math.round(avg)} s per page`;
  const eta =
    avg !== null && running ? ` · about ${formatDuration((translation.total - translation.done) * avg)} left` : '';
  const pct = translation.total ? Math.round((translation.done / translation.total) * 100) : 0;

  const open = () => {
    const v = addr.trim().replace(/^\/+/, '').replace(/^https?:\/\//i, '');
    if (v) navigate('/' + v);
  };

  return (
    // A panel in the 3D scene (see Css3dPanels): no drag handle, no minimize, and no HUD box drawn
    // around it, because its outline would not follow the panel's perspective
    <div
      id="css3d-arxiv-bar"
      className="hud-box rift-doc--arxiv-bar css3d-panel"
      onClick={(e) => {
        if (!(e.target as Element).closest('button, input, select, textarea, a, label')) onFocusBox();
      }}
    >
      <div className="rift-doc__head">
        <h2 className="rift-doc__title">arXiv</h2>
        <span className="rift-doc__sub">{target ? bareForm(target) : 'no paper'}</span>
      </div>
      <form
        className="arxiv-bar__addr"
       
        onSubmit={(e) => {
          e.preventDefault();
          open();
        }}
      >
        <input
          className="arxiv-bar__input"
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
          spellCheck={false}
          placeholder="arxiv.org/pdf/1706.03762"
          aria-label="PDF address"
        />
        <button type="submit" className="arxiv-bar__btn">Open</button>
      </form>
      <div className="arxiv-bar__row">
        <button
          type="button"
          className="arxiv-bar__btn"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          ◀
        </button>
        <span className="arxiv-bar__page">Page {page} / {pages || '–'}</span>
        <button
          type="button"
          className="arxiv-bar__btn"
          onClick={() => onPage(page + 1)}
          disabled={!pages || page >= pages}
          aria-label="Next page"
        >
          ▶
        </button>
        <button
          type="button"
          className={`arxiv-bar__btn arxiv-bar__btn--wide${mode !== 'overview' ? ' arxiv-bar__btn--on' : ''}`}
          onClick={() => onMode(mode === 'overview' ? 'compare' : 'overview')}
          disabled={!pages}
        >
          {mode === 'overview' ? 'Side by side' : 'Overview'}
        </button>
      </div>
      <div className="arxiv-bar__row">
        <select
          className="arxiv-bar__input arxiv-bar__select"
          value={lang}
          onChange={(e) => pickLang(e.target.value, false)}
          aria-label="Translate into"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
        <input
          className="arxiv-bar__input arxiv-bar__code"
          value={custom}
          onChange={(e) => pickLang(e.target.value, true)}
          spellCheck={false}
          placeholder="or a code"
          aria-label="Other language code"
        />
        <button
          type="button"
          className={`arxiv-bar__btn arxiv-bar__btn--wide${running ? ' arxiv-bar__btn--on' : ''}`}
          disabled={!pages || !effectiveLang}
          onClick={() => (running ? commands.current.stop() : commands.current.translate(effectiveLang))}
        >
          {running ? 'Stop' : translation.state === 'done' ? 'Translate again' : 'Translate'}
        </button>
      </div>
      {translation.state !== 'idle' && (
        <div className="arxiv-bar__progress">
          <div className="arxiv-bar__track">
            <div className="arxiv-bar__fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="arxiv-bar__progress-text">
            {translation.state === 'error'
              ? `Translation stopped: ${translation.error}`
              : translation.state === 'done'
                ? `Translated all ${translation.total} pages`
                : `Translated ${translation.done} of ${translation.total} pages · ${avgText}${eta}`}
          </div>
        </div>
      )}
      {error && <div className="arxiv-bar__error">{error}</div>}
    </div>
  );
}
