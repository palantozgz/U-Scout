export type ReportStatus = "draft" | "proposed" | "approved" | "published";

export interface ReportStatusInfo {
  status: ReportStatus;
  label: string;
  color: string;
  canPropose: boolean;
  canPublish: boolean;
}

export function getReportStatusInfo(
  status: ReportStatus,
  locale: "en" | "es" | "zh" = "en",
): ReportStatusInfo {
  const labels: Record<ReportStatus, Record<string, string>> = {
    draft: { en: "Draft", es: "Borrador", zh: "草稿" },
    proposed: { en: "Proposed", es: "Propuesto", zh: "已提交" },
    approved: { en: "Approved", es: "Aprobado", zh: "已审批" },
    published: { en: "Published", es: "Publicado", zh: "已发布" },
  };
  const colors: Record<ReportStatus, string> = {
    draft: "bg-muted text-muted-foreground",
    proposed:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    approved:
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    published:
      "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  };
  return {
    status,
    label: labels[status][locale] ?? labels[status]["en"],
    color: colors[status],
    canPropose: status === "draft",
    canPublish: status === "approved" || status === "proposed",
  };
}
