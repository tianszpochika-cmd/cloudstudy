import { computed, ref, watch, type Ref } from "vue";
/** Filters only the currently loaded, authorized projection. Never implies a server-wide search. */
export function useListView<T extends object>(
  rows: Ref<T[]>,
  fields: Array<keyof T>,
) {
  const query = ref("");
  const page = ref(1);
  const pageSize = 10;
  const filtered = computed(() => {
    const term = query.value.trim().toLowerCase();
    return term
      ? rows.value.filter((row) =>
          fields.some((field) =>
            String(row[field] ?? "")
              .toLowerCase()
              .includes(term),
          ),
        )
      : rows.value;
  });
  watch([query, rows], () => {
    page.value = 1;
  });
  const visible = computed(() =>
    filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize),
  );
  return { query, page, pageSize, filtered, visible };
}
