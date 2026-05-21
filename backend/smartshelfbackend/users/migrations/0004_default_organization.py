from django.db import migrations

DEFAULT_SCHOOL_SLUG = "default-school"
DEFAULT_SCHOOL_NAME = "Default School"


def create_default_organization(apps, schema_editor):
    Organization = apps.get_model("users", "Organization")
    Organization.objects.get_or_create(
        slug=DEFAULT_SCHOOL_SLUG,
        defaults={"name": DEFAULT_SCHOOL_NAME, "address": ""},
    )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0003_alter_userprofile_options_alter_userprofile_managers"),
    ]

    operations = [
        migrations.RunPython(create_default_organization, noop),
    ]
