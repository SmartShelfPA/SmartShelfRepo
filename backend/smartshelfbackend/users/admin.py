from django.contrib import admin
from .models import User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('id', 'username', 'email', 'name', 'date_of_birth', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('username', 'email', 'name')
    readonly_fields = ('id', 'created_at')
