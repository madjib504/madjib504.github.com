import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Search as SearchIcon, MapPin, Star, Stethoscope, Leaf, Navigation, Calendar } from 'lucide-react';
import NearbyDoctors from '@/components/NearbyDoctors';

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
    keyword: searchParams.get('keyword') || searchParams.get('q') || ''
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchSpecialties();
    searchDoctors();
  }, []);

  const fetchSpecialties = async () => {
    try {
      const response = await axios.get(`${API}/specialties`);
      setSpecialties(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement des spécialités');
    }
  };

  const searchDoctors = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.specialty && filters.specialty !== 'all') params.append('specialty', filters.specialty);
      if (filters.medical_type && filters.medical_type !== 'all') params.append('medical_type', filters.medical_type);
      if (filters.location) params.append('location', filters.location);
      if (filters.min_rating && filters.min_rating !== 'all') params.append('min_rating', filters.min_rating);
      if (filters.home_service && filters.home_service !== 'all') params.append('home_service', filters.home_service);
      if (filters.structure_type && filters.structure_type !== 'all') params.append('structure_type', filters.structure_type);
      if (filters.keyword) params.append('keyword', filters.keyword);

      const response = await axios.get(`${API}/doctors/search?${params.toString()}`);
      setDoctors(response.data);
    } catch (error) {
      console.error('Erreur lors de la recherche');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSearch = () => {
    searchDoctors();
  };

  const handleSelectDoctor = (doctor) => {
    navigate(`/doctor/${doctor.id}`);
  };

  const filteredSpecialties = specialties.filter(
    s => !filters.medical_type || filters.medical_type === 'all' || s.medical_type === filters.medical_type
  );

  const getMedicalTypeBadge = (type) => {
    const badges = {
      'moderne': { label: 'Moderne', color: 'bg-sky-100 text-sky-700' },
      'traditionnel_africain': { label: 'Traditionnel', color: 'bg-green-100 text-green-700' },
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
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-green-900 mb-2" data-testid="search-title">
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
                ? 'bg-green-900 text-white'
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
                ? 'bg-green-900 text-white'
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
                      placeholder="Rechercher par symptôme, spécialité, nom..."
                      value={filters.keyword}
                      onChange={(e) => handleFilterChange('keyword', e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                      className="flex-1 bg-white border-stone-200 rounded-lg h-11"
                      data-testid="filter-keyword"
                    />
                    <Button
                      onClick={handleSearch}
                      className="bg-green-900 text-white hover:bg-green-800 rounded-lg h-11 px-6"
                      data-testid="quick-search-btn"
                    >
                      <SearchIcon className="w-4 h-4 md:mr-2" />
                      <span className="hidden md:inline">Rechercher</span>
                    </Button>
                  </div>
                </div>

                {/* Filters Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Select value={filters.medical_type} onValueChange={(value) => handleFilterChange('medical_type', value)}>
                    <SelectTrigger className="bg-white border-stone-200 rounded-lg h-10 text-sm" data-testid="filter-medical-type">
                      <SelectValue placeholder="Type de service" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les types</SelectItem>
                      <SelectItem value="moderne">Médecine Moderne</SelectItem>
                      <SelectItem value="traditionnel_africain">Médecine Traditionnelle</SelectItem>
                      <SelectItem value="bien_etre">Bien-être</SelectItem>
                      <SelectItem value="service_domicile">Service à Domicile</SelectItem>
                      <SelectItem value="materiel_medical">Matériel Médical</SelectItem>
                      <SelectItem value="boutique_bien_etre">Boutique Bien-être</SelectItem>
                      <SelectItem value="autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filters.specialty} onValueChange={(value) => handleFilterChange('specialty', value)}>
                    <SelectTrigger className="bg-white border-stone-200 rounded-lg h-10 text-sm" data-testid="filter-specialty">
                      <SelectValue placeholder="Spécialité" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      <SelectItem value="all">Toutes</SelectItem>
                      {filteredSpecialties.map((specialty) => (
                        <SelectItem key={specialty.id} value={specialty.name}>
                          {specialty.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    type="text"
                    placeholder="Ville..."
                    value={filters.location}
                    onChange={(e) => handleFilterChange('location', e.target.value)}
                    className="bg-white border-stone-200 rounded-lg h-10 text-sm"
                    data-testid="filter-location"
                  />

                  <Select value={filters.min_rating} onValueChange={(value) => handleFilterChange('min_rating', value)}>
                    <SelectTrigger className="bg-white border-stone-200 rounded-lg h-10 text-sm" data-testid="filter-rating">
                      <SelectValue placeholder="Note" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes</SelectItem>
                      <SelectItem value="4">4+ ⭐</SelectItem>
                      <SelectItem value="4.5">4.5+ ⭐</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Results */}
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-green-900"></div>
                <p className="mt-3 text-stone-600">Recherche en cours...</p>
              </div>
            ) : doctors.length === 0 ? (
              <div className="text-center py-12" data-testid="no-results">
                <SearchIcon className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-stone-900 mb-1">Aucun résultat</h3>
                <p className="text-stone-500 text-sm">Essayez de modifier vos critères</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="doctors-grid">
                {doctors.map((doctor) => {
                  const badge = getMedicalTypeBadge(doctor.medical_type);
                  return (
                    <Card
                      key={doctor.id}
                      data-testid={`doctor-card-${doctor.id}`}
                      className="bg-white rounded-xl border border-stone-100 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 overflow-hidden"
                    >
                      <CardContent className="p-0">
                        <div className="h-40 bg-gradient-to-br from-green-100 to-sky-100 relative overflow-hidden">
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
                                <Leaf className="w-16 h-16 text-green-600/50" />
                              )}
                            </div>
                          )}
                          <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-medium ${badge.color}`}>
                            {badge.label}
                          </div>
                        </div>
                        <div className="p-4">
                          <h3 className="text-lg font-semibold text-stone-900 mb-1">
                            Dr. {doctor.name}
                          </h3>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {doctor.specialties?.slice(0, 2).map((spec, idx) => (
                              <span
                                key={idx}
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
                              <div className="text-green-600 font-medium">
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
                                className="bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm h-9 px-3"
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
      </div>
    </div>
  );
};

export default Search;
