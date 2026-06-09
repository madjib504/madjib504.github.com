import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from '@/components/ui/select';
import {
  Shield, UserPlus, Trash2, Power, KeyRound, Crown, History,
  CheckCircle2, XCircle, Search as SearchIcon
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const ROLE_LABELS = {
  super_admin_owner: { label: 'OWNER', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  moderator: { label: 'Modérateur', color: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
  support: { label: 'Support', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  manager: { label: 'Manager', color: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
};

const ACTION_LABELS = {
  admin_created: 'Modérateur créé',
  admin_updated: 'Modérateur modifié',
  admin_deleted: 'Modérateur supprimé',
  maintenance_toggled: 'Maintenance togglée',
  user_deleted: 'Utilisateur supprimé',
  delete_all_data: '⚠️ Suppression totale',
  claim_approved: 'Réclamation approuvée',
  claim_rejected: 'Réclamation rejetée',
  claim_approvedd: 'Réclamation approuvée',
  claim_rejectedd: 'Réclamation rejetée',
};

const PanelTab = ({ active, onClick, icon: Icon, children, testid }) => (
  <button
    onClick={onClick}
    data-testid={testid}
    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
      active ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-400 hover:text-white'
    }`}
  >
    <Icon className="w-4 h-4" />
    {children}
  </button>
);

const RoleBadge = ({ role }) => {
  const meta = ROLE_LABELS[role] || { label: role, color: 'bg-slate-700 text-slate-300 border-slate-600' };
  return (
    <Badge data-testid={`owner-admin-role-${role}`} className={`${meta.color} border`}>
      {role === 'super_admin_owner' && <Crown className="w-3 h-3 mr-1 inline" />}
      {meta.label}
    </Badge>
  );
};

const OwnerAdminPanel = ({ token }) => {
  const [tab, setTab] = useState('admins');
  const [admins, setAdmins] = useState([]);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editAdmin, setEditAdmin] = useState(null);
  const [search, setSearch] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        if (tab === 'admins') {
          const { data } = await axios.get(`${API}/admin/owner/admins`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!cancelled) setAdmins(data.admins || []);
        } else if (tab === 'audit') {
          const { data } = await axios.get(`${API}/admin/owner/audit-log?limit=100`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!cancelled) setAudit(data.entries || []);
        }
      } catch (e) {
        if (!cancelled) toast.error(
          tab === 'admins'
            ? "Impossible de charger les admins (accès OWNER requis ?)"
            : "Impossible de charger le journal d'audit"
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [tab, refreshTick, token]);

  const refresh = () => setRefreshTick(t => t + 1);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Supprimer définitivement l'admin "${name}" ?`)) return;
    try {
      await axios.delete(`${API}/admin/owner/admins/${id}`, authHeader);
      toast.success('Admin supprimé');
      refresh();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Suppression impossible');
    }
  };

  const handleToggleActive = async (admin) => {
    try {
      const { data } = await axios.patch(
        `${API}/admin/owner/admins/${admin.id}`,
        { is_active: !admin.is_active },
        authHeader
      );
      toast.success(data.admin.is_active ? 'Admin activé' : 'Admin désactivé');
      refresh();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Action impossible');
    }
  };

  const filteredAdmins = admins.filter(a => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (a.username || '').toLowerCase().includes(q)
      || (a.display_name || '').toLowerCase().includes(q)
      || (a.admin_role || '').toLowerCase().includes(q);
  });

  return (
    <div data-testid="owner-admin-panel" className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Crown className="w-6 h-6 text-amber-400" />
          <h2 className="text-xl font-bold text-white">Espace OWNER</h2>
          <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40">Réservé</Badge>
        </div>
        <div className="flex gap-2">
          <PanelTab
            active={tab === 'admins'}
            onClick={() => setTab('admins')}
            icon={Shield}
            testid="owner-tab-admins"
          >
            Modérateurs ({admins.length})
          </PanelTab>
          <PanelTab
            active={tab === 'audit'}
            onClick={() => setTab('audit')}
            icon={History}
            testid="owner-tab-audit"
          >
            Journal d&apos;audit
          </PanelTab>
        </div>
      </div>

      {tab === 'admins' && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-white flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Gestion des modérateurs
            </CardTitle>
            <div className="flex gap-2 items-center">
              <div className="relative">
                <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  data-testid="owner-search-admin"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher…"
                  className="pl-9 bg-slate-900 border-slate-700 text-white w-48"
                />
              </div>
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="owner-add-admin-btn" className="bg-amber-500 hover:bg-amber-600 text-slate-900">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Ajouter
                  </Button>
                </DialogTrigger>
                <CreateAdminDialog
                  token={token}
                  onClose={() => setCreateOpen(false)}
                  onCreated={() => { setCreateOpen(false); refresh(); }}
                />
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-10 text-center text-slate-400">Chargement…</div>
            ) : filteredAdmins.length === 0 ? (
              <div className="py-10 text-center text-slate-400">Aucun modérateur trouvé.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-700">
                      <th className="py-2 px-2">Nom</th>
                      <th className="py-2 px-2">Username</th>
                      <th className="py-2 px-2">Rôle</th>
                      <th className="py-2 px-2">Statut</th>
                      <th className="py-2 px-2">Dernière connexion</th>
                      <th className="py-2 px-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAdmins.map(a => (
                      <tr key={a.id} data-testid={`owner-admin-row-${a.id}`} className="border-b border-slate-800 hover:bg-slate-900/50">
                        <td className="py-3 px-2 text-white font-medium">{a.display_name || a.username}</td>
                        <td className="py-3 px-2 text-slate-300">{a.username}</td>
                        <td className="py-3 px-2"><RoleBadge role={a.admin_role} /></td>
                        <td className="py-3 px-2">
                          {a.is_active === false ? (
                            <span className="inline-flex items-center gap-1 text-red-400">
                              <XCircle className="w-4 h-4" />Désactivé
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-400">
                              <CheckCircle2 className="w-4 h-4" />Actif
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-slate-400">
                          {a.last_login_at ? new Date(a.last_login_at).toLocaleString('fr-FR') : '—'}
                        </td>
                        <td className="py-3 px-2 text-right space-x-1">
                          {!a.is_seed_owner && (
                            <>
                              <Button
                                data-testid={`owner-toggle-active-${a.id}`}
                                size="sm" variant="ghost"
                                onClick={() => handleToggleActive(a)}
                                className="text-amber-400 hover:bg-amber-500/10"
                                title={a.is_active === false ? 'Activer' : 'Désactiver'}
                              >
                                <Power className="w-4 h-4" />
                              </Button>
                              <Button
                                data-testid={`owner-edit-${a.id}`}
                                size="sm" variant="ghost"
                                onClick={() => setEditAdmin(a)}
                                className="text-sky-400 hover:bg-sky-500/10"
                                title="Modifier"
                              >
                                <KeyRound className="w-4 h-4" />
                              </Button>
                              <Button
                                data-testid={`owner-delete-${a.id}`}
                                size="sm" variant="ghost"
                                onClick={() => handleDelete(a.id, a.display_name || a.username)}
                                className="text-red-400 hover:bg-red-500/10"
                                title="Supprimer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {a.is_seed_owner && (
                            <span className="text-xs text-amber-400 italic">Protégé</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'audit' && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <History className="w-5 h-5" />
              Journal d&apos;audit ({audit.length} dernières actions)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-10 text-center text-slate-400">Chargement…</div>
            ) : audit.length === 0 ? (
              <div className="py-10 text-center text-slate-400">Aucune action enregistrée.</div>
            ) : (
              <div className="space-y-2">
                {audit.map(e => (
                  <div
                    key={e.id}
                    data-testid={`audit-row-${e.id}`}
                    className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/50 border border-slate-700/60 hover:border-slate-600 transition"
                  >
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-2 h-2 rounded-full bg-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-medium">
                          {ACTION_LABELS[e.action] || e.action}
                        </span>
                        <RoleBadge role={e.actor_role} />
                        <span className="text-xs text-slate-400">
                          par {e.actor_display_name || e.actor_username}
                        </span>
                      </div>
                      {e.target_type && (
                        <div className="text-xs text-slate-500 mt-1">
                          Cible : {e.target_type}{e.target_id ? ` / ${e.target_id.slice(0, 8)}…` : ''}
                        </div>
                      )}
                      {e.details && Object.keys(e.details).length > 0 && (
                        <div className="text-xs text-slate-400 mt-1 font-mono">
                          {Object.entries(e.details).slice(0, 4).map(([k, v]) => (
                            <span key={k} className="mr-3">
                              <span className="text-slate-500">{k}=</span>
                              {typeof v === 'object' ? JSON.stringify(v).slice(0, 40) : String(v).slice(0, 40)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 whitespace-nowrap">
                      {new Date(e.created_at).toLocaleString('fr-FR')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {editAdmin && (
        <Dialog open={!!editAdmin} onOpenChange={() => setEditAdmin(null)}>
          <EditAdminDialog
            token={token}
            admin={editAdmin}
            onClose={() => setEditAdmin(null)}
            onSaved={() => { setEditAdmin(null); refresh(); }}
          />
        </Dialog>
      )}
    </div>
  );
};

const CreateAdminDialog = ({ token, onClose, onCreated }) => {
  const [form, setForm] = useState({
    username: '', password: '', display_name: '', admin_role: 'moderator'
  });
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (form.username.length < 3) return toast.error("Nom d'utilisateur trop court (min 3)");
    if (form.password.length < 8) return toast.error("Mot de passe trop court (min 8)");
    setSubmitting(true);
    try {
      await axios.post(`${API}/admin/owner/admins`, form, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Modérateur ${form.username} créé`);
      onCreated();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Création impossible');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogContent className="bg-slate-900 border-slate-700 text-white">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-amber-400" />
          Nouveau modérateur
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label className="text-slate-300">Nom complet (affiché)</Label>
          <Input
            data-testid="create-admin-display-name"
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            placeholder="ex: Aïcha Diallo"
            className="bg-slate-800 border-slate-700"
          />
        </div>
        <div>
          <Label className="text-slate-300">Nom d&apos;utilisateur (login)</Label>
          <Input
            data-testid="create-admin-username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            placeholder="aicha_d"
            className="bg-slate-800 border-slate-700"
          />
        </div>
        <div>
          <Label className="text-slate-300">Mot de passe (min 8 caractères)</Label>
          <Input
            data-testid="create-admin-password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="bg-slate-800 border-slate-700"
          />
        </div>
        <div>
          <Label className="text-slate-300">Rôle</Label>
          <Select
            value={form.admin_role}
            onValueChange={(v) => setForm({ ...form, admin_role: v })}
          >
            <SelectTrigger data-testid="create-admin-role" className="bg-slate-800 border-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="moderator">Modérateur</SelectItem>
              <SelectItem value="support">Support</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} className="border-slate-700 text-slate-300">
          Annuler
        </Button>
        <Button
          data-testid="create-admin-submit"
          disabled={submitting}
          onClick={submit}
          className="bg-amber-500 hover:bg-amber-600 text-slate-900"
        >
          {submitting ? 'Création…' : 'Créer'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

const EditAdminDialog = ({ token, admin, onClose, onSaved }) => {
  const [form, setForm] = useState({
    display_name: admin.display_name || '',
    admin_role: admin.admin_role || 'moderator',
    password: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const payload = {};
    if (form.display_name && form.display_name !== admin.display_name) payload.display_name = form.display_name;
    if (form.admin_role !== admin.admin_role) payload.admin_role = form.admin_role;
    if (form.password) payload.password = form.password;
    if (Object.keys(payload).length === 0) { toast('Aucune modification'); return; }
    setSubmitting(true);
    try {
      await axios.patch(`${API}/admin/owner/admins/${admin.id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Modérateur mis à jour');
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Mise à jour impossible');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogContent className="bg-slate-900 border-slate-700 text-white">
      <DialogHeader>
        <DialogTitle>Modifier {admin.username}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label className="text-slate-300">Nom affiché</Label>
          <Input
            data-testid="edit-admin-display-name"
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            className="bg-slate-800 border-slate-700"
          />
        </div>
        <div>
          <Label className="text-slate-300">Rôle</Label>
          <Select
            value={form.admin_role}
            onValueChange={(v) => setForm({ ...form, admin_role: v })}
          >
            <SelectTrigger data-testid="edit-admin-role" className="bg-slate-800 border-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="moderator">Modérateur</SelectItem>
              <SelectItem value="support">Support</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-slate-300">Nouveau mot de passe (laisser vide pour ne pas changer)</Label>
          <Input
            data-testid="edit-admin-password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="bg-slate-800 border-slate-700"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} className="border-slate-700 text-slate-300">
          Annuler
        </Button>
        <Button
          data-testid="edit-admin-submit"
          disabled={submitting}
          onClick={submit}
          className="bg-amber-500 hover:bg-amber-600 text-slate-900"
        >
          {submitting ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

export default OwnerAdminPanel;
