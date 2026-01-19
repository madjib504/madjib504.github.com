import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Stethoscope, Calendar, MessageSquare, Video, Star, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const Home = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
  };

  const features = [
    {
      icon: Search,
      title: 'Recherche Avancée',
      description: 'Trouvez le spécialiste parfait selon vos besoins spécifiques'
    },
    {
      icon: Calendar,
      title: 'Prise de Rendez-vous',
      description: 'Réservez vos consultations en ligne en quelques clics'
    },
    {
      icon: MessageSquare,
      title: 'Chat en Temps Réel',
      description: 'Communiquez directement avec vos médecins via messagerie'
    },
    {
      icon: Video,
      title: 'Consultations Vidéo',
      description: 'Consultations à distance par appel vidéo sécurisé'
    }
  ];

  const medicalTypes = [
    {
      type: 'moderne',
      title: 'Médecine Moderne',
      description: 'Cardiologues, Gynécologues, Ophtalmologues, Chirurgiens, Pharmaciens et plus',
      image: 'https://images.unsplash.com/photo-1645066928295-2506defde470?crop=entropy&cs=srgb&fm=jpg&q=85',
      color: 'sky'
    },
    {
      type: 'traditionnel_africain',
      title: 'Médecine Traditionnelle Africaine',
      description: 'Tradipraticiens, Phytothérapeutes, Guérisseurs, Herboristes Africains',
      image: 'https://images.unsplash.com/photo-1488820098099-8d4a4723a490?crop=entropy&cs=srgb&fm=jpg&q=85',
      color: 'green'
    },
    {
      type: 'bien_etre',
      title: 'Bien-être & Beauté',
      description: 'Kinés, Ostéopathes, Nutritionnistes, Coachs, Esthéticiens, Spa et plus',
      image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?crop=entropy&cs=srgb&fm=jpg&q=85',
      color: 'purple'
    }
  ];

  return (
    <div data-testid="home-page" className="min-h-screen bg-gradient-to-br from-stone-50 via-green-50 to-sky-50">
      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8 animate-fade-in">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif font-light tracking-tight text-green-900" data-testid="hero-title">
                Votre Santé,
                <br />
                <span className="font-bold">Notre Priorité</span>
              </h1>
              <p className="text-lg md:text-xl text-stone-600 leading-relaxed">
                Connectez-vous avec les meilleurs spécialistes en médecine moderne et traditionnelle. 
                Prenez votre santé en main dès aujourd'hui.
              </p>
              
              <form onSubmit={handleSearch} className="relative" data-testid="hero-search-form">
                <Input
                  type="text"
                  placeholder="Rechercher une spécialité ou un médecin..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-white shadow-lg border-stone-200 rounded-full h-16 px-6 pr-16 text-lg"
                  data-testid="hero-search-input"
                />
                <Button
                  type="submit"
                  className="absolute right-2 top-2 bg-green-900 text-white hover:bg-green-800 rounded-full h-12 px-6"
                  data-testid="hero-search-btn"
                >
                  <Search className="w-5 h-5" />
                </Button>
              </form>

              <div className="flex gap-4">
                <Link to="/search" data-testid="hero-explore-btn">
                  <Button className="bg-green-900 text-white hover:bg-green-800 rounded-full px-8 py-6 text-lg font-medium shadow-lg hover:shadow-green-900/20 transition-all">
                    Explorer les Médecins
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <Link to="/register" data-testid="hero-register-btn">
                  <Button variant="outline" className="bg-white text-stone-900 border-stone-200 hover:border-stone-300 hover:bg-stone-50 rounded-full px-6 py-6 transition-all">
                    Inscription Gratuite
                  </Button>
                </Link>
              </div>
            </div>

            <div className="relative lg:block hidden">
              <div className="grid grid-cols-2 gap-4">
                <img
                  src="https://images.unsplash.com/photo-1645066928295-2506defde470?crop=entropy&cs=srgb&fm=jpg&q=85"
                  alt="Médecin moderne"
                  className="rounded-2xl shadow-lg h-64 w-full object-cover hover-lift"
                />
                <img
                  src="https://images.unsplash.com/photo-1488820098099-8d4a4723a490?crop=entropy&cs=srgb&fm=jpg&q=85"
                  alt="Médecine traditionnelle"
                  className="rounded-2xl shadow-lg h-64 w-full object-cover hover-lift mt-8"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Medical Types Section */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-green-900 mb-4" data-testid="medical-types-title">
              Deux Approches, Une Mission
            </h2>
            <p className="text-lg text-stone-600 max-w-2xl mx-auto">
              Choisissez entre médecine moderne et traditionnelle selon vos préférences
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {medicalTypes.map((type, idx) => (
              <Link
                key={type.type}
                to={`/search?medical_type=${type.type}`}
                data-testid={`medical-type-card-${type.type}`}
                className="group"
              >
                <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                  <div className="h-48 overflow-hidden">
                    <img
                      src={type.image}
                      alt={type.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-8">
                    <h3 className={`text-2xl font-serif font-bold text-${type.color}-600 mb-3`}>
                      {type.title}
                    </h3>
                    <p className="text-stone-600 mb-4">{type.description}</p>
                    <div className="flex items-center text-green-900 font-medium">
                      Découvrir
                      <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-green-900 mb-4" data-testid="features-title">
              Pourquoi HealthFusion ?
            </h2>
            <p className="text-lg text-stone-600 max-w-2xl mx-auto">
              Une plateforme complète pour tous vos besoins de santé
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div
                  key={idx}
                  data-testid={`feature-card-${idx}`}
                  className="bg-stone-100/50 rounded-3xl p-8 hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-stone-100"
                >
                  <div className="bg-green-50 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                    <Icon className="w-7 h-7 text-green-900" />
                  </div>
                  <h3 className="text-xl font-serif font-bold text-stone-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-stone-600">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-green-900 rounded-3xl p-12 md:p-16 shadow-xl">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-white mb-6" data-testid="cta-title">
              Prêt à Prendre en Charge Votre Santé ?
            </h2>
            <p className="text-green-100 text-lg mb-8 max-w-2xl mx-auto">
              Inscrivez-vous gratuitement et accédez à des centaines de professionnels de santé qualifiés.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link to="/register" data-testid="cta-register-btn">
                <Button className="bg-white text-green-900 hover:bg-stone-100 rounded-full px-8 py-6 text-lg font-medium">
                  Créer un Compte
                </Button>
              </Link>
              <Link to="/search" data-testid="cta-search-btn">
                <Button variant="outline" className="border-white text-white hover:bg-white/10 rounded-full px-8 py-6 text-lg">
                  Parcourir les Médecins
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;