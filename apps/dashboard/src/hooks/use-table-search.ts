import { useEffect, useState } from "react";

/** Search box state for a table that searches on the server: a debounced term for the request, and the props for DataTable. */
export function useTableSearch(resetPage: () => void, delay = 250) {
  const [value, setValue] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTerm(value.trim()), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return {
    /** Send this as `search` in the request. Undefined when the box is empty. */
    term: term || undefined,
    search: {
      value,
      onChange: (v: string) => {
        setValue(v);
        resetPage();
      },
    },
  };
}
