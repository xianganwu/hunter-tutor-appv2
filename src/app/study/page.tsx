import { GuidedStudySession } from "@/components/study/GuidedStudySession";

export default function StudyPage() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50 dark:bg-surface-950">
      <GuidedStudySession />
    </div>
  );
}
