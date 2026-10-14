import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icons';
import {
  WEEKDAY_SHORT,
  addMonths,
  buildMonthGrid,
  daysInMonth,
  formatDisplay,
  formatMonthLabel,
  isOutOfRange,
  minuteOptions,
  pad2,
  parseValue,
  toDateValue,
  toDateTimeValue,
  todayParts
} from '../utils/dateParts';
import './DateField.css';

/**
 * A date / date-time field with OUR OWN picker.
 *
 * ## Why this exists
 *
 * The admin forms used `<input type="date">` and `<input type="datetime-local">`.
 * Those are drawn by the BROWSER: the calendar popup is Chrome's own widget, and
 * a page has no API to close it — there is no "dismiss" call, and `blur()` is an
 * undocumented trick that may stop working in any Chrome release.  So after
 * picking a date the popup stayed open over the form, which is what the admin
 * kept running into.
 *
 * This component renders the calendar itself, so "it closes when you are done"
 * is a fact rather than a hope: the popover closes on **Done**, on **Escape**,
 * on a click outside, and — for a date-only field — the moment a day is picked.
 *
 * ## Drop-in shape
 *
 * `onChange` receives a synthetic `{ target: { name, value } }`, exactly the
 * shape a native input emits, so every existing `handleChange` in the admin
 * pages works unchanged.  `value` is the same wire format the native input used:
 * `'YYYY-MM-DD'` for a date, `'YYYY-MM-DDTHH:mm'` for a date-time.
 *
 * ## The one behaviour change
 *
 * `required` draws the asterisk and sets `aria-required`, but it is NOT a native
 * constraint: a button cannot carry `required`.  Every one of the four admin
 * forms already validates its own dates in `validate()` and renders the message
 * inline, so an empty date still cannot be submitted — the error just comes from
 * the form instead of the browser's bubble.
 *
 * ## Portalled on purpose
 *
 * The create-forms live in a modal whose body is a scroll container
 * (`overflow-y: auto`).  An absolutely-positioned popover inside it would be
 * clipped at the modal's edge, so the popover is portalled to `document.body`
 * and positioned with `position: fixed` from the trigger's rect.
 */

/** When a date-time field has no time yet, this is the hour it starts at.
 *  Midnight would make a freshly-picked schedule read "12:00 AM", which looks
 *  like a bug on a form whose whole subject is office hours. */
const DEFAULT_HOUR = 9;

const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MERIDIEMS = ['AM', 'PM'];

export function DateField({
  label,
  error,
  help,
  type = 'date',
  name,
  value,
  onChange,
  required = false,
  disabled = false,
  min,
  max,
  placeholder,
  className = '',
  id,
  ...props
}) {
  const withTime = type === 'datetime-local';

  const generatedId = useId();
  const fieldId = id || `date-field-${generatedId}`;
  const popoverId = `${fieldId}-popover`;
  const errorId = `${fieldId}-error`;
  const helpId = `${fieldId}-help`;
  const describedBy = [error ? errorId : null, help && !error ? helpId : null]
    .filter(Boolean)
    .join(' ') || undefined;

  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const openedRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);

  const selected = useMemo(() => parseValue(value), [value]);
  const today = useMemo(() => todayParts(), []);
  const todayIso = toDateValue(today);

  const [view, setView] = useState(() => {
    const base = parseValue(value) || todayParts();
    return { year: base.year, month: base.month };
  });
  const [focusIso, setFocusIso] = useState('');
  // Bumped only by the arrow keys, so the month-nav buttons do not yank focus
  // out of the button the admin just clicked and into the grid.
  const [focusRequest, setFocusRequest] = useState(0);

  const cells = useMemo(() => buildMonthGrid(view.year, view.month), [view.year, view.month]);
  const minutes = useMemo(() => minuteOptions(selected?.minute), [selected?.minute]);

  const hour24 = selected ? selected.hour : DEFAULT_HOUR;
  const minute = selected ? selected.minute : 0;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const meridiem = hour24 < 12 ? 'AM' : 'PM';

  const display = formatDisplay(selected, withTime);
  const selectedIso = selected ? toDateValue(selected) : '';

  // The roving tab stop: one Tab reaches the grid, then the arrow keys move
  // inside it.  Without this the month would be 42 tab stops.
  const tabbableIso = cells.some((cell) => cell.iso === focusIso)
    ? focusIso
    : (cells.find((cell) => cell.inMonth)?.iso || '');

  /** Emit the native-input event shape so existing `handleChange`s just work. */
  const emit = useCallback((nextValue) => {
    if (typeof onChange !== 'function') return;
    onChange({ target: { name, value: nextValue, type: withTime ? 'datetime-local' : 'date' } });
  }, [name, onChange, withTime]);

  const closePopover = useCallback(() => setOpen(false), []);

  const openPopover = useCallback(() => {
    if (disabled) return;
    const base = parseValue(value) || todayParts();
    setView({ year: base.year, month: base.month });
    setFocusIso(toDateValue(base));
    setOpen(true);
  }, [disabled, value]);

  const changeMonth = useCallback((delta) => {
    setView((previous) => addMonths(previous.year, previous.month, delta));
  }, []);

  const commitDay = useCallback((iso) => {
    const parts = parseValue(iso);
    if (!parts) return;
    if (!withTime) {
      emit(iso);
      closePopover();
      return;
    }
    // Keep the time the field already had, so picking a different day does not
    // silently reset the hour the admin just set.
    emit(toDateTimeValue({
      ...parts,
      hour: selected ? selected.hour : DEFAULT_HOUR,
      minute: selected ? selected.minute : 0
    }));
  }, [closePopover, emit, selected, withTime]);

  const commitTime = useCallback((patch) => {
    const base = selected || todayParts();
    emit(toDateTimeValue({ ...base, ...patch }));
  }, [emit, selected]);

  const handleHour = (nextHour12) => {
    commitTime({ hour: (nextHour12 % 12) + (meridiem === 'PM' ? 12 : 0) });
  };

  const handleMeridiem = (nextMeridiem) => {
    if (nextMeridiem === meridiem) return;
    commitTime({ hour: nextMeridiem === 'PM' ? hour12 + 12 : hour12 % 12 });
  };

  const goToToday = () => {
    setView({ year: today.year, month: today.month });
    setFocusIso(todayIso);
    commitDay(todayIso);
  };

  const handleGridKeyDown = (event) => {
    const index = cells.findIndex((cell) => cell.iso === focusIso);
    if (index < 0) return;

    let nextIndex = null;
    if (event.key === 'ArrowLeft') nextIndex = index - 1;
    else if (event.key === 'ArrowRight') nextIndex = index + 1;
    else if (event.key === 'ArrowUp') nextIndex = index - 7;
    else if (event.key === 'ArrowDown') nextIndex = index + 7;
    else if (event.key === 'Home') nextIndex = cells.findIndex((cell) => cell.inMonth);
    else if (event.key === 'End') nextIndex = 41 - [...cells].reverse().findIndex((cell) => cell.inMonth);
    else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      const target = addMonths(view.year, view.month, event.key === 'PageUp' ? -1 : 1);
      const day = Math.min(parseValue(focusIso)?.day || 1, daysInMonth(target.year, target.month));
      setView(target);
      setFocusIso(`${target.year}-${pad2(target.month)}-${pad2(day)}`);
      setFocusRequest((count) => count + 1);
      return;
    } else return;

    const target = cells[nextIndex];
    if (!target) return;
    event.preventDefault();
    if (!target.inMonth) setView({ year: target.year, month: target.month });
    setFocusIso(target.iso);
    setFocusRequest((count) => count + 1);
  };

  // Position the portalled popover under the trigger, flipping up when there is
  // more room above.  Re-measured on scroll (capture, so the modal's own scroll
  // container counts) and on resize.
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return undefined;
    }

    const measure = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const height = popoverRef.current?.getBoundingClientRect().height || 352;
      const width = Math.max(rect.width, 296);
      const margin = 8;
      const spaceBelow = window.innerHeight - rect.bottom;
      const flip = spaceBelow < height + margin && rect.top > spaceBelow;

      let left = rect.left;
      if (left + width > window.innerWidth - margin) left = window.innerWidth - width - margin;
      if (left < margin) left = margin;

      setPosition({
        top: flip ? Math.max(margin, rect.top - height - 6) : rect.bottom + 6,
        left,
        width
      });
    };

    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open]);

  // Close on a click outside, and on Escape.
  //
  // Escape is on `document` in the CAPTURE phase, which is also where <Modal>
  // listens.  The modal defers to any open field marked `data-escape-owns` (see
  // Modal.jsx), so this handler is the one that acts and the dialog stays up —
  // otherwise Escape would tear down the whole form just to dismiss a calendar.
  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (popoverRef.current?.contains(event.target)) return;
      if (triggerRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  // Move focus into the popover once, on open, so Escape targets it rather than
  // the page behind.  Focus lands on the selected day when there is one.
  useEffect(() => {
    if (!open) {
      openedRef.current = false;
      return;
    }
    if (openedRef.current) return;
    openedRef.current = true;
    const node = (focusIso && popoverRef.current?.querySelector(`[data-day="${focusIso}"]`))
      || popoverRef.current;
    if (node && typeof node.focus === 'function') node.focus();
  }, [open, focusIso]);

  // Follow the arrow keys.  Guarded on `focusRequest` so month navigation does
  // not steal focus back out of the nav button that was just pressed.
  useEffect(() => {
    if (!open || focusRequest === 0) return;
    const node = popoverRef.current?.querySelector(`[data-day="${focusIso}"]`);
    if (node) node.focus();
  }, [focusIso, focusRequest, open]);

  const popover = open ? createPortal(
    <div
      ref={popoverRef}
      id={popoverId}
      className="date-field-popover"
      role="dialog"
      aria-label={label || props['aria-label'] || 'Choose a date'}
      tabIndex={-1}
      /* The popover is portalled to <body>, so it is NOT a DOM descendant of
         the `.date-field` wrapper — it has to carry the marker itself or the
         modal's Escape deferral would not see it. */
      data-escape-owns="true"
      style={{
        top: position ? position.top : -9999,
        left: position ? position.left : -9999,
        width: position ? position.width : 296,
        visibility: position ? 'visible' : 'hidden'
      }}
    >
      <div className="date-field-nav">
        <button
          type="button"
          className="date-field-nav-btn"
          onClick={() => changeMonth(-1)}
          aria-label="Previous month"
        >
          <span aria-hidden="true">‹</span>
        </button>
        <span className="date-field-month">{formatMonthLabel(view.year, view.month)}</span>
        <button
          type="button"
          className="date-field-nav-btn"
          onClick={() => changeMonth(1)}
          aria-label="Next month"
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>

      <div className="date-field-weekdays" aria-hidden="true">
        {WEEKDAY_SHORT.map((day) => <span key={day} className="date-field-weekday">{day}</span>)}
      </div>

      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div className="date-field-grid" role="group" aria-label="Days" onKeyDown={handleGridKeyDown}>
        {cells.map((cell) => {
          const outOfRange = isOutOfRange(cell.iso, min, max);
          const isSelected = cell.iso === selectedIso;
          return (
            <button
              key={cell.iso}
              type="button"
              data-day={cell.iso}
              className={[
                'date-field-day',
                cell.inMonth ? '' : 'is-outside',
                isSelected ? 'is-selected' : '',
                cell.iso === todayIso ? 'is-today' : ''
              ].filter(Boolean).join(' ')}
              tabIndex={cell.iso === tabbableIso ? 0 : -1}
              disabled={outOfRange}
              aria-pressed={isSelected}
              aria-label={formatDisplay(cell.iso, false)}
              aria-current={cell.iso === todayIso ? 'date' : undefined}
              onClick={() => commitDay(cell.iso)}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      {withTime && (
        <div className="date-field-time">
          <span className="date-field-time-label">Time</span>
          <select
            className="date-field-select"
            aria-label="Hour"
            value={hour12}
            onChange={(event) => handleHour(Number(event.target.value))}
          >
            {HOURS_12.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <select
            className="date-field-select"
            aria-label="Minute"
            value={minute}
            onChange={(event) => commitTime({ minute: Number(event.target.value) })}
          >
            {minutes.map((option) => (
              <option key={option} value={option}>{pad2(option)}</option>
            ))}
          </select>
          <div className="date-field-meridiem" role="group" aria-label="AM or PM">
            {MERIDIEMS.map((option) => (
              <button
                key={option}
                type="button"
                className={`date-field-meridiem-btn ${meridiem === option ? 'is-active' : ''}`}
                aria-pressed={meridiem === option}
                onClick={() => handleMeridiem(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="date-field-actions">
        <button type="button" className="date-field-link" onClick={goToToday}>Today</button>
        <button
          type="button"
          className="date-field-link"
          onClick={() => { emit(''); closePopover(); }}
        >
          Clear
        </button>
        {withTime && (
          <button type="button" className="date-field-done" onClick={closePopover}>Done</button>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="form-group date-field" data-escape-owns={open ? 'true' : undefined}>
      {label && (
        <label className="form-label" htmlFor={fieldId}>
          {label}
          {required && <span className="required-marker" aria-hidden="true"> *</span>}
        </label>
      )}

      <div className="date-field-control">
        <button
          type="button"
          id={fieldId}
          ref={triggerRef}
          className={`form-input date-field-trigger ${className} ${error ? 'error' : ''} ${display ? '' : 'is-empty'}`.trim()}
          onClick={() => (open ? closePopover() : openPopover())}
          disabled={disabled}
          // The trigger opens a dialog and reports a value, so it is announced
          // as a combobox rather than a plain button. The role is what makes
          // aria-invalid / aria-required legal here: on an implicit `button`
          // role both attributes are unsupported, and jsx-a11y rejects them —
          // which `CI=true` turns into a build failure, so this is also what
          // keeps the production build compiling.
          role="combobox"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? popoverId : undefined}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          {...props}
        >
          <span className="date-field-value">{display || placeholder || 'Select a date'}</span>
          <span className="date-field-icons" aria-hidden="true">
            <Icon name="calendar" size={15} />
          </span>
        </button>

        {display && !disabled && (
          <button
            type="button"
            className="date-field-clear"
            aria-label="Clear date"
            onClick={() => emit('')}
          >
            ×
          </button>
        )}
      </div>

      {error && <div className="form-error" id={errorId} role="alert">{error}</div>}
      {help && !error && <div className="form-help" id={helpId}>{help}</div>}

      {popover}
    </div>
  );
}

export default DateField;
