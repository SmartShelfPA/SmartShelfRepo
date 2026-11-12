from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0012_school_admin_join_code"),
    ]

    operations = [
        migrations.AddField(
            model_name="book",
            name="edition",
            field=models.CharField(blank=True, max_length=80),
        ),
        migrations.AddField(
            model_name="book",
            name="curriculum",
            field=models.CharField(
                blank=True,
                help_text="Curriculum this edition covers, e.g. NERDC SS2 Biology or WAEC.",
                max_length=255,
            ),
        ),
    ]
