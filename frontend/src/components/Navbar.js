import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Stethoscope, User, LogOut, MessageSquare, Calendar, Smartphone } from 'lucide-react';
import { NotificationBell } from '@/components/NotificationCenter';

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
            <div className="bg-blue-900 text-white p-2 rounded-lg group-hover:bg-blue-800 transition-colors">
              <Stethoscope className="w-6 h-6" />
            </div>
            <span className="text-2xl font-serif font-bold text-blue-900 hidden sm:inline">keneyakafisa</span>
          </Link>

          <div className="flex items-center gap-4 md:gap-6">
            <Link to="/search" className="text-stone-600 hover:text-blue-900 font-medium transition-colors text-sm md:text-base" data-testid="nav-search-link">
              Rechercher
            </Link>
            <Link to="/wellness-packs" className="text-stone-600 hover:text-blue-900 font-medium transition-colors hidden md:block" data-testid="nav-packs-link">
              Packs
            </Link>
            <Link to="/blog" className="text-stone-600 hover:text-blue-900 font-medium transition-colors hidden md:block" data-testid="nav-blog-link">
              Blog
            </Link>
            <Link to="/payment" className="text-stone-600 hover:text-blue-900 font-medium transition-colors flex items-center gap-1 hidden md:flex" data-testid="nav-payment-link">
              <Smartphone className="w-4 h-4" />
              Paiement
            </Link>
            
            {user ? (
              <>
                {/* Notification Bell */}
                <NotificationBell />
                
                <Link to="/chat" className="text-stone-600 hover:text-blue-900 transition-colors" data-testid="nav-chat-link">
                  <MessageSquare className="w-5 h-5" />
                </Link>
                <Link to={user.user_type === 'patient' ? '/patient/dashboard' : '/doctor/dashboard'} className="text-stone-600 hover:text-blue-900 transition-colors" data-testid="nav-dashboard-link">
                  <Calendar className="w-5 h-5" />
                </Link>
                <Button
                  onClick={handleLogout}
                  variant="ghost"
                  size="sm"
                  className="text-stone-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg"
                  data-testid="nav-logout-btn"
                >
                  <LogOut className="w-4 h-4 md:mr-2" />
                  <span className="hidden md:inline">Déconnexion</span>
                </Button>
              </>
            ) : (
              <>
                <Link to="/login" data-testid="nav-login-link">
                  <Button variant="ghost" size="sm" className="text-stone-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg">
                    <User className="w-4 h-4 md:mr-2" />
                    <span className="hidden md:inline">Connexion</span>
                  </Button>
                </Link>
                <Link to="/register" data-testid="nav-register-link">
                  <Button size="sm" className="bg-blue-900 text-white hover:bg-blue-800 rounded-full px-4 md:px-6">
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
