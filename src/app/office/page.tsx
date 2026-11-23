import type { Metadata } from "next";
import { Office } from "@/components/office/Office";

export const metadata: Metadata = { title: "오피스" };

export default function OfficePage() {
  return <Office />;
}
