from .tenant import set_current_organization_id


class CurrentOrganizationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        organization_id = None
        user = getattr(request, "user", None)
        if user and user.is_authenticated:
            organization_id = user.organization_id
        set_current_organization_id(organization_id)
        response = self.get_response(request)
        set_current_organization_id(None)
        return response
