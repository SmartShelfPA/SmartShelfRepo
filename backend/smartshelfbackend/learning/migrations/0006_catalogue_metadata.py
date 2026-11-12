from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("learning", "0005_school_resources_pdf_annotations"),
    ]

    operations = [
        migrations.AddField(
            model_name="protectedpdfasset",
            name="author",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="protectedpdfasset",
            name="edition",
            field=models.CharField(blank=True, max_length=80),
        ),
        migrations.AddField(
            model_name="protectedpdfasset",
            name="isbn",
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name="protectedpdfasset",
            name="publisher_name",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="protectedpdfasset",
            name="curriculum",
            field=models.CharField(
                blank=True,
                help_text="Curriculum coverage, e.g. NERDC SS2 Biology or WAEC.",
                max_length=255,
            ),
        ),
        migrations.AddField(
            model_name="protectedpdfasset",
            name="offline_allowed",
            field=models.BooleanField(
                default=True,
                help_text="Publisher has confirmed students may keep an offline copy.",
            ),
        ),
    ]
