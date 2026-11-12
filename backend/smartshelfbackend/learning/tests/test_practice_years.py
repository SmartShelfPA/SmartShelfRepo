from django.test import SimpleTestCase
from django.utils import timezone

from learning.question_service import default_years
from learning.services.providers.aloc import parse_available_years


class AvailableYearTests(SimpleTestCase):
    def test_reads_every_paper_year_from_the_bank(self):
        years = parse_available_years(
            {
                "data": [
                    {"questions": 4, "examyear": "2008"},
                    {"questions": 2, "examyear": "2013"},
                    {"questions": 5, "examyear": "2006"},
                    {"examyear": "utme"},
                    {"examyear": "nope"},
                ]
            }
        )
        self.assertEqual(years, [2013, 2008, 2006])

    def test_unknown_year_list_is_not_the_last_four_calendar_years(self):
        years = default_years()
        latest = timezone.now().year
        self.assertEqual(years[0], latest)
        self.assertEqual(years[-1], 2000)
        self.assertNotEqual(years, [latest, latest - 1, latest - 2, latest - 3])
