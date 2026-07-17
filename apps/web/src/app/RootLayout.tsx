import { Outlet } from "react-router";

/**
 * Root layout wrapper — renders the matched child route via `<Outlet />`.
 */
export function RootLayout() {
  return (
    <main>
      <Outlet />
    </main>
  );
}
