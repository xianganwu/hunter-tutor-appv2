import { DrillMode } from "@/components/tutor/DrillMode";

interface DrillPageProps {
  readonly searchParams: Promise<{ skill?: string }>;
}

export default async function DrillPage({ searchParams }: DrillPageProps) {
  const params = await searchParams;
  const skillId = params.skill;

  return (
    <div className="flex flex-col min-h-screen bg-surface-50 dark:bg-surface-950">
      <DrillMode initialSkillId={skillId} />
    </div>
  );
}
