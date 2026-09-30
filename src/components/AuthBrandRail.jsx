import { Icon } from './icons';
import hytLogo from '../assets/HYT.png';

/**
 * The brand rail shared by the Login and Register pages.  It carries the HYT
 * identity (logo lockup, "Helping Youth Transcend" wordmark and the brand
 * palette) into the authentication flow so sign-in still feels like the
 * foundation rather than a generic form.
 */
export function AuthBrandRail({ description, points = [], footnote = 'HYT Foundation Inc.' }) {
  return (
    <aside className="auth-brand">
      <div className="auth-brand-glow auth-brand-glow-a" aria-hidden="true" />
      <div className="auth-brand-glow auth-brand-glow-b" aria-hidden="true" />

      <div className="auth-brand-inner">
        <div className="auth-brand-logo-card">
          <img src={hytLogo} alt="HYT Foundation — Helping Youth Transcend" />
        </div>

        <h1 className="auth-brand-title">
          Helping Youth{' '}
          <span>Transcend</span>
        </h1>

        {description && <p className="auth-brand-text">{description}</p>}

        <ul className="auth-brand-points">
          {points.map((point) => (
            <li key={point}>
              <span className="auth-brand-tick"><Icon name="check" size={13} /></span>
              {point}
            </li>
          ))}
        </ul>
      </div>

      <p className="auth-brand-foot">{footnote}</p>
    </aside>
  );
}
