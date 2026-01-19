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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DoctorProfileCreate(BaseModel):
    bio: Optional[str] = None
    experience_years: Optional[int] = None
    location: Optional[str] = None
    consultation_fee: Optional[float] = None
    languages: Optional[List[str]] = None
    availability: Optional[Dict[str, Any]] = None
    profile_image: Optional[str] = None

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

@api_router.get("/specialties")
async def get_specialties():
    moderne_specialties = [
        {"id": "1", "name": "Médecine Générale", "medical_type": "moderne"},
        {"id": "2", "name": "Cardiologie", "medical_type": "moderne"},
        {"id": "3", "name": "Dermatologie", "medical_type": "moderne"},
        {"id": "4", "name": "Gynécologie", "medical_type": "moderne"},
        {"id": "5", "name": "Ophtalmologie", "medical_type": "moderne"},
        {"id": "6", "name": "Chirurgie", "medical_type": "moderne"},
        {"id": "7", "name": "Pédiatrie", "medical_type": "moderne"},
        {"id": "8", "name": "Orthopédie", "medical_type": "moderne"},
        {"id": "9", "name": "Neurologie", "medical_type": "moderne"},
        {"id": "10", "name": "Psychiatrie", "medical_type": "moderne"},
    ]
    traditionnel_specialties = [
        {"id": "11", "name": "Phytothérapie", "medical_type": "traditionnel"},
        {"id": "12", "name": "Acupuncture", "medical_type": "traditionnel"},
        {"id": "13", "name": "Naturopathie", "medical_type": "traditionnel"},
        {"id": "14", "name": "Médecine Ayurvédique", "medical_type": "traditionnel"},
        {"id": "15", "name": "Homéopathie", "medical_type": "traditionnel"},
    ]
    return moderne_specialties + traditionnel_specialties

@api_router.get("/doctors/search")
async def search_doctors(
    specialty: Optional[str] = None,
    medical_type: Optional[str] = None,
    location: Optional[str] = None,
    min_rating: Optional[float] = None
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