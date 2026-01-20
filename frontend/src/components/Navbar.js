import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Stethoscope, User, LogOut, MessageSquare, Calendar, Smartphone } from 'lucide-react';

const Navbar = ({ user, setUser }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    navigate('/');
  };

  return (
    <nav data-testid="main-navbar" className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-stone-100">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group" data-testid="nav-logo-link">
            <div className="bg-green-900 text-white p-2 rounded-lg group-hover:bg-green-800 transition-colors">
              <Stethoscope className="w-6 h-6" />
            </div>
            <span className="text-2xl font-serif font-bold text-green-900">HealthFusion</span>
          </Link>

          <div className="flex items-center gap-6">
            <Link to="/search" className="text-stone-600 hover:text-green-900 font-medium transition-colors" data-testid="nav-search-link">
              Rechercher
            </Link>
            <Link to="/wellness-packs" className="text-stone-600 hover:text-green-900 font-medium transition-colors" data-testid="nav-packs-link">
              Packs
            </Link>
            <Link to="/blog" className="text-stone-600 hover:text-green-900 font-medium transition-colors" data-testid="nav-blog-link">
              Blog
            </Link>
            <Link to="/payment" className="text-stone-600 hover:text-green-900 font-medium transition-colors flex items-center gap-1" data-testid="nav-payment-link">
              <Smartphone className="w-4 h-4" />
              Paiement
            </Link>
            
            {user ? (
              <>
                <Link to="/loyalty" className="text-stone-600 hover:text-green-900 transition-colors" data-testid="nav-loyalty-link">
                  🏆
                </Link>
                {user.user_type === 'patient' && (
                  <Link to="/medical-record" className="text-stone-600 hover:text-green-900 transition-colors" data-testid="nav-medical-link">
                    📋
                  </Link>
                )}
                <Link to="/chat" className="text-stone-600 hover:text-green-900 transition-colors" data-testid="nav-chat-link">
                  <MessageSquare className="w-5 h-5" />
                </Link>
                <Link to={user.user_type === 'patient' ? '/patient/dashboard' : '/doctor/dashboard'} className="text-stone-600 hover:text-green-900 transition-colors" data-testid="nav-dashboard-link">
                  <Calendar className="w-5 h-5" />
                </Link>
                <Button
                  onClick={handleLogout}
                  variant="ghost"
                  className="text-stone-600 hover:text-green-900 hover:bg-green-50 rounded-lg"
                  data-testid="nav-logout-btn"
                >
                  <LogOut className="w-5 h-5 mr-2" />
                  Déconnexion
                </Button>
              </>
            ) : (
              <>
                <Link to="/login" data-testid="nav-login-link">
                  <Button variant="ghost" className="text-stone-600 hover:text-green-900 hover:bg-green-50 rounded-lg">
                    <User className="w-4 h-4 mr-2" />
                    Connexion
                  </Button>
                </Link>
                <Link to="/register" data-testid="nav-register-link">
                  <Button className="bg-green-900 text-white hover:bg-green-800 rounded-full px-6">
                    S'inscrire
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;