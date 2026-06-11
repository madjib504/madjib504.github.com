/**
 * ClaimsSocialProof — small banner shown under search results.
 *
 * Encourages providers to claim their fiche by surfacing how many peers
 * already claimed theirs this month (FOMO local).
 * Hidden if the API returns 0 to avoid the empty-counter effect.
 */
import { useEffect, useState } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { Link } from 'react-router-dom';
import { Sparkles, ShieldCheck } from 'lucide-react';

export default function ClaimsSocialProof() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${API}/stats/claims-monthly`)
      .then((r) => !cancelled && setStats(r.data))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!stats) return null;
  // Only show if we have any meaningful number
  if (!stats.claims_this_month && !stats.verified_total) return null;

  return (
    <div
      className="mt-8 mb-6 bg-gradient-to-br from-blue-50 to-emerald-50 border border-blue-100 rounded-2xl p-5 sm:p-6 shadow-sm"
      data-testid="claims-social-proof"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles className="w-5 h-5 text-blue-700" />
            <h3 className="text-base sm:text-lg font-semibold text-blue-900">
              Cette fiche est la vôtre&nbsp;?
            </h3>
          </div>
          <p className="text-sm text-stone-700 leading-relaxed">
            Votre établissement est déjà présent sur Keneyakafisa. Revendiquez votre
            profil pour recevoir davantage de patients, gérer votre réputation et
            développer votre activité.
          </p>
          <div className="flex flex-wrap gap-4 mt-3 text-xs sm:text-sm text-stone-600">
            {stats.claims_this_month > 0 && (
              <span className="inline-flex items-center gap-1.5" data-testid="stat-claims-month">
                <span className="font-bold text-blue-900 text-base">{stats.claims_this_month}</span>
                fiches revendiquées ce mois
              </span>
            )}
            {stats.verified_total > 0 && (
              <span className="inline-flex items-center gap-1.5" data-testid="stat-verified-total">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-emerald-700 text-base">{stats.verified_total}</span>
                établissements vérifiés
              </span>
            )}
            {stats.providers_total > 0 && (
              <span className="inline-flex items-center gap-1.5 text-stone-500">
                sur <span className="font-semibold text-stone-700">{stats.providers_total}</span> au total
              </span>
            )}
          </div>
        </div>
        <Link
          to="/claim"
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-full bg-blue-900 hover:bg-blue-800 text-white text-sm font-semibold shadow-md whitespace-nowrap"
          data-testid="claim-cta-from-search"
        >
          Revendiquer ma fiche
        </Link>
      </div>
    </div>
  );
}
