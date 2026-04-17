from django.contrib.auth import authenticate
from rest_framework import serializers, status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from users.models import Organization, UserProfile
from users.serializers import UserProfileSerializer


class RegisterSerializer(serializers.Serializer):
    organization_slug = serializers.SlugField()
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(min_length=8, write_only=True)
    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=UserProfile.Role.choices)
    full_name = serializers.CharField(max_length=255)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    avatar_url = serializers.URLField(required=False, allow_blank=True)
    staff_role = serializers.CharField(required=False, allow_blank=True, max_length=120)
    staff_department = serializers.CharField(
        required=False, allow_blank=True, max_length=120
    )

    def validate(self, attrs):
        role = attrs["role"]
        if role == UserProfile.Role.STAFF:
            if not attrs.get("staff_role"):
                raise serializers.ValidationError("staff_role is required for staff users.")
            if not attrs.get("staff_department"):
                raise serializers.ValidationError(
                    "staff_department is required for staff users."
                )
        return attrs


class RegisterView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        organization = Organization.objects.filter(slug=data["organization_slug"]).first()
        if not organization:
            return Response(
                {"error": "Organization not found for organization_slug."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if UserProfile.objects.filter(username=data["username"]).exists():
            return Response({"error": "Username already exists."}, status=400)
        if UserProfile.objects.filter(email=data["email"]).exists():
            return Response({"error": "Email already exists."}, status=400)

        user = UserProfile.objects.create_user(
            username=data["username"],
            password=data["password"],
            email=data["email"],
            role=data["role"],
            full_name=data["full_name"],
            date_of_birth=data.get("date_of_birth"),
            avatar_url=data.get("avatar_url", ""),
            staff_role=data.get("staff_role", ""),
            staff_department=data.get("staff_department", ""),
            organization=organization,
        )
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {
                "success": True,
                "message": "User registered successfully",
                "token": token.key,
                "user": UserProfileSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()


class LoginView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user = authenticate(username=data["username"], password=data["password"])
        if not user:
            return Response({"error": "Invalid username or password"}, status=401)
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {
                "success": True,
                "message": "Login successful",
                "token": token.key,
                "user": UserProfileSerializer(user).data,
            }
        )


class ValidateTokenView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"valid": True, "user_id": str(request.user.id)})
