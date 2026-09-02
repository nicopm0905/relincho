import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export const metadata = { title: "Crear tu finca — Relincho" };

export default function OnboardingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-lg px-4">
        <OnboardingForm />
      </div>
    </div>
  );
}
