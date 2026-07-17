import { createBrowserRouter } from "react-router";

import { RootLayout } from "./RootLayout";
import { LandingPage } from "./pages/LandingPage";
import { SenderPage } from "./pages/SenderPage";
import { ReceiverPage } from "./pages/ReceiverPage";
import { NotFoundPage } from "./pages/NotFoundPage";

/**
 * Application route tree.
 *
 * - `/` → Landing page with role selection.
 * - `/s` → Sender workspace.
 * - `/r` → Receiver workspace (room picker).
 * - `/r/:code` → Receiver workspace (room code pre-filled from URL).
 *
 * All unmatched routes render the 404 error boundary.
 */
export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <NotFoundPage />,
    children: [
      {
        index: true,
        element: <LandingPage />,
      },
      {
        path: "s",
        element: <SenderPage />,
      },
      {
        path: "r",
        element: <ReceiverPage />,
      },
      {
        path: "r/:code",
        element: <ReceiverPage />,
      },
    ],
  },
]);
