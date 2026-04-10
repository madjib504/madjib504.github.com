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
import { MapPin, Star, DollarSign, Calendar, MessageSquare, Stethoscope, Leaf, Clock, Languages } from 'lucide-react';

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
                  <div className="flex items-center mb-6">
                    <Star className="w-6 h-6 text-yellow-500 fill-yellow-500 mr-2" />
                    <span className="text-2xl font-bold text-stone-900">{doctor.rating}</span>
                    <span className="text-stone-600 ml-2">({doctor.total_reviews} avis)</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Reviews Section */}
            <Card className="shadow-md border-stone-100">
              <CardContent className="p-8">
                <div className="flex items-center justify-between mb-6">
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
                                    idx < review.rating
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
      </div>
    </div>
  );
};

export default DoctorProfilePage;