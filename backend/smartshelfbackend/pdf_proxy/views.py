"""
PDF proxy view - fetches PDF from external URL and returns with CORS headers.
Enables PDF.js viewer to load external PDFs (avoids CORS issues).
"""
import requests
from django.http import HttpResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt


def _cors_headers(response):
    response['Access-Control-Allow-Origin'] = '*'
    response['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
    response['Access-Control-Allow-Headers'] = '*'
    return response


@require_http_methods(['GET', 'OPTIONS'])
def pdf_proxy(request):
    if request.method == 'OPTIONS':
        return _cors_headers(HttpResponse())
    url = request.GET.get('url')
    if not url:
        return HttpResponse('Missing url parameter', status=400)
    if not url.startswith(('http://', 'https://')):
        return HttpResponse('Invalid url', status=400)
    try:
        resp = requests.get(url, timeout=30, stream=True)
        resp.raise_for_status()
        response = HttpResponse(resp.content, content_type=resp.headers.get('Content-Type', 'application/pdf'))
        return _cors_headers(response)
    except requests.RequestException as e:
        return HttpResponse(f'Failed to fetch PDF: {e}', status=502)
