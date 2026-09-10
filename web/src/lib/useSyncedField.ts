import { useEffect, useRef, useState } from "react";

// Keeps a local editable value that tracks an external (remote) value, but
// never clobbers what the user is actively typing. When the field is not
// focused and the remote value changes, the local value catches up.
export function useSyncedField(remote: string) {
  const [local, setLocal] = useState(remote);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setLocal(remote);
  }, [remote]);

  return {
    value: local,
    setValue: setLocal,
    onFocus: () => {
      focused.current = true;
    },
    onBlur: () => {
      focused.current = false;
    },
    focusedRef: focused,
  };
}
