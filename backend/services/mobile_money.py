"""
Mobile Money Payment Services for African Markets
Supports: Orange Money, MTN Mobile Money, Moov Money

Note: This implementation uses sandbox/test mode.
Replace with real API credentials for production.
"""
import os
import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, Optional
from enum import Enum
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class PaymentProvider(str, Enum):
    ORANGE_MONEY = "orange_money"
    MTN_MOMO = "mtn_momo"
    MOOV = "moov"


class PaymentStatus(str, Enum):
    PENDING = "PENDING"
    SUCCESSFUL = "SUCCESSFUL"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class MobileMoneyPaymentRequest(BaseModel):
    provider: PaymentProvider
    amount: float
    currency: str = "XOF"
    phone_number: str
    description: str
    customer_name: str
    service_type: str  # consultation, product, equipment
    external_id: Optional[str] = None


class MobileMoneyService:
    """
    Unified Mobile Money Service supporting multiple African payment providers.
    Currently operates in SANDBOX/TEST mode.
    """
    
    def __init__(self):
        self.environment = os.environ.get("MOBILE_MONEY_ENV", "sandbox")
        
        # Orange Money config
        self.orange_api_url = os.environ.get(
            "ORANGE_MONEY_API_URL", 
            "https://api.orange.com/mpp/v1"
        )
        self.orange_merchant_id = os.environ.get("ORANGE_MONEY_MERCHANT_ID", "")
        self.orange_api_key = os.environ.get("ORANGE_MONEY_API_KEY", "")
        
        # MTN MoMo config
        self.mtn_api_url = os.environ.get(
            "MTN_MOMO_API_URL",
            "https://sandbox.momodeveloper.mtn.com/momo"
        )
        self.mtn_subscription_key = os.environ.get("MTN_MOMO_SUBSCRIPTION_KEY", "")
        self.mtn_api_user = os.environ.get("MTN_MOMO_API_USER", "")
        self.mtn_api_key = os.environ.get("MTN_MOMO_API_KEY", "")
        
        # Moov config
        self.moov_api_url = os.environ.get("MOOV_API_URL", "https://api.moov.io")
        self.moov_api_key = os.environ.get("MOOV_API_KEY", "")
        self.moov_account_id = os.environ.get("MOOV_ACCOUNT_ID", "")
        
        logger.info(f"Mobile Money Service initialized in {self.environment} mode")

    async def initiate_payment(self, request: MobileMoneyPaymentRequest) -> Dict:
        """
        Initiate a payment through the selected mobile money provider.
        In sandbox mode, this simulates the payment flow.
        """
        reference_id = str(uuid.uuid4())
        external_id = request.external_id or str(uuid.uuid4())
        
        try:
            if self.environment == "sandbox":
                # Sandbox mode - simulate payment initiation
                return await self._simulate_payment_initiation(request, reference_id, external_id)
            
            # Production mode - call real APIs
            if request.provider == PaymentProvider.ORANGE_MONEY:
                return await self._initiate_orange_payment(request, reference_id, external_id)
            elif request.provider == PaymentProvider.MTN_MOMO:
                return await self._initiate_mtn_payment(request, reference_id, external_id)
            elif request.provider == PaymentProvider.MOOV:
                return await self._initiate_moov_payment(request, reference_id, external_id)
            else:
                raise ValueError(f"Unknown provider: {request.provider}")
                
        except Exception as e:
            logger.exception(f"Error initiating {request.provider} payment: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "reference_id": reference_id,
                "status": PaymentStatus.FAILED.value
            }

    async def _simulate_payment_initiation(
        self, 
        request: MobileMoneyPaymentRequest,
        reference_id: str,
        external_id: str
    ) -> Dict:
        """Simulate payment initiation for sandbox testing."""
        logger.info(f"[SANDBOX] Initiating {request.provider} payment: {reference_id}")
        
        # Simulate successful initiation
        # In real implementation, this would send a prompt to the user's phone
        return {
            "success": True,
            "reference_id": reference_id,
            "external_id": external_id,
            "provider": request.provider.value,
            "status": PaymentStatus.PENDING.value,
            "amount": request.amount,
            "currency": request.currency,
            "phone_number": request.phone_number,
            "message": f"[SANDBOX] Paiement {request.provider.value} initié. En production, l'utilisateur recevrait une notification sur son téléphone.",
            "initiated_at": datetime.now(timezone.utc).isoformat(),
            "sandbox_mode": True
        }

    async def _initiate_orange_payment(
        self,
        request: MobileMoneyPaymentRequest,
        reference_id: str,
        external_id: str
    ) -> Dict:
        """Initiate Orange Money payment via API."""
        import httpx
        
        headers = {
            "Authorization": f"Bearer {self.orange_api_key}",
            "Content-Type": "application/json",
            "X-Merchant-ID": self.orange_merchant_id
        }
        
        payload = {
            "amount": request.amount,
            "currency": request.currency,
            "description": request.description,
            "phoneNumber": request.phone_number,
            "externalId": external_id,
            "transactionRef": reference_id,
            "callbackUrl": f"{os.environ.get('BACKEND_URL', '')}/api/payments/webhook/orange"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.orange_api_url}/payment/request",
                json=payload,
                headers=headers,
                timeout=30.0
            )
        
        if response.status_code in [200, 201, 202]:
            data = response.json()
            return {
                "success": True,
                "reference_id": reference_id,
                "external_id": external_id,
                "provider": PaymentProvider.ORANGE_MONEY.value,
                "status": PaymentStatus.PENDING.value,
                "amount": request.amount,
                "currency": request.currency,
                "provider_response": data,
                "initiated_at": datetime.now(timezone.utc).isoformat()
            }
        else:
            logger.error(f"Orange Money API error: {response.text}")
            return {
                "success": False,
                "error": f"Orange Money API error: {response.status_code}",
                "reference_id": reference_id,
                "status": PaymentStatus.FAILED.value
            }

    async def _initiate_mtn_payment(
        self,
        request: MobileMoneyPaymentRequest,
        reference_id: str,
        external_id: str
    ) -> Dict:
        """Initiate MTN Mobile Money payment via API."""
        import httpx
        import base64
        
        # Generate Basic auth header
        credentials = f"{self.mtn_api_user}:{self.mtn_api_key}"
        auth_header = f"Basic {base64.b64encode(credentials.encode()).decode()}"
        
        headers = {
            "X-Reference-Id": reference_id,
            "X-Target-Environment": "sandbox" if self.environment == "sandbox" else "mtncameroon",
            "Content-Type": "application/json",
            "Ocp-Apim-Subscription-Key": self.mtn_subscription_key,
            "Authorization": auth_header
        }
        
        payload = {
            "amount": str(request.amount),
            "currency": "EUR",  # MTN sandbox uses EUR
            "externalId": external_id,
            "payer": {
                "partyIdType": "MSISDN",
                "partyId": request.phone_number
            },
            "payerMessage": request.description,
            "payeeNote": f"HealthFusion - {request.service_type}"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.mtn_api_url}/v1_0/requesttopay",
                json=payload,
                headers=headers,
                timeout=30.0
            )
        
        if response.status_code in [200, 202]:
            return {
                "success": True,
                "reference_id": reference_id,
                "external_id": external_id,
                "provider": PaymentProvider.MTN_MOMO.value,
                "status": PaymentStatus.PENDING.value,
                "amount": request.amount,
                "currency": "EUR",
                "initiated_at": datetime.now(timezone.utc).isoformat()
            }
        else:
            logger.error(f"MTN MoMo API error: {response.text}")
            return {
                "success": False,
                "error": f"MTN MoMo API error: {response.status_code}",
                "reference_id": reference_id,
                "status": PaymentStatus.FAILED.value
            }

    async def _initiate_moov_payment(
        self,
        request: MobileMoneyPaymentRequest,
        reference_id: str,
        external_id: str
    ) -> Dict:
        """Initiate Moov Money payment via API."""
        import httpx
        
        headers = {
            "Authorization": f"Bearer {self.moov_api_key}",
            "Content-Type": "application/json",
            "API-Version": "v2025.07.00"
        }
        
        payload = {
            "amount": int(request.amount * 100),  # Moov uses cents
            "currency": "USD",
            "description": request.description,
            "source": {
                "accountID": self.moov_account_id
            },
            "destination": {
                "phoneNumber": request.phone_number
            }
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.moov_api_url}/transfers",
                json=payload,
                headers=headers,
                timeout=30.0
            )
        
        if response.status_code in [200, 201, 202]:
            data = response.json()
            return {
                "success": True,
                "reference_id": data.get("id", reference_id),
                "external_id": external_id,
                "provider": PaymentProvider.MOOV.value,
                "status": PaymentStatus.PENDING.value,
                "amount": request.amount,
                "currency": "USD",
                "provider_response": data,
                "initiated_at": datetime.now(timezone.utc).isoformat()
            }
        else:
            logger.error(f"Moov API error: {response.text}")
            return {
                "success": False,
                "error": f"Moov API error: {response.status_code}",
                "reference_id": reference_id,
                "status": PaymentStatus.FAILED.value
            }

    async def verify_payment(self, reference_id: str, provider: PaymentProvider) -> Dict:
        """Verify payment status from the provider."""
        try:
            if self.environment == "sandbox":
                return await self._simulate_payment_verification(reference_id, provider)
            
            if provider == PaymentProvider.ORANGE_MONEY:
                return await self._verify_orange_payment(reference_id)
            elif provider == PaymentProvider.MTN_MOMO:
                return await self._verify_mtn_payment(reference_id)
            elif provider == PaymentProvider.MOOV:
                return await self._verify_moov_payment(reference_id)
            else:
                raise ValueError(f"Unknown provider: {provider}")
                
        except Exception as e:
            logger.exception(f"Error verifying payment: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "status": PaymentStatus.PENDING.value
            }

    async def _simulate_payment_verification(
        self, 
        reference_id: str, 
        provider: PaymentProvider
    ) -> Dict:
        """Simulate payment verification for sandbox testing."""
        logger.info(f"[SANDBOX] Verifying {provider} payment: {reference_id}")
        
        # In sandbox, we'll simulate successful payment after verification
        return {
            "success": True,
            "reference_id": reference_id,
            "provider": provider.value,
            "status": PaymentStatus.SUCCESSFUL.value,
            "verified_at": datetime.now(timezone.utc).isoformat(),
            "sandbox_mode": True,
            "message": "[SANDBOX] Paiement vérifié avec succès"
        }

    async def _verify_orange_payment(self, reference_id: str) -> Dict:
        """Verify Orange Money payment status."""
        import httpx
        
        headers = {
            "Authorization": f"Bearer {self.orange_api_key}",
            "X-Merchant-ID": self.orange_merchant_id
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.orange_api_url}/payment/verify/{reference_id}",
                headers=headers,
                timeout=30.0
            )
        
        if response.status_code == 200:
            data = response.json()
            status = data.get("status", "UNKNOWN").upper()
            return {
                "success": True,
                "reference_id": reference_id,
                "status": status,
                "provider_response": data,
                "verified_at": datetime.now(timezone.utc).isoformat()
            }
        else:
            return {
                "success": False,
                "error": "Verification failed",
                "status": PaymentStatus.PENDING.value
            }

    async def _verify_mtn_payment(self, reference_id: str) -> Dict:
        """Verify MTN MoMo payment status."""
        import httpx
        import base64
        
        credentials = f"{self.mtn_api_user}:{self.mtn_api_key}"
        auth_header = f"Basic {base64.b64encode(credentials.encode()).decode()}"
        
        headers = {
            "X-Target-Environment": "sandbox" if self.environment == "sandbox" else "mtncameroon",
            "Ocp-Apim-Subscription-Key": self.mtn_subscription_key,
            "Authorization": auth_header
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.mtn_api_url}/v1_0/requesttopay/{reference_id}",
                headers=headers,
                timeout=30.0
            )
        
        if response.status_code in [200, 202]:
            data = response.json()
            status = data.get("status", "PENDING").upper()
            return {
                "success": True,
                "reference_id": reference_id,
                "status": status,
                "financial_transaction_id": data.get("financialTransactionId"),
                "provider_response": data,
                "verified_at": datetime.now(timezone.utc).isoformat()
            }
        else:
            return {
                "success": False,
                "error": "Verification failed",
                "status": PaymentStatus.PENDING.value
            }

    async def _verify_moov_payment(self, reference_id: str) -> Dict:
        """Verify Moov payment status."""
        import httpx
        
        headers = {
            "Authorization": f"Bearer {self.moov_api_key}",
            "API-Version": "v2025.07.00"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.moov_api_url}/transfers/{reference_id}",
                headers=headers,
                timeout=30.0
            )
        
        if response.status_code == 200:
            data = response.json()
            status_map = {
                "completed": PaymentStatus.SUCCESSFUL.value,
                "failed": PaymentStatus.FAILED.value,
                "canceled": PaymentStatus.CANCELLED.value
            }
            status = status_map.get(data.get("status"), PaymentStatus.PENDING.value)
            return {
                "success": True,
                "reference_id": reference_id,
                "status": status,
                "provider_response": data,
                "verified_at": datetime.now(timezone.utc).isoformat()
            }
        else:
            return {
                "success": False,
                "error": "Verification failed",
                "status": PaymentStatus.PENDING.value
            }

    def process_webhook(self, provider: PaymentProvider, payload: Dict) -> Dict:
        """Process webhook notification from payment provider."""
        try:
            if provider == PaymentProvider.ORANGE_MONEY:
                return self._process_orange_webhook(payload)
            elif provider == PaymentProvider.MTN_MOMO:
                return self._process_mtn_webhook(payload)
            elif provider == PaymentProvider.MOOV:
                return self._process_moov_webhook(payload)
            else:
                raise ValueError(f"Unknown provider: {provider}")
        except Exception as e:
            logger.exception(f"Error processing webhook: {str(e)}")
            return {"success": False, "error": str(e)}

    def _process_orange_webhook(self, payload: Dict) -> Dict:
        """Process Orange Money webhook."""
        return {
            "success": True,
            "reference_id": payload.get("transactionRef"),
            "external_id": payload.get("externalId"),
            "status": payload.get("status", "UNKNOWN").upper(),
            "amount": payload.get("amount"),
            "processed_at": datetime.now(timezone.utc).isoformat()
        }

    def _process_mtn_webhook(self, payload: Dict) -> Dict:
        """Process MTN MoMo webhook."""
        return {
            "success": True,
            "reference_id": payload.get("externalId"),
            "status": payload.get("status", "UNKNOWN").upper(),
            "amount": payload.get("amount"),
            "financial_transaction_id": payload.get("financialTransactionId"),
            "processed_at": datetime.now(timezone.utc).isoformat()
        }

    def _process_moov_webhook(self, payload: Dict) -> Dict:
        """Process Moov webhook."""
        data = payload.get("data", {})
        status_map = {
            "completed": PaymentStatus.SUCCESSFUL.value,
            "failed": PaymentStatus.FAILED.value,
            "canceled": PaymentStatus.CANCELLED.value
        }
        return {
            "success": True,
            "reference_id": data.get("id"),
            "status": status_map.get(data.get("status"), PaymentStatus.PENDING.value),
            "amount": data.get("amount", 0) / 100,
            "processed_at": datetime.now(timezone.utc).isoformat()
        }


# Singleton instance
mobile_money_service = MobileMoneyService()
