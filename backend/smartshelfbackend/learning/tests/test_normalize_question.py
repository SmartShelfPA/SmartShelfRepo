from django.test import SimpleTestCase

from learning.services.normalize import clean_diagram, normalize_question
from learning.services.providers.aloc import AlocQuestionNormalizerMixin, parse_available_years


class CleanDiagramTests(SimpleTestCase):
    def test_keeps_url_svg_and_drops_scripts(self):
        svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4"/></svg>'
        self.assertEqual(clean_diagram("https://cdn.example.com/graph.png"), "https://cdn.example.com/graph.png")
        self.assertEqual(clean_diagram("//cdn.example.com/graph.png"), "https://cdn.example.com/graph.png")
        self.assertEqual(clean_diagram(svg), svg)
        self.assertEqual(clean_diagram("<svg><script>alert(1)</script></svg>"), "")
        self.assertEqual(clean_diagram("null"), "")
        self.assertEqual(clean_diagram("maths2011.png"), "")

    def test_question_keeps_its_own_year_and_figure(self):
        svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4"/></svg>'
        generic = AlocQuestionNormalizerMixin.to_generic(
            {
                "id": 12,
                "question": "The diagram shows an equilateral triangle of side 6 cm. What is the perimeter?",
                "option": {"a": "12 cm", "b": "18 cm", "c": "24 cm", "d": "36 cm"},
                "answer": "b",
                "examyear": "2011",
                "image": svg,
            },
            0,
        )
        question = normalize_question(
            exam_type="WAEC",
            subject="mathematics",
            year=2013,
            order_index=0,
            raw=generic,
            provider="aloc",
        )
        self.assertEqual(question["year"], 2011)
        self.assertEqual(question["diagram_url"], svg)
        self.assertEqual(question["correct_option_id"], "B")

    def test_img_in_the_prompt_is_used_when_there_is_no_image_field(self):
        question = normalize_question(
            exam_type="JAMB",
            subject="mathematics",
            year=2013,
            order_index=0,
            raw={
                "id": "4",
                "question": '<p>Study the graph.</p><img src="https://cdn.example.com/parabola.png" alt="Parabola">',
                "options": [{"id": "A", "label": "y = x^2"}, {"id": "B", "label": "y = -x^2"}],
                "answer": "A",
            },
            provider="aloc",
        )
        self.assertEqual(question["diagram_url"], "https://cdn.example.com/parabola.png")
        self.assertEqual(question["year"], 2013)


class AvailableYearTests(SimpleTestCase):
    def test_reads_every_paper_year_from_the_bank(self):
        years = parse_available_years(
            {
                "data": [
                    {"questions": 4, "examyear": "2008"},
                    {"questions": 2, "examyear": "2013"},
                    {"questions": 5, "examyear": "2006"},
                    {"examyear": "nope"},
                ]
            }
        )
        self.assertEqual(years, [2013, 2008, 2006])
