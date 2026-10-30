import { FEATURES } from "@/lib/features";
import { Unavailable } from "../ui";

export default function Layout({ children }: { children: React.ReactNode }) {
  return FEATURES.calculator ? children : <Unavailable title="Калькулятор потерь" />;
}
