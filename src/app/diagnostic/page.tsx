import { DiagnosticTest } from "@/components/onboarding/DiagnosticTest";

export default function DiagnosticPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-brand-50 to-surface-50 dark:from-surface-950 dark:to-surface-900">
      <DiagnosticTest />
    </div>
  );
}
