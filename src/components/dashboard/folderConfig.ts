export interface Folder {
  id: string;
  name: string;
  color: string;
  userId: string;
  createdAt: string;
  parentId?: string | null;
}

export const FOLDER_COLORS = [
  { value: "violet", bg: "bg-violet-500", light: "bg-violet-50", border: "border-violet-200", text: "text-violet-600" },
  { value: "rose", bg: "bg-rose-500", light: "bg-rose-50", border: "border-rose-200", text: "text-rose-600" },
  { value: "emerald", bg: "bg-emerald-500", light: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-600" },
  { value: "amber", bg: "bg-amber-500", light: "bg-amber-50", border: "border-amber-200", text: "text-amber-600" },
  { value: "sky", bg: "bg-sky-500", light: "bg-sky-50", border: "border-sky-200", text: "text-sky-600" },
] as const;

export function getColorConfig(color: string) {
  return FOLDER_COLORS.find((c) => c.value === color) || FOLDER_COLORS[0];
}
