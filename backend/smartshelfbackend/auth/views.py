from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.hashers import make_password, check_password
from django.utils import timezone
import json
import logging
from datetime import datetime

from users.models import User
from .models import Token

logger = logging.getLogger(__name__)


def add_cors_headers(response):
    """Add CORS headers to response for frontend access."""
    response['Access-Control-Allow-Origin'] = '*'
    response['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return response


@csrf_exempt
def register(request):
    """Register a new user and return an authentication token."""
    # Handle CORS preflight
    if request.method == 'OPTIONS':
        return add_cors_headers(JsonResponse({}))
    
    if request.method != 'POST':
        response = JsonResponse({'error': 'Method not allowed'}, status=405)
        return add_cors_headers(response)
    
    logger.info("=" * 50)
    logger.info("REGISTER API CALL RECEIVED")
    logger.info("=" * 50)
    
    try:
        data = json.loads(request.body)
        logger.info(f"Request data received: username={data.get('username')}, email={data.get('email')}")
        
        # Validate required fields
        required_fields = ['name', 'username', 'password', 'email', 'date_of_birth']
        for field in required_fields:
            if field not in data:
                logger.warning(f"Missing required field: {field}")
                return JsonResponse({
                    'error': f'Missing required field: {field}'
                }, status=400)
        
        # Check if username already exists
        if User.objects.filter(username=data['username']).exists():
            logger.warning(f"Registration failed: Username '{data['username']}' already exists")
            return JsonResponse({
                'error': 'Username already exists'
            }, status=400)
        
        # Check if email already exists
        if User.objects.filter(email=data['email']).exists():
            logger.warning(f"Registration failed: Email '{data['email']}' already exists")
            return JsonResponse({
                'error': 'Email already exists'
            }, status=400)
        
        # Parse date of birth
        try:
            date_of_birth = datetime.strptime(data['date_of_birth'], '%Y-%m-%d').date()
            logger.info(f"Date of birth parsed: {date_of_birth}")
        except ValueError:
            logger.warning(f"Invalid date format: {data['date_of_birth']}")
            return JsonResponse({
                'error': 'Invalid date format. Use YYYY-MM-DD'
            }, status=400)
        
        # Create user with hashed password
        logger.info(f"Creating user: {data['username']}")
        user = User.objects.create(
            name=data['name'],
            username=data['username'],
            password=make_password(data['password']),  # Hash the password
            email=data['email'],
            date_of_birth=date_of_birth
        )
        logger.info(f"User created successfully: ID={user.id}, Username={user.username}")
        
        # Create or get token for the user
        token, created = Token.objects.get_or_create(user=user)
        if created:
            logger.info(f"New token created for user: {user.username}")
        else:
            logger.info(f"Existing token retrieved for user: {user.username}")
        
        logger.info(f"Registration successful for user: {user.username}")
        logger.info("=" * 50)
        
        response = JsonResponse({
            'success': True,
            'message': 'User registered successfully',
            'token': token.key,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'name': user.name,
                'date_of_birth': user.date_of_birth.isoformat(),
                'created_at': user.created_at.isoformat()
            }
        }, status=201)
        return add_cors_headers(response)
        
    except json.JSONDecodeError:
        logger.error("Invalid JSON format in request body")
        response = JsonResponse({
            'error': 'Invalid JSON format'
        }, status=400)
        return add_cors_headers(response)
    except Exception as e:
        logger.error(f"Registration error: {str(e)}", exc_info=True)
        response = JsonResponse({
            'error': str(e)
        }, status=500)
        return add_cors_headers(response)


@csrf_exempt
def login(request):
    """Authenticate user with username and password, return token."""
    # Handle CORS preflight
    if request.method == 'OPTIONS':
        return add_cors_headers(JsonResponse({}))
    
    if request.method != 'POST':
        response = JsonResponse({'error': 'Method not allowed'}, status=405)
        return add_cors_headers(response)
    
    logger.info("=" * 50)
    logger.info("LOGIN API CALL RECEIVED")
    logger.info("=" * 50)
    
    try:
        data = json.loads(request.body)
        username = data.get('username', '')
        logger.info(f"Login attempt for username: {username}")
        
        # Validate required fields
        if 'username' not in data or 'password' not in data:
            logger.warning("Login failed: Missing username or password")
            return JsonResponse({
                'error': 'Username and password are required'
            }, status=400)
        
        username = data['username']
        password = data['password']
        
        # Find user by username
        try:
            user = User.objects.get(username=username)
            logger.info(f"User found: ID={user.id}, Username={user.username}")
        except User.DoesNotExist:
            logger.warning(f"Login failed: User '{username}' not found")
            return JsonResponse({
                'error': 'Invalid username or password'
            }, status=401)
        
        # Check password
        if not check_password(password, user.password):
            logger.warning(f"Login failed: Invalid password for user '{username}'")
            return JsonResponse({
                'error': 'Invalid username or password'
            }, status=401)
        
        logger.info(f"Password verified successfully for user: {username}")
        
        # Create or get token for the user
        token, created = Token.objects.get_or_create(user=user)
        if created:
            logger.info(f"New token created for user: {user.username}")
        else:
            logger.info(f"Existing token retrieved for user: {user.username}")
        
        logger.info(f"Login successful for user: {user.username}")
        logger.info("=" * 50)
        
        response = JsonResponse({
            'success': True,
            'message': 'Login successful',
            'token': token.key,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'name': user.name,
                'date_of_birth': user.date_of_birth.isoformat(),
                'created_at': user.created_at.isoformat()
            }
        }, status=200)
        return add_cors_headers(response)
        
    except json.JSONDecodeError:
        logger.error("Invalid JSON format in request body")
        response = JsonResponse({
            'error': 'Invalid JSON format'
        }, status=400)
        return add_cors_headers(response)
    except Exception as e:
        logger.error(f"Login error: {str(e)}", exc_info=True)
        response = JsonResponse({
            'error': str(e)
        }, status=500)
        return add_cors_headers(response)
