/**
 * PartnerPricing — public Tarifs page for healthcare providers.
 *
 * Goal: convert seeded/claimed providers into paying Partenaire Officiel.
 * Layout:
 *   1. Hero ("Faites grandir votre établissement")
 *   2. 3 plan cards (Annuaire — gratuit / Mis en avant — 3000 XOF / Partenaire Officiel — 15000 XOF)
 *   3. Interactive ROI calculator
 *   4. Comparison table
 *   5. FAQ
 *   6. Final CTA
 *
 * The actual payment integration is Phase 2 — for now the "Souscrire" CTA
 * routes to the claim flow so providers must first claim/verify before paying.
 */
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Check, Sparkles, BadgeCheck, ShieldCheck, FileText,
  TrendingUp, Users, Calendar, ArrowRight, Calculator,
} from 'lucide-react';

const PLANS = [
  {
    key: 'free',
    name: 'Annuaire',
    price: 0,
    period: 'gratuit',
    Icon: FileText,
    color: 'slate',
    description:
      "Votre fiche est pré-référencée. Visible dans les résultats de recherche standards.",
    features: [
      { ok: true,  label: 'Présence dans l\'annuaire Keneyakafisa' },
      { ok: true,  label: 'Adresse, téléphone, horaires affichés' },
      { ok: true,  label: 'Géolocalisation sur la carte' },
      { ok: false, label: 'Revendiquer la fiche pour la mettre à jour' },
      { ok: false, label: 'Badge Identité vérifiée' },
      { ok: false, label: 'Photos & galerie' },
      { ok: false, label: 'Statistiques de visites' },
    ],
    cta: 'Présent par défaut',
    ctaTo: '/search',
    ctaVariant: 'outline',
  },
  {
    key: 'boost',
    name: 'Mis en avant',
    price: 3000,
    period: '7 jours',
    pricePerDay: '~430 XOF/jour',
    Icon: Sparkles,
    color: 'orange',
    description:
      "Coup de projecteur ponctuel : votre fiche apparaît en tête sur tous les mots-clés de votre catégorie pendant 7 jours.",
    features: [
      { ok: true, label: 'Tout ce qui est dans Annuaire' },
      { ok: true, label: 'Mise en avant 7 jours dans le tri par défaut' },
      { ok: true, label: 'Badge orange « Mis en avant »' },
      { ok: true, label: 'Bonus Trust score (+3)' },
      { ok: true, label: 'Statistiques basiques (vues, clics)' },
      { ok: false, label: 'Récurrence automatique' },
    ],
    cta: 'Boostez ma fiche',
    ctaTo: '/register/claim',
    ctaVariant: 'default',
    badge: 'Test rapide',
  },
  {
    key: 'premium',
    name: 'Partenaire Officiel',
    price: 15000,
    period: 'par mois',
    pricePerDay: '~500 XOF/jour',
    Icon: BadgeCheck,
    color: 'purple',
    description:
      "Identité vérifiée + visibilité prioritaire continue. La solution recommandée pour développer durablement votre activité.",
    features: [
      { ok: true, label: 'Tout ce qui est dans Mis en avant' },
      { ok: true, label: 'Badge violet « Partenaire Officiel »' },
      { ok: true, label: 'Identité vérifiée par notre équipe' },
      { ok: true, label: 'Photos professionnelles & vidéo de présentation' },
      { ok: true, label: 'Statistiques complètes (vues, RDV, conversion)' },
      { ok: true, label: 'Support prioritaire WhatsApp' },
      { ok: true, label: 'Renouvellement automatique mensuel' },
    ],
    cta: 'Devenir Partenaire',
    ctaTo: '/register/claim',
    ctaVariant: 'premium',
    badge: 'Recommandé',
    highlight: true,
  },
];

const COLOR_TOKENS = {
  slate:  { bg: 'bg-slate-50',  border: 'border-slate-200',  text: 'text-slate-700',  pill: 'bg-slate-100 text-slate-700' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', pill: 'bg-orange-100 text-orange-700' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-800', pill: 'bg-purple-100 text-purple-800' },
};

const FAQ = [
  {
    q: "Dois-je payer pour apparaître sur Keneyakafisa ?",
    a: "Non. Toutes les fiches sont gratuites dans l'annuaire. Le paiement sert uniquement à augmenter votre visibilité et à obtenir le badge Partenaire Officiel.",
  },
  {
    q: "Comment se passe le paiement en Côte d'Ivoire ?",
    a: "Mobile Money (Orange Money, MTN, Moov, Wave) — disponible bientôt. Les paiements actuels s'effectuent par virement après contact avec notre équipe.",
  },
  {
    q: "Puis-je arrêter à tout moment ?",
    a: "Oui. Le plan Mis en avant expire automatiquement après 7 jours. Le plan Partenaire Officiel se renouvelle chaque mois et peut être désactivé à tout moment depuis votre dashboard.",
  },
  {
    q: "Le tri de la recherche est-il vraiment honnête ?",
    a: "Oui. Les fiches sponsorisées affichent un disclaimer « Sponsorisé » et le boost de score est plafonné. La proximité géographique et la pertinence médicale restent les critères principaux du tri.",
  },
  {
    q: "Comment me faire vérifier sans payer ?",
    a: "Revendiquez votre fiche, fournissez des documents (carte ordre, RCCM, diplôme) et notre équipe valide gratuitement votre identité sous 48-72h. La vérification est totalement gratuite.",
  },
];

// ---------------------------------------------------------------------------
// ROI Calculator
// ---------------------------------------------------------------------------
function ROICalculator() {
  const [views, setViews] = useState(50);
  const [conversion, setConversion] = useState(5);
  const [fee, setFee] = useState(5000);
  const [plan, setPlan] = useState('premium');

  const monthlyCost = plan === 'premium' ? 15000 : plan === 'boost' ? 12858 : 0; // boost extrapolated to 30j
  const stats = useMemo(() => {
    const dailyAppts = (views * conversion) / 100;
    const dailyRevenue = dailyAppts * fee;
    const monthlyRevenue = dailyRevenue * 30;
    const netMonthly = monthlyRevenue - monthlyCost;
    const roi = monthlyCost > 0 ? Math.round((netMonthly / monthlyCost) * 100) : null;
    return { dailyAppts, dailyRevenue, monthlyRevenue, netMonthly, roi };
  }, [views, conversion, fee, monthlyCost]);

  const fmt = (n) => Math.round(n).toLocaleString('fr-FR');

  return (
    <div
      className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 shadow-sm"
      data-testid="roi-calculator"
    >
      <div className="flex items-center gap-2 mb-1">
        <Calculator className="w-5 h-5 text-blue-700" />
        <h3 className="text-xl sm:text-2xl font-bold text-blue-900">
          Calculez votre retour sur investissement
        </h3>
      </div>
      <p className="text-sm text-stone-600 mb-6">
        Estimez ce que peut vous rapporter une fiche bien mise en avant.
      </p>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <Slider label="Vues estimées / jour" min={5} max={500} step={5}
                value={views} onChange={setViews} suffix=" vues"
                testid="slider-views" />
        <Slider label="Taux de conversion" min={1} max={20} step={1}
                value={conversion} onChange={setConversion} suffix=" %"
                testid="slider-conversion" />
        <Slider label="Prix moyen consultation" min={1000} max={50000} step={500}
                value={fee} onChange={setFee} suffix=" XOF"
                testid="slider-fee" />
      </div>

      <div className="flex flex-wrap gap-2 mb-6" data-testid="plan-toggle">
        {[
          { k: 'free',    label: 'Annuaire (gratuit)' },
          { k: 'boost',   label: 'Mis en avant' },
          { k: 'premium', label: 'Partenaire Officiel' },
        ].map((p) => (
          <button
            key={p.k}
            type="button"
            onClick={() => setPlan(p.k)}
            data-testid={`plan-btn-${p.k}`}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              plan === p.k
                ? 'bg-blue-900 text-white border-blue-900'
                : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPI label="RDV / jour" value={stats.dailyAppts.toFixed(1)} icon={Calendar} />
        <KPI label="Revenu / jour" value={`${fmt(stats.dailyRevenue)} XOF`} icon={TrendingUp} />
        <KPI label="Revenu / mois" value={`${fmt(stats.monthlyRevenue)} XOF`} icon={Users} />
        <KPI
          label={monthlyCost > 0 ? `Bénéfice net / mois (après ${fmt(monthlyCost)} XOF)` : "Bénéfice / mois"}
          value={`${fmt(stats.netMonthly)} XOF`}
          highlight
          icon={Sparkles}
        />
      </div>

      {stats.roi !== null && (
        <p className="text-sm mt-5 text-stone-700" data-testid="roi-line">
          Soit un <span className="font-bold text-blue-900">ROI de {stats.roi}%</span> par mois
          {stats.roi > 0
            ? " — votre fiche s'autofinance largement."
            : " — il faut quelques semaines pour rentabiliser."}
        </p>
      )}
      <p className="text-[11px] text-stone-500 italic mt-2">
        Estimation indicative. Les résultats réels dépendent de votre spécialité, votre zone et la qualité de votre fiche.
      </p>
    </div>
  );
}

function Slider({ label, min, max, step, value, onChange, suffix, testid }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-stone-600">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-blue-700"
          data-testid={testid}
        />
        <span className="text-sm font-semibold text-blue-900 whitespace-nowrap min-w-[80px] text-right">
          {value.toLocaleString('fr-FR')}{suffix}
        </span>
      </div>
    </label>
  );
}

function KPI({ label, value, highlight = false, icon: Icon }) {
  return (
    <div
      className={`rounded-xl p-3 ${
        highlight
          ? 'bg-gradient-to-br from-blue-900 to-blue-700 text-white shadow-md'
          : 'bg-stone-50 text-stone-700 border border-stone-100'
      }`}
    >
      {Icon && (
        <Icon className={`w-4 h-4 mb-1 ${highlight ? 'text-blue-200' : 'text-stone-400'}`} />
      )}
      <div className={`text-xs ${highlight ? 'text-blue-100' : 'text-stone-500'}`}>{label}</div>
      <div className="text-base sm:text-lg font-bold mt-0.5">{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plan card
// ---------------------------------------------------------------------------
function PlanCard({ plan }) {
  const t = COLOR_TOKENS[plan.color] || COLOR_TOKENS.slate;
  const Icon = plan.Icon;
  return (
    <Card
      className={`relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg ${
        plan.highlight ? 'border-2 border-purple-300 shadow-lg' : `border ${t.border}`
      } rounded-2xl`}
      data-testid={`plan-card-${plan.key}`}
    >
      {plan.badge && (
        <div
          className={`absolute top-3 right-3 ${t.pill} text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide`}
          data-testid={`plan-badge-${plan.key}`}
        >
          {plan.badge}
        </div>
      )}
      <CardContent className={`p-6 sm:p-7 ${t.bg}`}>
        <Icon className={`w-8 h-8 ${t.text} mb-3`} />
        <h3 className="text-lg sm:text-xl font-bold text-stone-900">{plan.name}</h3>
        <div className="flex items-baseline gap-1.5 mt-3 min-h-[40px]">
          {plan.price > 0 ? (
            <>
              <span className="text-3xl sm:text-4xl font-extrabold text-stone-900">
                {plan.price.toLocaleString('fr-FR')}
              </span>
              <span className="text-sm text-stone-600">XOF</span>
              <span className="text-sm text-stone-500 ml-1">/ {plan.period}</span>
            </>
          ) : (
            <span className="text-2xl font-bold text-stone-900">Gratuit</span>
          )}
        </div>
        {plan.pricePerDay && (
          <p className="text-xs text-stone-500 mb-3">{plan.pricePerDay}</p>
        )}
        <p className="text-sm text-stone-600 mt-2 mb-5 leading-relaxed min-h-[60px]">
          {plan.description}
        </p>
        <ul className="space-y-2 mb-6">
          {plan.features.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Check
                className={`w-4 h-4 mt-0.5 shrink-0 ${
                  f.ok ? 'text-emerald-600' : 'text-stone-300 line-through'
                }`}
              />
              <span className={f.ok ? 'text-stone-700' : 'text-stone-400 line-through'}>
                {f.label}
              </span>
            </li>
          ))}
        </ul>
        <Link to={plan.ctaTo}>
          <Button
            className={`w-full rounded-full ${
              plan.ctaVariant === 'premium'
                ? 'bg-purple-700 hover:bg-purple-800 text-white'
                : plan.ctaVariant === 'outline'
                ? 'bg-white text-stone-700 border border-stone-300 hover:bg-stone-50'
                : 'bg-blue-900 hover:bg-blue-800 text-white'
            }`}
            data-testid={`plan-cta-${plan.key}`}
          >
            {plan.cta}
            {plan.ctaVariant !== 'outline' && <ArrowRight className="w-4 h-4 ml-1" />}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function PartnerPricing() {
  return (
    <div className="min-h-screen bg-stone-50 pt-24 pb-16 px-4 md:px-6" data-testid="partner-pricing-page">
      <div className="max-w-6xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            <ShieldCheck className="w-3.5 h-3.5" />
            Pour les professionnels de santé
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold text-blue-900 leading-tight">
            Faites grandir votre établissement
          </h1>
          <p className="text-stone-600 mt-4 max-w-2xl mx-auto text-base sm:text-lg">
            Toutes les fiches sont gratuites. Choisissez la mise en avant qui vous convient,
            et concentrez-vous sur vos patients.
          </p>
          <div className="flex justify-center gap-3 mt-6 flex-wrap">
            <Link to="/register/claim">
              <Button
                className="bg-blue-900 hover:bg-blue-800 text-white rounded-full px-6 h-11"
                data-testid="hero-claim-btn"
              >
                Revendiquer ma fiche
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
            <a href="#calculator">
              <Button
                variant="outline"
                className="rounded-full px-6 h-11"
                data-testid="hero-calc-btn"
              >
                <Calculator className="w-4 h-4 mr-1" />
                Calculer mon ROI
              </Button>
            </a>
          </div>
        </div>

        {/* 3 plan cards */}
        <div className="grid md:grid-cols-3 gap-5 mb-12">
          {PLANS.map((p) => (
            <PlanCard key={p.key} plan={p} />
          ))}
        </div>

        {/* ROI calculator */}
        <div id="calculator" className="mb-12 scroll-mt-24">
          <ROICalculator />
        </div>

        {/* Trust strip */}
        <div className="bg-white border border-stone-100 rounded-2xl p-6 sm:p-8 mb-12">
          <div className="grid sm:grid-cols-3 gap-6 text-center">
            <div>
              <ShieldCheck className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <div className="font-bold text-stone-900 mb-1">Tri transparent</div>
              <p className="text-xs text-stone-600">
                Les fiches sponsorisées sont clairement identifiées. La pertinence médicale et la
                proximité restent les critères principaux.
              </p>
            </div>
            <div>
              <Users className="w-8 h-8 text-blue-700 mx-auto mb-2" />
              <div className="font-bold text-stone-900 mb-1">Vérification gratuite</div>
              <p className="text-xs text-stone-600">
                Notre équipe vérifie gratuitement votre identité sous 48-72h après réception de vos
                documents.
              </p>
            </div>
            <div>
              <TrendingUp className="w-8 h-8 text-purple-700 mx-auto mb-2" />
              <div className="font-bold text-stone-900 mb-1">Sans engagement</div>
              <p className="text-xs text-stone-600">
                Pas de contrat long-terme. Désactivez votre plan à tout moment depuis votre
                dashboard.
              </p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mb-12">
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-blue-900 mb-6 text-center">
            Questions fréquentes
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {FAQ.map((item, i) => (
              <details
                key={i}
                className="bg-white border border-stone-200 rounded-xl p-4 group hover:border-blue-200 transition-colors"
                data-testid={`faq-item-${i}`}
              >
                <summary className="cursor-pointer font-semibold text-stone-900 list-none flex items-center justify-between">
                  {item.q}
                  <ArrowRight className="w-4 h-4 text-stone-400 group-open:rotate-90 transition-transform" />
                </summary>
                <p className="text-sm text-stone-600 mt-3 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>

        {/* Final CTA */}
        <div className="text-center bg-gradient-to-br from-blue-900 to-blue-700 text-white rounded-2xl p-8 sm:p-12">
          <h2 className="text-2xl sm:text-3xl font-serif font-bold mb-3">
            Prêt à développer votre activité ?
          </h2>
          <p className="text-blue-100 mb-6 max-w-xl mx-auto">
            Revendiquez d'abord votre fiche gratuitement. Une fois vérifiée, vous pourrez activer
            une mise en avant en quelques clics.
          </p>
          <Link to="/register/claim">
            <Button
              className="bg-white text-blue-900 hover:bg-blue-50 rounded-full px-8 h-12 font-semibold"
              data-testid="final-cta-btn"
            >
              Revendiquer ma fiche maintenant
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
