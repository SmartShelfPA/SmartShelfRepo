from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("classroom", "0003_study_workspace"),
    ]

    operations = [
        migrations.AddField(
            model_name="assignmentquestion",
            name="diagram_url",
            field=models.TextField(
                blank=True,
                default="",
                help_text="Figure for this question: an image URL or a plain SVG diagram.",
            ),
        ),
    ]
