import type { Metadata } from "next";
import UnsubscribeClientPage from "./unsubscribe-content";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function UnsubscribePage() {
  return <UnsubscribeClientPage />;
}
