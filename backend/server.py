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
    medical_type: Optional[str] = None  # 'moderne' or 'traditionnel' for doctors
    specialties: Optional[List[str]] = None  # for doctors

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Specialty(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    medical_type: str  # 'moderne' or 'traditionnel'

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
    keyword: Optional[str] = None
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