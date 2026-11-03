import type MaterialIcons from '@expo/vector-icons/MaterialIcons';

import type { UserRole } from '@/services/api';

export type TutorialStep = {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  body: string;
  where: string;
};

type Options = {
  role: UserRole | null | undefined;
  desktop: boolean;
  hasSchool: boolean;
  isSchoolAdmin: boolean;
};

export function navTutorialSteps({ role, desktop, hasSchool, isSchoolAdmin }: Options): TutorialStep[] {
  if (role === 'parent') return parentSteps();
  if (role === 'staff') return teacherSteps(isSchoolAdmin);
  return studentSteps(desktop, hasSchool);
}

function studentSteps(desktop: boolean, hasSchool: boolean): TutorialStep[] {
  const homeWhere = desktop ? 'Side menu → Home' : 'Bottom bar → SmartShelf logo';
  const shelfWhere = desktop ? 'Side menu → My Shelf' : 'Bottom bar → Bookshelf';
  const profileWhere = desktop ? 'Side menu → Profile' : 'Bottom bar → Profile';

  const steps: TutorialStep[] = [
    {
      icon: 'home',
      title: 'This is Home',
      body: 'Home is where you start after you sign in. Your greeting, textbooks, and practice are all on this screen.',
      where: homeWhere,
    },
    {
      icon: 'auto-stories',
      title: 'Open a textbook',
      body: 'Tap IGCSE shelf to pick a subject and open a book. On a computer, IGCSE is also in the side menu.',
      where: desktop ? 'Side menu → IGCSE' : 'Home → IGCSE shelf',
    },
    {
      icon: 'edit-note',
      title: 'Practice for exams',
      body: 'WAEC and JAMB sit under Textbooks on Home. Tap one to start a practice session.',
      where: desktop ? 'Side menu → Practice' : 'Home → Practice',
    },
    {
      icon: 'menu-book',
      title: 'Your bookshelf',
      body: desktop
        ? 'My Shelf keeps books you open. Downloads, just under it in the side menu, is for books saved on this device.'
        : 'The Bookshelf tab keeps books you open. You can group them into collections from that screen.',
      where: shelfWhere,
    },
  ];

  if (hasSchool) {
    steps.push({
      icon: 'assignment',
      title: 'School work',
      body: 'Your school section on Home lists assignments that are still open, plus notes and PDFs from your teachers.',
      where: 'Home → your school name',
    });
  }

  steps.push({
    icon: 'person',
    title: 'Your account',
    body: 'Profile holds your plan, privacy settings, and help. You can open this tour again from Profile whenever you want.',
    where: profileWhere,
  });

  return steps;
}

function parentSteps(): TutorialStep[] {
  return [
    {
      icon: 'family-restroom',
      title: 'Your parent home',
      body: 'This screen is your home. Each card is one linked child and how their learning is going.',
      where: 'You are on this screen now',
    },
    {
      icon: 'insights',
      title: 'Progress at a glance',
      body: 'The summary at the top counts your children and the work being tracked. Open a child card for the detail.',
      where: 'Top of this screen',
    },
    {
      icon: 'chat',
      title: 'Message a teacher',
      body: 'Messages is where you read from teachers and write about one child. A number means something is unread.',
      where: 'Messages card on this screen',
    },
    {
      icon: 'vpn-key',
      title: 'Link a child',
      body: 'A teacher sends one invite code per child. If someone is missing, ask their teacher for a new code.',
      where: 'Shown here until a child is linked',
    },
    {
      icon: 'person',
      title: 'Your account',
      body: 'Tap your name at the top for help, privacy, or sign out. Show me around in that menu replays this tour.',
      where: 'Your name at the top',
    },
  ];
}

function teacherSteps(isSchoolAdmin: boolean): TutorialStep[] {
  return [
    {
      icon: 'dashboard',
      title: 'Your class home',
      body: 'This is your teacher home. Class overview, students, and assignments all live on this page.',
      where: 'You are on this screen now',
    },
    {
      icon: 'assignment',
      title: 'Set work',
      body: 'New assignment starts a task. Assignments shows who has started and who has finished.',
      where: 'Tiles at the top',
    },
    {
      icon: 'groups',
      title: 'Students',
      body: 'Filter by class, then use a student card to add a note or invite their parent. One invite code links one child.',
      where: 'Scroll to Students',
    },
    {
      icon: 'chat',
      title: 'Messages',
      body: 'Parents reach you from Messages. A number on the tile means a conversation is waiting.',
      where: 'Messages tile at the top',
    },
    {
      icon: 'folder-shared',
      title: isSchoolAdmin ? 'Resources and admin' : 'Resources and help',
      body: isSchoolAdmin
        ? 'School resources holds shared files. School admin is for school-wide settings. Tap your name to replay this tour.'
        : 'School resources holds files for your classes. Tap your name at the top for help, or to replay this tour.',
      where: isSchoolAdmin ? 'Tiles at the top, and your name' : 'School resources tile, and your name',
    },
  ];
}
