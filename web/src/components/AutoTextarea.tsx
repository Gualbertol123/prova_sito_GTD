import { useLayoutEffect, useRef } from "react";

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  value: string;
};

// A textarea that grows to fit its content instead of scrolling. It resizes on
// every value change and on window resize (so it re-fits when its column width
// changes). Long unbreakable words wrap via break-words on the caller.
export function AutoTextarea({ value, className, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useLayoutEffect(() => {
    resize();
  }, [value]);

  // Re-fit whenever the textarea's own width changes (column resize, layout
  // shifts, window resize) so it never clips or shows a scrollbar.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", resize);
      return () => window.removeEventListener("resize", resize);
    }
    const ro = new ResizeObserver(() => resize());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onInput={resize}
      className={`resize-none overflow-hidden break-words ${className ?? ""}`}
      {...rest}
    />
  );
}
