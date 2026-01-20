import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Eye } from 'lucide-react';

const Blog = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const response = await axios.get(`${API}/blog`);
      setPosts(response.data);
    } catch (error) {
      console.error('Erreur');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 pt-20">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-900"></div>
      </div>
    );
  }

  return (
    <div data-testid=\"blog-page\" className=\"min-h-screen bg-stone-50 pt-24 px-6 pb-12\">
      <div className=\"max-w-7xl mx-auto\">
        <div className=\"text-center mb-12\">
          <h1 className=\"text-4xl md:text-5xl font-serif font-bold text-green-900 mb-4\">
            Blog Santé & Bien-être
          </h1>
          <p className=\"text-lg text-stone-600\">
            Conseils et articles rédigés par nos experts
          </p>
        </div>

        {posts.length === 0 ? (
          <div className=\"text-center py-12\">
            <p className=\"text-stone-600\">Aucun article pour le moment. Revenez bientôt !</p>
          </div>
        ) : (
          <div className=\"grid md:grid-cols-2 lg:grid-cols-3 gap-8\">
            {posts.map((post) => (
              <Link key={post.id} to={`/blog/${post.id}`}>
                <Card className=\"h-full hover:shadow-xl transition-all hover:-translate-y-1\">
                  {post.image && (
                    <div className=\"h-48 overflow-hidden\">
                      <img 
                        src={post.image} 
                        alt={post.title}
                        className=\"w-full h-full object-cover\"
                      />
                    </div>
                  )}
                  <CardContent className=\"p-6\">
                    <Badge className=\"mb-3\">{post.category}</Badge>
                    <h3 className=\"text-xl font-serif font-bold text-stone-900 mb-3 line-clamp-2\">
                      {post.title}
                    </h3>
                    <div className=\"flex items-center gap-4 text-sm text-stone-500\">
                      <div className=\"flex items-center gap-1\">
                        <Clock className=\"w-4 h-4\" />
                        {new Date(post.created_at).toLocaleDateString('fr-FR')}
                      </div>
                      <div className=\"flex items-center gap-1\">
                        <Eye className=\"w-4 h-4\" />
                        {post.views || 0}
                      </div>
                    </div>
                    <p className=\"text-sm text-stone-600 mt-2\">Par {post.author_name}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Blog;
