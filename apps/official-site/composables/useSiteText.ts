export function useSiteText() {
  const { officialI18n, officialI18nAdapter } = useNuxtApp().$foundation;
  const locale = useState(
    "official:locale",
    () => officialI18nAdapter.state.locale,
  );
  function t(key: string, values?: Record<string, string | number>) {
    if (!key.startsWith("official.")) return key;
    return officialI18n.t(key, values, { locale: locale.value });
  }
  return {
    t,
    locale,
    number: (value: number) =>
      officialI18n.formatNumber(value, undefined, locale.value),
  };
}
