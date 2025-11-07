from django.db import models


class User(models.Model):
    """User model to store user details."""
    username = models.CharField(max_length=150, unique=True)
    password = models.CharField(max_length=128)  # Store hashed password in production
    email = models.EmailField(unique=True)
    date_of_birth = models.DateField()
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'users'
        ordering = ['-created_at']
    
    def __str__(self):
        return self.username
