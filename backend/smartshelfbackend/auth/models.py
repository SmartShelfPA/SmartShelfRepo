from django.db import models
from users.models import User
import secrets


class Token(models.Model):
    """Token model for user authentication."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='auth_token')
    key = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'auth_tokens'
        ordering = ['-created_at']
    
    def __str__(self):
        return f'{self.user.username} - {self.key[:8]}...'
    
    def save(self, *args, **kwargs):
        if not self.key:
            self.key = self.generate_key()
        return super().save(*args, **kwargs)
    
    @staticmethod
    def generate_key():
        """Generate a secure random token."""
        return secrets.token_urlsafe(48)
