import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  ShieldCheck, Users, Clock, XCircle, CheckCircle2, Eye, FileText,
  Phone, Mail, User as UserIcon, Building2, AlertTriangle, Star
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const CLAIM_TYPE_LABELS = {
  owner: { label: 'Propriétaire', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  manager: { label: 'Manager', color: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
  doctor: { label: 'Médecin', color: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
  secretary: { label: 'Secrétaire', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  admin_rep: { label: 'Représentant', color: 'bg-pink-500/20 text-pink-300 border-pink-500/30' },
};

const KpiCard = ({ title, value, icon: Icon, color, testid }) => (
  <Card data-testid={testid} className="bg-slate-800 border-slate-700">
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide">{title}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const TrustBadge = ({ score }) => {
  let color = 'bg-red-500/20 text-red-300 border-red-500/40';
  let label = 'Faible';
  if (score >= 70) { color = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'; label = 'Élevée'; }
  else if (score >= 40) { color = 'bg-amber-500/20 text-amber-300 border-amber-500/40'; label = 'Moyenne'; }
  return (
    <Badge className={`${color} border font-mono`} data-testid={`trust-${score}`}>
      <Star className="w-3 h-3 mr-1 inline" />
      {score} · {label}
    </Badge>
  );
};

const ClaimTypeBadge = ({ type }) => {
  const meta = CLAIM_TYPE_LABELS[type] || { label: type || 'Autre', color: 'bg-slate-700 text-slate-300 border-slate-600' };
  return <Badge className={`${meta.color} border`}>{meta.label}</Badge>;
};

const formatDate = (s) => {
  if (!s) return '—';
  try { return new Date(s).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return s; }
};

const AdminClaimsPanel = ({ token }) => {
  const [stats, setStats] = useState(null);
  const [claims, setClaims] = useState([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [loading, setLoading] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const auth = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [s, l] = await Promise.all([
          axios.get(`${API}/admin/claims/stats`, auth),
          axios.get(`${API}/admin/claims?status=${statusFilter}`, auth),
        ]);
        if (!cancelled) {
          setStats(s.data);
          setClaims(l.data || []);
        }
      } catch (e) {
        if (!cancelled) toast.error('Chargement des claims impossible');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, statusFilter, refreshTick]);

  const refresh = () => setRefreshTick(t => t + 1);

  return (
    <div className="space-y-5" data-testid="admin-claims-panel">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="Providers"
          value={stats?.providers_total ?? '—'}
          icon={Users}
          color="bg-sky-500"
          testid="kpi-total"
        />
        <KpiCard
          title="Revendiqués"
          value={stats?.providers_claimed ?? '—'}
          icon={ShieldCheck}
          color="bg-emerald-500"
          testid="kpi-claimed"
        />
        <KpiCard
          title="En attente"
          value={stats?.claims_pending ?? '—'}
          icon={Clock}
          color="bg-amber-500"
          testid="kpi-pending"
        />
        <KpiCard
          title="Rejetés"
          value={stats?.claims_rejected ?? '—'}
          icon={XCircle}
          color="bg-red-500"
          testid="kpi-rejected"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'pending', label: 'En attente', count: stats?.claims_pending },
          { id: 'approved', label: 'Approuvés', count: stats?.claims_approved },
          { id: 'rejected', label: 'Rejetés', count: stats?.claims_rejected },
          { id: 'all', label: 'Tous' },
        ].map(t => (
          <button
            key={t.id}
            data-testid={`claim-filter-${t.id}`}
            onClick={() => setStatusFilter(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === t.id ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {t.label}{typeof t.count === 'number' ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {/* Claims table */}
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-slate-400">Chargement…</div>
          ) : claims.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              Aucune revendication dans ce statut.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/40">
                  <tr className="text-left text-slate-400">
                    <th className="py-3 px-4">Provider</th>
                    <th className="py-3 px-4">Demandeur</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Confiance</th>
                    <th className="py-3 px-4">Documents</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map(c => (
                    <tr
                      key={c.id}
                      data-testid={`claim-row-${c.id}`}
                      className="border-t border-slate-700 hover:bg-slate-900/50"
                    >
                      <td className="py-3 px-4 text-white font-medium">{c.provider_name}</td>
                      <td className="py-3 px-4 text-slate-300">
                        <div>{c.full_name}</div>
                        <div className="text-xs text-slate-500">{c.phone}</div>
                      </td>
                      <td className="py-3 px-4"><ClaimTypeBadge type={c.claim_type || c.function_role} /></td>
                      <td className="py-3 px-4"><TrustBadge score={c.trust_score || 0} /></td>
                      <td className="py-3 px-4 text-slate-300">
                        <span className="inline-flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          {(c.proof_documents || []).length}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{formatDate(c.created_at)}</td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          data-testid={`view-claim-${c.id}`}
                          onClick={() => setSelectedClaimId(c.id)}
                          className="text-amber-400 hover:bg-amber-500/10"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Voir détails
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedClaimId && (
        <ClaimDetailDialog
          claimId={selectedClaimId}
          token={token}
          onClose={() => setSelectedClaimId(null)}
          onDecided={() => { setSelectedClaimId(null); refresh(); }}
        />
      )}
    </div>
  );
};

const ClaimDetailDialog = ({ claimId, token, onClose, onDecided }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await axios.get(`${API}/admin/claims/${claimId}`, auth);
        if (!cancelled) setData(r.data);
      } catch (e) {
        toast.error('Impossible de charger la revendication');
        onClose();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimId]);

  const handleDecide = async () => {
    if (!decision) return;
    if (decision === 'reject' && reason.trim().length < 5) {
      toast.error('Indiquez une raison de rejet (5 caractères min).');
      return;
    }
    setSubmitting(true);
    try {
      await axios.put(`${API}/admin/claims/${claimId}/decide`, {
        action: decision,
        reason,
      }, auth);
      toast.success(decision === 'approve' ? 'Revendication approuvée' : 'Revendication rejetée');
      onDecided();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Décision impossible');
    } finally {
      setSubmitting(false);
    }
  };

  const { claim, provider, user, other_claims, trust_score_current } = data || {};

  return (
    <Dialog open={!!claimId} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-400" />
            Détail de la revendication
          </DialogTitle>
        </DialogHeader>

        {loading || !claim ? (
          <div className="py-16 text-center text-slate-400">Chargement…</div>
        ) : (
          <div className="space-y-5">
            {/* Provider info */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">{provider?.name || claim.provider_name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {provider?.activity_type || (provider?.specialties || []).join(', ') || '—'}
                  </p>
                  <div className="text-xs text-slate-500 mt-1">
                    {[provider?.neighborhood, provider?.city, provider?.country].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <TrustBadge score={trust_score_current ?? claim.trust_score ?? 0} />
              </div>
            </div>

            {/* User + Claim infos */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <UserIcon className="w-4 h-4" />
                  Demandeur
                </h4>
                <dl className="space-y-2 text-sm">
                  <div className="flex gap-2"><dt className="text-slate-500 w-24">Nom :</dt><dd className="text-white">{claim.full_name}</dd></div>
                  <div className="flex gap-2"><dt className="text-slate-500 w-24"><Phone className="w-3 h-3 inline" /> :</dt><dd className="text-white">{claim.phone}</dd></div>
                  <div className="flex gap-2"><dt className="text-slate-500 w-24"><Mail className="w-3 h-3 inline" /> :</dt><dd className="text-white break-all">{claim.email}</dd></div>
                  <div className="flex gap-2 items-center"><dt className="text-slate-500 w-24">Rôle :</dt><dd><ClaimTypeBadge type={claim.claim_type || claim.function_role} /></dd></div>
                  <div className="flex gap-2"><dt className="text-slate-500 w-24">Soumis :</dt><dd className="text-white">{formatDate(claim.created_at)}</dd></div>
                </dl>
              </div>

              <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-slate-300 mb-3">Message / Justification</h4>
                <p className="text-sm text-slate-200 whitespace-pre-wrap min-h-[80px]">
                  {claim.justification || <span className="italic text-slate-500">Aucune justification fournie</span>}
                </p>
              </div>
            </div>

            {/* Proof documents */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Documents justificatifs ({(claim.proof_documents || []).length})
              </h4>
              {(!claim.proof_documents || claim.proof_documents.length === 0) ? (
                <p className="text-sm text-slate-500 italic">Aucun document fourni — confiance réduite.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {claim.proof_documents.map((d, i) => {
                    const isImg = (d.content_type || '').startsWith('image/');
                    const url = process.env.REACT_APP_BACKEND_URL + d.url;
                    return (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid={`proof-doc-${i}`}
                        className="block p-2 rounded-lg bg-slate-900/50 border border-slate-700 hover:border-amber-500/50 transition"
                      >
                        {isImg ? (
                          <img src={url} alt={d.name} className="w-full h-24 object-cover rounded" />
                        ) : (
                          <div className="w-full h-24 flex flex-col items-center justify-center text-red-400">
                            <FileText className="w-8 h-8" />
                            <span className="text-xs mt-1">PDF</span>
                          </div>
                        )}
                        <p className="text-xs text-slate-300 mt-2 truncate" title={d.name}>
                          {d.name || `Document ${i + 1}`}
                        </p>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Other claims history */}
            {other_claims && other_claims.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-amber-300 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Autres demandes du même demandeur ({other_claims.length})
                </h4>
                <ul className="space-y-1 text-xs text-amber-100">
                  {other_claims.map(o => (
                    <li key={o.id}>
                      {formatDate(o.created_at)} · {o.provider_name} · <span className="font-mono">{o.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Decision panel — only if pending */}
            {claim.status === 'pending' && (
              <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-slate-300 mb-3">Décision</h4>
                <div className="flex gap-2 mb-3">
                  <Button
                    data-testid="decide-approve"
                    onClick={() => setDecision('approve')}
                    className={`flex-1 ${decision === 'approve' ? 'bg-emerald-500 text-slate-900' : 'bg-slate-700 hover:bg-emerald-500/70'}`}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Approuver
                  </Button>
                  <Button
                    data-testid="decide-reject"
                    onClick={() => setDecision('reject')}
                    className={`flex-1 ${decision === 'reject' ? 'bg-red-500 text-white' : 'bg-slate-700 hover:bg-red-500/70'}`}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Rejeter
                  </Button>
                </div>
                {decision && (
                  <Textarea
                    data-testid="decide-reason"
                    placeholder={decision === 'reject' ? 'Raison du rejet (obligatoire)…' : 'Note interne (optionnel)…'}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="bg-slate-900 border-slate-700 text-white"
                  />
                )}
              </div>
            )}

            {claim.status !== 'pending' && (
              <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
                <p className="text-sm text-slate-300">
                  Statut : <span className={`font-mono font-bold ${claim.status === 'approved' ? 'text-emerald-400' : 'text-red-400'}`}>{claim.status}</span>
                </p>
                {claim.decision_reason && (
                  <p className="text-xs text-slate-400 mt-2">Raison : {claim.decision_reason}</p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-slate-700 text-slate-300">
            Fermer
          </Button>
          {claim?.status === 'pending' && decision && (
            <Button
              data-testid="decide-submit"
              disabled={submitting}
              onClick={handleDecide}
              className={`${decision === 'approve' ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-900' : 'bg-red-500 hover:bg-red-600 text-white'}`}
            >
              {submitting ? 'En cours…' : 'Confirmer la décision'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminClaimsPanel;
