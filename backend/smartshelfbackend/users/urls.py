from django.urls import path

from .views import BookListView, BookshelfView, ProfileView, StaffBookCreateView

urlpatterns = [
    path("profile/", ProfileView.as_view(), name="profile"),
    path("books/", BookListView.as_view(), name="books"),
    path("bookshelf/", BookshelfView.as_view(), name="bookshelf"),
    path("staff/books/", StaffBookCreateView.as_view(), name="staff-books-create"),
]
