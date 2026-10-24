import type { Metadata } from "next";
import Newsroom from "@/components/Newsroom";

export const metadata: Metadata = { title: "FinUrheilu Newsroom", robots: { index: false } };

export default function Page() {
  return <Newsroom />;
}
