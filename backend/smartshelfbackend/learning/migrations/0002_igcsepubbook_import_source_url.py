from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("learning", "0001_initial_learning"),
    ]

    operations = [
        migrations.AddField(
            model_name="igcsepubbook",
            name="import_source_url",
            field=models.URLField(
                blank=True,
                help_text=(
                    "Optional. Paste an epub.pub / readanybook.com book page or remote EPUB "
                    "archive URL; on save the file is downloaded into EPUB file automatically."
                ),
            ),
        ),
    ]
