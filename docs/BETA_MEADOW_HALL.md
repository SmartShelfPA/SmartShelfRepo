# Meadow Hall beta: operator guide

This covers what was built for the Meadow Hall beta, how to set a school up,
and what is still open.

## 1. Deploy checklist

1. Deploy the backend, then run on Render:

   ```bash
   python manage.py migrate
   python manage.py setup_beta_school --name "Meadow Hall" --slug meadow-hall --demo --out meadow_hall_demo.csv
   ```

2. Set these environment variables on the backend service:

   | Variable | Purpose | Default |
   | --- | --- | --- |
   | `SUPPORT_WHATSAPP_NUMBER` | Beta support WhatsApp, international format without `+` (e.g. `2348012345678`) | empty: WhatsApp button hidden |
   | `SUPPORT_EMAIL` | Support email shown in the app | `info@smartshelflearn.com` |
   | `SUPPORT_HOURS` | Shown under the support buttons | `Mon-Fri, 8am-6pm WAT` |
   | `PROTECTED_STORAGE_BACKEND` | Where uploaded school PDFs are stored: `database` or `filesystem` | `database` on Render, `filesystem` locally |
   | `SCHOOL_RESOURCE_MAX_MB` | Max size of a school PDF upload | `40` |

   Render's disk is ephemeral, so keep `PROTECTED_STORAGE_BACKEND=database`
   there unless a persistent disk is attached.

3. Ship new app builds. `react-native-svg` was added (native module, used by
   the annotation tools), so an OTA update is not enough: build new iOS and
   Android binaries with EAS. The web and desktop builds only need a normal
   rebuild.

## 2. Accounts

### Demo accounts

`--demo` creates, for the school slug `meadow-hall` (prefix `meadowhall`):

| Role | Username | Signs in on |
| --- | --- | --- |
| Teacher (school admin) | `meadowhall_teacher` | Teacher sign-in |
| Student, class SS2A | `meadowhall_student1`, `meadowhall_student2` | Student login |
| Parent (linked to student 1 / 2) | `meadowhall_parent1`, `meadowhall_parent2` | Parent sign-in |

It also seeds sample assignments and activity so dashboards are not empty.
Passwords are generated and printed (or written to `--out`); pass
`--password` to choose one. Re-running is safe: existing accounts keep their
password unless `--reset-passwords` is given.

### Real participants

```bash
python manage.py setup_beta_school --slug meadow-hall --participants participants.csv --out meadow_hall_credentials.csv
```

`participants.csv` (header row required):

```text
role,full_name,email,student_class,child_email,username,is_school_admin
teacher,Mrs Ada Okafor,ada@meadowhall.ng,,,,yes
student,Tobi Adeyemi,tobi@meadowhall.ng,SS2A,,,
parent,Mr Adeyemi,adeyemi@gmail.com,,tobi@meadowhall.ng,,
```

- `role` is `teacher`, `student` or `parent`.
- Parents are linked to the student whose email is in `child_email`.
- `is_school_admin=yes` lets a teacher manage members and the join code.

The credentials file is secret. Share each login privately with its owner and
delete the file afterwards. Never commit it.

Other flags: `--join-code CODE` (set the student join code),
`--no-join-code` (let students join without one), `--governs-data` (school
has signed the data processing agreement).

### Portal separation

- Teachers cannot self-register; accounts come from the command above or from
  a school admin (School admin screen).
- Each sign-in screen only accepts its own role. Signing in on the wrong
  screen shows a link to the right one.
- Students joining a school that has a join code must enter it at sign-up.
- Every role is guarded in the app: a parent token can't open the student or
  teacher areas, and vice versa.

## 3. What teachers, students and parents get

**Teachers** (Teacher home):

- Create assignments: multiple-choice and theory questions, a reading from a
  school resource, or a WAEC/JAMB practice set. Target a class or chosen
  students, optionally with a due date.
- Multiple-choice answers are marked automatically. Theory answers are marked
  on the submission screen with marks and feedback.
- Export results as CSV for the school's LMS or spreadsheet.
- Upload school PDFs and choose which classes can see them.
- School admins also get: join code, add students/teachers, reset passwords,
  deactivate accounts.

**Students**: "School work" on the home tab lists assignments and school
resources. Scores and correct answers stay hidden until the teacher has
marked the work, because students can resubmit until then.

**Parents**: per-child progress, assignments and scores, practice stats and
teacher feedback.

### School content segregation

School resources belong to one school. Only members of that school can list
or download them, and if audience classes are set, only students in those
classes. Other schools never see them (covered by backend tests).

## 4. Annotation and highlighting

Pen, highlighter, sticky notes and eraser on school/protected PDFs. Strokes
are saved per user, per PDF, per page on the server, so they follow the
student across devices. Annotations are private to the student.

- **Web and desktop**: tools row at the top of the PDF reader.
- **iOS/Android**: tap the pen icon in the PDF reader header to open notes
  mode (page by page). Swipe pages in Read mode; pick a tool to draw.

Known limitations for the beta:

- On phones, drawings show in notes mode, not in the normal scrolling reader.
- Only PDFs with a server id can be annotated (school resources and the
  protected library), not arbitrary local files.
- No text-selection highlighting: highlights are freehand strokes.

## 5. Beta support and feedback

- Help & Feedback is in the Profile tab (students), parent home and teacher
  home. It has WhatsApp and email buttons and a feedback form (category,
  rating, message). Users see their own feedback history and its status.
- Triage in Django admin under **Support > Feedback**: filter by school,
  role, category, status, priority and platform; set status and priority
  straight from the list; add admin notes. The "Export selected feedback to
  CSV" action produces a sheet for review meetings.
- Suggested rhythm: review new feedback with John weekly during the beta. Tag
  items as bug / request / question, set the status, and reply to the user on
  WhatsApp where needed.

## 6. LMS integration (investigation notes)

Now: CSV export per assignment (student name, username, email, class,
status, score, marks, submitted and marked dates, teacher feedback). Most LMSs and gradebooks can import that.

Options for later, if Meadow Hall's LMS needs a live link:

| Option | Fits when | Effort |
| --- | --- | --- |
| LTI 1.3 + Assignment and Grade Services | School uses Canvas, Moodle, Schoology or Blackboard | Large: tool registration, OIDC launch, grade passback |
| Google Classroom API | School uses Google Workspace for Education | Medium: OAuth per teacher, coursework + grade sync |
| Moodle web services | Moodle without LTI | Medium |

Next step: ask Meadow Hall which LMS they use and whether CSV import is enough
for the beta.

## 7. Open items

- Confirm Meadow Hall's participant list, then run the participants import.
- Set `SUPPORT_WHATSAPP_NUMBER`.
- Agree the feedback review slot with John.
- Decide on LMS integration after the school confirms its LMS.
