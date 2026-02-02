import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Package, ShoppingCart, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const WellnessPacks = () => {
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPacks();
  }, []);

  const fetchPacks = async () => {
    try {
      const response = await axios.get(`${API}/packs/wellness`);
      setPacks(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement des packs');
      toast.error('Erreur lors du chargement des packs');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (pack) => {
    toast.success(`${pack.name} ajouté au panier !`);
    // TODO: Implement cart functionality
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 pt-20">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
          <p className="mt-4 text-stone-600">Chargement des packs...</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="wellness-packs-page" className="min-h-screen bg-gradient-to-br from-stone-50 via-blue-50 to-purple-50 pt-24 px-6 pb-12">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Package className="w-12 h-12 text-blue-900" />
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-blue-900" data-testid="packs-title">
              Packs Bien-être
            </h1>
          </div>
          <p className="text-lg text-stone-600 max-w-2xl mx-auto mb-6">
            Des ensembles thématiques soigneusement composés pour votre bien-être, 
            avec jusqu'à 29% de réduction
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-blue-800 bg-blue-50 rounded-full px-6 py-2 inline-flex">
            <Sparkles className="w-4 h-4" />
            <span className="font-medium">Économisez en achetant nos packs complets</span>
          </div>
        </div>

        {/* Packs Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8" data-testid="packs-grid">
          {packs.map((pack) => (
            <Card 
              key={pack.id}
              data-testid={`pack-${pack.id}`}
              className="bg-white rounded-2xl border border-stone-100 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-2 group"
            >
              <div className="relative h-56 overflow-hidden">
                <img
                  src={pack.image}
                  alt={pack.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-full font-bold shadow-lg">
                  -{pack.discount}%
                </div>
              </div>

              <CardContent className="p-6">
                <h3 className="text-2xl font-serif font-bold text-blue-900 mb-2">
                  {pack.name}
                </h3>
                <p className="text-stone-600 mb-4">{pack.description}</p>

                {/* Benefits */}
                <div className="mb-4">
                  <p className="text-sm font-medium text-stone-700 mb-2">Bienfaits :</p>
                  <div className="flex flex-wrap gap-2">
                    {pack.benefits.map((benefit, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs bg-blue-50 text-blue-800 border-blue-200">
                        {benefit}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Products List */}
                <div className="mb-4">
                  <p className="text-sm font-medium text-stone-700 mb-2">Contenu du pack :</p>
                  <div className="space-y-1">
                    {pack.products.map((product, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm text-stone-600">
                        <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <span>{product}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pricing */}
                <div className="border-t border-stone-100 pt-4 mb-4">
                  <div className="flex items-end gap-3 mb-1">
                    <span className="text-3xl font-bold text-blue-900">
                      {pack.pack_price.toFixed(2)} €
                    </span>
                    <span className="text-lg text-stone-400 line-through mb-1">
                      {pack.original_price.toFixed(2)} €
                    </span>
                  </div>
                  <p className="text-sm text-blue-700 font-medium">
                    Économisez {(pack.original_price - pack.pack_price).toFixed(2)} €
                  </p>
                </div>

                {/* Action Button */}
                <Button
                  onClick={() => handleAddToCart(pack)}
                  className="w-full bg-blue-900 text-white hover:bg-blue-800 rounded-full py-6 text-lg font-medium shadow-lg"
                  data-testid={`add-to-cart-${pack.id}`}
                >
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  Ajouter au panier
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center bg-white rounded-3xl p-12 shadow-md">
          <h2 className="text-3xl font-serif font-bold text-blue-900 mb-4">
            Besoin d'un pack personnalisé ?
          </h2>
          <p className="text-stone-600 mb-6 max-w-2xl mx-auto">
            Contactez nos experts bien-être pour créer un pack sur-mesure adapté à vos besoins spécifiques
          </p>
          <Link to="/search?medical_type=boutique_bien_etre">
            <Button className="bg-blue-900 text-white hover:bg-blue-800 rounded-full px-8 py-6 text-lg">
              Découvrir nos boutiques
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default WellnessPacks;
