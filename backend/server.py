from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, WebSocket, WebSocketDisconnect, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
import re
import secrets
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
import jwt
import socketio
import base64
import aiofiles
import asyncio
from services.storage import init_storage, put_object, get_object
from services.email_service import send_verification_email
from services.seed_loader import seed_initial_data
from services.master_model import migrate_all_providers

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
    user_type: str  # 'patient', 'doctor', or 'partner'

class UserRegister(UserBase):
    password: str
    whatsapp_number: Optional[str] = None
    medical_type: Optional[str] = None  # 'moderne' or 'traditionnel' for doctors
    specialties: Optional[List[str]] = None  # for doctors
    custom_medical_type: Optional[str] = None  # for "autre" category
    company_name: Optional[str] = None  # for partners
    activity_type: Optional[str] = None  # for partners
    address: Optional[str] = None  # for partners

class UserLogin(BaseModel):
    email: EmailStr
    password: str
    whatsapp_number: Optional[str] = None

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    whatsapp_number: Optional[str] = None
    medical_type: Optional[str] = None
    specialties: Optional[List[str]] = None
    address: Optional[str] = None
    partner_role: Optional[str] = None  # owner | manager | doctor | secretary | assistant | coach | therapist
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
        whatsapp_number=user_data.whatsapp_number,
        medical_type=user_data.medical_type,
        specialties=user_data.specialties,
        address=user_data.address
    )
    user_dict = user.model_dump()
    user_dict['password'] = hash_password(user_data.password)
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    # Email verification (magic link)
    verification_token = secrets.token_urlsafe(32)
    user_dict['email_verified'] = False
    user_dict['verification_token'] = verification_token
    user_dict['verification_token_expires_at'] = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    
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
        # Ajouter whatsapp_number
        if user_data.whatsapp_number:
            profile_dict['whatsapp_number'] = user_data.whatsapp_number
        # Ajouter custom_medical_type si catégorie "autre"
        if user_data.medical_type == "autre" and user_data.custom_medical_type:
            profile_dict['custom_medical_type'] = user_data.custom_medical_type
        await db.doctor_profiles.insert_one(profile_dict)
    
    # If partner, create partner profile
    if user_data.user_type == "partner":
        partner_profile = {
            "id": str(uuid.uuid4()),
            "user_id": user.id,
            "name": user.name,
            "email": user.email,
            "company_name": user_data.company_name or "",
            "activity_type": user_data.activity_type or "",
            "address": user_data.address or "",
            "whatsapp_number": user_data.whatsapp_number or "",
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.partner_profiles.insert_one(partner_profile)
    
    token = create_access_token({"sub": user.id})
    
    # Create admin notification for new registration
    notification = {
        "id": str(uuid.uuid4()),
        "type": "new_registration",
        "user_type": user_data.user_type,
        "user_name": user_data.name,
        "user_email": user_data.email,
        "whatsapp_number": user_data.whatsapp_number or "",
        "message": f"Nouveau {'médecin' if user_data.user_type == 'doctor' else 'partenaire' if user_data.user_type == 'partner' else 'patient'} inscrit : {user_data.name}",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.admin_notifications.insert_one(notification)
    
    # Send verification email (non-blocking; failure does NOT block registration)
    try:
        asyncio.create_task(send_verification_email(user.email, user.name, verification_token))
    except Exception as e:
        logging.error(f"Could not enqueue verification email: {e}")
    
    user_response = user.model_dump()
    user_response['email_verified'] = False
    return {"token": token, "user": user_response}

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(credentials.password, user['password']):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Mettre à jour le numéro WhatsApp si fourni
    if credentials.whatsapp_number:
        await db.users.update_one(
            {"email": credentials.email},
            {"$set": {"whatsapp_number": credentials.whatsapp_number}}
        )
        user['whatsapp_number'] = credentials.whatsapp_number
        # Mettre à jour aussi dans doctor_profiles si c'est un médecin
        if user.get('user_type') == 'doctor':
            await db.doctor_profiles.update_one(
                {"user_id": user['id']},
                {"$set": {"whatsapp_number": credentials.whatsapp_number}}
            )
    
    del user['password']
    # Strip out verification fields before returning
    user.pop('verification_token', None)
    user.pop('verification_token_expires_at', None)
    user['email_verified'] = bool(user.get('email_verified', False))
    if isinstance(user.get('created_at'), str):
        user['created_at'] = datetime.fromisoformat(user['created_at'])
    
    token = create_access_token({"sub": user['id']})
    return {"token": token, "user": user}

@api_router.get("/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    # Fetch email_verified from DB and include in response
    db_user = await db.users.find_one(
        {"id": current_user.id}, {"_id": 0, "email_verified": 1}
    )
    response = current_user.model_dump()
    response["email_verified"] = bool(db_user and db_user.get("email_verified"))
    return response

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
    # Dictionnaire d'alias FR (praticien → racine de spécialité)
    # Permet à "cardiologue", "dermato"… de trouver "Cardiologie", "Dermatologie"…
    keyword_aliases = {
        "cardiologue": "cardiolog", "cardio": "cardiolog",
        "dermatologue": "dermatolog", "dermato": "dermatolog",
        "gynecologue": "gynéc", "gynécologue": "gynéc", "gyneco": "gynéc", "gynéco": "gynéc",
        "ophtalmologue": "ophtalmolog", "ophtalmologiste": "ophtalmolog", "ophtalmo": "ophtalmolog", "oculiste": "ophtalmolog",
        "pediatre": "pédiatr", "pédiatre": "pédiatr",
        "chirurgien": "chirurgie",
        "psychiatre": "psychiatr", "psy": "psych",
        "psychologue": "psycholog",
        "neurologue": "neurolog", "neuro": "neurolog",
        "orthopediste": "orthopéd", "orthopédiste": "orthopéd", "ortho": "orthopéd",
        "pneumologue": "pneumolog",
        "gastroenterologue": "gastro", "gastroentérologue": "gastro", "gastro": "gastro",
        "endocrinologue": "endocrinolog", "endocrino": "endocrinolog",
        "pharmacien": "pharma", "pharmacienne": "pharma", "pharmacie": "pharma",
        "generaliste": "génér", "généraliste": "génér", "medecin generaliste": "génér", "médecin généraliste": "génér",
        "kinesitherapeute": "kiné", "kinésithérapeute": "kiné", "kine": "kiné", "kiné": "kiné",
        "osteopathe": "ostéopath", "ostéopathe": "ostéopath",
        "nutritionniste": "nutrition",
        "dieteticien": "diététic", "diététicien": "diététic",
        "naturopathe": "naturopath",
        "sophrologue": "sophrolog",
        "tradipraticien": "tradipratic", "tradi": "tradipratic",
        "guerisseur": "guérisseur", "guérisseur": "guérisseur",
        "phytotherapeute": "phyto", "phytothérapeute": "phyto", "phyto": "phyto",
        "herboriste": "herboriste",
        "rebouteux": "rebouteux",
        "infirmier": "infirmier", "infirmiere": "infirmi", "infirmière": "infirmi",
        "acupuncteur": "acupunct", "acupuncteure": "acupunct",
        "estheticien": "esthétic", "esthéticien": "esthétic", "esthéticienne": "esthétic", "esthetique": "esthétic", "esthétique": "esthétic",
        "coiffeur": "coiffeur", "coiffeuse": "coiff",
        "sage femme": "sage-femme", "sage-femme": "sage-femme",
        "orl": "ORL",
        "dentiste": "dent", "dentaire": "dent",
        "coach sportif": "coach sport", "coach": "coach",
        "masseur": "masseur", "masseuse": "masseu",
        "spa": "spa",
        "maquilleur": "maquill", "maquilleuse": "maquill",
        "prothesiste": "prothésist", "prothésiste": "prothésist",
    }

    def normalize_keyword(kw: str) -> str:
        kw_lower = kw.lower().strip()
        # Lookup alias; fallback to raw keyword
        return keyword_aliases.get(kw_lower, kw)

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
        search_term = normalize_keyword(keyword)
        query["$or"] = [
            {"name": {"$regex": search_term, "$options": "i"}},
            {"bio": {"$regex": search_term, "$options": "i"}},
            {"specialties": {"$regex": search_term, "$options": "i"}}
        ]
    
    # Recherche personnalisée pour "Autre" catégorie
    # Cherche dans le medical_type personnalisé, les spécialités et le bio
    if custom_search:
        search_term = normalize_keyword(custom_search)
        custom_or_conditions = [
            {"specialties": {"$regex": search_term, "$options": "i"}},
            {"bio": {"$regex": search_term, "$options": "i"}},
            {"name": {"$regex": search_term, "$options": "i"}},
            {"custom_medical_type": {"$regex": search_term, "$options": "i"}}
        ]
        if "$or" in query:
            query["$and"] = [{"$or": query.pop("$or")}, {"$or": custom_or_conditions}]
        else:
            query["$or"] = custom_or_conditions
    
    doctors = await db.doctor_profiles.find(query, {"_id": 0}).to_list(200)
    # Deduplicate by name (case-insensitive) — defensive: duplicates may exist from seed reruns
    seen_names = set()
    unique = []
    for doc in doctors:
        key = (doc.get("name") or "").strip().lower()
        if not key or key in seen_names:
            continue
        seen_names.add(key)
        if isinstance(doc.get('created_at'), str):
            doc['created_at'] = datetime.fromisoformat(doc['created_at'])
        unique.append(doc)
    return unique[:100]

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
        # Les RDV sont stockés avec doctor_id = doctor_profiles.id, pas users.id.
        # On résout d'abord le profil du docteur connecté.
        doctor_profile = await db.doctor_profiles.find_one(
            {"user_id": current_user.id}, {"_id": 0, "id": 1}
        )
        if not doctor_profile:
            return []
        query["doctor_id"] = doctor_profile["id"]
    
    appointments = await db.appointments.find(query, {"_id": 0}).sort("appointment_date", -1).to_list(100)
    
    # Enrich with doctor/patient info
    for apt in appointments:
        if isinstance(apt.get('created_at'), str):
            apt['created_at'] = datetime.fromisoformat(apt['created_at'])
        
        if current_user.user_type == "patient":
            doctor = await db.doctor_profiles.find_one({"id": apt['doctor_id']}, {"_id": 0, "name": 1, "specialties": 1, "profile_image": 1})
            apt['doctor_info'] = doctor
        else:
            patient = await db.users.find_one({"id": apt['patient_id']}, {"_id": 0, "name": 1, "email": 1, "whatsapp_number": 1})
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

@sio.on('send_message')
async def handle_send_message(sid, data):
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
# ============ SYMPTOM ORIENTATION (shared helper) ============

URGENT_KEYWORDS = [
    "urgent", "urgence",
    "saigne", "sang", "hémorragie", "hemorragie",
    "inconscient", "évanoui", "evanoui", "ne respire", "respire plus",
    "convulsion", "crise cardiaque", "infarctus", "avc",
    "douleur poitrine", "essoufflement sévère", "essoufflement severe",
    "brûlure", "brulure grave", "empoisonn", "intoxication",
    "accident", "trauma",
]
MODERATE_KEYWORDS = [
    "douleur intense", "fièvre élevée", "fievre elevee",
    "vomissement", "déshydrat", "deshydrat",
]
SYMPTOM_MAPPING = {
    "coeur|cœur|palpitation|douleur poitrine|essoufflement|infarctus|hypertension|tension|crise cardiaque":
        [("Cardiologie", "moderne", 3)],
    "peau|bouton|acné|eczéma|psoriasis|démangeaison|urticaire|allergie cutanée":
        [("Dermatologie", "moderne", 3)],
    "yeux|vision|vue|lunettes|cataracte|conjonctivite|glaucome":
        [("Ophtalmologie", "moderne", 3)],
    "femme|grossesse|règles|règle|contraception|ménopause|gynéco|sein|seins":
        [("Gynécologie", "moderne", 3)],
    "enfant|bébé|bebe|nourrisson|vaccination|croissance|pédiatre|pediatre":
        [("Pédiatrie", "moderne", 3)],
    "dos|articulation|fracture|entorse|genou|cheville|cervical|lombaire|épaule":
        [("Orthopédie", "moderne", 2), ("Kinésithérapie", "bien_etre", 2)],
    "tête|migraine|maux de tête|cerveau|épilepsie|parkinson|alzheimer|vertige|mal de tête":
        [("Neurologie", "moderne", 3)],
    "stress|anxiété|anxiete|dépression|depression|insomnie|panique|burn-out|burnout|trouble du sommeil":
        [("Psychiatrie", "moderne", 2), ("Psychologie", "moderne", 2)],
    "estomac|ventre|mal au ventre|diarrhée|diarrhee|constipation|digestion|nausée|nausee|gastro|ulcère":
        [("Gastro-entérologie", "moderne", 3)],
    "poumon|toux|asthme|bronchite|respiration|essoufflement|pneumonie":
        [("Pneumologie", "moderne", 3)],
    "diabète|diabete|thyroïde|thyroide|hormone|poids|obésité|obesite":
        [("Endocrinologie", "moderne", 2), ("Nutrition", "bien_etre", 2)],
    "dent|dents|dentaire|carie|gencive|orthodonti|implant dentaire|mal de dent|mal aux dents":
        [("Dentisterie", "moderne", 3)],
    "oreille|nez|gorge|sinusite|otite|angine|amygdale":
        [("ORL", "moderne", 3)],
    "urine|rein|prostate|vessie|incontinence":
        [("Urologie", "moderne", 3)],
    "fièvre|fievre|grippe|rhume|fatigue|maladie générale|symptôme général":
        [("Médecine Générale", "moderne", 2)],
    "plante|plantes|naturel|traditionnel|tradi|herbe":
        [("Phytothérapie", "traditionnel_africain", 2), ("Naturopathie", "bien_etre", 2)],
    "massage|détente|relaxation|tension musculaire":
        [("Massage thérapeutique", "bien_etre", 2)],
    "nutrition|régime|alimentation|perte de poids|prise de poids":
        [("Nutrition", "bien_etre", 3)],
    "yoga|méditation|meditation|pleine conscience|mindfulness":
        [("Yoga", "bien_etre", 2)],
    "kiné|kine|kinésithérapie|kinesitherapie|rééducation|reeducation|paralysie":
        [("Kinésithérapie", "bien_etre", 3)],
    "coach|sport|musculation|condition physique|remise en forme":
        [("Coaching sportif", "bien_etre", 3)],
    "écouter|ecouter|solitude|détresse|detresse|harcèlement|harcelement|violence":
        [("Centre d'écoute", "social_humanitaire", 3), ("Psychologie", "moderne", 2)],
    "humanitaire|aide alimentaire|secours|catastrophe":
        [("Humanitaire / ONG", "social_humanitaire", 3)],
    # Urgence + accidents → orientation directe vers SAMU/Médecine Générale en urgence
    "urgence|urgent|accident|saigne|sang|hémorragie|hemorragie|inconscient|évanoui|evanoui|crise cardiaque|infarctus|avc|brûlure grave|brulure grave|intoxication|empoisonn":
        [("Médecine Générale", "moderne", 5), ("Cardiologie", "moderne", 2)],
}

SYMPTOM_TRIGGER_WORDS = [
    "mal", "douleur", "souffre", "j'ai", "jai", "ai mal",
    "symptome", "symptôme", "symptomes", "symptômes",
    "fièvre", "fievre", "fatigue", "toux", "nausée", "nausee",
    "vomi", "diarrhée", "diarrhee", "saigne", "brûle", "brule",
    "stress", "anxiété", "anxiete", "dépression", "depression",
    "insomnie", "essoufflement", "vertige", "démangeai",
]


def detect_symptom_orientation(symptoms_raw: str) -> dict:
    """Détecte si le texte ressemble à un symptôme et renvoie l'orientation complète.
    Renvoie dict avec: is_symptom, urgency_level, urgency_label, suggestions[]."""
    symptoms = (symptoms_raw or "").lower().strip()
    if not symptoms:
        return {"is_symptom": False, "urgency_level": "low", "urgency_label": "", "suggestions": []}

    # Heuristic: is it a symptom?
    looks_like_symptom = any(trigger in symptoms for trigger in SYMPTOM_TRIGGER_WORDS)

    # Urgency
    if any(k in symptoms for k in URGENT_KEYWORDS):
        urgency_level = "urgent"
        urgency_label = "⚠️ Potentiellement urgent — consultation rapide ou urgences recommandées"
    elif any(k in symptoms for k in MODERATE_KEYWORDS):
        urgency_level = "moderate"
        urgency_label = "Consultation rapide recommandée"
    else:
        urgency_level = "low"
        urgency_label = "Consultation à planifier"

    # Specialty mapping
    seen = {}
    for pattern, specs in SYMPTOM_MAPPING.items():
        for keyword in pattern.split('|'):
            if keyword and keyword in symptoms:
                for spec_name, med_type, weight in specs:
                    key = spec_name.lower()
                    if key not in seen or seen[key]["weight"] < weight:
                        seen[key] = {"specialty": spec_name, "medical_type": med_type, "weight": weight}
                break
    suggestions = list(seen.values())
    suggestions.sort(key=lambda s: -s["weight"])
    suggestions = [{"specialty": s["specialty"], "medical_type": s["medical_type"]} for s in suggestions[:5]]

    # Final symptom decision: trigger words OR direct symptom match OR urgent keyword hit
    is_symptom = bool(looks_like_symptom or suggestions or urgency_level == "urgent")

    return {
        "is_symptom": is_symptom,
        "urgency_level": urgency_level,
        "urgency_label": urgency_label,
        "suggestions": suggestions,
    }


async def find_providers_for_specialties(spec_names: List[str], limit: int = 12) -> List[dict]:
    """Search providers (doctors + relevant partners) matching any of the given specialty names.

    Uses the V2 nested `master_profile.ai_matching.ai_specialty_tags` field first
    (most accurate), then falls back to the flat `specialties`/`bio` fields for
    backward compatibility with records that haven't been migrated yet.
    """
    if not spec_names:
        return []
    # Build a regex OR query against both the V2 nested tags and the flat fields
    escaped_names = [re.escape(name) for name in spec_names]
    or_clauses = []
    for name in escaped_names:
        or_clauses.extend([
            {"master_profile.ai_matching.ai_specialty_tags": {"$regex": name, "$options": "i"}},
            {"master_profile.classification.specialites": {"$regex": name, "$options": "i"}},
            {"master_profile.classification.categorie": {"$regex": name, "$options": "i"}},
            {"specialties": {"$regex": name, "$options": "i"}},
            {"bio": {"$regex": name, "$options": "i"}},
        ])
    query = {"$or": or_clauses}
    projection = {
        "_id": 0, "id": 1, "name": 1, "specialties": 1, "medical_type": 1,
        "city": 1, "neighborhood": 1, "country": 1, "whatsapp_number": 1,
        "profile_image": 1, "rating": 1, "total_reviews": 1, "claim_status": 1,
        "coordinates": 1, "imported": 1, "master_profile": 1,
    }

    doctors = await db.doctor_profiles.find(query, projection).limit(limit).to_list(limit)

    # Also include partners that are medical (pharmacies, labs, hospitals) when the
    # mapped specialty matches their tags. This is essential for symptoms like
    # "ordonnance" → pharmacie, or "bilan sanguin" → laboratoire.
    partner_projection = {
        "_id": 0, "id": 1, "name": 1, "company_name": 1, "activity_type": 1,
        "city": 1, "neighborhood": 1, "country": 1, "whatsapp_number": 1,
        "rating": 1, "total_reviews": 1, "claim_status": 1, "coordinates": 1,
        "imported": 1, "master_profile": 1,
    }
    partners_raw = await db.partner_profiles.find(query, partner_projection).limit(limit).to_list(limit)
    # Normalize partner shape so the frontend can render them like doctors
    partners = []
    for p in partners_raw:
        p["specialties"] = (
            (p.get("master_profile") or {}).get("classification", {}).get("specialites")
            or [p.get("activity_type") or "Autre"]
        )
        p.setdefault("name", p.get("company_name") or "")
        p["provider_kind"] = "partner"
        partners.append(p)

    for d in doctors:
        d["provider_kind"] = "doctor"

    providers = doctors + partners

    def _rank(p):
        mp = p.get("master_profile") or {}
        trust = mp.get("trust") or {}
        # Higher triage_priority and verified records first
        triage = -(trust.get("triage_priority") or 0)
        verified_bonus = 0 if (p.get("claim_status") == "verified" or trust.get("is_verified")) else 1
        rating = -(p.get("rating") or 0)
        return (verified_bonus, triage, rating)
    providers.sort(key=_rank)
    return providers[:limit]


@api_router.post("/assistant/suggest")
async def suggest_specialty(data: Dict[str, Any]):
    symptoms_raw = (data.get('symptoms') or '').strip()
    orient = detect_symptom_orientation(symptoms_raw)
    suggestions = orient["suggestions"]

    # Safety net
    if orient["urgency_level"] == "urgent" and not suggestions:
        suggestions = [
            {"specialty": "Médecine Générale", "medical_type": "moderne"},
            {"specialty": "Cardiologie", "medical_type": "moderne"},
        ]
    if not suggestions:
        suggestions = [{"specialty": "Médecine Générale", "medical_type": "moderne"}]

    providers = await find_providers_for_specialties([s["specialty"] for s in suggestions], limit=12)

    return {
        "suggestions": suggestions,
        "urgency_level": orient["urgency_level"],
        "urgency_label": orient["urgency_label"],
        "providers": providers[:6],
        "legal_notice": (
            "Cet outil est un assistant d'orientation et ne remplace pas une "
            "consultation médicale. En cas de symptômes graves, contactez les "
            "urgences (185 en Côte d'Ivoire) ou consultez un professionnel de santé."
        ),
        "emergency_number": "185",
        "message": "Voici les spécialités recommandées",
    }


@api_router.get("/search/smart")
async def smart_search(q: str = "", limit: int = 30):
    """Recherche intelligente unifiée :
    - Si la requête ressemble à un symptôme → mode 'orientation' (urgence + spécialités + médecins)
    - Sinon → mode 'directory' (recherche classique par nom/spécialité/bio)
    - Si peu de résultats en mode directory → tente aussi le mode orientation en complément.
    """
    q = (q or "").strip()
    if len(q) < 2:
        return {"mode": "empty", "results": [], "orientation": None}

    orient = detect_symptom_orientation(q)

    # Always run a classical keyword search using existing alias dictionary
    # (re-use the same logic as /doctors/search?keyword=…)
    from urllib.parse import quote
    # Direct DB lookup mirroring the keyword logic
    keyword_aliases = {
        "cardiologue": "cardiolog", "cardio": "cardiolog",
        "dermatologue": "dermatolog", "dermato": "dermatolog",
        "gynecologue": "gynéc", "gynécologue": "gynéc", "gyneco": "gynéc", "gynéco": "gynéc",
        "ophtalmologue": "ophtalmolog", "ophtalmologiste": "ophtalmolog", "ophtalmo": "ophtalmolog", "oculiste": "ophtalmolog",
        "pediatre": "pédiatr", "pédiatre": "pédiatr",
        "chirurgien": "chirurgie",
        "psychiatre": "psychiatr", "psy": "psych",
        "psychologue": "psycholog",
        "neurologue": "neurolog", "neuro": "neurolog",
        "orthopediste": "orthopéd", "orthopédiste": "orthopéd", "ortho": "orthopéd",
        "pneumologue": "pneumolog",
        "gastroenterologue": "gastro", "gastroentérologue": "gastro", "gastro": "gastro",
        "endocrinologue": "endocrinolog", "endocrino": "endocrinolog",
        "pharmacien": "pharma", "pharmacienne": "pharma", "pharmacie": "pharma",
        "generaliste": "génér", "généraliste": "génér",
        "kinesitherapeute": "kiné", "kinésithérapeute": "kiné", "kine": "kiné", "kiné": "kiné",
        "naturopathe": "naturopath",
        "tradipraticien": "tradipratic", "tradi": "tradipratic",
        "dentiste": "dent", "dentaire": "dent",
        "orl": "ORL",
        "sage femme": "sage-femme", "sage-femme": "sage-femme",
    }
    search_term = keyword_aliases.get(q.lower(), q)
    # Query against both flat fields AND the new V2 master_profile nested fields
    directory_query = {
        "$or": [
            {"name": {"$regex": search_term, "$options": "i"}},
            {"bio": {"$regex": search_term, "$options": "i"}},
            {"specialties": {"$regex": search_term, "$options": "i"}},
            {"city": {"$regex": search_term, "$options": "i"}},
            {"neighborhood": {"$regex": search_term, "$options": "i"}},
            {"master_profile.identity.name": {"$regex": search_term, "$options": "i"}},
            {"master_profile.classification.specialites": {"$regex": search_term, "$options": "i"}},
            {"master_profile.classification.categorie": {"$regex": search_term, "$options": "i"}},
            {"master_profile.ai_matching.symptomes_pris_en_charge": {"$regex": search_term, "$options": "i"}},
            {"master_profile.ai_matching.ai_specialty_tags": {"$regex": search_term, "$options": "i"}},
            {"master_profile.contact.ville": {"$regex": search_term, "$options": "i"}},
            {"master_profile.contact.commune": {"$regex": search_term, "$options": "i"}},
        ]
    }
    projection = {
        "_id": 0, "id": 1, "name": 1, "specialties": 1, "medical_type": 1,
        "city": 1, "neighborhood": 1, "whatsapp_number": 1, "rating": 1,
        "total_reviews": 1, "claim_status": 1, "coordinates": 1,
        "master_profile": 1,
    }
    direct_doctors = await db.doctor_profiles.find(directory_query, projection).limit(limit).to_list(limit)
    for d in direct_doctors:
        d["provider_kind"] = "doctor"

    # Include partners in directory mode too (pharmacies, labs, spas)
    partner_proj = {
        "_id": 0, "id": 1, "name": 1, "company_name": 1, "activity_type": 1,
        "city": 1, "neighborhood": 1, "whatsapp_number": 1, "rating": 1,
        "total_reviews": 1, "claim_status": 1, "coordinates": 1,
        "master_profile": 1,
    }
    direct_partners_raw = await db.partner_profiles.find(directory_query, partner_proj).limit(limit).to_list(limit)
    direct_partners = []
    for p in direct_partners_raw:
        p["specialties"] = (
            (p.get("master_profile") or {}).get("classification", {}).get("specialites")
            or [p.get("activity_type") or "Autre"]
        )
        p.setdefault("name", p.get("company_name") or "")
        p["provider_kind"] = "partner"
        direct_partners.append(p)

    direct = direct_doctors + direct_partners

    # Deduplicate by name (case-insensitive) - the seed loader created duplicates over multiple runs
    seen_names = set()
    direct_dedup = []
    for p in direct:
        n = (p.get("name") or "").strip().lower()
        if n and n in seen_names:
            continue
        seen_names.add(n)
        direct_dedup.append(p)
    direct = direct_dedup

    # Rank by triage_priority/verified status from master_profile
    def _rank(p):
        mp = p.get("master_profile") or {}
        trust = mp.get("trust") or {}
        triage = -(trust.get("triage_priority") or 0)
        verified_bonus = 0 if (p.get("claim_status") == "verified" or trust.get("is_verified")) else 1
        rating = -(p.get("rating") or 0)
        return (verified_bonus, triage, rating)
    direct.sort(key=_rank)
    direct = direct[:limit]

    # Decide mode
    if orient["is_symptom"]:
        # Symptom detected → orientation mode (with provider suggestions)
        orient_suggestions = orient["suggestions"] or [
            {"specialty": "Médecine Générale", "medical_type": "moderne"}
        ]
        orient_providers = await find_providers_for_specialties(
            [s["specialty"] for s in orient_suggestions], limit=12
        )
        # ALSO query providers that have this exact symptom in their
        # master_profile.ai_matching.symptomes_pris_en_charge array.
        # This catches symptoms not present in our static SYMPTOM_MAPPING.
        direct_symptom_query = {
            "$or": [
                {"master_profile.ai_matching.symptomes_pris_en_charge": {"$regex": re.escape(q), "$options": "i"}},
                {"master_profile.ai_matching.ai_specialty_tags": {"$regex": re.escape(q), "$options": "i"}},
            ]
        }
        symptom_doctors = await db.doctor_profiles.find(
            direct_symptom_query, projection
        ).limit(12).to_list(12)
        for d in symptom_doctors:
            d["provider_kind"] = "doctor"
        symptom_partners_raw = await db.partner_profiles.find(
            direct_symptom_query, partner_proj
        ).limit(8).to_list(8)
        for p in symptom_partners_raw:
            p["specialties"] = (
                (p.get("master_profile") or {}).get("classification", {}).get("specialites")
                or [p.get("activity_type") or "Autre"]
            )
            p.setdefault("name", p.get("company_name") or "")
            p["provider_kind"] = "partner"

        # Merge with orient_providers, deduplicate by id
        seen_ids = set()
        merged = []
        for src in (symptom_doctors + symptom_partners_raw + orient_providers):
            sid = src.get("id")
            if not sid or sid in seen_ids:
                continue
            seen_ids.add(sid)
            merged.append(src)
        merged.sort(key=_rank)
        return {
            "mode": "orientation",
            "query": q,
            "results": merged[:limit],
            "orientation": {
                "urgency_level": orient["urgency_level"],
                "urgency_label": orient["urgency_label"],
                "suggestions": orient_suggestions,
                "legal_notice": (
                    "Cet outil est un assistant d'orientation et ne remplace pas une "
                    "consultation médicale. En cas de symptômes graves, contactez les "
                    "urgences (185 en Côte d'Ivoire) ou consultez un professionnel de santé."
                ),
                "emergency_number": "185",
            }
        }

    # Directory mode
    if len(direct) < 3:
        # Few results → also propose orientation if we can guess one
        orient_suggestions = orient["suggestions"]
        if orient_suggestions:
            orient_providers = await find_providers_for_specialties(
                [s["specialty"] for s in orient_suggestions], limit=8
            )
            return {
                "mode": "hybrid",
                "query": q,
                "results": direct,
                "orientation": {
                    "urgency_level": orient["urgency_level"],
                    "urgency_label": orient["urgency_label"],
                    "suggestions": orient_suggestions,
                    "extra_providers": orient_providers[:8],
                    "legal_notice": (
                        "Cet outil est un assistant d'orientation et ne remplace pas une "
                        "consultation médicale. En cas de symptômes graves, contactez les "
                        "urgences (185 en Côte d'Ivoire) ou consultez un professionnel de santé."
                    ),
                    "emergency_number": "185",
                }
            }

    return {
        "mode": "directory",
        "query": q,
        "results": direct,
        "orientation": None,
    }

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


@api_router.get("/doctors-nearby")
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
async def mark_user_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Marquer une notification utilisateur comme lue.
    """
    await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user.id},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"success": True}


@api_router.patch("/notifications/read-all")
async def mark_all_user_notifications_read(current_user: User = Depends(get_current_user)):
    """
    Marquer toutes les notifications utilisateur comme lues.
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


async def verify_admin_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Vérifier le token admin (compatible avec l'ancien format ET le nouveau).
    Bloque aussi les admins désactivés (is_active=False)."""
    try:
        token = credentials.credentials
        payload = jwt.decode(token, ADMIN_SECRET, algorithms=[ALGORITHM])
        if payload.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Accès admin requis")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token admin expiré")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token admin invalide")

    # Hard-block disabled admins (only checked for DB-stored admins, not legacy env-only)
    admin_id = payload.get("admin_id")
    if admin_id and admin_id != payload.get("username"):
        admin_doc = await db.admins.find_one(
            {"id": admin_id}, {"_id": 0, "is_active": 1, "admin_role": 1}
        )
        if admin_doc and admin_doc.get("is_active") is False:
            raise HTTPException(status_code=403, detail="Compte admin désactivé")
    return payload


async def verify_owner_token(admin: dict = Depends(verify_admin_token)):
    """Décorateur OWNER-only : seul l'admin_role 'super_admin_owner' passe."""
    if admin.get("admin_role") != "super_admin_owner":
        raise HTTPException(
            status_code=403,
            detail="Accès réservé au super-admin OWNER de la plateforme"
        )
    return admin


async def log_admin_action(admin: dict, action: str, target_type: str = "", target_id: str = "", details: dict = None):
    """Append a row to admin_audit_log. Non-blocking — never raise."""
    try:
        await db.admin_audit_log.insert_one({
            "id": str(uuid.uuid4()),
            "actor_admin_id": admin.get("admin_id") or admin.get("username") or "unknown",
            "actor_username": admin.get("username") or "unknown",
            "actor_display_name": admin.get("display_name") or "",
            "actor_role": admin.get("admin_role") or "",
            "action": action,
            "target_type": target_type or "",
            "target_id": target_id or "",
            "details": details or {},
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        logging.error(f"audit_log insert failed: {e}")


async def ensure_owner_admin_exists():
    """Garantit qu'au moins 1 OWNER existe dans la collection `admins` (DB)."""
    owner_display_name = "N'guessan Armandine"
    existing = await db.admins.find_one(
        {"admin_role": "super_admin_owner"}, {"_id": 0, "id": 1, "display_name": 1, "is_active": 1}
    )
    if existing:
        # Update legacy display_name if it was the default placeholder
        updates = {}
        if existing.get("display_name") in (None, "OWNER (root)", ADMIN_USERNAME):
            updates["display_name"] = owner_display_name
        if existing.get("is_active") is None:
            updates["is_active"] = True
        if updates:
            await db.admins.update_one({"id": existing["id"]}, {"$set": updates})
        return
    # Seed initial OWNER from env vars (login = MADJIB / 48851132kl)
    owner_doc = {
        "id": str(uuid.uuid4()),
        "username": ADMIN_USERNAME,
        "password": hash_password(ADMIN_PASSWORD),
        "admin_role": "super_admin_owner",
        "display_name": owner_display_name,
        "is_seed_owner": True,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.admins.insert_one(owner_doc)
    logging.info(f"Seeded initial OWNER admin: {owner_display_name} (username={ADMIN_USERNAME})")


@api_router.post("/admin/login")
async def admin_login(data: AdminLogin):
    """
    Connexion administrateur.
    - Cherche d'abord l'utilisateur dans la collection `admins` (nouveau système).
    - Sinon, fallback sur ADMIN_USERNAME / ADMIN_PASSWORD de l'env (rétro-compat).
    """
    admin_username = (data.username or "").strip()
    admin_doc = await db.admins.find_one({"username": admin_username}, {"_id": 0})

    if admin_doc:
        if admin_doc.get("is_active") is False:
            raise HTTPException(status_code=403, detail="Compte admin désactivé. Contactez l'OWNER de la plateforme.")
        if not verify_password(data.password, admin_doc["password"]):
            raise HTTPException(status_code=401, detail="Identifiants admin incorrects")
        role = admin_doc.get("admin_role", "super_admin_owner")
        display = admin_doc.get("display_name") or admin_username
        admin_id = admin_doc.get("id")
        # Track last login
        await db.admins.update_one(
            {"id": admin_id},
            {"$set": {"last_login_at": datetime.now(timezone.utc).isoformat()}}
        )
    elif admin_username == ADMIN_USERNAME and data.password == ADMIN_PASSWORD:
        # Legacy fallback: create the OWNER on the fly so future logins are DB-based
        await ensure_owner_admin_exists()
        role = "super_admin_owner"
        display = "OWNER (root)"
        admin_id = admin_username
    else:
        raise HTTPException(status_code=401, detail="Identifiants admin incorrects")

    token_data = {
        "role": "admin",
        "admin_role": role,
        "admin_id": admin_id,
        "username": admin_username,
        "display_name": display,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24)
    }
    token = jwt.encode(token_data, ADMIN_SECRET, algorithm=ALGORITHM)

    return {
        "success": True,
        "token": token,
        "admin_role": role,
        "display_name": display,
        "message": "Connexion admin réussie"
    }


@api_router.get("/admin/verify")
async def verify_admin(admin: dict = Depends(verify_admin_token)):
    """Vérifier si le token admin est valide."""
    return {
        "valid": True,
        "username": admin.get("username"),
        "admin_role": admin.get("admin_role", "super_admin_owner"),
        "display_name": admin.get("display_name", admin.get("username")),
    }


# ============ OWNER-ONLY : GESTION DES ADMINS (modérateurs) ============

ALLOWED_ADMIN_ROLES = {"moderator", "support", "manager"}


@api_router.get("/admin/owner/admins")
async def list_admins(owner: dict = Depends(verify_owner_token)):
    """List tous les admins (OWNER + modérateurs). Réservé OWNER."""
    admins = await db.admins.find(
        {}, {"_id": 0, "password": 0}
    ).sort("created_at", 1).to_list(200)
    return {"admins": admins, "total": len(admins)}


@api_router.post("/admin/owner/admins")
async def create_admin(payload: dict, owner: dict = Depends(verify_owner_token)):
    """Créer un nouveau modérateur. Réservé OWNER.

    payload = { username, password, display_name, admin_role (moderator|support|manager) }
    """
    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""
    display_name = (payload.get("display_name") or "").strip() or username
    admin_role = (payload.get("admin_role") or "moderator").strip().lower()

    if not username or len(username) < 3:
        raise HTTPException(status_code=400, detail="Le nom d'utilisateur doit faire au moins 3 caractères.")
    if not password or len(password) < 8:
        raise HTTPException(status_code=400, detail="Le mot de passe doit faire au moins 8 caractères.")
    if admin_role not in ALLOWED_ADMIN_ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"Rôle invalide. Autorisés : {sorted(ALLOWED_ADMIN_ROLES)}."
        )
    if await db.admins.find_one({"username": username}, {"_id": 0, "id": 1}):
        raise HTTPException(status_code=400, detail="Ce nom d'utilisateur est déjà pris.")

    new_admin = {
        "id": str(uuid.uuid4()),
        "username": username,
        "password": hash_password(password),
        "admin_role": admin_role,
        "display_name": display_name,
        "is_active": True,
        "is_seed_owner": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by_admin_id": owner.get("admin_id"),
        "created_by_username": owner.get("username"),
    }
    await db.admins.insert_one(new_admin)
    await log_admin_action(
        owner, "admin_created", "admin", new_admin["id"],
        {"username": username, "admin_role": admin_role, "display_name": display_name}
    )
    safe_admin = {k: v for k, v in new_admin.items() if k not in ("password", "_id")}
    return {"success": True, "admin": safe_admin}


@api_router.patch("/admin/owner/admins/{admin_id}")
async def update_admin(admin_id: str, payload: dict, owner: dict = Depends(verify_owner_token)):
    """Modifier un modérateur : display_name, admin_role, is_active, password.
    Le seed OWNER ne peut être ni désactivé ni voir son rôle changé.
    """
    target = await db.admins.find_one({"id": admin_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Admin introuvable")

    updates = {}
    audit_details = {"target_username": target.get("username")}

    if "display_name" in payload:
        updates["display_name"] = (payload.get("display_name") or "").strip() or target.get("display_name")
        audit_details["new_display_name"] = updates["display_name"]

    if "admin_role" in payload:
        new_role = (payload.get("admin_role") or "").strip().lower()
        if new_role not in ALLOWED_ADMIN_ROLES and new_role != "super_admin_owner":
            raise HTTPException(status_code=400, detail=f"Rôle invalide. Autorisés : {sorted(ALLOWED_ADMIN_ROLES)}.")
        if target.get("is_seed_owner") and new_role != "super_admin_owner":
            raise HTTPException(status_code=400, detail="Impossible de changer le rôle du seed OWNER.")
        if new_role == "super_admin_owner" and not target.get("is_seed_owner"):
            raise HTTPException(status_code=400, detail="Impossible de promouvoir un admin au rôle super_admin_owner.")
        updates["admin_role"] = new_role
        audit_details["new_role"] = new_role

    if "is_active" in payload:
        new_active = bool(payload.get("is_active"))
        if target.get("is_seed_owner") and not new_active:
            raise HTTPException(status_code=400, detail="Impossible de désactiver le seed OWNER.")
        updates["is_active"] = new_active
        audit_details["is_active"] = new_active

    if "password" in payload and payload["password"]:
        new_pwd = payload["password"]
        if len(new_pwd) < 8:
            raise HTTPException(status_code=400, detail="Le mot de passe doit faire au moins 8 caractères.")
        updates["password"] = hash_password(new_pwd)
        audit_details["password_changed"] = True

    if not updates:
        raise HTTPException(status_code=400, detail="Aucun champ à mettre à jour.")

    await db.admins.update_one({"id": admin_id}, {"$set": updates})
    await log_admin_action(owner, "admin_updated", "admin", admin_id, audit_details)

    refreshed = await db.admins.find_one({"id": admin_id}, {"_id": 0, "password": 0})
    return {"success": True, "admin": refreshed}


@api_router.delete("/admin/owner/admins/{admin_id}")
async def delete_admin(admin_id: str, owner: dict = Depends(verify_owner_token)):
    """Supprimer un modérateur. Le seed OWNER est protégé."""
    target = await db.admins.find_one({"id": admin_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Admin introuvable")
    if target.get("is_seed_owner"):
        raise HTTPException(status_code=400, detail="Impossible de supprimer le seed OWNER.")
    if target.get("id") == owner.get("admin_id"):
        raise HTTPException(status_code=400, detail="Impossible de se supprimer soi-même.")

    await db.admins.delete_one({"id": admin_id})
    await log_admin_action(
        owner, "admin_deleted", "admin", admin_id,
        {"target_username": target.get("username"), "target_role": target.get("admin_role")}
    )
    return {"success": True}


@api_router.get("/admin/owner/audit-log")
async def get_audit_log(
    owner: dict = Depends(verify_owner_token),
    limit: int = 100,
    actor_admin_id: Optional[str] = None,
    action: Optional[str] = None,
):
    """Liste les 100 dernières actions admin (filtrable). Réservé OWNER."""
    query = {}
    if actor_admin_id:
        query["actor_admin_id"] = actor_admin_id
    if action:
        query["action"] = action
    limit = max(1, min(500, limit))
    rows = await db.admin_audit_log.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    total = await db.admin_audit_log.count_documents(query)
    return {"entries": rows, "total": total, "limit": limit}


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


@api_router.get("/admin/notifications")
async def get_admin_notifications(admin: dict = Depends(verify_admin_token)):
    """Get all admin notifications, newest first"""
    notifications = await db.admin_notifications.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    unread_count = await db.admin_notifications.count_documents({"read": False})
    return {"notifications": notifications, "unread_count": unread_count}


@api_router.post("/admin/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, admin: dict = Depends(verify_admin_token)):
    """Mark a notification as read"""
    await db.admin_notifications.update_one(
        {"id": notification_id},
        {"$set": {"read": True}}
    )
    return {"success": True}


@api_router.post("/admin/notifications/read-all")
async def mark_all_notifications_read(admin: dict = Depends(verify_admin_token)):
    """Mark all notifications as read"""
    await db.admin_notifications.update_many(
        {"read": False},
        {"$set": {"read": True}}
    )
    return {"success": True}


# ============ MAINTENANCE MODE ============

@api_router.get("/maintenance/status")
async def get_maintenance_status():
    """Public endpoint: returns whether the app is in maintenance mode."""
    setting = await db.settings.find_one({"key": "maintenance"}, {"_id": 0})
    return {"enabled": bool(setting and setting.get("enabled", False))}


@api_router.put("/admin/maintenance")
async def toggle_maintenance(payload: dict, admin: dict = Depends(verify_admin_token)):
    """Admin toggle for maintenance mode."""
    enabled = bool(payload.get("enabled", False))
    await db.settings.update_one(
        {"key": "maintenance"},
        {"$set": {"key": "maintenance", "enabled": enabled, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    await log_admin_action(admin, "maintenance_toggled", "system", "maintenance", {"enabled": enabled})
    return {"success": True, "enabled": enabled}


@api_router.post("/admin/run-seed")
async def trigger_seed(admin: dict = Depends(verify_admin_token)):
    """Manual trigger for the initial data seed. Idempotent."""
    from services.seed_loader import seed_initial_data, SEED_FILE
    file_exists = SEED_FILE.exists()
    file_size = SEED_FILE.stat().st_size if file_exists else 0
    stats = await seed_initial_data(db)
    return {
        "success": True,
        "seed_file_path": str(SEED_FILE),
        "seed_file_exists": file_exists,
        "seed_file_size_bytes": file_size,
        "stats": stats,
        "users_total_in_db": await db.users.count_documents({}),
        "doctor_profiles_in_db": await db.doctor_profiles.count_documents({}),
        "partner_profiles_in_db": await db.partner_profiles.count_documents({}),
    }


# ============ PROVIDERS SEARCH (for CLAIM flow) ============

@api_router.get("/providers/search")
async def search_providers(q: str, limit: int = 20):
    """Unified search across doctor_profiles + partner_profiles by name.
    Used by the claim flow on the registration page."""
    q = q.strip()
    if len(q) < 2:
        return []
    escaped = re.escape(q)
    pattern = {"$regex": escaped, "$options": "i"}

    doctors = await db.doctor_profiles.find(
        {"name": pattern},
        {"_id": 0, "id": 1, "name": 1, "specialties": 1, "city": 1,
         "neighborhood": 1, "claim_status": 1, "claimed_by_user_id": 1,
         "medical_type": 1, "imported": 1}
    ).limit(limit).to_list(limit)

    partners = await db.partner_profiles.find(
        {"$or": [{"name": pattern}, {"company_name": pattern}]},
        {"_id": 0, "id": 1, "name": 1, "company_name": 1, "activity_type": 1,
         "city": 1, "neighborhood": 1, "claim_status": 1, "claimed_by_user_id": 1,
         "imported": 1}
    ).limit(limit).to_list(limit)

    results = []
    for d in doctors:
        results.append({
            "id": d.get("id"),
            "kind": "doctor",
            "name": d.get("name"),
            "specialties": d.get("specialties", []),
            "activity_type": (d.get("medical_type") or "").replace("_", " ").title(),
            "city": d.get("city"),
            "neighborhood": d.get("neighborhood"),
            "claim_status": d.get("claim_status") or ("seeded" if d.get("imported") else None),
            "imported": bool(d.get("imported")),
        })
    for p in partners:
        results.append({
            "id": p.get("id"),
            "kind": "partner",
            "name": p.get("name") or p.get("company_name"),
            "activity_type": p.get("activity_type"),
            "city": p.get("city"),
            "neighborhood": p.get("neighborhood"),
            "claim_status": p.get("claim_status") or ("seeded" if p.get("imported") else None),
            "imported": bool(p.get("imported")),
        })
    return results


# ============ CLAIMS (revendication d'une fiche existante) ============

CLAIM_TYPES = {"owner", "manager", "doctor", "secretary", "admin_rep"}


def compute_trust_score(claim: dict, user: dict, provider: dict) -> int:
    """Compute a 0-100 trust score for a claim based on heuristics.

    Factors:
      +30 has at least one proof document
      +15 multiple documents (>= 2)
      +20 email looks professional (not free/auto-generated domain)
      +15 name similarity ≥ 50% between user.name and provider.name
      +10 phone matches provider phone or whatsapp (last 8 digits)
      +10 justification non-empty (≥ 30 chars)
    """
    score = 0

    docs = claim.get("proof_documents") or []
    if len(docs) >= 1:
        score += 30
    if len(docs) >= 2:
        score += 15

    email = (user.get("email") or "").lower()
    if email and "@keneyakafisa.app" not in email:
        free_domains = ("gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
                        "icloud.com", "yahoo.fr", "live.com")
        if not any(email.endswith("@" + d) for d in free_domains):
            score += 20

    user_name = (user.get("name") or "").lower()
    provider_name = (provider.get("name") or provider.get("company_name") or "").lower()
    if user_name and provider_name:
        user_tokens = set(re.findall(r"[a-zà-ÿ]{3,}", user_name))
        prov_tokens = set(re.findall(r"[a-zà-ÿ]{3,}", provider_name))
        if user_tokens and prov_tokens:
            overlap = len(user_tokens & prov_tokens) / max(len(user_tokens), 1)
            if overlap >= 0.5:
                score += 15

    def _digits(s):
        return re.sub(r"\D", "", s or "")[-8:]
    user_phone = _digits(claim.get("phone") or user.get("whatsapp_number"))
    prov_phones = [_digits(p) for p in [
        provider.get("telephone"),
        provider.get("whatsapp_number"),
        (provider.get("master_profile") or {}).get("contact", {}).get("telephone"),
    ] if p]
    if user_phone and any(user_phone == p for p in prov_phones if p):
        score += 10

    if len((claim.get("justification") or "").strip()) >= 30:
        score += 10

    return max(0, min(100, score))


@api_router.post("/claims/upload")
async def upload_claim_document(file: UploadFile = File(...)):
    """Upload a single proof document (PDF or image) for an in-progress claim."""
    allowed = {
        "application/pdf",
        "image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif",
    }
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Format non supporté. Utilisez PDF, JPG, PNG ou WebP.")
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Le fichier ne doit pas dépasser 10 Mo.")
    ext = (file.filename.rsplit('.', 1)[-1] if '.' in (file.filename or '') else 'bin').lower()
    if ext not in ("pdf", "jpg", "jpeg", "png", "webp", "heic", "heif"):
        ext = "bin"
    file_path = f"keneyakafisa/claims/{datetime.now(timezone.utc).strftime('%Y%m')}/{uuid.uuid4()}.{ext}"
    try:
        put_object(file_path, content, file.content_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur upload: {e}")
    return {
        "success": True,
        "url": f"/api/media/{file_path}",
        "name": (file.filename or "document")[:80],
        "content_type": file.content_type,
        "size": len(content),
    }


@api_router.post("/claims")
async def create_claim(payload: dict):
    """Submit a claim request for an existing provider fiche (no auth required).

    payload supports the new V2 fields:
      - claim_type : owner | manager | doctor | secretary | admin_rep (replaces function_role)
      - proof_documents : list of { url, name, content_type } previously uploaded via /api/claims/upload
    """
    provider_id = payload.get("provider_id")
    provider_kind = payload.get("provider_kind")
    full_name = (payload.get("full_name") or "").strip()
    phone = (payload.get("phone") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    # Backward compat : function_role kept as alias of claim_type
    claim_type = (payload.get("claim_type") or payload.get("function_role") or "owner").strip().lower()
    justification = payload.get("justification") or payload.get("message") or ""
    password = payload.get("password")
    proof_documents = payload.get("proof_documents") or []

    if claim_type not in CLAIM_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"claim_type invalide. Autorisés : {sorted(CLAIM_TYPES)}"
        )
    if not isinstance(proof_documents, list) or len(proof_documents) > 5:
        raise HTTPException(status_code=400, detail="proof_documents doit être une liste de 5 fichiers max.")

    if not provider_id or provider_kind not in ("doctor", "partner") or not full_name or not phone or not password:
        raise HTTPException(status_code=400, detail="Champs requis manquants.")

    collection = db.doctor_profiles if provider_kind == "doctor" else db.partner_profiles
    provider = await collection.find_one({"id": provider_id}, {"_id": 0})
    if not provider:
        raise HTTPException(status_code=404, detail="Fiche introuvable.")
    if (provider.get("claim_status") or "") == "verified":
        raise HTTPException(status_code=400, detail="Cette fiche est déjà revendiquée.")

    # Block duplicate pending claim for the same provider+phone/email
    dup = await db.claims.find_one({
        "provider_id": provider_id,
        "status": "pending",
        "$or": [{"phone": phone}, {"email": email} if email else {"_": "_"}]
    }, {"_id": 0, "id": 1})
    if dup:
        raise HTTPException(status_code=400, detail="Une demande en attente existe déjà pour cette fiche avec ces coordonnées.")

    if not email:
        slug = re.sub(r"[^a-z0-9]+", "-", full_name.lower()).strip("-") or "claim"
        email = f"claim-{slug}-{secrets.token_hex(3)}@keneyakafisa.app"

    if await db.users.find_one({"email": email}, {"_id": 0, "id": 1}):
        raise HTTPException(status_code=400, detail="Un compte avec cet email existe déjà. Connectez-vous.")

    user_id = str(uuid.uuid4())
    new_user_doc = {
        "id": user_id,
        "email": email,
        "name": full_name,
        "user_type": "partner",
        "partner_role": claim_type,
        "password": hash_password(password),
        "whatsapp_number": phone,
        "verified": False,
        "email_verified": False,
        "claim_pending": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(new_user_doc)

    claim_id = str(uuid.uuid4())
    claim_doc = {
        "id": claim_id,
        "provider_id": provider_id,
        "provider_kind": provider_kind,
        "provider_name": provider.get("name") or provider.get("company_name"),
        "user_id": user_id,
        "full_name": full_name,
        "phone": phone,
        "email": email,
        "claim_type": claim_type,
        "function_role": claim_type,  # legacy alias
        "justification": justification,
        "proof_documents": proof_documents,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    # Compute trust score
    claim_doc["trust_score"] = compute_trust_score(claim_doc, new_user_doc, provider)
    await db.claims.insert_one(claim_doc)

    await collection.update_one(
        {"id": provider_id},
        {"$set": {
            "claim_status": "claim_pending",
            "master_profile.trust.claim_status": "claim_pending",
        }}
    )

    await db.admin_notifications.insert_one({
        "id": str(uuid.uuid4()),
        "type": "claim_request",
        "user_type": "partner",
        "user_id": user_id,
        "user_name": full_name,
        "user_email": email,
        "user_phone": phone,
        "provider_name": claim_doc["provider_name"],
        "message": f"{full_name} demande à revendiquer la fiche : {claim_doc['provider_name']} (trust {claim_doc['trust_score']})",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {
        "success": True,
        "claim_id": claim_id,
        "status": "pending",
        "trust_score": claim_doc["trust_score"],
    }


@api_router.get("/admin/claims")
async def list_claims(status: Optional[str] = "pending", admin: dict = Depends(verify_admin_token)):
    """List all claims with optional status filter."""
    query = {}
    if status and status != "all":
        query["status"] = status
    claims = await db.claims.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return claims


@api_router.get("/admin/claims/stats")
async def claims_stats(admin: dict = Depends(verify_admin_token)):
    """KPI stats for the admin claims dashboard."""
    total_doctors = await db.doctor_profiles.count_documents({})
    total_partners = await db.partner_profiles.count_documents({})
    claimed_doctors = await db.doctor_profiles.count_documents({"claim_status": "verified"})
    claimed_partners = await db.partner_profiles.count_documents({"claim_status": "verified"})
    pending_claims = await db.claims.count_documents({"status": "pending"})
    approved_claims = await db.claims.count_documents({"status": "approved"})
    rejected_claims = await db.claims.count_documents({"status": "rejected"})
    return {
        "providers_total": total_doctors + total_partners,
        "providers_doctors": total_doctors,
        "providers_partners": total_partners,
        "providers_claimed": claimed_doctors + claimed_partners,
        "claims_pending": pending_claims,
        "claims_approved": approved_claims,
        "claims_rejected": rejected_claims,
    }


@api_router.get("/admin/claims/{claim_id}")
async def get_claim_detail(claim_id: str, admin: dict = Depends(verify_admin_token)):
    """Return a claim with joined provider snapshot + user info."""
    claim = await db.claims.find_one({"id": claim_id}, {"_id": 0})
    if not claim:
        raise HTTPException(status_code=404, detail="Claim introuvable")

    collection = db.doctor_profiles if claim.get("provider_kind") == "doctor" else db.partner_profiles
    provider = await collection.find_one(
        {"id": claim.get("provider_id")},
        {"_id": 0, "id": 1, "name": 1, "company_name": 1, "telephone": 1,
         "whatsapp_number": 1, "email": 1, "city": 1, "neighborhood": 1,
         "country": 1, "specialties": 1, "activity_type": 1, "claim_status": 1,
         "is_verified": 1, "master_profile": 1, "created_at": 1}
    )
    user = await db.users.find_one(
        {"id": claim.get("user_id")},
        {"_id": 0, "password": 0}
    )

    # Other previous claims from the same phone/email (helps spot fraud)
    other_claims = []
    if claim.get("phone") or claim.get("email"):
        or_filters = []
        if claim.get("phone"):
            or_filters.append({"phone": claim["phone"]})
        if claim.get("email"):
            or_filters.append({"email": claim["email"]})
        if or_filters:
            other_claims = await db.claims.find(
                {"$or": or_filters, "id": {"$ne": claim_id}},
                {"_id": 0, "id": 1, "provider_name": 1, "status": 1, "created_at": 1}
            ).sort("created_at", -1).limit(10).to_list(10)

    # Recompute trust on the fly so it reflects current data
    fresh_trust = compute_trust_score(claim, user or {}, provider or {})

    return {
        "claim": claim,
        "provider": provider,
        "user": user,
        "other_claims": other_claims,
        "trust_score_current": fresh_trust,
    }


@api_router.put("/admin/claims/{claim_id}/decide")
async def decide_claim(claim_id: str, payload: dict, admin: dict = Depends(verify_admin_token)):
    """Approve or reject a claim. payload = {action: 'approve'|'reject', reason?: str}"""
    action = payload.get("action")
    reason = payload.get("reason", "")
    if action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="action must be 'approve' or 'reject'")

    claim = await db.claims.find_one({"id": claim_id}, {"_id": 0})
    if not claim:
        raise HTTPException(status_code=404, detail="Claim introuvable")
    if claim["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Claim already {claim['status']}")

    collection = db.doctor_profiles if claim["provider_kind"] == "doctor" else db.partner_profiles

    if action == "approve":
        new_claim_status = "verified"
        await db.users.update_one(
            {"id": claim["user_id"]},
            {"$set": {"verified": True, "claim_pending": False, "email_verified": True}}
        )
        await collection.update_one(
            {"id": claim["provider_id"]},
            {"$set": {
                "claim_status": "verified",
                "claimed_by_user_id": claim["user_id"],
                "is_verified": True,
                "master_profile.trust.is_verified": True,
                "master_profile.trust.claim_status": "verified",
            }}
        )
        await db.claims.update_one(
            {"id": claim_id},
            {"$set": {"status": "approved", "decided_at": datetime.now(timezone.utc).isoformat(), "decision_reason": reason}}
        )
    else:
        new_claim_status = "rejected"
        await db.users.update_one(
            {"id": claim["user_id"]},
            {"$set": {"claim_pending": False, "claim_rejected": True}}
        )
        await collection.update_one(
            {"id": claim["provider_id"]},
            {"$set": {
                "claim_status": "seeded",
                "master_profile.trust.claim_status": "seeded",
            }}
        )
        await db.claims.update_one(
            {"id": claim_id},
            {"$set": {"status": "rejected", "decided_at": datetime.now(timezone.utc).isoformat(), "decision_reason": reason}}
        )

    await log_admin_action(
        admin, f"claim_{action}d", "claim", claim_id,
        {"provider_id": claim["provider_id"], "provider_kind": claim["provider_kind"], "reason": reason}
    )
    return {"success": True, "status": new_claim_status}


# ============ ADD A NEW STRUCTURE (self-add) ============

@api_router.post("/structures/add")
async def add_structure(payload: dict):
    """Self-add a new structure (no existing fiche). Creates user + partner_profile."""
    structure_name = (payload.get("structure_name") or "").strip()
    phone = (payload.get("phone") or "").strip()
    full_name = (payload.get("full_name") or "").strip()
    password = payload.get("password")

    if not structure_name or not phone or not full_name or not password:
        raise HTTPException(status_code=400, detail="Champs requis manquants.")

    raw_email = (payload.get("email") or "").strip().lower()
    if raw_email:
        email = raw_email
    else:
        slug = re.sub(r"[^a-z0-9]+", "-", structure_name.lower()).strip("-") or "structure"
        email = f"{slug}-{secrets.token_hex(3)}@keneyakafisa.app"

    if await db.users.find_one({"email": email}, {"_id": 0, "id": 1}):
        raise HTTPException(status_code=400, detail="Un compte avec cet email existe déjà.")

    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": email,
        "name": full_name,
        "user_type": "partner",
        "partner_role": (payload.get("function_role") or "owner").lower(),
        "password": hash_password(password),
        "whatsapp_number": payload.get("whatsapp_number") or phone,
        "verified": True,  # self-added structures get auto-verified user
        "email_verified": bool(raw_email),
        "company_name": structure_name,
        "activity_type": payload.get("categorie") or "autre",
        "address": payload.get("address") or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)

    profile_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "name": structure_name,
        "company_name": structure_name,
        "email": email,
        "whatsapp_number": payload.get("whatsapp_number") or phone,
        "activity_type": payload.get("categorie") or "autre",
        "categorie": payload.get("categorie") or "",
        "sous_categorie": payload.get("sous_categorie") or "",
        "address": payload.get("address") or "",
        "neighborhood": payload.get("commune") or "",
        "city": payload.get("ville") or "",
        "country": "Côte d'Ivoire",
        "description": payload.get("description") or "",
        "claim_status": "verified",
        "claimed_by_user_id": user_id,
        "is_verified": True,
        "source": "self_added",
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    # Build nested master_profile (V2 schema) at creation
    try:
        from services.master_model import build_master_profile
        profile_doc["master_profile"] = build_master_profile(profile_doc, "partner")
    except Exception as ex_mp:
        logging.error(f"master_profile build failed for new structure {structure_name!r}: {ex_mp}")
    await db.partner_profiles.insert_one(profile_doc)

    # Admin notification
    await db.admin_notifications.insert_one({
        "id": str(uuid.uuid4()),
        "type": "new_structure",
        "user_type": "partner",
        "user_id": user_id,
        "user_name": full_name,
        "user_email": email,
        "user_phone": phone,
        "provider_name": structure_name,
        "message": f"Nouvelle structure ajoutée : {structure_name} par {full_name}",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    # Log the user in immediately
    token = create_access_token({"sub": user_id})
    user_response = {k: v for k, v in user_doc.items() if k not in ("password", "_id")}
    return {"success": True, "token": token, "user": user_response}


@api_router.get("/partner/profile")
async def get_partner_profile(current_user: User = Depends(get_current_user)):
    """Get partner profile"""
    if current_user.user_type != "partner":
        raise HTTPException(status_code=403, detail="Accès réservé aux partenaires")
    profile = await db.partner_profiles.find_one({"user_id": current_user.id}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Profil partenaire non trouvé")
    return profile


@api_router.put("/partner/profile")
async def update_partner_profile(data: dict, current_user: User = Depends(get_current_user)):
    """Update partner profile"""
    if current_user.user_type != "partner":
        raise HTTPException(status_code=403, detail="Accès réservé aux partenaires")
    allowed_fields = {"company_name", "activity_type", "address", "whatsapp_number"}
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    if update_data:
        await db.partner_profiles.update_one(
            {"user_id": current_user.id},
            {"$set": update_data}
        )
    profile = await db.partner_profiles.find_one({"user_id": current_user.id}, {"_id": 0})
    return profile


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

    await log_admin_action(
        admin, "user_deleted", "user", user_id,
        {"email": user.get("email"), "user_type": user.get("user_type"), "name": user.get("name")}
    )
    return {"success": True, "message": "Utilisateur supprimé"}


@api_router.delete("/admin/delete-all")
async def delete_all_data(admin: dict = Depends(verify_admin_token)):
    """
    Supprimer TOUTES les données (utilisateurs, médecins, etc.)
    Réservé OWNER pour éviter les catastrophes.
    """
    if admin.get("admin_role") != "super_admin_owner":
        raise HTTPException(status_code=403, detail="Action réservée à l'OWNER de la plateforme.")
    results = {}
    
    # Supprimer tous les utilisateurs
    r = await db.users.delete_many({})
    results["users"] = r.deleted_count
    
    # Supprimer tous les profils médecins
    r = await db.doctor_profiles.delete_many({})
    results["doctor_profiles"] = r.deleted_count
    
    # Supprimer tous les rendez-vous
    r = await db.appointments.delete_many({})
    results["appointments"] = r.deleted_count
    
    # Supprimer tous les paiements
    r = await db.payments.delete_many({})
    results["payments"] = r.deleted_count
    
    # Supprimer tous les messages
    r = await db.messages.delete_many({})
    results["messages"] = r.deleted_count
    
    # Supprimer tous les avis
    r = await db.reviews.delete_many({})
    results["reviews"] = r.deleted_count
    
    # Supprimer tous les dossiers médicaux
    r = await db.medical_records.delete_many({})
    results["medical_records"] = r.deleted_count
    
    # Supprimer tous les points fidélité
    r = await db.loyalty_points.delete_many({})
    results["loyalty_points"] = r.deleted_count

    await log_admin_action(admin, "delete_all_data", "system", "all", {"deleted_counts": results})
    return {"success": True, "deleted": results}


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


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint for Kubernetes
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ============ VIDEO & SOCIAL LINKS ENDPOINTS ============

@api_router.post("/upload/video")
async def upload_video(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    """Upload a presentation video for doctor or partner profile"""
    if current_user.user_type not in ("doctor", "partner"):
        raise HTTPException(status_code=403, detail="Réservé aux professionnels et partenaires")
    
    # Validate file type
    allowed_types = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Format vidéo non supporté. Utilisez MP4, WebM ou MOV.")
    
    # Max 50MB
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="La vidéo ne doit pas dépasser 50 Mo")
    
    # Upload to object storage (prefixed with app name to avoid bucket collisions)
    ext = file.filename.split('.')[-1] if '.' in file.filename else 'mp4'
    file_path = f"keneyakafisa/videos/{current_user.id}/{uuid.uuid4()}.{ext}"
    
    try:
        put_object(file_path, content, file.content_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'upload: {str(e)}")
    
    # Store video URL in profile
    video_url = f"/api/media/{file_path}"
    
    if current_user.user_type == "doctor":
        await db.doctor_profiles.update_one(
            {"user_id": current_user.id},
            {"$set": {"presentation_video": video_url}}
        )
    elif current_user.user_type == "partner":
        await db.partner_profiles.update_one(
            {"user_id": current_user.id},
            {"$set": {"presentation_video": video_url}}
        )
    
    return {"success": True, "video_url": video_url}


@api_router.get("/media/{path:path}")
async def serve_media(path: str):
    """Serve uploaded media files from object storage"""
    try:
        content, content_type = get_object(path)
        return Response(content=content, media_type=content_type)
    except Exception:
        raise HTTPException(status_code=404, detail="Fichier non trouvé")


@api_router.put("/profile/social-links")
async def update_social_links(data: dict, current_user: User = Depends(get_current_user)):
    """Update social links and video URL for doctor or partner"""
    if current_user.user_type not in ("doctor", "partner"):
        raise HTTPException(status_code=403, detail="Réservé aux professionnels et partenaires")
    
    allowed_fields = {"tiktok_url", "facebook_url", "instagram_url", "video_url"}
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    
    if current_user.user_type == "doctor":
        await db.doctor_profiles.update_one(
            {"user_id": current_user.id},
            {"$set": update_data}
        )
        profile = await db.doctor_profiles.find_one({"user_id": current_user.id}, {"_id": 0})
    else:
        await db.partner_profiles.update_one(
            {"user_id": current_user.id},
            {"$set": update_data}
        )
        profile = await db.partner_profiles.find_one({"user_id": current_user.id}, {"_id": 0})
    
    return profile


@api_router.put("/profile/location-details")
async def update_location_details(data: dict, current_user: User = Depends(get_current_user)):
    """Save extended location info (country, city, neighborhood, landmark, GPS, website)
    for doctor or partner profile."""
    if current_user.user_type not in ("doctor", "partner"):
        raise HTTPException(status_code=403, detail="Réservé aux professionnels et partenaires")

    allowed_fields = {"country", "city", "neighborhood", "landmark", "website", "latitude", "longitude"}
    update_data: dict = {}
    for k, v in data.items():
        if k in allowed_fields and v not in (None, ""):
            update_data[k] = v
    # Normalize GPS into a nested coordinates object for back-compat with NearbyDoctors
    if "latitude" in update_data or "longitude" in update_data:
        try:
            update_data["coordinates"] = {
                "latitude": float(update_data.pop("latitude", 0) or 0),
                "longitude": float(update_data.pop("longitude", 0) or 0),
            }
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Coordonnées GPS invalides")

    if not update_data:
        raise HTTPException(status_code=400, detail="Aucun champ valide à mettre à jour")

    collection = db.doctor_profiles if current_user.user_type == "doctor" else db.partner_profiles
    await collection.update_one({"user_id": current_user.id}, {"$set": update_data})
    profile = await collection.find_one({"user_id": current_user.id}, {"_id": 0})
    return profile


# ============ EMAIL VERIFICATION ============

@api_router.get("/auth/verify-email")
async def verify_email(token: str):
    """Verify the user's email by clicking the magic link in the verification email."""
    user = await db.users.find_one({"verification_token": token}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=400, detail="Lien invalide ou déjà utilisé")

    # Check expiry (7 days)
    expires_at_str = user.get("verification_token_expires_at")
    if expires_at_str:
        try:
            expires_at = datetime.fromisoformat(expires_at_str)
            if datetime.now(timezone.utc) > expires_at:
                raise HTTPException(status_code=400, detail="Le lien a expiré. Demandez un nouveau lien.")
        except ValueError:
            pass  # Bad stored date, allow verify

    if user.get("email_verified"):
        return {"success": True, "already_verified": True, "message": "Email déjà vérifié"}

    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"email_verified": True}, "$unset": {"verification_token": "", "verification_token_expires_at": ""}}
    )
    return {"success": True, "already_verified": False, "message": "Email vérifié avec succès"}


@api_router.post("/auth/resend-verification")
async def resend_verification(current_user: User = Depends(get_current_user)):
    """Resend the verification email to the logged-in user."""
    user = await db.users.find_one({"id": current_user.id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if user.get("email_verified"):
        return {"success": True, "already_verified": True, "message": "Votre email est déjà vérifié"}

    # Generate fresh token
    new_token = secrets.token_urlsafe(32)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "verification_token": new_token,
            "verification_token_expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        }}
    )
    try:
        asyncio.create_task(send_verification_email(user["email"], user["name"], new_token))
    except Exception as e:
        logging.error(f"Could not enqueue verification email: {e}")
    return {"success": True, "message": "Email de vérification renvoyé"}


@api_router.post("/admin/migrate-master-model")
async def trigger_master_model_migration(admin: dict = Depends(verify_admin_token)):
    """Build the nested master_profile object on every doctor & partner fiche.
    Idempotent — safe to re-run."""
    stats = await migrate_all_providers(db)
    return {
        "success": True,
        "stats": stats,
        "doctor_profiles_in_db": await db.doctor_profiles.count_documents({}),
        "partner_profiles_in_db": await db.partner_profiles.count_documents({}),
        "doctors_with_master": await db.doctor_profiles.count_documents({"master_profile": {"$exists": True}}),
        "partners_with_master": await db.partner_profiles.count_documents({"master_profile": {"$exists": True}}),
    }


@api_router.post("/admin/dedupe-providers")
async def dedupe_providers(admin: dict = Depends(verify_admin_token)):
    """Delete duplicate fiches (same name, case-insensitive) keeping the first one.

    Also dedupes the corresponding `users` rows (orphans cleanup).
    Idempotent: safe to re-run.
    """
    stats = {"doctors_removed": 0, "partners_removed": 0, "users_removed": 0}

    for coll_name, col, kind_key in (
        ("doctor_profiles", db.doctor_profiles, "doctors_removed"),
        ("partner_profiles", db.partner_profiles, "partners_removed"),
    ):
        seen = {}
        async for d in col.find({}, {"_id": 0, "id": 1, "name": 1, "user_id": 1, "company_name": 1, "created_at": 1}):
            name = (d.get("name") or d.get("company_name") or "").strip().lower()
            if not name:
                continue
            if name not in seen:
                seen[name] = d
                continue
            # Determine which one to keep (oldest = first imported)
            existing = seen[name]
            drop = d
            ec = existing.get("created_at") or ""
            dc = d.get("created_at") or ""
            if dc and ec and dc < ec:
                drop = existing
                seen[name] = d
            # Delete the dropped fiche + its orphan user
            await col.delete_one({"id": drop["id"]})
            stats[kind_key] += 1
            drop_uid = drop.get("user_id")
            if drop_uid:
                deleted_user = await db.users.delete_one({"id": drop_uid, "imported": True})
                stats["users_removed"] += deleted_user.deleted_count

    return {
        "success": True,
        "stats": stats,
        "doctor_profiles_in_db": await db.doctor_profiles.count_documents({}),
        "partner_profiles_in_db": await db.partner_profiles.count_documents({}),
    }


@api_router.get("/admin/master-model/stats")
async def master_model_stats(admin: dict = Depends(verify_admin_token)):
    """Inspection endpoint: master_profile coverage + sample fields distribution."""
    total_d = await db.doctor_profiles.count_documents({})
    total_p = await db.partner_profiles.count_documents({})
    with_d = await db.doctor_profiles.count_documents({"master_profile": {"$exists": True}})
    with_p = await db.partner_profiles.count_documents({"master_profile": {"$exists": True}})
    # Symptom coverage
    d_with_symptoms = await db.doctor_profiles.count_documents({"master_profile.ai_matching.symptomes_pris_en_charge.0": {"$exists": True}})
    p_with_symptoms = await db.partner_profiles.count_documents({"master_profile.ai_matching.symptomes_pris_en_charge.0": {"$exists": True}})
    d_verified = await db.doctor_profiles.count_documents({"master_profile.trust.is_verified": True})
    p_verified = await db.partner_profiles.count_documents({"master_profile.trust.is_verified": True})

    # Top categories
    pipeline = [
        {"$group": {"_id": "$master_profile.classification.categorie", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 15},
    ]
    top_doc_cats = await db.doctor_profiles.aggregate(pipeline).to_list(15)
    top_part_cats = await db.partner_profiles.aggregate(pipeline).to_list(15)

    return {
        "doctor_profiles": {
            "total": total_d,
            "with_master_profile": with_d,
            "with_symptoms": d_with_symptoms,
            "verified": d_verified,
        },
        "partner_profiles": {
            "total": total_p,
            "with_master_profile": with_p,
            "with_symptoms": p_with_symptoms,
            "verified": p_verified,
        },
        "top_doctor_categories": top_doc_cats,
        "top_partner_categories": top_part_cats,
    }


@api_router.get("/providers/{provider_id}/master")
async def get_master_profile(provider_id: str):
    """Return the structured master_profile (V2 model) for any provider.
    If missing, builds it on the fly AND persists it (lazy migration).
    """
    for kind, col in (("doctor", db.doctor_profiles), ("partner", db.partner_profiles)):
        doc = await col.find_one({"id": provider_id}, {"_id": 0, "master_profile": 1, "id": 1})
        if doc:
            mp = doc.get("master_profile")
            if not mp:
                full = await col.find_one({"id": provider_id}, {"_id": 0})
                from services.master_model import build_master_profile
                mp = build_master_profile(full, kind)
                # Persist so subsequent calls are cached
                await col.update_one({"id": provider_id}, {"$set": {"master_profile": mp}})
            return {"id": provider_id, "kind": kind, "master_profile": mp}
    raise HTTPException(status_code=404, detail="Fiche introuvable")


@app.on_event("startup")
async def startup_storage():
    """Initialize Emergent Object Storage on startup"""
    try:
        init_storage()
        logging.info("Object storage initialized")
    except Exception as e:
        logging.error(f"Storage init failed at startup (will retry on first upload): {e}")

    # Idempotent seed loader for the initial keneya dataset.
    # Runs on every startup but only inserts missing records.
    try:
        await seed_initial_data(db)
    except Exception as e:
        logging.error(f"Seed loader failed: {e}")

    # Idempotent master-model V2 enrichment.
    # Adds the nested `master_profile` field on every doctor/partner record.
    try:
        await migrate_all_providers(db)
    except Exception as e:
        logging.error(f"Master-model migration failed: {e}")

    # Ensure the initial OWNER admin exists in the `admins` collection.
    try:
        await ensure_owner_admin_exists()
    except Exception as e:
        logging.error(f"Failed to seed OWNER admin: {e}")


# Register all api routes (must be AFTER all @api_router.* decorators)
app.include_router(api_router)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()