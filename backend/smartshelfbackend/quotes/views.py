import json
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

from django.conf import settings
from django.http import JsonResponse


def random_quote(_request):
    """
    Proxy a random quote from the external quotes backend.
    Falls back to a simple static response if the external service fails.
    """
    quotes_url = getattr(settings, 'QUOTES_API_URL', 'http://localhost:8080/')

    try:
        req = Request(quotes_url, headers={'Accept': 'application/json'})
        with urlopen(req, timeout=5) as response:
            payload = response.read().decode('utf-8')
            data = json.loads(payload)
            quote = data.get('Quote')
            author = data.get('Author')
            if quote and author:
                return JsonResponse({'quote': quote, 'author': author})
    except (HTTPError, URLError, json.JSONDecodeError):
        pass

    return JsonResponse(
        {
            'quote': 'Education is the best investment a people can make.',
            'author': 'Chief Obafemi Awolowo',
        }
    )
