from django.urls import path

from .views import (
    BookListView,
    BookshelfView,
    ProfileView,
    PublisherBookCreateView,
    PublisherBookUpdateView,
    PublisherCatalogView,
    StaffBookCreateView,
)

urlpatterns = [
    path("profile/", ProfileView.as_view(), name="profile"),
    path("books/", BookListView.as_view(), name="books"),
    path("bookshelf/", BookshelfView.as_view(), name="bookshelf"),
    path("staff/books/", StaffBookCreateView.as_view(), name="staff-books-create"),
    path("publisher/books", PublisherBookCreateView.as_view(), name="publisher-books-create"),
    path("publisher/books/<uuid:id>", PublisherBookUpdateView.as_view(), name="publisher-books-update"),
    path("publisher/catalog", PublisherCatalogView.as_view(), name="publisher-catalog"),
]
