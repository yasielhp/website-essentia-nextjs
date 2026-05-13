import type { Metadata } from "next";
import RunRegisterSection from "@components/sections/community/run-register-section";

export const metadata: Metadata = {
  title: "Register for the Run | Essentia Running Club",
  description:
    "Register for the next Essentia Running Club session in Costa Adeje, Tenerife.",
};

export default function RunRegisterPage() {
  return <RunRegisterSection />;
}
