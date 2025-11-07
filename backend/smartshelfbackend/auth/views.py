from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.hashers import make_password, check_password
from django.utils import timezone
import json
from datetime import datetime

from users.models import User
from .models import Token


@csrf_exempt
@require_http_methods(["POST"])
def register(request):
    """Register a new user and return an authentication token."""
    try:
        data = json.loads(request.body)
        
        # Validate required fields
        required_fields = ['name', 'username', 'password', 'email', 'date_of_birth']
        for field in required_fields:
            if field not in data:
                return JsonResponse({
                    'error': f'Missing required field: {field}'
                }, status=400)
        
        # Check if username already exists
        if User.objects.filter(username=data['username']).exists():
            return JsonResponse({
                'error': 'Username already exists'
            }, status=400)
        
        # Check if email already exists
        if User.objects.filter(email=data['email']).exists():
            return JsonResponse({
                'error': 'Email already exists'
            }, status=400)
        
        # Parse date of birth
        try:
            date_of_birth = datetime.strptime(data['date_of_birth'], '%Y-%m-%d').date()
        except ValueError:
            return JsonResponse({
                'error': 'Invalid date format. Use YYYY-MM-DD'
            }, status=400)
        
        # Create user with hashed password
        user = User.objects.create(
            name=data['name'],
            username=data['username'],
            password=make_password(data['password']),  # Hash the password
            email=data['email'],
            date_of_birth=date_of_birth
        )
        
        # Create or get token for the user
        token, created = Token.objects.get_or_create(user=user)
        
        return JsonResponse({
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
        
    except json.JSONDecodeError:
        return JsonResponse({
            'error': 'Invalid JSON format'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def login(request):
    """Authenticate user with username and password, return token."""
    try:
        data = json.loads(request.body)
        
        # Validate required fields
        if 'username' not in data or 'password' not in data:
            return JsonResponse({
                'error': 'Username and password are required'
            }, status=400)
        
        username = data['username']
        password = data['password']
        
        # Find user by username
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return JsonResponse({
                'error': 'Invalid username or password'
            }, status=401)
        
        # Check password
        if not check_password(password, user.password):
            return JsonResponse({
                'error': 'Invalid username or password'
            }, status=401)
        
        # Create or get token for the user
        token, created = Token.objects.get_or_create(user=user)
        
        return JsonResponse({
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
        
    except json.JSONDecodeError:
        return JsonResponse({
            'error': 'Invalid JSON format'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'error': str(e)
        }, status=500)
