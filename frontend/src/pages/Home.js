import { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { 
  Menu, X, Search, Stethoscope, Calendar, MessageSquare, Video, 
  Heart, Shield, Users, ChevronRight, Home, ShoppingBag, 
  CreditCard, BookOpen, Award, FileText, Phone, LogOut, User,
  Leaf, Sparkles, Activity, Truck, Store, Clock,
  Megaphone, ChevronLeft, ExternalLink, Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuthContext } from '@/App';

// Advertising Carousel Component
const AdvertisingCarousel = () => {
  const [ads, setAds] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAds();
  }, []);

  const fetchAds = async () => {
    try {
      const response = await axios.get(`${API}/ads`);
      setAds(response.data);
    } catch (error) {
      // Publicités par défaut si l'API ne répond pas
      setAds([
        {
          id: '1',
          title: 'Clinique Santé Plus',
          description: 'Consultations médicales de qualité à prix abordables. Ouvert 7j/7.',
          image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&q=80',
          link: '#',
          advertiser: 'Clinique Santé Plus',
          type: 'entreprise'
        },
        {
          id: '2',
          title: 'Pharmacie du Bien-Être',
          description: 'Livraison gratuite de médicaments à domicile. -20% sur les produits naturels.',
          image: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=800&q=80',
          link: '#',
          advertiser: 'Pharmacie du Bien-Être',
          type: 'entreprise'
        },
        {
          id: '3',
          title: 'Formation Massage Traditionnel',
          description: 'Apprenez les techniques ancestrales de massage africain. Certification reconnue.',
          image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80',
          link: '#',
          advertiser: 'Institut Wellness Africa',
          type: 'formation'
        },
        {
          id: '4',
          title: 'Équipements Médicaux Pro',
          description: 'Matériel médical certifié aux meilleurs prix. Garantie 2 ans incluse.',
          image: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=800&q=80',
          link: '#',
          advertiser: 'MedEquip CI',
          type: 'entreprise'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Auto-scroll every 5 seconds
  useEffect(() => {
    if (ads.length === 0) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % ads.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [ads.length]);

  const goToSlide = (index) => {
    setCurrentIndex(index);
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + ads.length) % ads.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % ads.length);
  };

  if (loading || ads.length === 0) return null;

  return (
    <div className="bg-gradient-to-b from-blue-900 to-blue-800 py-6 px-2 sm:py-8 sm:px-4" data-testid="advertising-section">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <Megaphone className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Espace Publicitaire</h2>
          <Megaphone className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400 transform scale-x-[-1]" />
        </div>
        <p className="text-blue-200 text-center text-xs sm:text-sm mb-4 sm:mb-6">
          Découvrez les offres de nos partenaires
        </p>

        {/* Carousel Container */}
        <div className="relative px-6 sm:px-0">
          {/* Main Carousel */}
          <div className="overflow-hidden rounded-xl sm:rounded-2xl">
            <div 
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${currentIndex * 100}%)` }}
            >
              {ads.map((ad) => (
                <div key={ad.id} className="w-full flex-shrink-0 px-1">
                  <div className="bg-white rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl">
                    <div className="flex flex-col sm:flex-row">
                      {/* Image */}
                      <div className="sm:w-1/2 h-36 sm:h-48 md:h-64 relative overflow-hidden">
                        <img 
                          src={ad.image} 
                          alt={ad.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2 left-2 sm:top-3 sm:left-3">
                          <span className="bg-blue-600 text-white text-[10px] sm:text-xs px-2 sm:px-3 py-1 rounded-full font-medium flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {ad.type === 'entreprise' ? 'Entreprise' : ad.type === 'formation' ? 'Formation' : 'Publicité'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Content */}
                      <div className="sm:w-1/2 p-3 sm:p-4 md:p-6 flex flex-col justify-center">
                        <h3 className="text-base sm:text-lg md:text-2xl font-bold text-blue-900 mb-1 sm:mb-2">
                          {ad.title}
                        </h3>
                        <p className="text-stone-600 mb-2 sm:mb-4 text-xs sm:text-sm md:text-base line-clamp-2 sm:line-clamp-none">
                          {ad.description}
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] sm:text-xs text-stone-400 truncate">
                            Par {ad.advertiser}
                          </span>
                          <a 
                            href={ad.link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 sm:gap-2 bg-blue-600 hover:bg-blue-700 text-white px-2 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-colors whitespace-nowrap"
                          >
                            <span className="hidden sm:inline">En savoir plus</span>
                            <span className="sm:hidden">Voir</span>
                            <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation Arrows */}
          <button
            onClick={goToPrevious}
            className="absolute left-0 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-1.5 sm:p-2 rounded-full shadow-lg transition-all hover:scale-110"
            aria-label="Précédent"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-blue-900" />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-1.5 sm:p-2 rounded-full shadow-lg transition-all hover:scale-110"
            aria-label="Suivant"
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-blue-900" />
          </button>
        </div>

        {/* Dots Navigation */}
        <div className="flex justify-center gap-1.5 sm:gap-2 mt-3 sm:mt-4">
          {ads.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full transition-all ${
                index === currentIndex 
                  ? 'bg-yellow-400 w-6' 
                  : 'bg-white/40 hover:bg-white/60'
              }`}
              aria-label={`Aller à la publicité ${index + 1}`}
            />
          ))}
        </div>

        {/* CTA for Advertisers */}
        <div className="mt-6 text-center">
          <Link to="/advertise">
            <button className="inline-flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-blue-900 px-6 py-2.5 rounded-full text-sm font-semibold transition-colors shadow-lg">
              <Megaphone className="w-4 h-4" />
              Publier votre annonce
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
};

const HomePage = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { user, setUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    setMenuOpen(false);
    navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setMenuOpen(false);
    navigate('/');
  };

  const menuSections = [
    {
      title: 'Services Médicaux',
      items: [
        { icon: Activity, label: 'Médecine Moderne', link: '/search?medical_type=moderne', color: 'text-sky-500' },
        { icon: Leaf, label: 'Médecine Traditionnelle', link: '/search?medical_type=traditionnel_africain', color: 'text-blue-600' },
        { icon: Sparkles, label: 'Bien-être & Beauté', link: '/search?medical_type=bien_etre', color: 'text-purple-500' },
        { icon: Truck, label: 'Service à Domicile', link: '/search?medical_type=service_domicile', color: 'text-orange-500' },
        { icon: Users, label: 'Autre', link: '/search?medical_type=autre', color: 'text-gray-500' },
      ]
    },
    {
      title: 'Boutique',
      items: [
        { icon: Store, label: 'Matériel Médical', link: '/search?medical_type=materiel_medical', color: 'text-blue-500' },
        { icon: ShoppingBag, label: 'Boutique Bien-être', link: '/search?medical_type=boutique_bien_etre', color: 'text-pink-500' },
        { icon: Award, label: 'Packs Bien-être', link: '/wellness-packs', color: 'text-amber-500' },
      ]
    },
    {
      title: 'Ressources',
      items: [
        { icon: BookOpen, label: 'Blog Santé', link: '/blog', color: 'text-teal-500' },
        { icon: Heart, label: 'Assistance Santé', link: '/search?assistant=true', color: 'text-red-500' },
      ]
    }
  ];

  const userMenuItems = user ? [
    { icon: Home, label: 'Mon Dashboard', link: user.user_type === 'patient' ? '/patient/dashboard' : '/doctor/dashboard' },
    { icon: MessageSquare, label: 'Mes Messages', link: '/chat' },
    { icon: Calendar, label: 'Mes Rendez-vous', link: user.user_type === 'patient' ? '/patient/dashboard' : '/doctor/dashboard' },
    { icon: CreditCard, label: 'Paiement Mobile', link: '/payment' },
    { icon: Award, label: 'Points Fidélité', link: '/loyalty' },
    ...(user.user_type === 'patient' ? [{ icon: FileText, label: 'Dossier Médical', link: '/medical-record' }] : []),
  ] : [];

  return (
    <div data-testid="home-page" className="min-h-screen flex flex-col">
      {/* Main Hero - Full viewport height */}
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-900 via-blue-800 to-blue-900 relative px-6 py-8">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        {/* Menu Button - Top Left */}
        <button
          onClick={() => setMenuOpen(true)}
          className="absolute top-6 left-6 z-20 bg-white/10 backdrop-blur-sm p-3 rounded-xl hover:bg-white/20 transition-colors"
          data-testid="menu-button"
          aria-label="Ouvrir le menu"
        >
          <Menu className="w-6 h-6 text-white" />
        </button>

        {/* User/Auth Button - Top Right */}
        <div className="absolute top-6 right-6 z-20">
          {user ? (
            <button
              onClick={() => setMenuOpen(true)}
              className="bg-white/10 backdrop-blur-sm px-4 py-2 rounded-xl hover:bg-white/20 transition-colors flex items-center gap-2"
            >
              <User className="w-5 h-5 text-white" />
              <span className="text-white text-sm hidden sm:inline">{user.name?.split(' ')[0]}</span>
            </button>
          ) : (
            <Link to="/login">
              <Button variant="ghost" className="text-white hover:bg-white/10 rounded-xl">
                <User className="w-5 h-5 mr-2" />
                <span className="hidden sm:inline">Connexion</span>
              </Button>
            </Link>
          )}
        </div>

        {/* Main Content */}
        <div className="text-center z-10 max-w-3xl mx-auto">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl">
              <Stethoscope className="w-12 h-12 text-white" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold text-white mb-6 leading-tight" data-testid="hero-title">
            keneyakafisa
          </h1>
          
          <p className="text-xl md:text-2xl text-blue-100 mb-4 font-light">
            Votre Santé, Notre Priorité
          </p>

          <p className="text-base md:text-lg text-blue-200/80 mb-12 max-w-2xl mx-auto">
            Connectez-vous avec les meilleurs spécialistes en médecine moderne, traditionnelle africaine, chinoise et spécialistes de bien-être physique et émotionnel
          </p>

          {/* Main CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link to="/register" data-testid="cta-register-btn">
              <Button className="bg-white text-blue-900 hover:bg-blue-50 rounded-full px-10 py-7 text-lg font-semibold shadow-2xl hover:shadow-white/20 transition-all w-full sm:w-auto">
                <Users className="w-5 h-5 mr-2" />
                Créer un Compte
              </Button>
            </Link>
            <Link to="/search?assistant=true" data-testid="cta-assistant-btn">
              <Button className="bg-blue-700/50 backdrop-blur-sm text-white border-2 border-white/30 hover:bg-blue-600/50 hover:border-white/50 rounded-full px-10 py-7 text-lg font-semibold transition-all w-full sm:w-auto">
                <Heart className="w-5 h-5 mr-2" />
                Assistance Santé
              </Button>
            </Link>
          </div>

          {/* Quick Stats */}
          <div className="flex flex-wrap justify-center gap-8 text-blue-100/80 text-sm">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>100% Sécurisé</span>
            </div>
            <div className="flex items-center gap-2">
              <Stethoscope className="w-4 h-4" />
              <span>Médecins Vérifiés</span>
            </div>
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4" />
              <span>Gratuit</span>
            </div>
          </div>
        </div>

        {/* Menu indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-white/40 text-sm flex items-center gap-2">
          <Menu className="w-4 h-4" />
          <span>Menu</span>
        </div>
      </div>

      {/* Advertising Section */}
      <AdvertisingCarousel />

      {/* Side Menu Overlay */}
      <div 
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${menuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setMenuOpen(false)}
      />

      {/* Side Menu Panel */}
      <div 
        className={`fixed top-0 left-0 h-full w-80 max-w-[85vw] bg-white z-50 transform transition-transform duration-300 ease-out ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}
        data-testid="side-menu"
      >
        {/* Menu Header */}
        <div className="bg-blue-900 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Stethoscope className="w-8 h-8 text-white" />
            <span className="text-xl font-serif font-bold text-white">keneyakafisa</span>
          </div>
          <button
            onClick={() => setMenuOpen(false)}
            className="text-white/80 hover:text-white p-1"
            aria-label="Fermer le menu"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Menu Content - Scrollable */}
        <div className="h-[calc(100%-88px)] overflow-y-auto">
          {/* Search Bar */}
          <div className="p-4 border-b">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-stone-50 rounded-full pr-10"
                  data-testid="menu-search-input"
                />
                <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-blue-900">
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>

          {/* User Section (if logged in) */}
          {user && (
            <div className="p-4 border-b bg-blue-50">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-900 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-stone-900">{user.name}</p>
                  <p className="text-xs text-stone-500">{user.user_type === 'patient' ? 'Patient' : 'Professionnel'}</p>
                </div>
              </div>
              <div className="space-y-1">
                {userMenuItems.map((item, idx) => (
                  <Link
                    key={idx}
                    to={item.link}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <item.icon className="w-4 h-4 text-blue-700" />
                    <span className="text-sm text-stone-700">{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Menu Sections */}
          {menuSections.map((section, sectionIdx) => (
            <div key={sectionIdx} className="p-4 border-b">
              <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">
                {section.title}
              </h3>
              <div className="space-y-1">
                {section.items.map((item, itemIdx) => (
                  <Link
                    key={itemIdx}
                    to={item.link}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center justify-between px-3 py-3 rounded-lg hover:bg-stone-50 transition-colors group"
                    data-testid={`menu-item-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className={`w-5 h-5 ${item.color}`} />
                      <span className="text-stone-700 font-medium">{item.label}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-stone-500 transition-colors" />
                  </Link>
                ))}
              </div>
            </div>
          ))}

          {/* Quick Actions */}
          <div className="p-4 border-b">
            <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">
              Paiement
            </h3>
            <Link
              to="/payment"
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-between px-3 py-3 rounded-lg bg-orange-50 hover:bg-orange-100 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-orange-500" />
                <span className="text-stone-700 font-medium">Mobile Money</span>
              </div>
              <ChevronRight className="w-4 h-4 text-orange-300 group-hover:text-orange-500 transition-colors" />
            </Link>
          </div>

          {/* Auth Section */}
          <div className="p-4">
            {user ? (
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Déconnexion</span>
              </button>
            ) : (
              <div className="space-y-2">
                <Link to="/login" onClick={() => setMenuOpen(false)}>
                  <Button variant="outline" className="w-full rounded-lg">
                    Connexion
                  </Button>
                </Link>
                <Link to="/register" onClick={() => setMenuOpen(false)}>
                  <Button className="w-full bg-blue-900 hover:bg-blue-800 rounded-lg">
                    Créer un Compte
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 text-center text-xs text-stone-400">
            © 2025 keneyakafisa
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
