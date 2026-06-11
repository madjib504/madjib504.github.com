/**
 * ProviderBadge — single source of truth for displaying provider badges.
 *
 * Renders a 2-layer badge (trust + optional commercial). The trust badge is
 * ALWAYS visible (credibility), the commercial badge is shown only for
 * paid/sponsored providers and carries a discreet "Sponsorisé" tag.
 *
 * Usage:
 *   <ProviderBadge badges={provider.badges} size="sm" />
 *   <ProviderBadge badges={provider.badges} sponsored hint />
 */
import { ShieldCheck, BadgeCheck, Star, Sparkles, FileText } from 'lucide-react';

// Tailwind color map (kept in JS so it survives JIT purge — class names exist literally).
const COLOR_CLASSES = {
  slate:   'bg-slate-100 text-slate-700 border-slate-200',
  amber:   'bg-amber-100 text-amber-800 border-amber-200',
  emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  orange:  'bg-orange-100 text-orange-800 border-orange-300',
  purple:  'bg-purple-100 text-purple-800 border-purple-300',
  violet:  'bg-violet-100 text-violet-800 border-violet-300',
};

const TRUST_ICONS = {
  seeded:   FileText,
  pending:  Star,
  rejected: FileText,
  verified: ShieldCheck,
};

const COMMERCIAL_ICONS = {
  boost:        Sparkles,
  premium:      BadgeCheck,
  premium_plus: BadgeCheck,
};

const SIZE = {
  xs: { pad: 'px-1.5 py-0.5', text: 'text-[10px]', icon: 'w-3 h-3' },
  sm: { pad: 'px-2 py-0.5',   text: 'text-xs',     icon: 'w-3.5 h-3.5' },
  md: { pad: 'px-2.5 py-1',   text: 'text-sm',     icon: 'w-4 h-4' },
};

export default function ProviderBadge({
  badges,
  size = 'sm',
  hint = false,
  sponsored = false,
  className = '',
}) {
  if (!badges || !badges.trust) return null;
  const s = SIZE[size] || SIZE.sm;

  const TrustIcon = TRUST_ICONS[badges.trust.key] || FileText;
  const trustClasses = COLOR_CLASSES[badges.trust.color] || COLOR_CLASSES.slate;

  const CommIcon = badges.commercial
    ? (COMMERCIAL_ICONS[badges.commercial.key] || BadgeCheck)
    : null;
  const commClasses = badges.commercial
    ? (COLOR_CLASSES[badges.commercial.color] || COLOR_CLASSES.purple)
    : null;

  return (
    <span className={`inline-flex items-center gap-1 flex-wrap ${className}`} data-testid="provider-badge">
      <span
        className={`inline-flex items-center gap-1 rounded-full border font-medium ${trustClasses} ${s.pad} ${s.text}`}
        title={hintText(badges.trust.key)}
        data-testid={`badge-trust-${badges.trust.key}`}
      >
        <TrustIcon className={s.icon} aria-hidden />
        {badges.trust.label}
      </span>

      {badges.commercial && (
        <span
          className={`inline-flex items-center gap-1 rounded-full border font-medium ${commClasses} ${s.pad} ${s.text}`}
          title="Cette fiche bénéficie d'une mise en avant commerciale."
          data-testid={`badge-commercial-${badges.commercial.key}`}
        >
          <CommIcon className={s.icon} aria-hidden />
          {badges.commercial.label}
        </span>
      )}

      {sponsored && badges.commercial && (
        <span
          className="inline-flex items-center text-[10px] text-stone-500 italic"
          data-testid="badge-sponsored-disclaimer"
        >
          (Sponsorisé)
        </span>
      )}
    </span>
  );
}

function hintText(key) {
  switch (key) {
    case 'verified':
      return 'Identité du professionnel vérifiée par Keneyakafisa.';
    case 'pending':
      return 'Le professionnel a revendiqué cette fiche. Vérification en cours.';
    case 'rejected':
      return "Fiche présente dans l'annuaire (revendication non aboutie).";
    case 'seeded':
    default:
      return "Fiche pré-référencée. Le professionnel peut la revendiquer.";
  }
}
