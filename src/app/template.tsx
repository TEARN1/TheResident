// A short CSS fade when you move between sections. This used to be a
// Framer Motion fade-and-slide (0.75s) whose server-rendered starting style
// was opacity 0, so every page stayed blank until all the JavaScript had
// downloaded and run: seconds of empty screen on a slow connection. CSS
// starts as soon as the HTML and stylesheet arrive, and needs no JS at all.
//
// Opacity only, on purpose: a transform here would turn this wrapper into
// the containing block for every `position: fixed` element inside it (the
// bottom nav, modals) while it ran.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>
}
