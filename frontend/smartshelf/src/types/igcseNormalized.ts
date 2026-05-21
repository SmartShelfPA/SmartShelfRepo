import type { NormalizedQuestion } from '@/src/types/practice';

/** SmartShelf Django `/api/igcse/*` envelope (success payload). */
export type IgcseApiSchemaVersion = '1.0';

export type IgcseEnvelopeSuccess<T> = {
  success: true;
  schema_version: IgcseApiSchemaVersion | string;
  data: T;
};

export type IgcseEnvelopeErrorBody = {
  success: false;
  schema_version: IgcseApiSchemaVersion | string;
  error: {
    code: string;
    message: string;
    detail?: string;
    validation?: Record<string, unknown>;
  };
};

export type IgcseRevisionSubject = {
  id: string;
  title: string;
};

export type IgcseRevisionTopic = {
  id: string;
  title: string;
};

export type IgcseSearchHit = {
  slug: string;
  title: string;
  excerpt: string;
  path?: string;
  icon?: string;
  is_topic: boolean;
};

export type IgcseTheoryNormalized = {
  id: string;
  kind: 'theory';
  intro: string;
  statements: string[];
  image_url: string;
  question: string;
  prompt_html: string;
  difficulty: number;
  scheme: string[];
  explanation: string;
  explanation_html: string;
  order_index: number;
  source_ref: {
    provider: string;
    subject_slug: string;
    topic_slug: string;
  };
};

export type IgcseQuestionsLimits = {
  selective_requested?: number | null;
  theory_requested?: number | null;
  selective_applied?: number | null;
  theory_applied?: number | null;
};

/** Normalized `GET /api/igcse/questions/` payload (within envelope `data`). */
export type IgcseQuestionsBundle = {
  provider: string;
  subject: string;
  topic: string;
  limits: IgcseQuestionsLimits;
  selective: NormalizedQuestion[];
  theory: IgcseTheoryNormalized[];
};

export type IgcseGetQuestionsOptions = {
  limitSelective?: number;
  limitTheory?: number;
};
