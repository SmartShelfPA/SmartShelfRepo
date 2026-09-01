from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0010_passwordresetchallenge"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="stripe_customer_id",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="stripe_subscription_id",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="subscription_active_until",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="subscription_plan_id",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="subscription_status",
            field=models.CharField(
                choices=[
                    ("none", "None"),
                    ("active", "Active"),
                    ("past_due", "Past due"),
                    ("canceled", "Canceled"),
                ],
                default="none",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="subscription_tier",
            field=models.CharField(blank=True, default="", max_length=32),
        ),
    ]
