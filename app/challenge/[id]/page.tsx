import { notFound } from "next/navigation";
import scenarios from "@/lib/scenarios-public.json";
import Challenge from "./challenge";

export default async function ChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!scenarios.some((s) => s.id === id)) notFound();
  return <Challenge id={id} />;
}
