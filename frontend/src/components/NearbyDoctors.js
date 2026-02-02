import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  MapPin, Navigation, Loader2, Star, Phone, 
  ChevronRight, RefreshCw, AlertCircle 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

const NearbyDoctors = ({ medicalType, specialty, onSelectDoctor }) => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [radius, setRadius] = useState(10);
  const [locationPermission, setLocationPermission] = useState('prompt');

  useEffect(() => {
    // Check if geolocation is available
    if ('geolocation' in navigator) {
      navigator.permissions?.query({ name: 'geolocation' }).then((result) => {
        setLocationPermission(result.state);
        result.onchange = () => setLocationPermission(result.state);
      });
    }
  }, []);

  const getCurrentLocation = () => {
    setLoading(true);
    setError(null);

    if (!('geolocation' in navigator)) {
      setError('La géolocalisation n\'est pas supportée par votre navigateur');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ latitude, longitude });
        await fetchNearbyDoctors(latitude, longitude);
      },
      (err) => {
        console.error('Erreur géolocalisation:', err);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('Accès à la localisation refusé. Veuillez autoriser la géolocalisation.');
            break;
          case err.POSITION_UNAVAILABLE:
            setError('Position non disponible. Vérifiez votre connexion GPS.');
            break;
          case err.TIMEOUT:
            setError('La demande de géolocalisation a expiré. Réessayez.');
            break;
          default:
            setError('Erreur lors de la récupération de votre position.');
        }
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const fetchNearbyDoctors = async (lat, lon) => {
    try {
      let url = `${API}/doctors/nearby?latitude=${lat}&longitude=${lon}&radius_km=${radius}`;
      if (medicalType) url += `&medical_type=${medicalType}`;
      if (specialty) url += `&specialty=${encodeURIComponent(specialty)}`;

      const response = await axios.get(url);
      setDoctors(response.data.doctors || []);
      
      if (response.data.doctors?.length === 0) {
        toast.info(`Aucun professionnel trouvé dans un rayon de ${radius}km`);
      } else {
        toast.success(`${response.data.count} professionnel(s) trouvé(s)`);
      }
    } catch (error) {
      console.error('Erreur recherche:', error);
      setError('Erreur lors de la recherche des professionnels');
    } finally {
      setLoading(false);
    }
  };

  const handleRadiusChange = (newRadius) => {
    setRadius(newRadius);
    if (userLocation) {
      setLoading(true);
      fetchNearbyDoctors(userLocation.latitude, userLocation.longitude);
    }
  };

  return (
    <div className="space-y-4">
      {/* Location Card */}
      <Card className="border-dashed border-2 border-blue-200 bg-blue-50/50">
        <CardContent className="p-6">
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <MapPin className="w-7 h-7 text-blue-600" />
            </div>
            
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              Trouver des professionnels proches
            </h3>
            
            <p className="text-sm text-stone-600 mb-4">
              Activez la géolocalisation pour découvrir les professionnels de santé près de vous
            </p>

            {error && (
              <div className="w-full mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Radius Selection */}
            <div className="flex gap-2 mb-4">
              {[5, 10, 20, 50].map((r) => (
                <button
                  key={r}
                  onClick={() => handleRadiusChange(r)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    radius === r 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-white border border-stone-200 text-stone-600 hover:border-blue-300'
                  }`}
                >
                  {r} km
                </button>
              ))}
            </div>

            <Button
              onClick={getCurrentLocation}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6"
              data-testid="locate-me-btn"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Recherche en cours...
                </>
              ) : (
                <>
                  <Navigation className="w-4 h-4 mr-2" />
                  Me localiser
                </>
              )}
            </Button>

            {userLocation && (
              <p className="text-xs text-stone-500 mt-3">
                Position: {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {doctors.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-stone-900">
              {doctors.length} professionnel{doctors.length > 1 ? 's' : ''} trouvé{doctors.length > 1 ? 's' : ''}
            </h4>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={getCurrentLocation}
              className="text-blue-600"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Actualiser
            </Button>
          </div>

          <div className="space-y-3">
            {doctors.map((doctor) => (
              <Card 
                key={doctor.id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => onSelectDoctor && onSelectDoctor(doctor)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      {doctor.profile_image ? (
                        <img 
                          src={doctor.profile_image} 
                          alt={doctor.name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-xl font-semibold text-blue-600">
                          {doctor.name?.charAt(0)}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h5 className="font-semibold text-stone-900">
                            Dr. {doctor.name}
                          </h5>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {doctor.specialties?.slice(0, 2).map((spec, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {spec}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <Badge className="bg-blue-100 text-blue-700">
                            {doctor.distance_km} km
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 mt-2 text-sm text-stone-500">
                        {doctor.rating > 0 && (
                          <span className="flex items-center">
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 mr-1" />
                            {doctor.rating.toFixed(1)}
                          </span>
                        )}
                        {doctor.city && (
                          <span className="flex items-center">
                            <MapPin className="w-4 h-4 mr-1" />
                            {doctor.city}
                          </span>
                        )}
                      </div>
                      
                      {doctor.consultation_fee && (
                        <p className="text-sm font-medium text-blue-600 mt-2">
                          {doctor.consultation_fee.toLocaleString()} XOF
                        </p>
                      )}
                    </div>
                    
                    <ChevronRight className="w-5 h-5 text-stone-300 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State after search */}
      {userLocation && doctors.length === 0 && !loading && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <MapPin className="w-12 h-12 text-stone-300 mx-auto mb-3" />
            <h4 className="font-medium text-stone-900 mb-1">
              Aucun professionnel trouvé
            </h4>
            <p className="text-sm text-stone-500 mb-4">
              Essayez d'augmenter le rayon de recherche
            </p>
            <div className="flex gap-2 justify-center">
              {[20, 50, 100].map((r) => (
                <Button
                  key={r}
                  variant="outline"
                  size="sm"
                  onClick={() => handleRadiusChange(r)}
                  className="rounded-full"
                >
                  {r} km
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NearbyDoctors;
