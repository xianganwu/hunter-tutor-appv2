import { SkillMap } from "@/components/dashboard/SkillMap";
import { DomainCard } from "@/components/dashboard/DomainCard";
import { WeeklySummary } from "@/components/dashboard/WeeklySummary";
import { StreakDisplay } from "@/components/dashboard/StreakDisplay";
import { ContinueLearningButton } from "@/components/dashboard/ContinueLearningButton";
import { UserMenu } from "@/components/dashboard/UserMenu";
import {
  getMockStudentStates,
  getMockDomainProgress,
  getMockStreakData,
  getMockWeeklySummary,
} from "@/components/dashboard/mock-data";

export default function DashboardPage() {
  const studentStates = getMockStudentStates();
  const domainProgress = getMockDomainProgress();
  const streakData = getMockStreakData();
  const weeklySummary = getMockWeeklySummary();

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* User Menu */}
      <section className="flex justify-end">
        <UserMenu />
      </section>

      {/* Header: Greeting + Streak + Continue Learning */}
      <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">
            Welcome back!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Keep up the great work. Every practice session gets you closer to the Hunter exam.
          </p>
          <div className="mt-4">
            <StreakDisplay data={streakData} />
          </div>
        </div>
        <div className="flex-shrink-0">
          <ContinueLearningButton states={studentStates} />
        </div>
      </section>

      {/* Skill Map */}
      <section>
        <SkillMap states={studentStates} />
      </section>

      {/* Domain Cards */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Practice by Subject</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {domainProgress.map((dp) => (
            <DomainCard key={dp.domainId} progress={dp} />
          ))}
        </div>
      </section>

      {/* Quick Links */}
      <section className="flex flex-wrap gap-3">
        <a
          href="/mistakes"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Mistake Journal
        </a>
        <a
          href="/tutor/writing"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Writing Workshop
        </a>
        <a
          href="/tutor/reading"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Reading Stamina
        </a>
        <a
          href="/simulate"
          className="inline-flex items-center gap-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-2.5 text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
        >
          Full Practice Exam
        </a>
        <a
          href="/parent"
          className="inline-flex items-center gap-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-2.5 text-sm font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
        >
          Parent Dashboard
        </a>
      </section>

      {/* Weekly Summary */}
      <section>
        <WeeklySummary data={weeklySummary} />
      </section>
    </main>
  );
}
