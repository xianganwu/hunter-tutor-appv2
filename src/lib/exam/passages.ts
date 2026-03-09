import type { Passage, PassageGenre, DifficultyLevel } from "@/lib/types";

// Fiction
import fiction01 from "../../../content/passages/fiction/fiction_01.json";
import fiction02 from "../../../content/passages/fiction/fiction_02.json";
import fiction03 from "../../../content/passages/fiction/fiction_03.json";
import fiction04 from "../../../content/passages/fiction/fiction_04.json";
import fiction05 from "../../../content/passages/fiction/fiction_05.json";

// Nonfiction
import nonfiction01 from "../../../content/passages/nonfiction/nonfiction_01.json";
import nonfiction02 from "../../../content/passages/nonfiction/nonfiction_02.json";
import nonfiction03 from "../../../content/passages/nonfiction/nonfiction_03.json";
import nonfiction04 from "../../../content/passages/nonfiction/nonfiction_04.json";
import nonfiction05 from "../../../content/passages/nonfiction/nonfiction_05.json";

// Poetry
import poetry01 from "../../../content/passages/poetry/poetry_01.json";
import poetry02 from "../../../content/passages/poetry/poetry_02.json";
import poetry03 from "../../../content/passages/poetry/poetry_03.json";
import poetry04 from "../../../content/passages/poetry/poetry_04.json";
import poetry05 from "../../../content/passages/poetry/poetry_05.json";

// Historical Documents
import historicalDocument01 from "../../../content/passages/historical_document/historical_document_01.json";
import historicalDocument02 from "../../../content/passages/historical_document/historical_document_02.json";
import historicalDocument03 from "../../../content/passages/historical_document/historical_document_03.json";
import historicalDocument04 from "../../../content/passages/historical_document/historical_document_04.json";
import historicalDocument05 from "../../../content/passages/historical_document/historical_document_05.json";

// Science Articles
import scienceArticle01 from "../../../content/passages/science_article/science_article_01.json";
import scienceArticle02 from "../../../content/passages/science_article/science_article_02.json";
import scienceArticle03 from "../../../content/passages/science_article/science_article_03.json";
import scienceArticle04 from "../../../content/passages/science_article/science_article_04.json";
import scienceArticle05 from "../../../content/passages/science_article/science_article_05.json";

const allPassagesArray = [
  fiction01,
  fiction02,
  fiction03,
  fiction04,
  fiction05,
  nonfiction01,
  nonfiction02,
  nonfiction03,
  nonfiction04,
  nonfiction05,
  poetry01,
  poetry02,
  poetry03,
  poetry04,
  poetry05,
  historicalDocument01,
  historicalDocument02,
  historicalDocument03,
  historicalDocument04,
  historicalDocument05,
  scienceArticle01,
  scienceArticle02,
  scienceArticle03,
  scienceArticle04,
  scienceArticle05,
] as unknown as Passage[];

const passageMap = new Map<string, Passage>(
  allPassagesArray.map((p) => [p.metadata.passage_id, p])
);

/** Get a single passage by ID */
export function getPassageById(passageId: string): Passage | undefined {
  return passageMap.get(passageId);
}

/** Get all passages */
export function getAllPassages(): ReadonlyMap<string, Passage> {
  return passageMap;
}

/** Get all passage IDs */
export function getPassageIds(): string[] {
  return Array.from(passageMap.keys());
}

/** Filter passages by genre */
export function getPassagesByGenre(genre: PassageGenre): readonly Passage[] {
  return allPassagesArray.filter((p) => p.metadata.genre === genre);
}

/** Filter passages by difficulty level */
export function getPassagesByDifficulty(
  level: DifficultyLevel
): readonly Passage[] {
  return allPassagesArray.filter((p) => p.metadata.difficulty_level === level);
}

/** Filter passages that test a specific skill */
export function getPassagesBySkill(skillId: string): readonly Passage[] {
  return allPassagesArray.filter((p) =>
    p.metadata.tagged_skills.includes(skillId)
  );
}

/** Composite query: filter by any combination of genre, difficulty, and skill */
export interface PassageQuery {
  readonly genre?: PassageGenre;
  readonly difficulty?: DifficultyLevel;
  readonly skill?: string;
}

export function queryPassages(query: PassageQuery): readonly Passage[] {
  return allPassagesArray.filter((p) => {
    if (query.genre && p.metadata.genre !== query.genre) return false;
    if (query.difficulty && p.metadata.difficulty_level !== query.difficulty)
      return false;
    if (query.skill && !p.metadata.tagged_skills.includes(query.skill))
      return false;
    return true;
  });
}
