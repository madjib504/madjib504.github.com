import { useState, useEffect, useContext, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import { API, AuthContext } from '@/App';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Video } from 'lucide-react';
import { Link } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const Chat = () => {
  const { userId: chatUserId } = useParams();
  const { user } = useContext(AuthContext);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchConversations();
    
    // Initialize Socket.IO
    const newSocket = io(BACKEND_URL, {
      transports: ['websocket', 'polling']
    });
    setSocket(newSocket);

    return () => {
      if (newSocket) newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (chatUserId) {
      const conv = conversations.find(c => c.user_id === chatUserId);
      if (conv) {
        handleSelectConversation(conv);
      } else {
        // Create new conversation placeholder
        fetchUserInfo(chatUserId);
      }
    }
  }, [chatUserId, conversations]);

  useEffect(() => {
    if (socket && selectedConversation) {
      const room = [user.id, selectedConversation.user_id].sort().join('_');
      socket.emit('join_room', { room });

      socket.on('receive_message', (data) => {
        if (data.sender_id === selectedConversation.user_id) {
          setMessages(prev => [...prev, {
            sender_id: data.sender_id,
            recipient_id: user.id,
            content: data.content,
            created_at: new Date().toISOString()
          }]);
        }
      });
    }

    return () => {
      if (socket) {
        socket.off('receive_message');
      }
    };
  }, [socket, selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConversations(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement des conversations');
    }
  };

  const fetchUserInfo = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      // Try to get doctor profile first
      const doctorsResponse = await axios.get(`${API}/doctors/search`);
      const doctor = doctorsResponse.data.find(d => d.user_id === userId);
      
      if (doctor) {
        setSelectedConversation({
          user_id: userId,
          user_info: {
            name: doctor.name,
            email: doctor.email,
            user_type: 'doctor',
            profile_image: doctor.profile_image
          },
          last_message: null,
          unread_count: 0
        });
        setMessages([]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des informations utilisateur');
    }
  };

  const handleSelectConversation = async (conv) => {
    setSelectedConversation(conv);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/messages/${conv.user_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement des messages');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/messages`,
        {
          recipient_id: selectedConversation.user_id,
          content: newMessage
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const newMsg = {
        sender_id: user.id,
        recipient_id: selectedConversation.user_id,
        content: newMessage,
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, newMsg]);

      // Send via Socket.IO
      if (socket) {
        const room = [user.id, selectedConversation.user_id].sort().join('_');
        socket.emit('send_message', {
          room,
          sender_id: user.id,
          recipient_id: selectedConversation.user_id,
          content: newMessage
        });
      }

      setNewMessage('');
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message');
    }
  };

  return (
    <div data-testid="chat-page" className="min-h-screen bg-stone-50 pt-20">
      <div className="h-[calc(100vh-5rem)] max-w-7xl mx-auto flex">
        {/* Conversations List */}
        <div className="w-80 bg-white border-r border-stone-200 flex flex-col">
          <div className="p-6 border-b border-stone-200">
            <h2 className="text-2xl font-serif font-bold text-blue-900" data-testid="conversations-title">Messages</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-6 text-center text-stone-600" data-testid="no-conversations">
                Aucune conversation
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.user_id}
                  onClick={() => handleSelectConversation(conv)}
                  data-testid={`conversation-${conv.user_id}`}
                  className={`w-full p-4 flex items-center gap-3 hover:bg-stone-50 transition-colors border-b border-stone-100 ${
                    selectedConversation?.user_id === conv.user_id ? 'bg-blue-50' : ''
                  }`}
                >
                  <Avatar className="w-12 h-12">
                    <AvatarFallback className="bg-blue-900 text-white">
                      {conv.user_info?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-stone-900">{conv.user_info?.name || 'Utilisateur'}</p>
                    {conv.last_message && (
                      <p className="text-sm text-stone-600 truncate">
                        {conv.last_message.content}
                      </p>
                    )}
                  </div>
                  {conv.unread_count > 0 && (
                    <div className="bg-blue-900 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                      {conv.unread_count}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-white">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-6 border-b border-stone-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-blue-900 text-white">
                      {selectedConversation.user_info?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-serif font-bold text-stone-900" data-testid="chat-user-name">
                      {selectedConversation.user_info?.name || 'Utilisateur'}
                    </h3>
                    <p className="text-sm text-stone-600 capitalize">
                      {selectedConversation.user_info?.user_type || ''}
                    </p>
                  </div>
                </div>
                <Link to={`/video-call/${[user.id, selectedConversation.user_id].sort().join('_')}`}>
                  <Button variant="outline" className="border-blue-900 text-blue-900 hover:bg-blue-50 rounded-full" data-testid="start-video-call-btn">
                    <Video className="w-4 h-4 mr-2" />
                    Appel Vidéo
                  </Button>
                </Link>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4" data-testid="messages-container">
                {messages.map((msg, idx) => {
                  const isOwn = msg.sender_id === user.id;
                  return (
                    <div
                      key={idx}
                      data-testid={`message-${idx}`}
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-md px-4 py-3 rounded-2xl ${
                          isOwn
                            ? 'bg-blue-900 text-white rounded-br-sm'
                            : 'bg-stone-100 text-stone-900 rounded-bl-sm'
                        }`}
                      >
                        <p>{msg.content}</p>
                        <p className={`text-xs mt-1 ${
                          isOwn ? 'text-blue-200' : 'text-stone-500'
                        }`}>
                          {new Date(msg.created_at).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <form onSubmit={handleSendMessage} className="p-6 border-t border-stone-200" data-testid="message-form">
                <div className="flex gap-3">
                  <Input
                    type="text"
                    placeholder="Écrivez votre message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1 bg-stone-50 border-stone-200 rounded-full h-12 px-6"
                    data-testid="message-input"
                  />
                  <Button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="bg-blue-900 text-white hover:bg-blue-800 rounded-full px-6"
                    data-testid="send-message-btn"
                  >
                    <Send className="w-5 h-5" />
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-stone-600" data-testid="no-chat-selected">
              <div className="text-center">
                <p className="text-lg mb-2">Sélectionnez une conversation</p>
                <p className="text-sm">Choisissez une conversation pour commencer à discuter</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;