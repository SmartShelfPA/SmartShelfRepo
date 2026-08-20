"""
URL configuration for smartshelfbackend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import path, include

from learning.views import DashboardView
from users.legal_views import PrivacyPolicyPageView, TermsOfUsePageView
from smartshelfbackend.root_views import api_root
from smartshelfbackend.download_views import download_macos, download_page, download_windows

urlpatterns = [
    path('', api_root, name='api-root'),
    path('download/', download_page, name='desktop-download'),
    path('download/windows', download_windows, name='desktop-download-windows'),
    path('download/macos', download_macos, name='desktop-download-macos'),
    path('privacy/', PrivacyPolicyPageView.as_view(), name='privacy-policy'),
    path('terms/', TermsOfUsePageView.as_view(), name='terms-of-use'),
    path('admin/', admin.site.urls),
    path('api/auth/', include('auth.urls')),
    path('api/quotes/', include('quotes.urls')),
    path('api/pdf-proxy/', include('pdf_proxy.urls')),
    path('api/v1/auth/', include('auth.urls')),
    path('api/v1/', include('users.urls')),
    # IGCSE EPUB reader + annotations (authenticated).
    path('api/v1/igcse/', include('learning.igcse_urls')),
    path('api/v1/practice/', include('learning.practice_urls')),
    path('api/v1/dashboard/', DashboardView.as_view(), name='dashboard'),
    # Canonical IGCSE study-agent catalog (subjects, chapters, sets, ingest).
    path('api/igcse/', include('igcse_catalog.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
