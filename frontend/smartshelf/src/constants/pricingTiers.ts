/**
 * SmartShelf revenue streams (smartshelf.ng business model).
 * Student-facing tiers include purchase CTAs; B2B tiers point to contact.
 */

export type PricingTierId =
  | 'student'
  | 'institutional'
  | 'diaspora'
  | 'micro'
  | 'publisher'
  | 'analytics';

export type PricingTier = {
  id: PricingTierId;
  title: string;
  tagline: string;
  audience: string;
  price: string;
  priceNote?: string;
  features: string[];
  icon: 'school' | 'business' | 'public' | 'payments' | 'menu-book' | 'insights';
  highlighted?: boolean;
  ctaLabel: string;
};

export const PRICING_HEADLINE = 'Six ways to learn on one platform';
export const PRICING_SUBHEADLINE =
  'Affordable access for students, flexible options for families abroad, and partnerships for schools and publishers.';

export const PRICING_TIERS: PricingTier[] = [
  {
    id: 'student',
    title: 'Student subscription',
    tagline: 'Full shelf access for less than print',
    audience: 'Students',
    price: '₦2,000 – ₦8,000',
    priceNote: 'per term · monthly, termly, or annual',
    features: [
      'IGCSE textbooks, revision, and practice tools',
      '80–90% below typical print material costs',
      'One login across mobile and web',
    ],
    icon: 'school',
    highlighted: true,
    ctaLabel: 'Choose plan — coming soon',
  },
  {
    id: 'micro',
    title: 'Micro-transactions',
    tagline: 'Pay only for what you need',
    audience: 'Students',
    price: 'Pay per chapter',
    priceNote: 'Rent-a-Chapter · term-only exam prep',
    features: [
      'Rent-a-Chapter for targeted revision',
      'Term-only access when you do not need the full year',
      'Built for low-income and exam-sprint learners',
    ],
    icon: 'payments',
    ctaLabel: 'Browse chapters — coming soon',
  },
  {
    id: 'diaspora',
    title: 'Diaspora premium',
    tagline: 'Parents abroad, students in Nigeria',
    audience: 'Families abroad',
    price: 'GBP · CAD · USD',
    priceNote: 'Premium plans billed in your local currency',
    features: [
      'Pay from the UK, Canada, US, and more',
      'Support a student’s shelf back home',
      'Same content as Nigerian student plans',
    ],
    icon: 'public',
    ctaLabel: 'View diaspora plans — coming soon',
  },
  {
    id: 'institutional',
    title: 'Institutional licence',
    tagline: 'Bulk access for schools',
    audience: 'Schools & government',
    price: 'Per student, per term',
    priceNote: 'Volume contracts for classes and states',
    features: [
      'Fixed fee per student per term',
      'School-wide and state education contracts',
      'Admin visibility and rollout support',
    ],
    icon: 'business',
    ctaLabel: 'Contact sales',
  },
  {
    id: 'publisher',
    title: 'Publisher revenue share',
    tagline: 'List titles on SmartShelf',
    audience: 'Publishers',
    price: '70% to you',
    priceNote: 'SmartShelf retains 30% per sale',
    features: [
      'Commission on every digital sale',
      'Optional placement fees for featured slots',
      'Reach students nationwide on one platform',
    ],
    icon: 'menu-book',
    ctaLabel: 'Partner with us',
  },
  {
    id: 'analytics',
    title: 'Analytics licensing',
    tagline: 'Curriculum intelligence',
    audience: 'Publishers & authorities',
    price: 'Custom licensing',
    priceNote: 'Anonymized usage insights',
    features: [
      'Aggregated, privacy-safe curriculum data',
      'Understand what students actually use',
      'Inform publishing and policy decisions',
    ],
    icon: 'insights',
    ctaLabel: 'Request a demo',
  },
];
