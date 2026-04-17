from threading import local

from django.db import models

_local = local()


def set_current_organization_id(organization_id):
    _local.organization_id = organization_id


def get_current_organization_id():
    return getattr(_local, "organization_id", None)


class OrganizationScopedQuerySet(models.QuerySet):
    def for_current_organization(self):
        organization_id = get_current_organization_id()
        if organization_id is None:
            return self
        return self.filter(organization_id=organization_id)


class OrganizationScopedManager(models.Manager):
    def get_queryset(self):
        queryset = OrganizationScopedQuerySet(self.model, using=self._db)
        if hasattr(self.model, "organization_id"):
            return queryset.for_current_organization()
        return queryset
