import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Search as SearchIcon, MapPin, Star, DollarSign, Stethoscope, Leaf } from 'lucide-react';

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [doctors, setDoctors] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    specialty: searchParams.get('specialty') || '',
    medical_type: searchParams.get('medical_type') || '',
    location: searchParams.get('location') || '',
    min_rating: searchParams.get('min_rating') || '',
    home_service: searchParams.get('home_service') || '',
    structure_type: searchParams.get('structure_type') || '',
    keyword: searchParams.get('keyword') || ''
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
      if (filters.specialty) params.append('specialty', filters.specialty);
      if (filters.medical_type) params.append('medical_type', filters.medical_type);
      if (filters.location) params.append('location', filters.location);
      if (filters.min_rating) params.append('min_rating', filters.min_rating);
      if (filters.home_service) params.append('home_service', filters.home_service);
      if (filters.structure_type) params.append('structure_type', filters.structure_type);
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

  const filteredSpecialties = specialties.filter(
    s => !filters.medical_type || s.medical_type === filters.medical_type
  );

  return (
    <div data-testid="search-page" className="min-h-screen bg-stone-50 pt-24 px-6 pb-12">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-green-900 mb-4" data-testid="search-title">
            Trouvez Votre Médecin
          </h1>
          <p className="text-lg text-stone-600">
            Recherchez parmi nos professionnels de santé qualifiés
          </p>
        </div>

        {/* Filters */}
        <Card className="mb-8 shadow-md border-stone-100">
          <CardContent className="p-6">
            {/* Recherche intelligente */}
            <div className="mb-6">
              <Label className="text-base font-medium mb-2 block">Recherche simplifiée</Label>
              <p className="text-sm text-stone-600 mb-3">
                Décrivez ce que vous cherchez (ex: "mal de dos", "problème de peau", "grossesse", "massage relaxant")
              </p>
              <div className="flex gap-3">
                <Input
                  type="text"
                  placeholder="Décrivez votre besoin ou symptôme..."
                  value={filters.keyword}
                  onChange={(e) => handleFilterChange('keyword', e.target.value)}
                  className="flex-1 bg-white border-stone-200 rounded-lg h-12"
                  data-testid="filter-keyword"
                />
                <Button
                  onClick={handleSearch}
                  className="bg-green-900 text-white hover:bg-green-800 rounded-lg h-12 px-8"
                  data-testid="quick-search-btn"
                >
                  <SearchIcon className="w-5 h-5 mr-2" />
                  Rechercher
                </Button>
              </div>
            </div>

            <div className="border-t border-stone-200 pt-6">
              <Label className="text-base font-medium mb-3 block">Filtres avancés</Label>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <Select value={filters.medical_type} onValueChange={(value) => handleFilterChange('medical_type', value)}>
                  <SelectTrigger className="bg-white border-stone-200 rounded-lg h-12" data-testid="filter-medical-type">
                    <SelectValue placeholder="Type de service" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    <SelectItem value="moderne">Médecine Moderne</SelectItem>
                    <SelectItem value="traditionnel_africain">Médecine Traditionnelle Africaine</SelectItem>
                    <SelectItem value="bien_etre">Bien-être & Beauté</SelectItem>
                    <SelectItem value="service_domicile">Service à Domicile</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filters.specialty} onValueChange={(value) => handleFilterChange('specialty', value)}>
                  <SelectTrigger className="bg-white border-stone-200 rounded-lg h-12" data-testid="filter-specialty">
                    <SelectValue placeholder="Spécialité" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    <SelectItem value="all">Toutes les spécialités</SelectItem>
                    {filteredSpecialties.map((specialty) => (
                      <SelectItem key={specialty.id} value={specialty.name}>
                        {specialty.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  type="text"
                  placeholder="Localisation"
                  value={filters.location}
                  onChange={(e) => handleFilterChange('location', e.target.value)}
                  className="bg-white border-stone-200 rounded-lg h-12"
                  data-testid="filter-location"
                />

                <Select value={filters.min_rating} onValueChange={(value) => handleFilterChange('min_rating', value)}>
                  <SelectTrigger className="bg-white border-stone-200 rounded-lg h-12" data-testid="filter-rating">
                    <SelectValue placeholder="Note minimum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les notes</SelectItem>
                    <SelectItem value="4">4+ ⭐</SelectItem>
                    <SelectItem value="4.5">4.5+ ⭐</SelectItem>
                    <SelectItem value="4.8">4.8+ ⭐</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Select value={filters.structure_type} onValueChange={(value) => handleFilterChange('structure_type', value)}>
                  <SelectTrigger className="bg-white border-stone-200 rounded-lg h-12" data-testid="filter-structure">
                    <SelectValue placeholder="Type de structure" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="cabinet">Cabinet privé</SelectItem>
                    <SelectItem value="clinique">Clinique</SelectItem>
                    <SelectItem value="hopital">Hôpital</SelectItem>
                    <SelectItem value="centre">Centre de santé</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filters.home_service} onValueChange={(value) => handleFilterChange('home_service', value)}>
                  <SelectTrigger className="bg-white border-stone-200 rounded-lg h-12" data-testid="filter-home-service">
                    <SelectValue placeholder="Service à domicile" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="true">Disponible à domicile</SelectItem>
                    <SelectItem value="false">En cabinet uniquement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-900"></div>
            <p className="mt-4 text-stone-600">Recherche en cours...</p>
          </div>
        ) : doctors.length === 0 ? (
          <div className="text-center py-12" data-testid="no-results">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-serif font-bold text-stone-900 mb-2">Aucun résultat</h3>
            <p className="text-stone-600">Essayez de modifier vos critères de recherche</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="doctors-grid">
            {doctors.map((doctor) => (
              <Card
                key={doctor.id}
                data-testid={`doctor-card-${doctor.id}`}
                className="bg-white rounded-2xl border border-stone-100 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group overflow-hidden"
              >
                <CardContent className="p-0">
                  <div className="h-48 bg-gradient-to-br from-green-100 to-sky-100 relative overflow-hidden">
                    {doctor.profile_image ? (
                      <img
                        src={doctor.profile_image}
                        alt={doctor.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {doctor.medical_type === 'moderne' ? (
                          <Stethoscope className="w-20 h-20 text-sky-600" />
                        ) : (
                          <Leaf className="w-20 h-20 text-green-700" />
                        )}
                      </div>
                    )}
                    <div className="absolute top-4 right-4 bg-white px-3 py-1 rounded-full text-sm font-medium">
                      {doctor.medical_type === 'moderne' ? (
                        <span className="text-sky-600">Moderne</span>
                      ) : (
                        <span className="text-green-700">Traditionnel</span>
                      )}
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-serif font-bold text-stone-900 mb-2">
                      Dr. {doctor.name}
                    </h3>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {doctor.specialties && doctor.specialties.slice(0, 2).map((spec, idx) => (
                        <span
                          key={idx}
                          className="bg-green-50 text-green-800 text-xs px-2 py-1 rounded-full"
                        >
                          {spec}
                        </span>
                      ))}
                      {doctor.specialties && doctor.specialties.length > 2 && (
                        <span className="bg-stone-100 text-stone-600 text-xs px-2 py-1 rounded-full">
                          +{doctor.specialties.length - 2}
                        </span>
                      )}
                    </div>
                    {doctor.home_service && (
                      <div className="mb-2">
                        <span className="bg-blue-50 text-blue-700 text-xs px-3 py-1 rounded-full font-medium">
                          🏠 Service à domicile
                        </span>
                      </div>
                    )}
                    {doctor.structure_type && (
                      <div className="mb-3">
                        <span className="bg-purple-50 text-purple-700 text-xs px-3 py-1 rounded-full capitalize">
                          {doctor.structure_type}
                        </span>
                      </div>
                    )}
                    <div className="space-y-2 mb-4">
                      {doctor.location && (
                        <div className="flex items-center text-sm text-stone-600">
                          <MapPin className="w-4 h-4 mr-2" />
                          {doctor.location}
                        </div>
                      )}
                      {doctor.rating > 0 && (
                        <div className="flex items-center text-sm text-stone-600">
                          <Star className="w-4 h-4 mr-2 text-yellow-500 fill-yellow-500" />
                          {doctor.rating} ({doctor.total_reviews} avis)
                        </div>
                      )}
                      {doctor.consultation_fee && (
                        <div className="flex items-center text-sm text-stone-600">
                          <DollarSign className="w-4 h-4 mr-2" />
                          {doctor.consultation_fee} € / consultation
                        </div>
                      )}
                    </div>
                    <Link to={`/doctor/${doctor.id}`}>
                      <Button className="w-full bg-green-900 text-white hover:bg-green-800 rounded-full" data-testid={`view-profile-btn-${doctor.id}`}>
                        Voir le profil
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Search;