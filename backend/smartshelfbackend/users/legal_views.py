from django.views.generic import TemplateView


class PrivacyPolicyPageView(TemplateView):
    template_name = "legal/privacy_policy.html"


class TermsOfUsePageView(TemplateView):
    template_name = "legal/terms_of_use.html"
