import { getTranslations } from "next-intl/server";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export async function generateMetadata() {
  const t = await getTranslations("metadata.onboarding");
  return { title: t("title") };
}

export default function OnboardingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-lg px-4">
        <OnboardingForm />
      </div>
    </div>
  );
}
