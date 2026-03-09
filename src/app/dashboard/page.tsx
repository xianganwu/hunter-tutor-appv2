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
    <main className="min-h-screen bg-surface-50 dark:bg-surface-950">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* User Menu */}
        <section className="flex justify-end animate-fade-in">
          <UserMenu />
        </section>

        {/* Header: Greeting + Streak + Continue Learning */}
        <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 animate-slide-up">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-surface-900 dark:text-surface-50">
              Welcome back!
            </h1>
            <p className="text-surface-500 dark:text-surface-400 mt-1">
              Keep up the great work. Every practice session gets you closer to the Hunter exam.
            </p>
            {/* Motivational micro-copy */}
            <p className="mt-2 text-sm font-medium text-brand-600 dark:text-brand-400">
              You crushed inference questions last time. Ready to level up?
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
        <section className="animate-fade-in">
          <SkillMap states={studentStates} />
        </section>

        {/* Domain Cards */}
        <section className="animate-fade-in">
          <h2 className="text-xl font-semibold mb-4 text-surface-800 dark:text-surface-100">
            Practice by Subject
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {domainProgress.map((dp) => (
              <DomainCard key={dp.domainId} progress={dp} />
            ))}
          </div>
        </section>

        {/* Quick Links */}
        <section className="animate-fade-in">
          <h2 className="text-xl font-semibold mb-4 text-surface-800 dark:text-surface-100">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <a
              href="/mistakes"
              className="flex flex-col items-center gap-2 rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 px-4 py-5 text-sm font-medium text-surface-700 dark:text-surface-300 hover:shadow-glow transition-all duration-200 hover:-translate-y-0.5"
            >
              <span className="text-2xl" aria-hidden="true">📝</span>
              <span>Mistake Journal</span>
            </a>
            <a
              href="/tutor/writing"
              className="flex flex-col items-center gap-2 rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 px-4 py-5 text-sm font-medium text-surface-700 dark:text-surface-300 hover:shadow-glow transition-all duration-200 hover:-translate-y-0.5"
            >
              <span className="text-2xl" aria-hidden="true">✍️</span>
              <span>Writing Workshop</span>
            </a>
            <a
              href="/tutor/reading"
              className="flex flex-col items-center gap-2 rounded-2xl shadow-card bg-surface-0 dark:bg-surface-900 px-4 py-5 text-sm font-medium text-surface-700 dark:text-surface-300 hover:shadow-glow transition-all duration-200 hover:-translate-y-0.5"
            >
              <span className="text-2xl" aria-hidden="true">📚</span>
              <span>Reading Stamina</span>
            </a>
            <a
              href="/simulate"
              className="flex flex-col items-center gap-2 rounded-2xl shadow-card bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 px-4 py-5 text-sm font-medium text-brand-700 dark:text-brand-300 hover:shadow-glow transition-all duration-200 hover:-translate-y-0.5"
            >
              <span className="text-2xl" aria-hidden="true">🎯</span>
              <span>Practice Exam</span>
            </a>
            <a
              href="/parent"
              className="flex flex-col items-center gap-2 rounded-2xl shadow-card bg-streak-50 dark:bg-streak-600/10 border border-streak-200 dark:border-streak-600/30 px-4 py-5 text-sm font-medium text-streak-600 dark:text-streak-400 hover:shadow-glow-streak transition-all duration-200 hover:-translate-y-0.5"
            >
              <span className="text-2xl" aria-hidden="true">👨‍👩‍👧</span>
              <span>Parent Dashboard</span>
            </a>
          </div>
        </section>

        {/* Weekly Summary */}
        <section className="animate-fade-in">
          <WeeklySummary data={weeklySummary} />
        </section>
      </div>
    </main>
  );
}
