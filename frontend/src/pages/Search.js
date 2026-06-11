import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Search as SearchIcon, MapPin, Star, Stethoscope, Leaf, Navigation, Calendar, Map as MapIcon, List as ListIcon } from 'lucide-react';
import NearbyDoctors from '@/components/NearbyDoctors';
import ProvidersMap from '@/components/ProvidersMap';

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [doctors, setDoctors] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('search'); // 'search' or 'nearby'
  const [filters, setFilters] = useState({
    specialty: searchParams.get('specialty') || '',
    medical_type: searchParams.get('medical_type') || '',
    location: searchParams.get('location') || '',
    min_rating: searchParams.get('min_rating') || '',
    home_service: searchParams.get('home_service') || '',
    structure_type: searchParams.get('structure_type') || '',
    keyword: searchParams.get('keyword') || searchParams.get('q') || '',
    custom_search: searchParams.get('custom_search') || ''
  });
  const navigate = useNavigate();

  const fetchSpecialties = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/specialties`);
      setSpecialties(response.data);
    } catch {
      // Specialties non-critical
    }
  }, []);

  useEffect(() => {
    fetchSpecialties();
    searchDoctors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchSpecialties]);

  const [orientation, setOrientation] = useState(null);
  const [searchMode, setSearchMode] = useState('directory');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'map' | 'split'

  const searchDoctors = async (overrideKw) => {
    setLoading(true);
    try {
      const kw = (typeof overrideKw === 'string' ? overrideKw : filters.keyword || '').trim();

      // Use smart-search as soon as the user types a keyword.
      // It detects symptoms and falls back to directory search otherwise.
      if (kw) {
        const r = await axios.get(`${API}/search/smart`, { params: { q: kw, limit: 60 } });
        let results = r.data.results || [];
        // Apply client-side filters on top of smart results
        if (filters.medical_type && filters.medical_type !== 'all' && filters.medical_type !== 'autre') {
          results = results.filter((d) => (d.medical_type || '').toLowerCase() === filters.medical_type);
        }
        if (filters.specialty && filters.specialty !== 'all') {
          results = results.filter((d) => (d.specialties || []).some((s) => s.toLowerCase().includes(filters.specialty.toLowerCase())));
        }
        if (filters.location) {
          const loc = filters.location.toLowerCase();
          results = results.filter((d) =>
            (d.city || '').toLowerCase().includes(loc) ||
            (d.neighborhood || '').toLowerCase().includes(loc)
          );
        }
        if (filters.min_rating && filters.min_rating !== 'all') {
          results = results.filter((d) => (d.rating || 0) >= parseFloat(filters.min_rating));
        }
        setDoctors(results);
        setOrientation(r.data.orientation || null);
        setSearchMode(r.data.mode || 'directory');
        return;
      }

      // No keyword → classical /doctors/search with filters
      const params = new URLSearchParams();
      if (filters.specialty && filters.specialty !== 'all') params.append('specialty', filters.specialty);

      if (filters.medical_type === 'autre') {
        if (filters.custom_search) {
          params.append('custom_search', filters.custom_search);
        }
      } else if (filters.medical_type && filters.medical_type !== 'all') {
        params.append('medical_type', filters.medical_type);
      }

      if (filters.location) params.append('location', filters.location);
      if (filters.min_rating && filters.min_rating !== 'all') params.append('min_rating', filters.min_rating);
      if (filters.home_service && filters.home_service !== 'all') params.append('home_service', filters.home_service);
      if (filters.structure_type && filters.structure_type !== 'all') params.append('structure_type', filters.structure_type);

      const response = await axios.get(`${API}/doctors/search?${params.toString()}`);
      setDoctors(response.data);
      setOrientation(null);
      setSearchMode('directory');
    } catch {
      setOrientation(null);
      setSearchMode('directory');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSearch = (overrideKeyword) => {
    if (typeof overrideKeyword === 'string') {
      // When triggered from a suggestion chip, override the keyword first
      setFilters(prev => ({ ...prev, keyword: overrideKeyword }));
      // Call searchDoctors with an explicit keyword so it doesn't race with setState
      searchDoctors(overrideKeyword);
    } else {
      searchDoctors();
    }
  };

  const handleSelectDoctor = (doctor) => {
    navigate(`/doctor/${doctor.id}`);
  };

  const filteredSpecialties = specialties.filter(
    s => !filters.medical_type || filters.medical_type === 'all' || s.medical_type === filters.medical_type
  );

  // Decide whether to prefix the name with "Dr." (only for individual practitioners).
  // Structures (clinics, hospitals, pharmacies, spas, cabinets) keep their full name.
  const STRUCTURE_KEYWORDS = [
    'clinique', 'polyclinique', 'cabinet', 'centre', 'hôpital', 'hopital',
    'pharmacie', 'spa', 'salon', 'institut', 'boutique', 'maison', 'école', 'ecole',
    'hcms', 'sos', 'service', 'serv.', 'service à', 'services', 'cliniques',
    'laboratoire', 'labo', 'imagerie', 'radiologie',
    'fondation', 'association', 'ong', 'croix-rouge',
  ];
  const PRACTITIONER_PREFIXES = ['dr ', 'dr.', 'pr ', 'pr.', 'mme ', 'mlle ', 'm. ', 'docteur ', 'professeur '];

  const isStructure = (provider) => {
    if (!provider) return false;
    if (provider.provider_kind === 'partner') return true;
    const name = (provider.name || '').trim().toLowerCase();
    if (!name) return true;
    // Already starts with a practitioner prefix → individual
    if (PRACTITIONER_PREFIXES.some(p => name.startsWith(p))) return false;
    // Contains a structure keyword → structure
    if (STRUCTURE_KEYWORDS.some(kw => name.includes(kw))) return true;
    return false;
  };

  const displayName = (provider) => {
    const raw = (provider.name || '').trim();
    if (!raw) return 'Sans nom';
    if (isStructure(provider)) return raw;
    // Avoid double "Dr."
    const lower = raw.toLowerCase();
    if (PRACTITIONER_PREFIXES.some(p => lower.startsWith(p))) return raw;
    return `Dr. ${raw}`;
  };

  // Client-side dedup by name (case-insensitive) — safety net in case API returns dups
  const uniqueDoctors = (() => {
    const seen = new Set();
    return (doctors || []).filter(d => {
      const key = ((d.name || '') + '').trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();

  const getMedicalTypeBadge = (type) => {
    const badges = {
      'moderne': { label: 'Moderne', color: 'bg-sky-100 text-sky-700' },
      'traditionnel_africain': { label: 'Traditionnel', color: 'bg-blue-100 text-blue-700' },
      'bien_etre': { label: 'Bien-être', color: 'bg-purple-100 text-purple-700' },
      'service_domicile': { label: 'Domicile', color: 'bg-orange-100 text-orange-700' },
      'materiel_medical': { label: 'Matériel', color: 'bg-blue-100 text-blue-700' },
      'boutique_bien_etre': { label: 'Boutique', color: 'bg-pink-100 text-pink-700' }
    };
    return badges[type] || { label: type, color: 'bg-stone-100 text-stone-700' };
  };

  return (
    <div data-testid="search-page" className="min-h-screen bg-stone-50 pt-24 px-4 md:px-6 pb-12">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-blue-900 mb-2" data-testid="search-title">
            Trouvez Votre Professionnel
          </h1>
          <p className="text-stone-600">
            Recherchez parmi nos professionnels de santé qualifiés
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium transition-colors ${
              activeTab === 'search'
                ? 'bg-blue-900 text-white'
                : 'bg-white text-stone-600 hover:bg-stone-100'
            }`}
          >
            <SearchIcon className="w-4 h-4" />
            Recherche
          </button>
          <button
            onClick={() => setActiveTab('nearby')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium transition-colors ${
              activeTab === 'nearby'
                ? 'bg-blue-900 text-white'
                : 'bg-white text-stone-600 hover:bg-stone-100'
            }`}
            data-testid="nearby-tab"
          >
            <Navigation className="w-4 h-4" />
            À proximité
          </button>
        </div>

        {/* Nearby Tab */}
        {activeTab === 'nearby' && (
          <NearbyDoctors 
            medicalType={filters.medical_type !== 'all' ? filters.medical_type : null}
            specialty={filters.specialty !== 'all' ? filters.specialty : null}
            onSelectDoctor={handleSelectDoctor}
          />
        )}

        {/* Search Tab */}
        {activeTab === 'search' && (
          <>
            {/* Filters */}
            <Card className="mb-6 shadow-sm border-stone-100">
              <CardContent className="p-4 md:p-6">
                {/* Quick Search */}
                <div className="mb-4">
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Symptôme, spécialité, nom du cabinet…"
                      value={filters.keyword}
                      onChange={(e) => handleFilterChange('keyword', e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                      className="flex-1 bg-white border-stone-200 rounded-lg h-11"
                      data-testid="filter-keyword"
                    />
                    <Button
                      onClick={handleSearch}
                      className="bg-blue-900 text-white hover:bg-blue-800 rounded-lg h-11 px-6"
                      data-testid="quick-search-btn"
                    >
                      <SearchIcon className="w-4 h-4 md:mr-2" />
                      <span className="hidden md:inline">Rechercher</span>
                    </Button>
                  </div>
                  <p className="text-xs text-stone-500 mt-2">
                    💡 Tapez un nom (« PISAM »), une spécialité (« cardiologue ») ou un symptôme (« mal de dents ») — l&apos;IA vous oriente automatiquement.
                  </p>

                  {/* Suggestions de symptômes / besoins cliquables */}
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-stone-600 mb-2 uppercase tracking-wide">
                      Suggestions populaires
                    </p>
                    <div className="flex flex-wrap gap-2" data-testid="symptom-suggestions">
                      {[
                        { label: 'Mal de tête', q: 'mal de tête', emoji: '🤕' },
                        { label: 'Fièvre', q: 'fièvre', emoji: '🌡️' },
                        { label: 'Toux', q: 'toux', emoji: '😷' },
                        { label: 'Mal au ventre', q: 'mal au ventre', emoji: '🤢' },
                        { label: 'Diabète', q: 'diabète', emoji: '💉' },
                        { label: 'Tension', q: 'tension', emoji: '❤️' },
                        { label: 'Bilan sanguin', q: 'bilan sanguin', emoji: '🩸' },
                        { label: 'Mal de dents', q: 'mal de dents', emoji: '🦷' },
                        { label: 'Ordonnance', q: 'ordonnance', emoji: '💊' },
                        { label: 'Grossesse', q: 'grossesse', emoji: '🤰' },
                        { label: 'Stress / Anxiété', q: 'stress anxiété', emoji: '🧠' },
                        { label: 'Massage', q: 'massage', emoji: '💆' },
                      ].map((s) => (
                        <button
                          key={s.q}
                          type="button"
                          onClick={() => handleSearch(s.q)}
                          data-testid={`suggest-${s.q.replace(/\s+/g, '-')}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 hover:bg-blue-100 border border-blue-200 hover:border-blue-300 text-sm text-blue-900 font-medium transition-colors"
                        >
                          <span aria-hidden>{s.emoji}</span>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Orientation banner (when symptom detected) */}
            {orientation && (
              <Card className={`mb-6 border ${
                orientation.urgency_level === 'urgent' ? 'bg-red-50 border-red-300' :
                orientation.urgency_level === 'moderate' ? 'bg-amber-50 border-amber-300' :
                'bg-blue-50 border-blue-200'
              }`} data-testid="orientation-banner">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">
                      {orientation.urgency_level === 'urgent' ? '⚠️' : '🩺'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-sm ${
                        orientation.urgency_level === 'urgent' ? 'text-red-900' :
                        orientation.urgency_level === 'moderate' ? 'text-amber-900' :
                        'text-blue-900'
                      }`}>
                        {searchMode === 'orientation' ? "Assistant d'orientation" : "Suggestion d'orientation"}
                      </p>
                      <p className="text-sm text-stone-700 mt-1">{orientation.urgency_label}</p>
                    </div>
                    {orientation.urgency_level === 'urgent' && orientation.emergency_number && (
                      <a
                        href={`tel:${orientation.emergency_number}`}
                        className="px-3 py-1.5 bg-red-600 text-white rounded-full text-xs font-semibold hover:bg-red-700 whitespace-nowrap"
                        data-testid="orientation-call-emergency"
                      >
                        📞 {orientation.emergency_number}
                      </a>
                    )}
                  </div>
                  {orientation.suggestions && orientation.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs text-stone-600 font-medium self-center">Spécialités recommandées :</span>
                      {orientation.suggestions.map((s) => (
                        <span key={s.specialty}
                          className="inline-block px-3 py-1 rounded-full bg-white border border-stone-200 text-stone-800 text-xs font-medium">
                          {s.specialty}
                        </span>
                      ))}
                    </div>
                  )}
                  {orientation.legal_notice && (
                    <p className="text-xs text-stone-500 italic leading-relaxed pt-2 border-t border-stone-200/50">
                      ⚠️ {orientation.legal_notice}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Results */}
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-900"></div>
                <p className="mt-3 text-stone-600">Recherche en cours...</p>
              </div>
            ) : uniqueDoctors.length === 0 ? (
              <div className="text-center py-12" data-testid="no-results">
                <SearchIcon className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-stone-900 mb-1">Aucun résultat</h3>
                <p className="text-stone-500 text-sm">
                  {orientation
                    ? "Aucun professionnel correspondant à cette spécialité n'est encore référencé. Essayez un autre terme."
                    : "Essayez de modifier vos critères ou de décrire vos symptômes."}
                </p>
              </div>
            ) : (
              <>
                {/* View toggle: List / Map / Split */}
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                  <p className="text-sm text-stone-600">
                    <span className="font-semibold text-stone-900">{uniqueDoctors.length}</span> résultat{uniqueDoctors.length > 1 ? 's' : ''}
                  </p>
                  <div
                    className="inline-flex rounded-lg border border-stone-200 bg-white p-0.5 shadow-sm"
                    role="tablist"
                    data-testid="view-mode-toggle"
                  >
                    {[
                      { v: 'list',  label: 'Liste', Icon: ListIcon },
                      { v: 'split', label: 'Mixte', Icon: Navigation },
                      { v: 'map',   label: 'Carte', Icon: MapIcon },
                    ].map(({ v, label, Icon }) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setViewMode(v)}
                        data-testid={`view-mode-${v}`}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                          viewMode === v
                            ? 'bg-blue-900 text-white shadow-sm'
                            : 'text-stone-600 hover:bg-stone-100'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="hidden sm:inline">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* MAP view */}
                {viewMode === 'map' && (
                  <ProvidersMap providers={uniqueDoctors} height="70vh" />
                )}

                {/* SPLIT view: map on top (mobile) / left (desktop), list below/right */}
                {viewMode === 'split' && (
                  <div className="grid lg:grid-cols-5 gap-4">
                    <div className="lg:col-span-3 lg:sticky lg:top-4 lg:self-start">
                      <ProvidersMap providers={uniqueDoctors} height="70vh" />
                    </div>
                    <div className="lg:col-span-2 grid grid-cols-1 gap-3 max-h-[70vh] overflow-y-auto pr-1" data-testid="doctors-grid-split">
                      {uniqueDoctors.map((doctor) => {
                        const badge = getMedicalTypeBadge(doctor.medical_type);
                        return (
                          <Card
                            key={doctor.id}
                            data-testid={`doctor-card-${doctor.id}`}
                            className="bg-white rounded-xl border border-stone-100 hover:shadow-md transition-all"
                          >
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="text-sm font-semibold text-stone-900 leading-tight">
                                  {displayName(doctor)}
                                </h3>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${badge.color}`}>
                                  {badge.label}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {doctor.specialties?.slice(0, 2).map((spec) => (
                                  <span key={spec} className="bg-stone-100 text-stone-600 text-[10px] px-2 py-0.5 rounded-full">
                                    {spec}
                                  </span>
                                ))}
                              </div>
                              {(doctor.neighborhood || doctor.city) && (
                                <div className="flex items-center text-xs text-stone-500 mt-1.5">
                                  <MapPin className="w-3 h-3 mr-1" />
                                  {doctor.neighborhood || doctor.city}
                                </div>
                              )}
                              <div className="flex gap-1.5 mt-2">
                                <Link to={`/doctor/${doctor.id}`} className="flex-1">
                                  <Button variant="outline" className="w-full rounded-md text-xs h-8" data-testid={`view-profile-btn-${doctor.id}`}>
                                    Voir
                                  </Button>
                                </Link>
                                <Link to={`/booking/${doctor.id}`}>
                                  <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs h-8 px-3" data-testid={`book-btn-${doctor.id}`}>
                                    <Calendar className="w-3.5 h-3.5" />
                                  </Button>
                                </Link>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* LIST view (original cards grid) */}
                {viewMode === 'list' && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="doctors-grid">
                {uniqueDoctors.map((doctor) => {
                  const badge = getMedicalTypeBadge(doctor.medical_type);
                  return (
                    <Card
                      key={doctor.id}
                      data-testid={`doctor-card-${doctor.id}`}
                      className="bg-white rounded-xl border border-stone-100 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 overflow-hidden"
                    >
                      <CardContent className="p-0">
                        <div className="h-40 bg-gradient-to-br from-blue-100 to-sky-100 relative overflow-hidden">
                          {doctor.profile_image ? (
                            <img
                              src={doctor.profile_image}
                              alt={doctor.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              {doctor.medical_type === 'moderne' ? (
                                <Stethoscope className="w-16 h-16 text-sky-500/50" />
                              ) : (
                                <Leaf className="w-16 h-16 text-blue-600/50" />
                              )}
                            </div>
                          )}
                          <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-medium ${badge.color}`}>
                            {badge.label}
                          </div>
                        </div>
                        <div className="p-4">
                          <h3 className="text-lg font-semibold text-stone-900 mb-1">
                            {displayName(doctor)}
                          </h3>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {doctor.specialties?.slice(0, 2).map((spec) => (
                              <span
                                key={spec}
                                className="bg-stone-100 text-stone-600 text-xs px-2 py-0.5 rounded-full"
                              >
                                {spec}
                              </span>
                            ))}
                          </div>
                          <div className="space-y-1 mb-3 text-sm">
                            {doctor.location && (
                              <div className="flex items-center text-stone-500">
                                <MapPin className="w-3.5 h-3.5 mr-1.5" />
                                {doctor.location}
                              </div>
                            )}
                            {doctor.rating > 0 && (
                              <div className="flex items-center text-stone-500">
                                <Star className="w-3.5 h-3.5 mr-1.5 text-yellow-500 fill-yellow-500" />
                                {doctor.rating.toFixed(1)} ({doctor.total_reviews} avis)
                              </div>
                            )}
                            {doctor.consultation_fee && (
                              <div className="text-blue-600 font-medium">
                                {doctor.consultation_fee.toLocaleString()} XOF
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Link to={`/doctor/${doctor.id}`} className="flex-1">
                              <Button 
                                variant="outline" 
                                className="w-full rounded-lg text-sm h-9"
                                data-testid={`view-profile-btn-${doctor.id}`}
                              >
                                Voir profil
                              </Button>
                            </Link>
                            <Link to={`/booking/${doctor.id}`}>
                              <Button 
                                className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm h-9 px-3"
                                data-testid={`book-btn-${doctor.id}`}
                              >
                                <Calendar className="w-4 h-4" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Search;
