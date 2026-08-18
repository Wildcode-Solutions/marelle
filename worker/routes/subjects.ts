import { json } from "../lib/http";

interface SubjectRow {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  icon: string;
  color: string;
  chapter_count: number;
}

export async function subjects(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const schoolLevel = url.searchParams.get("level") ?? "6e";

  const result = await env.DB.prepare(
    `SELECT
      s.id,
      s.slug,
      s.name,
      s.short_name,
      s.icon,
      s.color,
      COUNT(c.id) AS chapter_count
     FROM subjects s
     LEFT JOIN chapters c
       ON c.subject_id = s.id
      AND c.school_level_id = ?1
      AND c.is_active = 1
     WHERE s.is_active = 1
     GROUP BY s.id
     ORDER BY s.name`,
  )
    .bind(schoolLevel)
    .all<SubjectRow>();

  return json(
    request,
    result.results.map((subject) => ({
      id: subject.id,
      slug: subject.slug,
      name: subject.name,
      shortName: subject.short_name,
      icon: subject.icon,
      color: subject.color,
      chapterCount: subject.chapter_count,
    })),
  );
}
