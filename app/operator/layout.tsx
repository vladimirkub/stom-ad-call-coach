import { FEATURES } from "@/lib/features";
import { Unavailable } from "../ui";

export default function Layout({ children }: { children: React.ReactNode }) {
  return FEATURES.operator ? children : <Unavailable title="Входящий от ИИ-оператора" />;
}
