/** Study-agent IGCSE catalog (`GET /api/igcse/*`, provider: study_agent). */

export type IgcseCatalogSubject = {
  id: string;
  title: string;
};

export type IgcseCatalogChapter = {
  id: string;
  title: string;
};

export type IgcsePdfAsset = {
  url: string;
  sha256?: string | null;
  page_count?: number | null;
};

export type IgcseSimulatorAsset = {
  simulator_set_id: string;
  public_url: string;
  artifact_url?: string;
  artifact_json?: Record<string, unknown>;
  schema_version?: string;
  build_id?: string;
};

export type IgcseGeneratedSetSummary = {
  id: string;
  subject_slug: string;
  chapter_slug: string;
  chapter_title: string;
  practice_paper_url: string;
  worked_solutions_url: string;
  simulator_set_id: string;
  simulator_public_url: string;
  simulator_artifact_url?: string;
  generated_at: string;
  is_published: boolean;
  generation_status: string;
  quality_score?: number | null;
  pipeline_bundle_id?: string | null;
  version: number;
  is_latest_published: boolean;
};

export type IgcseGeneratedSetDetail = IgcseGeneratedSetSummary & {
  generation_metadata?: Record<string, unknown>;
  practice_paper: IgcsePdfAsset | null;
  worked_solutions: IgcsePdfAsset | null;
  simulator: IgcseSimulatorAsset | null;
};
