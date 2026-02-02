from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
import jwt
import socketio
import base64
import aiofiles

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Admin credentials (changez ces valeurs !)
ADMIN_USERNAME = os.environ.get('ADMIN_USERNAME', 'admin')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'HealthFusion2025!')
ADMIN_SECRET = os.environ.get('ADMIN_SECRET', 'admin-secret-key-change-me')

security = HTTPBearer()

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Socket.IO for real-time chat
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=True
)
socket_app = socketio.ASGIApp(sio, app)

# ============ Models ============

class UserBase(BaseModel):
    email: EmailStr
    name: str
    user_type: str  # 'patient' or 'doctor'

class UserRegister(UserBase):
    password: str
    whatsapp_number: Optional[str] = None
    medical_type: Optional[str] = None  # 'moderne' or 'traditionnel' for doctors
    specialties: Optional[List[str]] = None  # for doctors
    custom_medical_type: Optional[str] = None  # for "autre" category

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    whatsapp_number: Optional[str] = None
    medical_type: Optional[str] = None
    specialties: Optional[List[str]] = None
    verified: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DoctorProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    email: str
    medical_type: str
    specialties: List[str]
    bio: Optional[str] = None
    experience_years: Optional[int] = None
    location: Optional[str] = None
    consultation_fee: Optional[float] = None
    languages: Optional[List[str]] = None
    availability: Optional[Dict[str, Any]] = None
    profile_image: Optional[str] = None
    documents_verified: bool = False
    rating: float = 0.0
    total_reviews: int = 0
    service_type: Optional[str] = None  # 'cabinet', 'clinique', 'domicile', 'both'
    home_service: bool = False  # Service à domicile disponible
    structure_type: Optional[str] = None  # 'cabinet', 'clinique', 'hopital', 'centre'
    is_pack: bool = False  # Si c'est un pack bien-être
    pack_products: Optional[List[str]] = None  # Liste des produits dans le pack
    pack_original_price: Optional[float] = None  # Prix si acheté séparément
    pack_discount_percentage: Optional[int] = None  # Pourcentage de réduction
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DoctorProfileCreate(BaseModel):
    bio: Optional[str] = None
    experience_years: Optional[int] = None
    location: Optional[str] = None
    consultation_fee: Optional[float] = None
    languages: Optional[List[str]] = None
    availability: Optional[Dict[str, Any]] = None
    profile_image: Optional[str] = None
    service_type: Optional[str] = None
    home_service: Optional[bool] = False
    structure_type: Optional[str] = None

class AppointmentCreate(BaseModel):
    doctor_id: str
    appointment_date: str
    appointment_time: str
    reason: Optional[str] = None

class Appointment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    patient_id: str
    doctor_id: str
    appointment_date: str
    appointment_time: str
    reason: Optional[str] = None
    status: str = "pending"  # pending, confirmed, cancelled, completed
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MessageCreate(BaseModel):
    recipient_id: str
    content: str

class Message(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sender_id: str
    recipient_id: str
    content: str
    read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReviewCreate(BaseModel):
    doctor_id: str
    rating: float
    comment: Optional[str] = None

class Review(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    doctor_id: str
    patient_id: str
    patient_name: str
    rating: float
    comment: Optional[str] = None
    doctor_reply: Optional[str] = None
    reply_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Specialty(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    medical_type: str  # 'moderne' or 'traditionnel'

# New Models for Phase 1

class MedicalRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    patient_id: str
    allergies: Optional[List[str]] = None
    chronic_conditions: Optional[List[str]] = None
    medications: Optional[List[Dict[str, str]]] = None
    vaccinations: Optional[List[Dict[str, str]]] = None
    blood_type: Optional[str] = None
    emergency_contact: Optional[Dict[str, str]] = None
    documents: Optional[List[Dict[str, str]]] = None  # {name, url, type, date}
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LoyaltyPoints(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    total_points: int = 0
    level: str = "Bronze"  # Bronze, Argent, Or, Platine
    transactions: Optional[List[Dict[str, Any]]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DoctorSchedule(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    doctor_id: str
    date: str  # YYYY-MM-DD
    slots: List[Dict[str, Any]]  # [{time: "09:00", available: true}]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BlogPost(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    content: str
    author_id: str
    author_name: str
    category: str  # nutrition, exercice, prévention, etc.
    image: Optional[str] = None
    tags: Optional[List[str]] = None
    views: int = 0
    published: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============ Utility Functions ============

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return User(**user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

# ============ Routes ============

@api_router.post("/auth/register")
async def register(user_data: UserRegister):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user = User(
        email=user_data.email,
        name=user_data.name,
        user_type=user_data.user_type,
        medical_type=user_data.medical_type,
        specialties=user_data.specialties
    )
    user_dict = user.model_dump()
    user_dict['password'] = hash_password(user_data.password)
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    
    await db.users.insert_one(user_dict)
    
    # If doctor, create profile
    if user_data.user_type == "doctor":
        profile = DoctorProfile(
            user_id=user.id,
            name=user.name,
            email=user.email,
            medical_type=user_data.medical_type or "moderne",
            specialties=user_data.specialties or []
        )
        profile_dict = profile.model_dump()
        profile_dict['created_at'] = profile_dict['created_at'].isoformat()
        # Ajouter custom_medical_type si catégorie "autre"
        if user_data.medical_type == "autre" and user_data.custom_medical_type:
            profile_dict['custom_medical_type'] = user_data.custom_medical_type
        await db.doctor_profiles.insert_one(profile_dict)
    
    token = create_access_token({"sub": user.id})
    return {"token": token, "user": user.model_dump()}

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(credentials.password, user['password']):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    del user['password']
    if isinstance(user.get('created_at'), str):
        user['created_at'] = datetime.fromisoformat(user['created_at'])
    
    token = create_access_token({"sub": user['id']})
    return {"token": token, "user": user}

@api_router.get("/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.get("/packs/wellness")
async def get_wellness_packs():
    """Récupère les packs bien-être thématiques prédéfinis"""
    packs = [
        {
            "id": "pack_relaxation",
            "name": "Pack Relaxation Complète",
            "description": "Tout pour créer votre oasis de détente à la maison",
            "products": [
                "Huiles Essentielles (Lavande, Ylang-Ylang)",
                "Diffuseur d'Arômes",
                "Bougies Parfumées",
                "Sels de Bain"
            ],
            "original_price": 89.99,
            "pack_price": 64.99,
            "discount": 28,
            "image": "https://images.unsplash.com/photo-1600334129128-685c5582fd35?crop=entropy&cs=srgb&fm=jpg&q=85",
            "benefits": ["Réduit le stress", "Améliore le sommeil", "Détente profonde"]
        },
        {
            "id": "pack_meditation",
            "name": "Pack Méditation & Pleine Conscience",
            "description": "L'essentiel pour débuter ou approfondir votre pratique méditative",
            "products": [
                "Coussin de Méditation Zafu",
                "Encens & Fumigation",
                "Journal de Pleine Conscience",
                "Livre Développement Personnel"
            ],
            "original_price": 79.99,
            "pack_price": 59.99,
            "discount": 25,
            "image": "https://images.unsplash.com/photo-1506126613408-eca07ce68773?crop=entropy&cs=srgb&fm=jpg&q=85",
            "benefits": ["Concentration améliorée", "Paix intérieure", "Réduction anxiété"]
        },
        {
            "id": "pack_beaute_naturelle",
            "name": "Pack Beauté Naturelle",
            "description": "Des soins bio pour rayonner de l'intérieur",
            "products": [
                "Cosmétiques Naturels & Bio",
                "Savons Artisanaux",
                "Huiles Essentielles (Rose, Tea Tree)",
                "Soins Peau Corps Cheveux"
            ],
            "original_price": 94.99,
            "pack_price": 69.99,
            "discount": 26,
            "image": "https://images.unsplash.com/photo-1556228578-8c89e6adf883?crop=entropy&cs=srgb&fm=jpg&q=85",
            "benefits": ["Peau éclatante", "100% naturel", "Routine beauté complète"]
        },
        {
            "id": "pack_energie_vitalite",
            "name": "Pack Énergie & Vitalité",
            "description": "Boostez votre énergie naturellement",
            "products": [
                "Tisanes & Infusions Énergisantes",
                "Compléments Naturels",
                "Pierres & Cristaux (Citrine, Cornaline)",
                "Huiles Essentielles (Menthe, Citron)"
            ],
            "original_price": 74.99,
            "pack_price": 54.99,
            "discount": 27,
            "image": "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?crop=entropy&cs=srgb&fm=jpg&q=85",
            "benefits": ["Plus d'énergie", "Système immunitaire renforcé", "Vitalité retrouvée"]
        },
        {
            "id": "pack_sommeil",
            "name": "Pack Sommeil Réparateur",
            "description": "Pour des nuits paisibles et un sommeil profond",
            "products": [
                "Huiles Essentielles (Lavande, Camomille)",
                "Tisanes & Infusions Relaxantes",
                "Bougies Parfumées",
                "Sels de Bain"
            ],
            "original_price": 69.99,
            "pack_price": 49.99,
            "discount": 29,
            "image": "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?crop=entropy&cs=srgb&fm=jpg&q=85",
            "benefits": ["Endormissement rapide", "Sommeil profond", "Réveil en forme"]
        },
        {
            "id": "pack_yoga_fitness",
            "name": "Pack Yoga & Fitness",
            "description": "Équipez-vous pour votre pratique quotidienne",
            "products": [
                "Tapis de Yoga Premium",
                "Outils de Massage",
                "Tisanes & Infusions",
                "Bijoux Énergétiques (Bracelet Mala)"
            ],
            "original_price": 99.99,
            "pack_price": 74.99,
            "discount": 25,
            "image": "https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?crop=entropy&cs=srgb&fm=jpg&q=85",
            "benefits": ["Pratique confortable", "Récupération optimale", "Alignement corps-esprit"]
        }
    ]
    return packs

@api_router.get("/specialties")
async def get_specialties():
    moderne_specialties = [
        {"id": "1", "name": "Médecine Générale", "medical_type": "moderne", "description": "Soins de santé généraux et prévention"},
        {"id": "2", "name": "Cardiologie", "medical_type": "moderne", "description": "Spécialiste du cœur et des vaisseaux sanguins"},
        {"id": "3", "name": "Dermatologie", "medical_type": "moderne", "description": "Spécialiste de la peau, des cheveux et des ongles"},
        {"id": "4", "name": "Gynécologie", "medical_type": "moderne", "description": "Santé de la femme et système reproducteur"},
        {"id": "5", "name": "Ophtalmologie", "medical_type": "moderne", "description": "Spécialiste des yeux et de la vision"},
        {"id": "6", "name": "Chirurgie", "medical_type": "moderne", "description": "Interventions chirurgicales"},
        {"id": "7", "name": "Pédiatrie", "medical_type": "moderne", "description": "Santé des enfants et des nourrissons"},
        {"id": "8", "name": "Orthopédie", "medical_type": "moderne", "description": "Spécialiste des os, articulations et muscles"},
        {"id": "9", "name": "Neurologie", "medical_type": "moderne", "description": "Spécialiste du système nerveux et du cerveau"},
        {"id": "10", "name": "Psychiatrie", "medical_type": "moderne", "description": "Santé mentale et troubles psychologiques"},
        {"id": "11", "name": "ORL", "medical_type": "moderne", "description": "Oreilles, nez et gorge"},
        {"id": "12", "name": "Gastro-entérologie", "medical_type": "moderne", "description": "Système digestif et intestinal"},
        {"id": "13", "name": "Pneumologie", "medical_type": "moderne", "description": "Spécialiste des poumons et de la respiration"},
        {"id": "14", "name": "Endocrinologie", "medical_type": "moderne", "description": "Hormones et glandes (diabète, thyroïde)"},
        {"id": "15", "name": "Pharmacien", "medical_type": "moderne", "description": "Médicaments et conseils pharmaceutiques"},
    ]
    
    traditionnel_africain_specialties = [
        {"id": "20", "name": "Tradipraticien Généraliste", "medical_type": "traditionnel_africain", "description": "Soins traditionnels africains généraux"},
        {"id": "21", "name": "Phytothérapeute Africain", "medical_type": "traditionnel_africain", "description": "Traitement par les plantes médicinales africaines"},
        {"id": "22", "name": "Guérisseur Traditionnel", "medical_type": "traditionnel_africain", "description": "Médecine ancestrale et spirituelle africaine"},
        {"id": "23", "name": "Herboriste Africain", "medical_type": "traditionnel_africain", "description": "Expert en plantes et remèdes naturels africains"},
        {"id": "24", "name": "Masseur Traditionnel", "medical_type": "traditionnel_africain", "description": "Massages thérapeutiques traditionnels"},
        {"id": "25", "name": "Sage-femme Traditionnelle", "medical_type": "traditionnel_africain", "description": "Accompagnement grossesse et accouchement traditionnel"},
        {"id": "26", "name": "Rebouteux", "medical_type": "traditionnel_africain", "description": "Spécialiste des fractures et entorses"},
    ]
    
    bien_etre_specialties = [
        {"id": "30", "name": "Kinésithérapeute", "medical_type": "bien_etre", "description": "Rééducation et massage thérapeutique"},
        {"id": "31", "name": "Ostéopathe", "medical_type": "bien_etre", "description": "Manipulation du corps pour soulager douleurs"},
        {"id": "32", "name": "Nutritionniste", "medical_type": "bien_etre", "description": "Conseils en alimentation et nutrition"},
        {"id": "33", "name": "Diététicien", "medical_type": "bien_etre", "description": "Plans alimentaires personnalisés"},
        {"id": "34", "name": "Naturopathe", "medical_type": "bien_etre", "description": "Médecine naturelle et prévention"},
        {"id": "35", "name": "Sophrologue", "medical_type": "bien_etre", "description": "Relaxation et gestion du stress"},
        {"id": "36", "name": "Relaxologue", "medical_type": "bien_etre", "description": "Techniques de relaxation profonde"},
        {"id": "37", "name": "Coach de Vie", "medical_type": "bien_etre", "description": "Accompagnement personnel et développement"},
        {"id": "38", "name": "Coach Sportif", "medical_type": "bien_etre", "description": "Entraînement physique et remise en forme"},
        {"id": "39", "name": "Masseur Bien-être", "medical_type": "bien_etre", "description": "Massages relaxants et détente"},
        {"id": "40", "name": "Spa Praticien", "medical_type": "bien_etre", "description": "Soins spa et hydrothérapie"},
        {"id": "41", "name": "Esthéticien", "medical_type": "bien_etre", "description": "Soins du visage et beauté"},
        {"id": "42", "name": "Coiffeur", "medical_type": "bien_etre", "description": "Soins et coiffure"},
        {"id": "43", "name": "Prothésiste Ongulaire", "medical_type": "bien_etre", "description": "Soins et pose d'ongles"},
        {"id": "44", "name": "Maquilleur Professionnel", "medical_type": "bien_etre", "description": "Maquillage et beauté"},
        {"id": "45", "name": "Acupuncteur", "medical_type": "bien_etre", "description": "Médecine chinoise par aiguilles"},
    ]
    
    services_domicile = [
        {"id": "50", "name": "Infirmier à Domicile", "medical_type": "service_domicile", "description": "Soins infirmiers à votre domicile"},
        {"id": "51", "name": "Aide Soignant à Domicile", "medical_type": "service_domicile", "description": "Aide aux personnes dépendantes"},
    ]
    
    materiel_medical = [
        {"id": "60", "name": "Fournitures Médicales", "medical_type": "materiel_medical", "description": "Gants, masques, seringues, compresses"},
        {"id": "61", "name": "Équipements de Diagnostic", "medical_type": "materiel_medical", "description": "Stéthoscopes, tensiomètres, thermomètres"},
        {"id": "62", "name": "Matériel de Mobilité", "medical_type": "materiel_medical", "description": "Fauteuils roulants, béquilles, déambulateurs"},
        {"id": "63", "name": "Équipements Hospitaliers", "medical_type": "materiel_medical", "description": "Lits médicalisés, tables d'examen, chariots"},
        {"id": "64", "name": "Dispositifs de Rééducation", "medical_type": "materiel_medical", "description": "Appareils de kinésithérapie et rééducation"},
        {"id": "65", "name": "Matériel d'Urgence", "medical_type": "materiel_medical", "description": "Défibrillateurs, trousses de premiers secours"},
        {"id": "66", "name": "Consommables de Laboratoire", "medical_type": "materiel_medical", "description": "Tests, tubes, réactifs médicaux"},
        {"id": "67", "name": "Équipements de Protection", "medical_type": "materiel_medical", "description": "Blouses, lunettes, masques professionnels"},
    ]
    
    boutique_bien_etre = [
        # Soins & beauté naturels
        {"id": "70", "name": "Cosmétiques Naturels & Bio", "medical_type": "boutique_bien_etre", "description": "Crèmes, huiles, lotions naturelles"},
        {"id": "71", "name": "Soins Peau Corps Cheveux", "medical_type": "boutique_bien_etre", "description": "Produits de soins naturels complets"},
        {"id": "72", "name": "Savons Artisanaux", "medical_type": "boutique_bien_etre", "description": "Savons faits main, naturels"},
        {"id": "73", "name": "Parfums de Bien-être", "medical_type": "boutique_bien_etre", "description": "Parfums naturels et aromathérapie"},
        
        # Relaxation & aromathérapie
        {"id": "74", "name": "Huiles Essentielles", "medical_type": "boutique_bien_etre", "description": "Huiles essentielles pures et naturelles"},
        {"id": "75", "name": "Diffuseurs d'Arômes", "medical_type": "boutique_bien_etre", "description": "Diffuseurs électriques et traditionnels"},
        {"id": "76", "name": "Encens & Fumigation", "medical_type": "boutique_bien_etre", "description": "Encens, bâtons de fumigation, résines"},
        {"id": "77", "name": "Bougies Parfumées", "medical_type": "boutique_bien_etre", "description": "Bougies naturelles parfumées"},
        {"id": "78", "name": "Sels de Bain", "medical_type": "boutique_bien_etre", "description": "Sels et produits pour le bain relaxant"},
        
        # Spiritualité & énergie
        {"id": "79", "name": "Pierres & Cristaux", "medical_type": "boutique_bien_etre", "description": "Pierres énergétiques et cristaux naturels"},
        {"id": "80", "name": "Bijoux Énergétiques", "medical_type": "boutique_bien_etre", "description": "Bracelets mala, pendentifs, bijoux"},
        {"id": "81", "name": "Oracles & Tarots", "medical_type": "boutique_bien_etre", "description": "Jeux d'oracles, tarots, guidance spirituelle"},
        {"id": "82", "name": "Livres Développement Personnel", "medical_type": "boutique_bien_etre", "description": "Livres de spiritualité et croissance"},
        
        # Nutrition & santé naturelle
        {"id": "83", "name": "Tisanes & Infusions", "medical_type": "boutique_bien_etre", "description": "Thés relaxants, tisanes digestion, détente"},
        {"id": "84", "name": "Compléments Naturels", "medical_type": "boutique_bien_etre", "description": "Suppléments à base de plantes"},
        {"id": "85", "name": "Plantes Médicinales Traditionnelles", "medical_type": "boutique_bien_etre", "description": "Produits issus de plantes médicinales"},
        
        # Accessoires pratique
        {"id": "86", "name": "Coussins de Méditation", "medical_type": "boutique_bien_etre", "description": "Coussins zafu, zafuton, supports"},
        {"id": "87", "name": "Tapis de Yoga", "medical_type": "boutique_bien_etre", "description": "Tapis, accessoires de yoga et pilates"},
        {"id": "88", "name": "Outils de Massage", "medical_type": "boutique_bien_etre", "description": "Rouleaux, balles, outils de récupération"},
        {"id": "89", "name": "Journaux de Pleine Conscience", "medical_type": "boutique_bien_etre", "description": "Carnets, journaux de gratitude, méditation"},
    ]
    
    return moderne_specialties + traditionnel_africain_specialties + bien_etre_specialties + services_domicile + materiel_medical + boutique_bien_etre

@api_router.get("/doctors/search")
async def search_doctors(
    specialty: Optional[str] = None,
    medical_type: Optional[str] = None,
    location: Optional[str] = None,
    min_rating: Optional[float] = None,
    home_service: Optional[bool] = None,
    structure_type: Optional[str] = None,
    keyword: Optional[str] = None,
    custom_search: Optional[str] = None
):
    query = {}
    if specialty:
        query["specialties"] = {"$in": [specialty]}
    if medical_type:
        query["medical_type"] = medical_type
    if location:
        query["location"] = {"$regex": location, "$options": "i"}
    if min_rating:
        query["rating"] = {"$gte": min_rating}
    if home_service is not None:
        query["home_service"] = home_service
    if structure_type:
        query["structure_type"] = structure_type
    
    # Recherche par mots-clés dans nom, bio, spécialités
    if keyword:
        query["$or"] = [
            {"name": {"$regex": keyword, "$options": "i"}},
            {"bio": {"$regex": keyword, "$options": "i"}},
            {"specialties": {"$regex": keyword, "$options": "i"}}
        ]
    
    # Recherche personnalisée pour "Autre" catégorie
    # Cherche dans le medical_type personnalisé, les spécialités et le bio
    if custom_search:
        custom_or_conditions = [
            {"specialties": {"$regex": custom_search, "$options": "i"}},
            {"bio": {"$regex": custom_search, "$options": "i"}},
            {"name": {"$regex": custom_search, "$options": "i"}},
            {"custom_medical_type": {"$regex": custom_search, "$options": "i"}}
        ]
        if "$or" in query:
            query["$and"] = [{"$or": query.pop("$or")}, {"$or": custom_or_conditions}]
        else:
            query["$or"] = custom_or_conditions
    
    doctors = await db.doctor_profiles.find(query, {"_id": 0}).to_list(100)
    for doctor in doctors:
        if isinstance(doctor.get('created_at'), str):
            doctor['created_at'] = datetime.fromisoformat(doctor['created_at'])
    return doctors

@api_router.get("/doctors/{doctor_id}")
async def get_doctor_profile(doctor_id: str):
    doctor = await db.doctor_profiles.find_one({"id": doctor_id}, {"_id": 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    if isinstance(doctor.get('created_at'), str):
        doctor['created_at'] = datetime.fromisoformat(doctor['created_at'])
    return doctor

@api_router.put("/doctors/profile")
async def update_doctor_profile(
    profile_data: DoctorProfileCreate,
    current_user: User = Depends(get_current_user)
):
    if current_user.user_type != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can update profiles")
    
    update_data = profile_data.model_dump(exclude_unset=True)
    await db.doctor_profiles.update_one(
        {"user_id": current_user.id},
        {"$set": update_data}
    )
    
    updated_profile = await db.doctor_profiles.find_one({"user_id": current_user.id}, {"_id": 0})
    if isinstance(updated_profile.get('created_at'), str):
        updated_profile['created_at'] = datetime.fromisoformat(updated_profile['created_at'])
    return updated_profile

@api_router.post("/appointments")
async def create_appointment(
    appointment_data: AppointmentCreate,
    current_user: User = Depends(get_current_user)
):
    if current_user.user_type != "patient":
        raise HTTPException(status_code=403, detail="Only patients can book appointments")
    
    appointment = Appointment(
        patient_id=current_user.id,
        doctor_id=appointment_data.doctor_id,
        appointment_date=appointment_data.appointment_date,
        appointment_time=appointment_data.appointment_time,
        reason=appointment_data.reason
    )
    
    appointment_dict = appointment.model_dump()
    appointment_dict['created_at'] = appointment_dict['created_at'].isoformat()
    await db.appointments.insert_one(appointment_dict)
    
    return appointment

@api_router.get("/appointments")
async def get_appointments(current_user: User = Depends(get_current_user)):
    query = {}
    if current_user.user_type == "patient":
        query["patient_id"] = current_user.id
    else:
        query["doctor_id"] = current_user.id
    
    appointments = await db.appointments.find(query, {"_id": 0}).to_list(100)
    
    # Enrich with doctor/patient info
    for apt in appointments:
        if isinstance(apt.get('created_at'), str):
            apt['created_at'] = datetime.fromisoformat(apt['created_at'])
        
        if current_user.user_type == "patient":
            doctor = await db.doctor_profiles.find_one({"id": apt['doctor_id']}, {"_id": 0, "name": 1, "specialties": 1, "profile_image": 1})
            apt['doctor_info'] = doctor
        else:
            patient = await db.users.find_one({"id": apt['patient_id']}, {"_id": 0, "name": 1, "email": 1})
            apt['patient_info'] = patient
    
    return appointments

@api_router.patch("/appointments/{appointment_id}/status")
async def update_appointment_status(
    appointment_id: str,
    status: str,
    current_user: User = Depends(get_current_user)
):
    await db.appointments.update_one(
        {"id": appointment_id},
        {"$set": {"status": status}}
    )
    
    updated = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return updated

@api_router.post("/messages")
async def send_message(
    message_data: MessageCreate,
    current_user: User = Depends(get_current_user)
):
    message = Message(
        sender_id=current_user.id,
        recipient_id=message_data.recipient_id,
        content=message_data.content
    )
    
    message_dict = message.model_dump()
    message_dict['created_at'] = message_dict['created_at'].isoformat()
    await db.messages.insert_one(message_dict)
    
    return message

@api_router.get("/messages/{other_user_id}")
async def get_messages(
    other_user_id: str,
    current_user: User = Depends(get_current_user)
):
    messages = await db.messages.find({
        "$or": [
            {"sender_id": current_user.id, "recipient_id": other_user_id},
            {"sender_id": other_user_id, "recipient_id": current_user.id}
        ]
    }, {"_id": 0}).sort("created_at", 1).to_list(1000)
    
    for msg in messages:
        if isinstance(msg.get('created_at'), str):
            msg['created_at'] = datetime.fromisoformat(msg['created_at'])
    
    return messages

@api_router.get("/conversations")
async def get_conversations(current_user: User = Depends(get_current_user)):
    # Get all messages involving the current user
    messages = await db.messages.find({
        "$or": [
            {"sender_id": current_user.id},
            {"recipient_id": current_user.id}
        ]
    }, {"_id": 0}).to_list(1000)
    
    # Group by conversation partner
    conversations = {}
    for msg in messages:
        other_id = msg['recipient_id'] if msg['sender_id'] == current_user.id else msg['sender_id']
        if other_id not in conversations:
            conversations[other_id] = []
        if isinstance(msg.get('created_at'), str):
            msg['created_at'] = datetime.fromisoformat(msg['created_at'])
        conversations[other_id].append(msg)
    
    # Get user info for each conversation
    result = []
    for other_id, msgs in conversations.items():
        user_info = await db.users.find_one({"id": other_id}, {"_id": 0, "name": 1, "email": 1, "user_type": 1})
        if user_info and user_info.get('user_type') == 'doctor':
            doctor_info = await db.doctor_profiles.find_one({"user_id": other_id}, {"_id": 0, "profile_image": 1})
            if doctor_info:
                user_info['profile_image'] = doctor_info.get('profile_image')
        
        last_msg = sorted(msgs, key=lambda x: x['created_at'], reverse=True)[0]
        result.append({
            "user_id": other_id,
            "user_info": user_info,
            "last_message": last_msg,
            "unread_count": sum(1 for m in msgs if m['recipient_id'] == current_user.id and not m['read'])
        })
    
    return sorted(result, key=lambda x: x['last_message']['created_at'], reverse=True)

@api_router.post("/reviews")
async def create_review(
    review_data: ReviewCreate,
    current_user: User = Depends(get_current_user)
):
    if current_user.user_type != "patient":
        raise HTTPException(status_code=403, detail="Only patients can leave reviews")
    
    # Check if already reviewed
    existing = await db.reviews.find_one({
        "doctor_id": review_data.doctor_id,
        "patient_id": current_user.id
    })
    if existing:
        raise HTTPException(status_code=400, detail="You have already reviewed this doctor")
    
    review = Review(
        doctor_id=review_data.doctor_id,
        patient_id=current_user.id,
        patient_name=current_user.name,
        rating=review_data.rating,
        comment=review_data.comment
    )
    
    review_dict = review.model_dump()
    review_dict['created_at'] = review_dict['created_at'].isoformat()
    await db.reviews.insert_one(review_dict)
    
    # Update doctor rating
    reviews = await db.reviews.find({"doctor_id": review_data.doctor_id}, {"_id": 0}).to_list(1000)
    avg_rating = sum(r['rating'] for r in reviews) / len(reviews)
    await db.doctor_profiles.update_one(
        {"id": review_data.doctor_id},
        {"$set": {"rating": round(avg_rating, 1), "total_reviews": len(reviews)}}
    )
    
    return review

@api_router.get("/reviews/{doctor_id}")
async def get_reviews(doctor_id: str):
    reviews = await db.reviews.find({"doctor_id": doctor_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for review in reviews:
        if isinstance(review.get('created_at'), str):
            review['created_at'] = datetime.fromisoformat(review['created_at'])
    return reviews

# Socket.IO events for real-time chat
@sio.event
async def connect(sid, environ):
    logging.info(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    logging.info(f"Client disconnected: {sid}")

@sio.event
async def join_room(sid, data):
    room = data.get('room')
    await sio.enter_room(sid, room)
    logging.info(f"Client {sid} joined room {room}")

@sio.event
async def send_message(sid, data):
    room = data.get('room')
    await sio.emit('receive_message', data, room=room, skip_sid=sid)


# ============ PHASE 1 - New Features Routes ============

# Medical Records
@api_router.post("/medical-records")
async def create_medical_record(
    record_data: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    if current_user.user_type != "patient":
        raise HTTPException(status_code=403, detail="Only patients can create medical records")
    
    record = MedicalRecord(patient_id=current_user.id, **record_data)
    record_dict = record.model_dump()
    record_dict['created_at'] = record_dict['created_at'].isoformat()
    record_dict['updated_at'] = record_dict['updated_at'].isoformat()
    await db.medical_records.insert_one(record_dict)
    return record

@api_router.get("/medical-records")
async def get_medical_record(current_user: User = Depends(get_current_user)):
    record = await db.medical_records.find_one({"patient_id": current_user.id}, {"_id": 0})
    if not record:
        # Create empty record if doesn't exist
        record = MedicalRecord(patient_id=current_user.id)
        record_dict = record.model_dump()
        record_dict['created_at'] = record_dict['created_at'].isoformat()
        record_dict['updated_at'] = record_dict['updated_at'].isoformat()
        await db.medical_records.insert_one(record_dict)
        return record
    
    if isinstance(record.get('created_at'), str):
        record['created_at'] = datetime.fromisoformat(record['created_at'])
    if isinstance(record.get('updated_at'), str):
        record['updated_at'] = datetime.fromisoformat(record['updated_at'])
    return record

@api_router.put("/medical-records")
async def update_medical_record(
    update_data: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    await db.medical_records.update_one(
        {"patient_id": current_user.id},
        {"$set": update_data}
    )
    return {"message": "Medical record updated"}

# Loyalty Program
@api_router.get("/loyalty/points")
async def get_loyalty_points(current_user: User = Depends(get_current_user)):
    loyalty = await db.loyalty_points.find_one({"user_id": current_user.id}, {"_id": 0})
    if not loyalty:
        # Create new loyalty account
        loyalty = LoyaltyPoints(user_id=current_user.id, transactions=[])
        loyalty_dict = loyalty.model_dump()
        loyalty_dict['created_at'] = loyalty_dict['created_at'].isoformat()
        await db.loyalty_points.insert_one(loyalty_dict)
        return loyalty
    
    if isinstance(loyalty.get('created_at'), str):
        loyalty['created_at'] = datetime.fromisoformat(loyalty['created_at'])
    return loyalty

@api_router.post("/loyalty/add-points")
async def add_loyalty_points(
    data: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    points = data.get('points', 0)
    reason = data.get('reason', 'Purchase')
    
    loyalty = await db.loyalty_points.find_one({"user_id": current_user.id})
    if not loyalty:
        loyalty = LoyaltyPoints(user_id=current_user.id, total_points=points, transactions=[])
        loyalty_dict = loyalty.model_dump()
    else:
        loyalty['total_points'] = loyalty.get('total_points', 0) + points
        if not loyalty.get('transactions'):
            loyalty['transactions'] = []
        loyalty['transactions'].append({
            "points": points,
            "reason": reason,
            "date": datetime.now(timezone.utc).isoformat()
        })
        
        # Update level based on points
        total = loyalty['total_points']
        if total >= 5000:
            loyalty['level'] = "Platine"
        elif total >= 2000:
            loyalty['level'] = "Or"
        elif total >= 1000:
            loyalty['level'] = "Argent"
        else:
            loyalty['level'] = "Bronze"
        
        loyalty_dict = loyalty
    
    if isinstance(loyalty_dict.get('created_at'), datetime):
        loyalty_dict['created_at'] = loyalty_dict['created_at'].isoformat()
    
    await db.loyalty_points.update_one(
        {"user_id": current_user.id},
        {"$set": loyalty_dict},
        upsert=True
    )
    
    return {"total_points": loyalty_dict['total_points'], "level": loyalty_dict['level']}

@api_router.get("/loyalty/rewards")
async def get_loyalty_rewards():
    rewards = [
        {"id": "r1", "name": "5€ de réduction", "points": 500, "type": "discount"},
        {"id": "r2", "name": "Consultation gratuite", "points": 1000, "type": "free_consultation"},
        {"id": "r3", "name": "Pack bien-être gratuit", "points": 2000, "type": "free_pack"},
        {"id": "r4", "name": "20€ de réduction", "points": 3000, "type": "discount"},
        {"id": "r5", "name": "Accès VIP 1 mois", "points": 5000, "type": "vip"},
    ]
    return rewards

# Doctor Schedule
@api_router.get("/doctors/{doctor_id}/schedule")
async def get_doctor_schedule(doctor_id: str, date: Optional[str] = None):
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    schedule = await db.doctor_schedules.find_one(
        {"doctor_id": doctor_id, "date": date},
        {"_id": 0}
    )
    
    if not schedule:
        # Generate default schedule (9h-17h)
        slots = []
        for hour in range(9, 17):
            for minute in [0, 30]:
                time_str = f"{hour:02d}:{minute:02d}"
                slots.append({"time": time_str, "available": True})
        
        schedule = {
            "doctor_id": doctor_id,
            "date": date,
            "slots": slots
        }
    
    return schedule

@api_router.post("/doctors/schedule")
async def update_doctor_schedule(
    schedule_data: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    if current_user.user_type != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can update schedules")
    
    # Get doctor profile to get doctor_id
    doctor_profile = await db.doctor_profiles.find_one({"user_id": current_user.id}, {"_id": 0})
    if not doctor_profile:
        raise HTTPException(status_code=404, detail="Doctor profile not found")
    
    schedule_data['doctor_id'] = doctor_profile['id']
    
    await db.doctor_schedules.update_one(
        {"doctor_id": doctor_profile['id'], "date": schedule_data['date']},
        {"$set": schedule_data},
        upsert=True
    )
    
    return {"message": "Schedule updated"}

# Statistics
@api_router.get("/stats/doctor")
async def get_doctor_stats(current_user: User = Depends(get_current_user)):
    if current_user.user_type != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can view doctor stats")
    
    # Get doctor profile
    doctor_profile = await db.doctor_profiles.find_one({"user_id": current_user.id}, {"_id": 0})
    if not doctor_profile:
        raise HTTPException(status_code=404, detail="Doctor profile not found")
    
    doctor_id = doctor_profile['id']
    
    # Get appointments
    appointments = await db.appointments.find({"doctor_id": doctor_id}, {"_id": 0}).to_list(1000)
    
    total_appointments = len(appointments)
    completed = sum(1 for apt in appointments if apt.get('status') == 'completed')
    pending = sum(1 for apt in appointments if apt.get('status') == 'pending')
    cancelled = sum(1 for apt in appointments if apt.get('status') == 'cancelled')
    
    # Calculate revenue (assuming consultation_fee per completed appointment)
    consultation_fee = doctor_profile.get('consultation_fee', 0) or 0
    total_revenue = completed * consultation_fee
    
    # Monthly data
    monthly_data = {}
    for apt in appointments:
        if isinstance(apt.get('created_at'), str):
            month = apt['created_at'][:7]  # YYYY-MM
            if month not in monthly_data:
                monthly_data[month] = 0
            if apt.get('status') == 'completed':
                monthly_data[month] += 1
    
    return {
        "total_appointments": total_appointments,
        "completed": completed,
        "pending": pending,
        "cancelled": cancelled,
        "total_revenue": total_revenue,
        "average_rating": doctor_profile.get('rating', 0),
        "total_reviews": doctor_profile.get('total_reviews', 0),
        "monthly_appointments": monthly_data
    }

@api_router.get("/stats/patient")
async def get_patient_stats(current_user: User = Depends(get_current_user)):
    if current_user.user_type != "patient":
        raise HTTPException(status_code=403, detail="Only patients can view patient stats")
    
    appointments = await db.appointments.find({"patient_id": current_user.id}, {"_id": 0}).to_list(1000)
    
    total_appointments = len(appointments)
    completed = sum(1 for apt in appointments if apt.get('status') == 'completed')
    upcoming = sum(1 for apt in appointments if apt.get('status') in ['pending', 'confirmed'])
    
    # Get loyalty points
    loyalty = await db.loyalty_points.find_one({"user_id": current_user.id}, {"_id": 0})
    total_points = loyalty.get('total_points', 0) if loyalty else 0
    
    return {
        "total_appointments": total_appointments,
        "completed": completed,
        "upcoming": upcoming,
        "loyalty_points": total_points,
        "loyalty_level": loyalty.get('level', 'Bronze') if loyalty else 'Bronze'
    }

# Blog
@api_router.get("/blog")
async def get_blog_posts(category: Optional[str] = None, limit: int = 10):
    query = {"published": True}
    if category:
        query["category"] = category
    
    posts = await db.blog_posts.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    for post in posts:
        if isinstance(post.get('created_at'), str):
            post['created_at'] = datetime.fromisoformat(post['created_at'])
    return posts

@api_router.get("/blog/{post_id}")
async def get_blog_post(post_id: str):
    post = await db.blog_posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Increment views
    await db.blog_posts.update_one({"id": post_id}, {"$inc": {"views": 1}})
    post['views'] = post.get('views', 0) + 1
    
    if isinstance(post.get('created_at'), str):
        post['created_at'] = datetime.fromisoformat(post['created_at'])
    return post

@api_router.post("/blog")
async def create_blog_post(
    post_data: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    if current_user.user_type != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can create blog posts")
    
    post = BlogPost(
        author_id=current_user.id,
        author_name=current_user.name,
        **post_data
    )
    post_dict = post.model_dump()
    post_dict['created_at'] = post_dict['created_at'].isoformat()
    await db.blog_posts.insert_one(post_dict)
    return post

# Emergency Contacts
@api_router.get("/emergency/contacts")
async def get_emergency_contacts():
    """
    Numéros d'urgence de Côte d'Ivoire
    """
    contacts = [
        {"name": "SAMU", "number": "185", "type": "Urgences Médicales", "description": "Service d'Aide Médicale d'Urgence"},
        {"name": "Pompiers", "number": "180", "type": "Incendie & Secours", "description": "Groupement des Sapeurs-Pompiers"},
        {"name": "Police Secours", "number": "110", "type": "Police", "description": "Police Nationale d'urgence"},
        {"name": "Gendarmerie", "number": "111", "type": "Gendarmerie", "description": "Gendarmerie Nationale"},
        {"name": "GSPM", "number": "170", "type": "Secours", "description": "Groupement de Sapeurs-Pompiers Militaires"},
        {"name": "CHU Cocody", "number": "+225 22 44 90 00", "type": "Hôpital", "description": "Centre Hospitalier Universitaire de Cocody"},
        {"name": "CHU Treichville", "number": "+225 21 24 91 00", "type": "Hôpital", "description": "Centre Hospitalier Universitaire de Treichville"},
        {"name": "Centre Anti-Poison", "number": "+225 21 24 24 24", "type": "Intoxication", "description": "Centre National Anti-Poison"},
        {"name": "Croix-Rouge CI", "number": "+225 21 35 64 96", "type": "Humanitaire", "description": "Croix-Rouge Côte d'Ivoire"},
    ]
    return contacts

# Medical Assistant (symptom checker)
@api_router.post("/assistant/suggest")
async def suggest_specialty(data: Dict[str, Any]):
    symptoms = data.get('symptoms', '').lower()
    
    suggestions = []
    
    symptom_mapping = {
        "coeur|palpitation|douleur poitrine|essoufflement": {"specialty": "Cardiologie", "medical_type": "moderne"},
        "peau|bouton|acné|eczéma|psoriasis|démangeaison": {"specialty": "Dermatologie", "medical_type": "moderne"},
        "yeux|vision|vue|lunettes|cataracte": {"specialty": "Ophtalmologie", "medical_type": "moderne"},
        "femme|grossesse|règles|contraception|ménopause": {"specialty": "Gynécologie", "medical_type": "moderne"},
        "enfant|bébé|vaccination|croissance": {"specialty": "Pédiatrie", "medical_type": "moderne"},
        "dos|articulation|fracture|entorse|genou": {"specialty": "Orthopédie", "medical_type": "moderne"},
        "tête|migraine|cerveau|épilepsie|parkinson": {"specialty": "Neurologie", "medical_type": "moderne"},
        "stress|anxiété|dépression|insomnie|panique": {"specialty": "Psychiatrie", "medical_type": "moderne"},
        "estomac|ventre|diarrhée|constipation|digestion": {"specialty": "Gastro-entérologie", "medical_type": "moderne"},
        "poumon|toux|asthme|bronchite|respiration": {"specialty": "Pneumologie", "medical_type": "moderne"},
        "diabète|thyroïde|hormone|poids": {"specialty": "Endocrinologie", "medical_type": "moderne"},
        "plantes|naturel|traditionnel": {"specialty": "Phytothérapeute Africain", "medical_type": "traditionnel_africain"},
        "massage|détente|relaxation": {"specialty": "Masseur Bien-être", "medical_type": "bien_etre"},
        "nutrition|régime|alimentation": {"specialty": "Nutritionniste", "medical_type": "bien_etre"},
        "yoga|meditation|stress": {"specialty": "Sophrologue", "medical_type": "bien_etre"},
    }
    
    for pattern, spec in symptom_mapping.items():
        if any(keyword in symptoms for keyword in pattern.split('|')):
            suggestions.append(spec)
    
    if not suggestions:
        suggestions.append({"specialty": "Médecine Générale", "medical_type": "moderne"})
    
    return {"suggestions": suggestions, "message": "Voici les spécialités recommandées"}

# Review Reply
@api_router.post("/reviews/{review_id}/reply")
async def reply_to_review(
    review_id: str,
    data: Dict[str, str],
    current_user: User = Depends(get_current_user)
):
    if current_user.user_type != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can reply to reviews")
    
    reply = data.get('reply', '')
    await db.reviews.update_one(
        {"id": review_id},
        {"$set": {
            "doctor_reply": reply,
            "reply_date": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Reply added successfully"}


# ============ PHASE 2 - Mobile Money Payments ============

class PaymentInitiationRequest(BaseModel):
    provider: str  # orange_money, mtn_momo, moov
    amount: float
    phone_number: str
    email: str
    description: str
    customer_name: str
    service_type: str  # consultation, product, equipment


class PaymentDocument(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    reference_id: str
    external_id: str
    provider: str
    amount: float
    currency: str = "XOF"
    phone_number: str
    email: str
    description: str
    customer_name: str
    service_type: str
    status: str = "PENDING"
    webhook_received: bool = False
    provider_response: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    confirmed_at: Optional[datetime] = None


@api_router.post("/payments/initiate")
async def initiate_payment(request: PaymentInitiationRequest):
    """
    Initier un paiement Mobile Money (Orange Money, MTN MoMo, Moov).
    En mode sandbox, simule le flux de paiement.
    """
    from services.mobile_money import mobile_money_service, MobileMoneyPaymentRequest, PaymentProvider
    
    try:
        # Valider le provider
        valid_providers = ['orange_money', 'mtn_momo', 'moov']
        if request.provider not in valid_providers:
            raise HTTPException(status_code=400, detail=f"Fournisseur invalide. Utilisez: {', '.join(valid_providers)}")
        
        # Créer la requête de paiement
        payment_request = MobileMoneyPaymentRequest(
            provider=PaymentProvider(request.provider),
            amount=request.amount,
            currency="XOF",
            phone_number=request.phone_number,
            description=request.description,
            customer_name=request.customer_name,
            service_type=request.service_type
        )
        
        # Initier le paiement
        result = await mobile_money_service.initiate_payment(payment_request)
        
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "Erreur lors de l'initiation du paiement"))
        
        # Sauvegarder en base de données
        payment_doc = {
            "id": str(uuid.uuid4()),
            "reference_id": result.get("reference_id"),
            "external_id": result.get("external_id"),
            "provider": request.provider,
            "amount": request.amount,
            "currency": result.get("currency", "XOF"),
            "phone_number": request.phone_number,
            "email": request.email,
            "description": request.description,
            "customer_name": request.customer_name,
            "service_type": request.service_type,
            "status": "PENDING",
            "webhook_received": False,
            "provider_response": result,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.payments.insert_one(payment_doc)
        
        return {
            "success": True,
            "reference_id": result.get("reference_id"),
            "status": "PENDING",
            "message": result.get("message", "Paiement initié avec succès"),
            "sandbox_mode": result.get("sandbox_mode", False),
            "provider": request.provider,
            "amount": request.amount,
            "currency": result.get("currency", "XOF")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Erreur paiement: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/payments/status/{reference_id}")
async def get_payment_status(reference_id: str, provider: Optional[str] = None):
    """
    Récupérer le statut d'un paiement par sa référence.
    """
    from services.mobile_money import mobile_money_service, PaymentProvider
    
    try:
        # Chercher en base de données
        payment = await db.payments.find_one(
            {"reference_id": reference_id},
            {"_id": 0}
        )
        
        if not payment:
            raise HTTPException(status_code=404, detail="Paiement non trouvé")
        
        # Si le paiement est en attente, vérifier auprès du provider
        if payment.get("status") == "PENDING" and not payment.get("webhook_received"):
            provider_enum = PaymentProvider(payment.get("provider", provider))
            verification = await mobile_money_service.verify_payment(reference_id, provider_enum)
            
            if verification.get("success") and verification.get("status") != "PENDING":
                # Mettre à jour le statut
                new_status = verification.get("status")
                await db.payments.update_one(
                    {"reference_id": reference_id},
                    {
                        "$set": {
                            "status": new_status,
                            "updated_at": datetime.now(timezone.utc).isoformat(),
                            "confirmed_at": datetime.now(timezone.utc).isoformat() if new_status == "SUCCESSFUL" else None
                        }
                    }
                )
                payment["status"] = new_status
        
        return {
            "success": True,
            "reference_id": reference_id,
            "status": payment.get("status", "UNKNOWN"),
            "amount": payment.get("amount"),
            "currency": payment.get("currency", "XOF"),
            "provider": payment.get("provider"),
            "customer_name": payment.get("customer_name"),
            "service_type": payment.get("service_type"),
            "created_at": payment.get("created_at"),
            "confirmed_at": payment.get("confirmed_at")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Erreur vérification paiement: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/payments/webhook/{provider}")
async def payment_webhook(provider: str, request_data: Dict[str, Any]):
    """
    Endpoint webhook pour recevoir les notifications des providers.
    """
    from services.mobile_money import mobile_money_service, PaymentProvider
    
    try:
        valid_providers = ['orange', 'mtn', 'moov']
        provider_map = {
            'orange': PaymentProvider.ORANGE_MONEY,
            'mtn': PaymentProvider.MTN_MOMO,
            'moov': PaymentProvider.MOOV
        }
        
        if provider not in valid_providers:
            raise HTTPException(status_code=400, detail="Provider invalide")
        
        # Traiter le webhook
        result = mobile_money_service.process_webhook(provider_map[provider], request_data)
        
        if result.get("success"):
            reference_id = result.get("reference_id")
            status = result.get("status")
            
            # Mettre à jour en base de données
            await db.payments.update_one(
                {"reference_id": reference_id},
                {
                    "$set": {
                        "status": status,
                        "webhook_received": True,
                        "webhook_payload": request_data,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        "confirmed_at": datetime.now(timezone.utc).isoformat() if status == "SUCCESSFUL" else None
                    }
                }
            )
            
            logging.info(f"Webhook traité: {reference_id} - {status}")
            return {"status": "success"}
        else:
            logging.error(f"Erreur webhook: {result.get('error')}")
            return {"status": "error", "message": result.get("error")}
            
    except Exception as e:
        logging.error(f"Erreur traitement webhook: {str(e)}")
        return {"status": "error", "message": str(e)}


@api_router.post("/payments/simulate-confirmation/{reference_id}")
async def simulate_payment_confirmation(reference_id: str):
    """
    [SANDBOX UNIQUEMENT] Simuler la confirmation d'un paiement.
    Utilisé pour tester le flux complet sans vrai paiement.
    """
    try:
        payment = await db.payments.find_one({"reference_id": reference_id}, {"_id": 0})
        
        if not payment:
            raise HTTPException(status_code=404, detail="Paiement non trouvé")
        
        if payment.get("status") != "PENDING":
            raise HTTPException(status_code=400, detail=f"Le paiement est déjà {payment.get('status')}")
        
        # Simuler la confirmation
        await db.payments.update_one(
            {"reference_id": reference_id},
            {
                "$set": {
                    "status": "SUCCESSFUL",
                    "webhook_received": True,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "confirmed_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # Ajouter des points de fidélité si c'est un paiement pour une consultation
        if payment.get("service_type") == "consultation":
            # Trouver l'utilisateur par email
            user = await db.users.find_one({"email": payment.get("email")}, {"_id": 0})
            if user:
                # Ajouter 10 points par euro/franc dépensé
                points_to_add = int(payment.get("amount", 0) / 100)  # 1 point par 100 XOF
                await db.loyalty_points.update_one(
                    {"user_id": user.get("id")},
                    {
                        "$inc": {"total_points": points_to_add},
                        "$push": {
                            "transactions": {
                                "points": points_to_add,
                                "reason": f"Paiement consultation - {payment.get('description', '')}",
                                "date": datetime.now(timezone.utc).isoformat()
                            }
                        }
                    },
                    upsert=True
                )
        
        return {
            "success": True,
            "message": "[SANDBOX] Paiement confirmé avec succès",
            "reference_id": reference_id,
            "status": "SUCCESSFUL",
            "confirmed_at": datetime.now(timezone.utc).isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Erreur simulation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/payments/history")
async def get_payment_history(current_user: User = Depends(get_current_user)):
    """
    Récupérer l'historique des paiements de l'utilisateur connecté.
    """
    try:
        # Chercher par email de l'utilisateur
        payments = await db.payments.find(
            {"email": current_user.email},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
        
        return {
            "success": True,
            "payments": payments,
            "total": len(payments)
        }
        
    except Exception as e:
        logging.error(f"Erreur historique paiements: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/payments/providers")
async def get_available_providers():
    """
    Récupérer la liste des fournisseurs de paiement Mobile Money disponibles.
    """
    return {
        "providers": [
            {
                "id": "orange_money",
                "name": "Orange Money",
                "logo": "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=100",
                "description": "Paiement via Orange Money",
                "countries": ["Sénégal", "Mali", "Côte d'Ivoire", "Cameroun", "Madagascar"],
                "currency": "XOF",
                "available": True
            },
            {
                "id": "mtn_momo",
                "name": "MTN Mobile Money",
                "logo": "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=100",
                "description": "Paiement via MTN Mobile Money",
                "countries": ["Cameroun", "Ghana", "Uganda", "Rwanda", "Côte d'Ivoire"],
                "currency": "XOF",
                "available": True
            },
            {
                "id": "moov",
                "name": "Moov Money",
                "logo": "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=100",
                "description": "Paiement via Moov Money",
                "countries": ["Bénin", "Togo", "Côte d'Ivoire", "Niger"],
                "currency": "XOF",
                "available": True
            }
        ],
        "sandbox_mode": True,
        "note": "En mode sandbox, les paiements sont simulés. Pour activer les vrais paiements, configurez les clés API des fournisseurs."
    }


# ============ FONCTIONNALITÉS AVANCÉES ============

# === 1. Système de Réservation Amélioré ===

class TimeSlot(BaseModel):
    time: str  # Format: "09:00"
    available: bool = True
    booked_by: Optional[str] = None

class DoctorAvailability(BaseModel):
    doctor_id: str
    date: str  # Format: "2025-01-20"
    slots: List[TimeSlot]

class BookingRequest(BaseModel):
    doctor_id: str
    date: str  # Format: "2025-01-20"
    time: str  # Format: "09:00"
    reason: Optional[str] = None
    payment_method: Optional[str] = None  # orange_money, mtn_momo, moov


@api_router.get("/doctors/{doctor_id}/availability")
async def get_doctor_availability(doctor_id: str, date: Optional[str] = None):
    """
    Récupérer les créneaux disponibles d'un médecin pour une date donnée.
    Si aucune date n'est spécifiée, retourne les 7 prochains jours.
    """
    doctor = await db.doctor_profiles.find_one({"id": doctor_id}, {"_id": 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Médecin non trouvé")
    
    # Définir les heures de travail par défaut (9h-18h)
    default_hours = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", 
                     "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"]
    
    if date:
        dates_to_check = [date]
    else:
        # Générer les 7 prochains jours
        today = datetime.now(timezone.utc).date()
        dates_to_check = [(today + timedelta(days=i)).isoformat() for i in range(7)]
    
    availability = []
    for check_date in dates_to_check:
        # Récupérer les rendez-vous existants pour cette date
        existing_appointments = await db.appointments.find({
            "doctor_id": doctor_id,
            "appointment_date": check_date,
            "status": {"$nin": ["cancelled"]}
        }, {"_id": 0}).to_list(100)
        
        booked_times = [apt.get("appointment_time") for apt in existing_appointments]
        
        slots = []
        for hour in default_hours:
            is_available = hour not in booked_times
            slots.append({
                "time": hour,
                "available": is_available,
                "booked_by": None if is_available else "reserved"
            })
        
        # Calculer le jour de la semaine en français
        date_obj = datetime.fromisoformat(check_date)
        days_fr = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
        day_name = days_fr[date_obj.weekday()]
        
        availability.append({
            "date": check_date,
            "day_name": day_name,
            "slots": slots,
            "available_count": sum(1 for s in slots if s["available"])
        })
    
    return {
        "doctor_id": doctor_id,
        "doctor_name": doctor.get("name"),
        "consultation_fee": doctor.get("consultation_fee", 0),
        "availability": availability
    }


@api_router.post("/bookings")
async def create_booking(
    booking: BookingRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Créer une réservation avec un créneau spécifique.
    """
    if current_user.user_type != "patient":
        raise HTTPException(status_code=403, detail="Seuls les patients peuvent réserver")
    
    # Vérifier que le médecin existe
    doctor = await db.doctor_profiles.find_one({"id": booking.doctor_id}, {"_id": 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Médecin non trouvé")
    
    # Vérifier que le créneau est disponible
    existing = await db.appointments.find_one({
        "doctor_id": booking.doctor_id,
        "appointment_date": booking.date,
        "appointment_time": booking.time,
        "status": {"$nin": ["cancelled"]}
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Ce créneau n'est plus disponible")
    
    # Créer le rendez-vous
    appointment_id = str(uuid.uuid4())
    appointment = {
        "id": appointment_id,
        "patient_id": current_user.id,
        "patient_name": current_user.name,
        "patient_email": current_user.email,
        "doctor_id": booking.doctor_id,
        "doctor_name": doctor.get("name"),
        "appointment_date": booking.date,
        "appointment_time": booking.time,
        "reason": booking.reason,
        "status": "pending",
        "consultation_fee": doctor.get("consultation_fee", 0),
        "payment_method": booking.payment_method,
        "payment_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.appointments.insert_one(appointment)
    
    # Créer une notification pour le médecin
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": doctor.get("user_id"),
        "type": "new_booking",
        "title": "Nouvelle réservation",
        "message": f"{current_user.name} a réservé un rendez-vous le {booking.date} à {booking.time}",
        "data": {"appointment_id": appointment_id},
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {
        "success": True,
        "appointment_id": appointment_id,
        "message": "Réservation créée avec succès",
        "appointment": {
            "id": appointment_id,
            "doctor_name": doctor.get("name"),
            "date": booking.date,
            "time": booking.time,
            "fee": doctor.get("consultation_fee", 0),
            "status": "pending"
        }
    }


# === 2. Géolocalisation ===

class LocationUpdate(BaseModel):
    latitude: float
    longitude: float
    address: Optional[str] = None


@api_router.put("/doctors/location")
async def update_doctor_location(
    location: LocationUpdate,
    current_user: User = Depends(get_current_user)
):
    """
    Mettre à jour la position géographique d'un médecin.
    """
    if current_user.user_type != "doctor":
        raise HTTPException(status_code=403, detail="Réservé aux professionnels")
    
    await db.doctor_profiles.update_one(
        {"user_id": current_user.id},
        {
            "$set": {
                "coordinates": {
                    "latitude": location.latitude,
                    "longitude": location.longitude
                },
                "address": location.address
            }
        }
    )
    
    return {"success": True, "message": "Position mise à jour"}


@api_router.get("/doctors/nearby")
async def get_nearby_doctors(
    latitude: float,
    longitude: float,
    radius_km: float = 10.0,
    medical_type: Optional[str] = None,
    specialty: Optional[str] = None
):
    """
    Trouver les médecins proches d'une position donnée.
    Utilise la formule de Haversine pour calculer la distance.
    """
    import math
    
    def haversine_distance(lat1, lon1, lat2, lon2):
        R = 6371  # Rayon de la Terre en km
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)
        
        a = math.sin(delta_phi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
        return R * c
    
    # Récupérer tous les médecins avec coordonnées
    query = {"coordinates": {"$exists": True}}
    if medical_type:
        query["medical_type"] = medical_type
    if specialty:
        query["specialties"] = {"$in": [specialty]}
    
    all_doctors = await db.doctor_profiles.find(query, {"_id": 0}).to_list(500)
    
    # Filtrer par distance
    nearby_doctors = []
    for doctor in all_doctors:
        coords = doctor.get("coordinates", {})
        doc_lat = coords.get("latitude")
        doc_lon = coords.get("longitude")
        
        if doc_lat and doc_lon:
            distance = haversine_distance(latitude, longitude, doc_lat, doc_lon)
            if distance <= radius_km:
                doctor["distance_km"] = round(distance, 2)
                nearby_doctors.append(doctor)
    
    # Trier par distance
    nearby_doctors.sort(key=lambda x: x.get("distance_km", 999))
    
    return {
        "count": len(nearby_doctors),
        "radius_km": radius_km,
        "doctors": nearby_doctors
    }


# === 3. Notifications ===

class NotificationCreate(BaseModel):
    user_id: str
    type: str  # new_booking, reminder, message, promotion
    title: str
    message: str
    data: Optional[Dict[str, Any]] = None


@api_router.get("/notifications")
async def get_notifications(
    current_user: User = Depends(get_current_user),
    unread_only: bool = False
):
    """
    Récupérer les notifications de l'utilisateur.
    """
    query = {"user_id": current_user.id}
    if unread_only:
        query["read"] = False
    
    notifications = await db.notifications.find(
        query, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    unread_count = await db.notifications.count_documents({
        "user_id": current_user.id,
        "read": False
    })
    
    return {
        "notifications": notifications,
        "unread_count": unread_count
    }


@api_router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Marquer une notification comme lue.
    """
    await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user.id},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"success": True}


@api_router.patch("/notifications/read-all")
async def mark_all_notifications_read(current_user: User = Depends(get_current_user)):
    """
    Marquer toutes les notifications comme lues.
    """
    await db.notifications.update_many(
        {"user_id": current_user.id, "read": False},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"success": True}


@api_router.post("/notifications/send-reminder")
async def send_appointment_reminders():
    """
    Envoyer des rappels pour les rendez-vous du lendemain.
    À appeler via un cron job.
    """
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).date().isoformat()
    
    appointments = await db.appointments.find({
        "appointment_date": tomorrow,
        "status": {"$nin": ["cancelled", "completed"]}
    }, {"_id": 0}).to_list(500)
    
    reminders_sent = 0
    for apt in appointments:
        # Notification pour le patient
        patient_notification = {
            "id": str(uuid.uuid4()),
            "user_id": apt.get("patient_id"),
            "type": "reminder",
            "title": "Rappel de rendez-vous",
            "message": f"Vous avez rendez-vous demain à {apt.get('appointment_time')} avec {apt.get('doctor_name', 'votre médecin')}",
            "data": {"appointment_id": apt.get("id")},
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(patient_notification)
        
        # Notification pour le médecin
        doctor = await db.doctor_profiles.find_one({"id": apt.get("doctor_id")}, {"_id": 0})
        if doctor:
            doctor_notification = {
                "id": str(uuid.uuid4()),
                "user_id": doctor.get("user_id"),
                "type": "reminder",
                "title": "Rappel de rendez-vous",
                "message": f"Vous avez rendez-vous demain à {apt.get('appointment_time')} avec {apt.get('patient_name', 'un patient')}",
                "data": {"appointment_id": apt.get("id")},
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.notifications.insert_one(doctor_notification)
        
        reminders_sent += 1
    
    return {"success": True, "reminders_sent": reminders_sent}


# === Seed sample doctors with coordinates ===
@api_router.post("/seed/doctors-with-location")
async def seed_doctors_with_location():
    """
    Ajouter des coordonnées GPS aux médecins existants pour les tests de géolocalisation.
    Coordonnées basées sur des villes africaines.
    """
    # Coordonnées de quelques villes africaines
    cities = [
        {"name": "Douala", "lat": 4.0511, "lon": 9.7679},
        {"name": "Yaoundé", "lat": 3.8480, "lon": 11.5021},
        {"name": "Abidjan", "lat": 5.3600, "lon": -4.0083},
        {"name": "Dakar", "lat": 14.7167, "lon": -17.4677},
        {"name": "Lagos", "lat": 6.5244, "lon": 3.3792},
        {"name": "Accra", "lat": 5.6037, "lon": -0.1870},
        {"name": "Bamako", "lat": 12.6392, "lon": -8.0029},
        {"name": "Conakry", "lat": 9.6412, "lon": -13.5784},
    ]
    
    doctors = await db.doctor_profiles.find({}, {"_id": 0}).to_list(100)
    updated = 0
    
    for i, doctor in enumerate(doctors):
        city = cities[i % len(cities)]
        # Ajouter une légère variation pour disperser les médecins
        import random
        lat_variation = random.uniform(-0.05, 0.05)
        lon_variation = random.uniform(-0.05, 0.05)
        
        await db.doctor_profiles.update_one(
            {"id": doctor["id"]},
            {
                "$set": {
                    "coordinates": {
                        "latitude": city["lat"] + lat_variation,
                        "longitude": city["lon"] + lon_variation
                    },
                    "city": city["name"],
                    "address": f"Quartier Centre, {city['name']}"
                }
            }
        )
        updated += 1
    
    return {"success": True, "updated": updated}


# ============ TABLEAU DE BORD ADMIN ============

class AdminLogin(BaseModel):
    username: str
    password: str


def verify_admin_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Vérifier le token admin."""
    try:
        token = credentials.credentials
        payload = jwt.decode(token, ADMIN_SECRET, algorithms=[ALGORITHM])
        if payload.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Accès admin requis")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token admin expiré")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token admin invalide")


@api_router.post("/admin/login")
async def admin_login(data: AdminLogin):
    """
    Connexion administrateur.
    """
    if data.username != ADMIN_USERNAME or data.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Identifiants admin incorrects")
    
    # Créer un token admin
    token_data = {
        "role": "admin",
        "username": data.username,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24)
    }
    token = jwt.encode(token_data, ADMIN_SECRET, algorithm=ALGORITHM)
    
    return {
        "success": True,
        "token": token,
        "message": "Connexion admin réussie"
    }


@api_router.get("/admin/verify")
async def verify_admin(admin: dict = Depends(verify_admin_token)):
    """Vérifier si le token admin est valide."""
    return {"valid": True, "username": admin.get("username")}


@api_router.get("/admin/stats")
async def get_admin_stats(admin: dict = Depends(verify_admin_token)):
    """
    Statistiques globales pour le tableau de bord admin.
    """
    # Compter les utilisateurs
    total_users = await db.users.count_documents({})
    total_patients = await db.users.count_documents({"user_type": "patient"})
    total_doctors = await db.users.count_documents({"user_type": "doctor"})
    
    # Compter les rendez-vous
    total_appointments = await db.appointments.count_documents({})
    pending_appointments = await db.appointments.count_documents({"status": "pending"})
    
    # Compter les paiements
    total_payments = await db.payments.count_documents({})
    successful_payments = await db.payments.count_documents({"status": "SUCCESSFUL"})
    
    # Calculer le revenu total
    payments = await db.payments.find({"status": "SUCCESSFUL"}, {"_id": 0, "amount": 1}).to_list(1000)
    total_revenue = sum(p.get("amount", 0) for p in payments)
    
    # Inscriptions récentes (7 derniers jours)
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    recent_users = await db.users.count_documents({
        "created_at": {"$gte": week_ago}
    })
    
    return {
        "users": {
            "total": total_users,
            "patients": total_patients,
            "doctors": total_doctors,
            "recent_7_days": recent_users
        },
        "appointments": {
            "total": total_appointments,
            "pending": pending_appointments
        },
        "payments": {
            "total": total_payments,
            "successful": successful_payments,
            "revenue": total_revenue
        }
    }


@api_router.get("/admin/users")
async def get_all_users(
    admin: dict = Depends(verify_admin_token),
    user_type: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    """
    Récupérer tous les utilisateurs (patients et médecins).
    """
    query = {}
    if user_type and user_type != "all":
        query["user_type"] = user_type
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    
    total = await db.users.count_documents(query)
    users = await db.users.find(query, {"_id": 0, "password": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "total": total,
        "users": users,
        "page": skip // limit + 1,
        "pages": (total + limit - 1) // limit
    }


@api_router.get("/admin/users/{user_id}")
async def get_user_detail(user_id: str, admin: dict = Depends(verify_admin_token)):
    """
    Détails complets d'un utilisateur.
    """
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    # Si c'est un médecin, récupérer son profil
    doctor_profile = None
    if user.get("user_type") == "doctor":
        doctor_profile = await db.doctor_profiles.find_one({"user_id": user_id}, {"_id": 0})
    
    # Récupérer ses rendez-vous
    if user.get("user_type") == "patient":
        appointments = await db.appointments.find({"patient_id": user_id}, {"_id": 0}).to_list(50)
    else:
        appointments = await db.appointments.find({"doctor_id": user_id}, {"_id": 0}).to_list(50)
    
    # Récupérer ses paiements
    payments = await db.payments.find({"email": user.get("email")}, {"_id": 0}).to_list(50)
    
    return {
        "user": user,
        "doctor_profile": doctor_profile,
        "appointments": appointments,
        "payments": payments
    }


@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(verify_admin_token)):
    """
    Supprimer un utilisateur.
    """
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    # Supprimer de la collection users
    await db.users.delete_one({"id": user_id})
    
    # Si c'est un médecin, supprimer aussi son profil
    if user.get("user_type") == "doctor":
        await db.doctor_profiles.delete_one({"user_id": user_id})
    
    return {"success": True, "message": "Utilisateur supprimé"}


@api_router.patch("/admin/users/{user_id}/verify")
async def verify_user(user_id: str, admin: dict = Depends(verify_admin_token)):
    """
    Vérifier/Valider un utilisateur (badge vérifié).
    """
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"verified": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    # Si c'est un médecin, mettre à jour aussi son profil
    await db.doctor_profiles.update_one(
        {"user_id": user_id},
        {"$set": {"documents_verified": True}}
    )
    
    return {"success": True, "message": "Utilisateur vérifié"}


@api_router.get("/admin/appointments")
async def get_all_appointments(
    admin: dict = Depends(verify_admin_token),
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    """
    Récupérer tous les rendez-vous.
    """
    query = {}
    if status and status != "all":
        query["status"] = status
    
    total = await db.appointments.count_documents(query)
    appointments = await db.appointments.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "total": total,
        "appointments": appointments
    }


@api_router.get("/admin/payments")
async def get_all_payments(
    admin: dict = Depends(verify_admin_token),
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    """
    Récupérer tous les paiements.
    """
    query = {}
    if status and status != "all":
        query["status"] = status
    
    total = await db.payments.count_documents(query)
    payments = await db.payments.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Calculer le total
    total_amount = sum(p.get("amount", 0) for p in payments if p.get("status") == "SUCCESSFUL")
    
    return {
        "total": total,
        "payments": payments,
        "total_amount": total_amount
    }


@api_router.get("/admin/export/users")
async def export_users_csv(admin: dict = Depends(verify_admin_token)):
    """
    Exporter tous les utilisateurs en format JSON (pour CSV).
    """
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(10000)
    return {
        "data": users,
        "count": len(users),
        "export_date": datetime.now(timezone.utc).isoformat()
    }




# ============ PUBLICITÉS / ADVERTISEMENTS ============

class AdvertisementCreate(BaseModel):
    title: str
    description: str
    image: str
    link: Optional[str] = None
    advertiser_name: str
    advertiser_email: EmailStr
    advertiser_phone: str
    ad_type: str = "entreprise"  # entreprise, particulier, formation
    duration_days: int = 30

class Advertisement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    image: str
    link: Optional[str] = None
    advertiser: str
    advertiser_email: str
    advertiser_phone: str
    type: str = "entreprise"
    status: str = "pending"  # pending, active, expired, rejected
    views: int = 0
    clicks: int = 0
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


@api_router.get("/ads")
async def get_active_ads():
    """Récupère les publicités actives pour l'affichage sur le site"""
    ads = await db.advertisements.find(
        {"status": "active"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    
    # Si pas de publicités actives, retourner des exemples par défaut
    if not ads:
        ads = [
            {
                "id": "default_1",
                "title": "Clinique Santé Plus",
                "description": "Consultations médicales de qualité à prix abordables. Ouvert 7j/7.",
                "image": "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&q=80",
                "link": "#",
                "advertiser": "Clinique Santé Plus",
                "type": "entreprise"
            },
            {
                "id": "default_2",
                "title": "Pharmacie du Bien-Être",
                "description": "Livraison gratuite de médicaments à domicile. -20% sur les produits naturels.",
                "image": "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=800&q=80",
                "link": "#",
                "advertiser": "Pharmacie du Bien-Être",
                "type": "entreprise"
            },
            {
                "id": "default_3",
                "title": "Formation Massage Traditionnel",
                "description": "Apprenez les techniques ancestrales de massage africain. Certification reconnue.",
                "image": "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80",
                "link": "#",
                "advertiser": "Institut Wellness Africa",
                "type": "formation"
            },
            {
                "id": "default_4",
                "title": "Équipements Médicaux Pro",
                "description": "Matériel médical certifié aux meilleurs prix. Garantie 2 ans incluse.",
                "image": "https://images.unsplash.com/photo-1516549655169-df83a0774514?w=800&q=80",
                "link": "#",
                "advertiser": "MedEquip CI",
                "type": "entreprise"
            }
        ]
    
    return ads


@api_router.post("/ads")
async def create_advertisement(ad_data: AdvertisementCreate):
    """Soumettre une nouvelle publicité (nécessite validation admin)"""
    ad = Advertisement(
        title=ad_data.title,
        description=ad_data.description,
        image=ad_data.image,
        link=ad_data.link,
        advertiser=ad_data.advertiser_name,
        advertiser_email=ad_data.advertiser_email,
        advertiser_phone=ad_data.advertiser_phone,
        type=ad_data.ad_type,
        status="pending"
    )
    
    ad_dict = ad.model_dump()
    ad_dict['created_at'] = ad_dict['created_at'].isoformat()
    await db.advertisements.insert_one(ad_dict)
    
    return {
        "success": True,
        "message": "Votre publicité a été soumise et est en attente de validation.",
        "ad_id": ad.id
    }


@api_router.get("/ads/{ad_id}")
async def get_advertisement(ad_id: str):
    """Récupère une publicité spécifique"""
    ad = await db.advertisements.find_one({"id": ad_id}, {"_id": 0})
    if not ad:
        raise HTTPException(status_code=404, detail="Publicité non trouvée")
    return ad


@api_router.post("/ads/{ad_id}/click")
async def track_ad_click(ad_id: str):
    """Enregistre un clic sur une publicité"""
    await db.advertisements.update_one(
        {"id": ad_id},
        {"$inc": {"clicks": 1}}
    )
    return {"success": True}


@api_router.get("/admin/ads")
async def get_all_ads_admin():
    """[ADMIN] Liste toutes les publicités"""
    ads = await db.advertisements.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return ads


@api_router.patch("/admin/ads/{ad_id}/status")
async def update_ad_status(ad_id: str, data: Dict[str, str]):
    """[ADMIN] Approuver ou rejeter une publicité"""
    status = data.get("status")
    if status not in ["active", "rejected", "expired"]:
        raise HTTPException(status_code=400, detail="Statut invalide")
    
    update_data = {"status": status}
    if status == "active":
        update_data["start_date"] = datetime.now(timezone.utc).isoformat()
        # Par défaut, 30 jours de diffusion
        end_date = datetime.now(timezone.utc) + timedelta(days=30)
        update_data["end_date"] = end_date.isoformat()
    
    await db.advertisements.update_one(
        {"id": ad_id},
        {"$set": update_data}
    )
    
    return {"success": True, "message": f"Publicité mise à jour: {status}"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()