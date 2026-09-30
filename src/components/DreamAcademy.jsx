import careerPhoto from '../assets/gallery/career.jpg';
import { DA_ABOUT, DA_FACTS, DA_GOALS, DA_PROGRAM, DA_UNITS } from '../data/dreamAcademy';
import './DreamAcademy.css';

const ordinal = (index) => String(index + 1).padStart(2, '0');

/**
 * Dream Academy — the closing section of the Home page.
 *
 * Five beats, in the order the source copy reads:
 *   1. header   — photo, the academy's name, and who it is run with
 *   2. about    — the one-paragraph explanation, on a card that breaks the
 *                 ramp rule between the header and the rest
 *   3. program  — Training Program / Training Objectives, as a two-panel spec
 *   4. goals    — Dreamer's Goals, as a pull-quote on the ink band
 *   5. units    — the eight units and what a trainee actually does in each
 *
 * Reveals ride the page-wide `data-reveal` system (useRevealOnScroll), which
 * scans for new nodes — so nothing here needs its own observer.
 *
 * The header's contrast is GUARANTEED, not eyeballed: the scrim is a flat
 * `rgba(14, 23, 38, 0.66)` painted over both the photo and the ramp wash, with a
 * strictly ADDITIVE bottom gradient over it. So whatever the photograph happens
 * to be under a glyph, the brightest possible pixel behind it is ~rgb(96, 102,
 * 112) — 5.78:1 against white. That is why the ramp wash sits BELOW the scrim
 * rather than on top of it, and why the gradient may only ever add ink.
 */
export function DreamAcademy() {
  return (
    <section className="da" id="dream-academy" aria-labelledby="da-title">
      {/* ---------------------------------------------------------------- */}
      {/* 1. Header                                                         */}
      {/* ---------------------------------------------------------------- */}
      <header className="da-head">
        {/* Decorative: the heading beside it already names the section. */}
        <img className="da-head-photo" src={careerPhoto} alt="" aria-hidden="true" />
        <span className="da-head-sweep" aria-hidden="true" />
        <span className="da-head-scrim" aria-hidden="true" />

        <div className="da-head-inner container">
          <p className="da-kicker" data-reveal>
            In partnership with Klassic Solutions Inc.
          </p>

          <h2 className="da-title" id="da-title" data-reveal>
            Dream <span className="da-title-outline">Academy</span>
          </h2>

          <span className="da-rule" aria-hidden="true" />

          <ul className="da-facts" data-reveal>
            {DA_FACTS.map((fact) => (
              <li className="da-fact" key={fact}>
                {fact}
              </li>
            ))}
          </ul>
        </div>

        {/* The logo ramp, full-bleed, as the seam into the white below. */}
        <span className="da-head-seam" aria-hidden="true" />
      </header>

      {/* ---------------------------------------------------------------- */}
      {/* 2. About                                                          */}
      {/* ---------------------------------------------------------------- */}
      <div className="da-about-wrap">
        <div className="container">
          <div className="da-about" data-reveal>
            <h3 className="da-h3">About Dream Academy</h3>
            <p className="da-body da-about-text">{DA_ABOUT}</p>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* 3. Training Program and Objectives                                 */}
      {/* ---------------------------------------------------------------- */}
      <div className="da-spec container">
        <div className="da-block-head" data-reveal>
          <p className="da-eyebrow">What a trainee signs up for</p>
          <h3 className="da-h3">Training Program and Objectives</h3>
        </div>

        <div className="da-spec-grid">
          {[DA_PROGRAM.program, DA_PROGRAM.objectives].map((panel, index) => (
            <article className="da-spec-card" data-reveal key={panel.title}>
              <span className="da-spec-num" aria-hidden="true">
                {ordinal(index)}
              </span>
              <h4 className="da-spec-title">{panel.title}</h4>
              <p className="da-body">{panel.body}</p>
            </article>
          ))}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* 4. Dreamer's Goals                                                */}
      {/* ---------------------------------------------------------------- */}
      <div className="da-goals">
        <div className="container">
          <div className="da-goals-inner" data-reveal>
            {/* A real heading, not a styled <p>: it labels the pull-quote in the
                document outline, which is what a screen reader reads out. */}
            <h3 className="da-goals-eyebrow">Dreamer&rsquo;s Goals</h3>
            <blockquote className="da-goals-text">{DA_GOALS}</blockquote>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* 5. Unit Assignments                                               */}
      {/* ---------------------------------------------------------------- */}
      <div className="da-units container">
        <div className="da-block-head" data-reveal>
          <p className="da-eyebrow">Eight units, one academy</p>
          <h3 className="da-h3">Unit Assignments</h3>
        </div>

        <ul className="da-grid">
          {DA_UNITS.map((unit, index) => (
            <li
              className="da-card"
              key={unit.name}
              data-reveal
              style={{ '--da-accent': unit.accent }}
            >
              <div className="da-card-top">
                <span className="da-card-num" aria-hidden="true">
                  {ordinal(index)}
                </span>
                <h4 className="da-card-name">{unit.name}</h4>
              </div>
              <ul className="da-list">
                {unit.duties.map((duty) => (
                  <li className="da-duty" key={duty}>
                    {duty}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default DreamAcademy;
