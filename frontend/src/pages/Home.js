import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Stethoscope, Calendar, MessageSquare, Video, Star, ArrowRight, ArrowDown, Heart, Shield, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const Home = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
  };

  const scrollToContent = () => {
    document.getElementById('content-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const features = [
    {
      icon: Search,
      title: 'Recherche Avancée',
      description: 'Trouvez le spécialiste parfait selon vos besoins'
    },
    {
      icon: Calendar,
      title: 'Rendez-vous',
      description: 'Réservez en ligne en quelques clics'
    },
    {
      icon: MessageSquare,
      title: 'Chat',
      description: 'Communiquez avec vos médecins'
    },
    {
      icon: Video,
      title: 'Vidéo',
      description: 'Consultations à distance'
    }
  ];

  const medicalTypes = [
    {
      type: 'moderne',
      title: 'Médecine Moderne',
      description: 'Cardiologues, Gynécologues, Chirurgiens, Pharmaciens',
      image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?crop=entropy&cs=srgb&fm=jpg&q=85',
      color: 'bg-sky-500'
    },
    {
      type: 'traditionnel_africain',
      title: 'Médecine Traditionnelle',
      description: 'Tradipraticiens, Phytothérapeutes, Guérisseurs',
      image: 'https://images.unsplash.com/photo-1678225894265-3c558f38724b?crop=entropy&cs=srgb&fm=jpg&q=85',
      color: 'bg-green-600'
    },
    {
      type: 'bien_etre',
      title: 'Bien-être',
      description: 'Kinés, Nutritionnistes, Coachs, Spa',
      image: 'https://images.unsplash.com/photo-1677682693087-711e24efaa69?crop=entropy&cs=srgb&fm=jpg&q=85',
      color: 'bg-purple-500'
    },
    {
      type: 'service_domicile',
      title: 'Service à Domicile',
      description: 'Infirmiers, Aides soignants à domicile',
      image: 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?crop=entropy&cs=srgb&fm=jpg&q=85',
      color: 'bg-orange-500'
    }
  ];

  return (
    <div data-testid="home-page" className="min-h-screen">
      {/* Hero Section - Full Screen */}
      <section className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-green-900 via-green-800 to-green-900 relative px-6">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        <div className="text-center z-10 max-w-3xl mx-auto">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl">
              <Stethoscope className="w-12 h-12 text-white" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold text-white mb-6 leading-tight" data-testid="hero-title">
            HealthFusion
          </h1>
          
          <p className="text-xl md:text-2xl text-green-100 mb-4 font-light">
            Votre Santé, Notre Priorité
          </p>

          <p className="text-base md:text-lg text-green-200/80 mb-12 max-w-xl mx-auto">
            Connectez-vous avec les meilleurs spécialistes en médecine moderne et traditionnelle africaine
          </p>

          {/* Main CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link to="/register" data-testid="cta-register-btn">
              <Button className="bg-white text-green-900 hover:bg-green-50 rounded-full px-10 py-7 text-lg font-semibold shadow-2xl hover:shadow-white/20 transition-all w-full sm:w-auto">
                <Users className="w-5 h-5 mr-2" />
                Créer un Compte
              </Button>
            </Link>
            <Link to="/search?assistant=true" data-testid="cta-assistant-btn">
              <Button className="bg-green-700/50 backdrop-blur-sm text-white border-2 border-white/30 hover:bg-green-600/50 hover:border-white/50 rounded-full px-10 py-7 text-lg font-semibold transition-all w-full sm:w-auto">
                <Heart className="w-5 h-5 mr-2" />
                Assistance Santé
              </Button>
            </Link>
          </div>

          {/* Quick Stats */}
          <div className="flex flex-wrap justify-center gap-8 text-green-100/80 text-sm mb-16">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>100% Sécurisé</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4" />
              <span>Médecins Vérifiés</span>
            </div>
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4" />
              <span>Gratuit</span>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <button 
          onClick={scrollToContent}
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-white/60 hover:text-white transition-colors animate-bounce"
          aria-label="Défiler vers le bas"
        >
          <ArrowDown className="w-8 h-8" />
        </button>
      </section>

      {/* Content Section - Scrollable */}
      <div id="content-section">
        {/* Search Bar Section */}
        <section className="py-12 px-6 bg-white border-b">
          <div className="max-w-2xl mx-auto">
            <form onSubmit={handleSearch} className="relative" data-testid="hero-search-form">
              <Input
                type="text"
                placeholder="Rechercher une spécialité, un symptôme..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-stone-50 border-stone-200 rounded-full h-14 px-6 pr-14 text-base"
                data-testid="hero-search-input"
              />
              <Button
                type="submit"
                className="absolute right-2 top-2 bg-green-900 text-white hover:bg-green-800 rounded-full h-10 w-10 p-0"
                data-testid="hero-search-btn"
              >
                <Search className="w-5 h-5" />
              </Button>
            </form>
          </div>
        </section>

        {/* Medical Types - Compact Cards */}
        <section className="py-16 px-6 bg-stone-50">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-green-900 text-center mb-10" data-testid="medical-types-title">
              Nos Services
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {medicalTypes.map((type) => (
                <Link
                  key={type.type}
                  to={`/search?medical_type=${type.type}`}
                  data-testid={`medical-type-card-${type.type}`}
                  className="group"
                >
                  <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                    <div className="h-32 overflow-hidden relative">
                      <img
                        src={type.image}
                        alt={type.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className={`absolute inset-0 ${type.color} opacity-40`}></div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-stone-900 text-sm mb-1">
                        {type.title}
                      </h3>
                      <p className="text-stone-500 text-xs line-clamp-2">{type.description}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* More Links */}
            <div className="flex flex-wrap justify-center gap-3 mt-8">
              <Link to="/search?medical_type=materiel_medical">
                <Button variant="outline" size="sm" className="rounded-full text-xs">
                  Matériel Médical
                </Button>
              </Link>
              <Link to="/search?medical_type=boutique_bien_etre">
                <Button variant="outline" size="sm" className="rounded-full text-xs">
                  Boutique Bien-être
                </Button>
              </Link>
              <Link to="/wellness-packs">
                <Button variant="outline" size="sm" className="rounded-full text-xs">
                  Packs Bien-être
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features - Minimal */}
        <section className="py-16 px-6 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-green-900 text-center mb-10" data-testid="features-title">
              Pourquoi HealthFusion ?
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {features.map((feature, idx) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={idx}
                    data-testid={`feature-card-${idx}`}
                    className="text-center"
                  >
                    <div className="bg-green-50 w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <Icon className="w-6 h-6 text-green-900" />
                    </div>
                    <h3 className="font-semibold text-stone-900 text-sm mb-1">
                      {feature.title}
                    </h3>
                    <p className="text-stone-500 text-xs">{feature.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Wellness Packs - Compact */}
        <section className="py-16 px-6 bg-gradient-to-br from-green-50 to-purple-50">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-green-900 mb-4">
              Packs Bien-être
            </h2>
            <p className="text-stone-600 mb-8">
              Des ensembles complets à prix réduit
            </p>

            <div className="flex flex-wrap justify-center gap-4 mb-8">
              <div className="bg-white rounded-xl p-4 shadow-sm w-40">
                <span className="text-2xl mb-2 block">🧘‍♀️</span>
                <p className="font-semibold text-sm">Méditation</p>
                <p className="text-green-600 text-sm font-bold">59,99€</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm w-40">
                <span className="text-2xl mb-2 block">✨</span>
                <p className="font-semibold text-sm">Beauté</p>
                <p className="text-green-600 text-sm font-bold">69,99€</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm w-40">
                <span className="text-2xl mb-2 block">🌿</span>
                <p className="font-semibold text-sm">Relaxation</p>
                <p className="text-green-600 text-sm font-bold">64,99€</p>
              </div>
            </div>

            <Link to="/wellness-packs">
              <Button className="bg-green-900 text-white hover:bg-green-800 rounded-full px-6">
                Voir tous les packs
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 px-6 bg-green-900">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-white mb-4" data-testid="cta-title">
              Prêt à Commencer ?
            </h2>
            <p className="text-green-100 mb-8">
              Inscrivez-vous gratuitement et accédez à des centaines de professionnels de santé.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link to="/register" data-testid="cta-register-btn-2">
                <Button className="bg-white text-green-900 hover:bg-stone-100 rounded-full px-8 py-6 font-medium">
                  Créer un Compte
                </Button>
              </Link>
              <Link to="/search?assistant=true" data-testid="cta-assistant-btn-2">
                <Button variant="outline" className="border-white text-white hover:bg-white/10 rounded-full px-8 py-6">
                  Assistance Santé
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 px-6 bg-stone-900 text-stone-400 text-center text-sm">
          <p>© 2025 HealthFusion - Votre Santé, Notre Priorité</p>
        </footer>
      </div>
    </div>
  );
};

export default Home;
