interface ProgressBarProps {
  readonly value: number; // 0.0 - 1.0
  readonly label?: string;
  readonly size?: "sm" | "md";
}

export function ProgressBar({ value, label, size = "md" }: ProgressBarProps) {
  const percent = Math.round(value * 100);
  const height = size === "sm" ? "h-2" : "h-3";

  const barColor =
    value > 0.7
      ? "bg-green-500"
      : value >= 0.4
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between mb-1 text-sm">
          <span>{label}</span>
          <span className="font-medium">{percent}%</span>
        </div>
      )}
      <div className={`w-full ${height} bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden`}>
        <div
          className={`${height} ${barColor} rounded-full transition-all duration-500`}
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label ?? `${percent}% progress`}
        />
      </div>
    </div>
  );
}
