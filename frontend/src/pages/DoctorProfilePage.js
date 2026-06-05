import { useState, useEffect, useCallback, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { API, AuthContext } from '@/App';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, Star, DollarSign, Calendar, MessageSquare, Stethoscope, Leaf, Clock, Languages, Video, Facebook, Instagram, ExternalLink, Globe, Phone } from 'lucide-react';

const DoctorProfilePage = () => {
  const { doctorId } = useParams();
  const { user } = useContext(AuthContext);
  const [doctor, setDoctor] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [bookingData, setBookingData] = useState({
    appointment_date: '',
    appointment_time: '',
    reason: ''
  });
  const [reviewData, setReviewData] = useState({ rating: 5, comment: '' });
  const navigate = useNavigate();

  const fetchDoctorProfile = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/doctors/${doctorId}`);
      setDoctor(response.data);
    } catch {
      toast.error('Erreur lors du chargement du profil');
    } finally {
      setLoading(false);
    }
  }, [doctorId]);

  const fetchReviews = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/reviews/${doctorId}`);
      setReviews(response.data);
    } catch {
      // Reviews fetch failed
    }
  }, [doctorId]);

  useEffect(() => {
    fetchDoctorProfile();
    fetchReviews();
  }, [fetchDoctorProfile, fetchReviews]);

  const handleBooking = async (e) => {
    e.preventDefault();
    if (!user) {
      toast.error('Vous devez être connecté pour prendre rendez-vous');
      navigate('/login');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/appointments`, { ...bookingData, doctor_id: doctorId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Rendez-vous réservé avec succès !');
      setBookingOpen(false);
      setBookingData({ appointment_date: '', appointment_time: '', reason: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la réservation');
    }
  };

  const handleReview = async (e) => {
    e.preventDefault();
    if (!user) {
      toast.error('Vous devez être connecté pour laisser un avis');
      navigate('/login');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/reviews`, { ...reviewData, doctor_id: doctorId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Avis ajouté avec succès !');
      setReviewOpen(false);
      setReviewData({ rating: 5, comment: '' });
      fetchReviews();
      fetchDoctorProfile();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'ajout de l\'avis');
    }
  };

  const handleMessage = () => {
    if (!user) {
      toast.error('Vous devez être connecté pour envoyer un message');
      navigate('/login');
      return;
    }
    navigate(`/chat/${doctor.user_id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 pt-20">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
          <p className="mt-4 text-stone-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 pt-20">
        <div className="text-center">
          <h2 className="text-2xl font-serif font-bold text-stone-900 mb-4">Médecin introuvable</h2>
          <Link to="/search">
            <Button className="bg-blue-900 text-white hover:bg-blue-800 rounded-full">Retour à la recherche</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="doctor-profile-page" className="min-h-screen bg-stone-50 pt-24 px-6 pb-12">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Profile */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-md border-stone-100 overflow-hidden">
              <div className="h-64 bg-gradient-to-br from-blue-100 to-sky-100 relative">
                {doctor.profile_image ? (
                  <img src={doctor.profile_image} alt={doctor.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {doctor.medical_type === 'moderne' ? (
                      <Stethoscope className="w-32 h-32 text-sky-600" />
                    ) : (
                      <Leaf className="w-32 h-32 text-blue-700" />
                    )}
                  </div>
                )}
                <div className="absolute top-6 right-6 bg-white px-4 py-2 rounded-full font-medium">
                  {doctor.medical_type === 'moderne' ? (
                    <span className="text-sky-600">Médecine Moderne</span>
                  ) : (
                    <span className="text-blue-700">Médecine Traditionnelle</span>
                  )}
                </div>
              </div>
              <CardContent className="p-8">
                <h1 className="text-4xl font-serif font-bold text-blue-900 mb-4" data-testid="doctor-name">
                  Dr. {doctor.name}
                </h1>
                <div className="flex flex-wrap gap-2 mb-6">
                  {doctor.specialties && doctor.specialties.map((spec) => (
                    <span key={spec} className="bg-blue-50 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                      {spec}
                    </span>
                  ))}
                </div>

                {/* Social Links */}
                {(doctor.tiktok_url || doctor.facebook_url || doctor.instagram_url) && (
                  <div className="flex flex-wrap items-center gap-3 mb-6" data-testid="doctor-social-links">
                    <span className="text-sm font-medium text-stone-700">Suivez-moi :</span>
                    {doctor.tiktok_url && (
                      <a href={doctor.tiktok_url} target="_blank" rel="noopener noreferrer"
                         className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-stone-900 text-white text-sm hover:bg-stone-800 transition-colors"
                         data-testid="doctor-tiktok-link">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9a6.33 6.33 0 00-.79-.05A6.34 6.34 0 003.15 15.3a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.81a8.23 8.23 0 004.76 1.52V6.88a4.85 4.85 0 01-1-.19z"/></svg>
                        TikTok
                      </a>
                    )}
                    {doctor.facebook_url && (
                      <a href={doctor.facebook_url} target="_blank" rel="noopener noreferrer"
                         className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors"
                         data-testid="doctor-facebook-link">
                        <Facebook className="w-4 h-4" /> Facebook
                      </a>
                    )}
                    {doctor.instagram_url && (
                      <a href={doctor.instagram_url} target="_blank" rel="noopener noreferrer"
                         className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 text-white text-sm hover:opacity-90 transition-opacity"
                         data-testid="doctor-instagram-link">
                        <Instagram className="w-4 h-4" /> Instagram
                      </a>
                    )}
                  </div>
                )}

                {/* Presentation Video */}
                {(doctor.presentation_video || doctor.video_url) && (
                  <div className="mb-6" data-testid="doctor-presentation-video">
                    <div className="flex items-center gap-2 mb-3">
                      <Video className="w-5 h-5 text-blue-900" />
                      <h3 className="text-lg font-serif font-bold text-stone-900">Vidéo de présentation</h3>
                    </div>
                    {doctor.presentation_video ? (
                      <video
                        src={`${API.replace('/api', '')}${doctor.presentation_video}`}
                        controls
                        className="w-full rounded-lg shadow-md max-h-96 bg-black"
                        data-testid="doctor-uploaded-video"
                      >
                        Votre navigateur ne supporte pas la lecture vidéo.
                      </video>
                    ) : (
                      <a href={doctor.video_url} target="_blank" rel="noopener noreferrer"
                         className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-900 text-white hover:bg-blue-800 transition-colors"
                         data-testid="doctor-external-video-link">
                        <ExternalLink className="w-4 h-4" /> Voir la vidéo
                      </a>
                    )}
                  </div>
                )}

                {doctor.bio && (
                  <div className="mb-6">
                    <h3 className="text-lg font-serif font-bold text-stone-900 mb-2">À propos</h3>
                    <p className="text-stone-600 leading-relaxed">{doctor.bio}</p>
                  </div>
                )}
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  {doctor.experience_years && (
                    <div className="flex items-center text-stone-700">
                      <Clock className="w-5 h-5 mr-3 text-blue-900" />
                      <span>{doctor.experience_years} ans d'expérience</span>
                    </div>
                  )}
                  {doctor.location && (
                    <div className="flex items-center text-stone-700">
                      <MapPin className="w-5 h-5 mr-3 text-blue-900" />
                      <span>{doctor.location}</span>
                    </div>
                  )}
                  {doctor.consultation_fee && (
                    <div className="flex items-center text-stone-700">
                      <DollarSign className="w-5 h-5 mr-3 text-blue-900" />
                      <span>{doctor.consultation_fee} € / consultation</span>
                    </div>
                  )}
                  {doctor.languages && doctor.languages.length > 0 && (
                    <div className="flex items-center text-stone-700">
                      <Languages className="w-5 h-5 mr-3 text-blue-900" />
                      <span>{doctor.languages.join(', ')}</span>
                    </div>
                  )}
                </div>
                {doctor.rating > 0 && (
                  <div className="flex items-center mb-2">
                    <Star className="w-6 h-6 text-yellow-500 fill-yellow-500 mr-2" />
                    <span className="text-2xl font-bold text-stone-900">{doctor.rating}</span>
                    <span className="text-stone-600 ml-2">({doctor.total_reviews} avis)</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Coordonnées du cabinet */}
            {(doctor.country || doctor.city || doctor.neighborhood || doctor.landmark || doctor.website || doctor.whatsapp_number || (doctor.coordinates && doctor.coordinates.latitude)) && (
              <Card className="shadow-md border-stone-100" data-testid="doctor-location-card">
                <CardContent className="p-8">
                  <h2 className="text-2xl font-serif font-bold text-stone-900 mb-6 flex items-center gap-2">
                    <MapPin className="w-6 h-6 text-blue-900" />
                    Coordonnées du cabinet
                  </h2>
                  <div className="grid md:grid-cols-2 gap-x-8 gap-y-4">
                    {doctor.whatsapp_number && (
                      <div className="md:col-span-2">
                        <p className="text-xs uppercase tracking-wider text-stone-500 mb-1 flex items-center gap-1">
                          <Phone className="w-3 h-3" /> Téléphone / WhatsApp
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={`tel:+${doctor.whatsapp_number.replace(/\D/g, '')}`}
                            data-testid="doctor-phone-link"
                            className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-stone-100 text-stone-900 hover:bg-stone-200 font-medium"
                          >
                            <Phone className="w-4 h-4" />
                            +{doctor.whatsapp_number}
                          </a>
                          <a
                            href={`https://wa.me/${doctor.whatsapp_number.replace(/\D/g, '')}`}
                            target="_blank" rel="noopener noreferrer"
                            data-testid="doctor-whatsapp-link"
                            className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-green-600 text-white hover:bg-green-700 font-medium"
                          >
                            <MessageSquare className="w-4 h-4" />
                            WhatsApp
                          </a>
                        </div>
                      </div>
                    )}
                    {doctor.country && (
                      <div>
                        <p className="text-xs uppercase tracking-wider text-stone-500 mb-1">Pays</p>
                        <p className="text-stone-900 font-medium" data-testid="doctor-country">{doctor.country}</p>
                      </div>
                    )}
                    {doctor.city && (
                      <div>
                        <p className="text-xs uppercase tracking-wider text-stone-500 mb-1">Ville</p>
                        <p className="text-stone-900 font-medium" data-testid="doctor-city">{doctor.city}</p>
                      </div>
                    )}
                    {doctor.neighborhood && (
                      <div>
                        <p className="text-xs uppercase tracking-wider text-stone-500 mb-1">Quartier</p>
                        <p className="text-stone-900 font-medium" data-testid="doctor-neighborhood">{doctor.neighborhood}</p>
                      </div>
                    )}
                    {doctor.landmark && (
                      <div>
                        <p className="text-xs uppercase tracking-wider text-stone-500 mb-1">Repère</p>
                        <p className="text-stone-900 font-medium" data-testid="doctor-landmark">{doctor.landmark}</p>
                      </div>
                    )}
                    {doctor.website && (
                      <div className="md:col-span-2">
                        <p className="text-xs uppercase tracking-wider text-stone-500 mb-1 flex items-center gap-1">
                          <Globe className="w-3 h-3" /> Site web
                        </p>
                        <a href={doctor.website.startsWith('http') ? doctor.website : `https://${doctor.website}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-blue-700 hover:text-blue-900 hover:underline font-medium break-all"
                          data-testid="doctor-website-link">
                          {doctor.website}
                        </a>
                      </div>
                    )}
                    {doctor.coordinates && doctor.coordinates.latitude && doctor.coordinates.longitude && (
                      <div className="md:col-span-2">
                        <p className="text-xs uppercase tracking-wider text-stone-500 mb-1">Position GPS</p>
                        <a
                          href={`https://www.google.com/maps?q=${doctor.coordinates.latitude},${doctor.coordinates.longitude}`}
                          target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-blue-50 text-blue-900 hover:bg-blue-100 font-medium"
                          data-testid="doctor-gps-link">
                          <MapPin className="w-4 h-4" />
                          {Number(doctor.coordinates.latitude).toFixed(5)}, {Number(doctor.coordinates.longitude).toFixed(5)}
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

          </div>

          {/* Sidebar Actions */}
          <div className="space-y-6">
            <Card className="shadow-md border-stone-100 sticky top-24">
              <CardContent className="p-6">
                <h3 className="text-xl font-serif font-bold text-stone-900 mb-4">Actions</h3>
                <div className="space-y-3">
                  <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
                    <DialogTrigger asChild>
                      <Button className="w-full bg-blue-900 text-white hover:bg-blue-800 rounded-full py-6 text-lg" data-testid="book-appointment-btn">
                        <Calendar className="w-5 h-5 mr-2" />
                        Prendre rendez-vous
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-white">
                      <DialogHeader>
                        <DialogTitle className="font-serif text-blue-900">Réserver un rendez-vous</DialogTitle>
                        <DialogDescription>Choisissez une date et heure pour votre consultation</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleBooking} className="space-y-4" data-testid="booking-form">
                        <div className="space-y-2">
                          <Label htmlFor="date">Date</Label>
                          <Input
                            id="date"
                            type="date"
                            value={bookingData.appointment_date}
                            onChange={(e) => setBookingData({ ...bookingData, appointment_date: e.target.value })}
                            required
                            className="bg-white border-stone-200 rounded-lg h-12"
                            data-testid="booking-date-input"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="time">Heure</Label>
                          <Input
                            id="time"
                            type="time"
                            value={bookingData.appointment_time}
                            onChange={(e) => setBookingData({ ...bookingData, appointment_time: e.target.value })}
                            required
                            className="bg-white border-stone-200 rounded-lg h-12"
                            data-testid="booking-time-input"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="reason">Motif (optionnel)</Label>
                          <Textarea
                            id="reason"
                            placeholder="Décrivez brièvement le motif de votre consultation..."
                            value={bookingData.reason}
                            onChange={(e) => setBookingData({ ...bookingData, reason: e.target.value })}
                            className="bg-white border-stone-200 rounded-lg"
                            data-testid="booking-reason-input"
                          />
                        </div>
                        <Button type="submit" className="w-full bg-blue-900 text-white hover:bg-blue-800 rounded-full" data-testid="confirm-booking-btn">
                          Confirmer le rendez-vous
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>

                  <Button
                    onClick={handleMessage}
                    variant="outline"
                    className="w-full border-blue-900 text-blue-900 hover:bg-blue-50 rounded-full py-6 text-lg"
                    data-testid="message-doctor-btn"
                  >
                    <MessageSquare className="w-5 h-5 mr-2" />
                    Envoyer un message
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Reviews Section - Full width, bottom */}
        <div className="mt-8">
          <Card className="shadow-md border-stone-100" data-testid="reviews-section">
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <h2 className="text-2xl font-serif font-bold text-stone-900">Avis des patients</h2>
                {user && user.user_type === 'patient' && (
                  <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-blue-900 text-white hover:bg-blue-800 rounded-full" data-testid="add-review-btn">
                        Laisser un avis
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-white">
                      <DialogHeader>
                        <DialogTitle className="font-serif text-blue-900">Laisser un avis</DialogTitle>
                        <DialogDescription>Partagez votre expérience avec Dr. {doctor.name}</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleReview} className="space-y-4" data-testid="review-form">
                        <div className="space-y-2">
                          <Label>Note</Label>
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => setReviewData({ ...reviewData, rating: star })}
                                data-testid={`rating-star-${star}`}
                              >
                                <Star
                                  className={`w-8 h-8 ${
                                    star <= reviewData.rating
                                      ? 'text-yellow-500 fill-yellow-500'
                                      : 'text-stone-300'
                                  }`}
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="comment">Commentaire</Label>
                          <Textarea
                            id="comment"
                            placeholder="Partagez votre expérience..."
                            value={reviewData.comment}
                            onChange={(e) => setReviewData({ ...reviewData, comment: e.target.value })}
                            className="bg-white border-stone-200 rounded-lg min-h-[100px]"
                            data-testid="review-comment-input"
                          />
                        </div>
                        <Button type="submit" className="w-full bg-blue-900 text-white hover:bg-blue-800 rounded-full" data-testid="submit-review-btn">
                          Soumettre l'avis
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              {reviews.length === 0 ? (
                <p className="text-stone-600 text-center py-8">Aucun avis pour le moment</p>
              ) : (
                <div className="space-y-4" data-testid="reviews-list">
                  {reviews.map((review) => (
                    <div key={review.id} className="border-b border-stone-100 pb-4 last:border-0" data-testid={`review-${review.id}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium text-stone-900">{review.patient_name}</p>
                          <div className="flex items-center mt-1">
                            {[...Array(5)].map((_, starIdx) => (
                              <Star
                                key={`star-${starIdx}`}
                                className={`w-4 h-4 ${
                                  starIdx < review.rating
                                    ? 'text-yellow-500 fill-yellow-500'
                                    : 'text-stone-300'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        <span className="text-sm text-stone-500">
                          {new Date(review.created_at).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      {review.comment && <p className="text-stone-600">{review.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DoctorProfilePage;