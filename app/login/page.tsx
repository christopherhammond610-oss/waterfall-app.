import type { Metadata } from "next";
import AuthForm from "@/components/auth/AuthForm";

export const metadata: Metadata = {
  title: "Sign In | Waterfall",
};

export default function LoginPage() {
  return <AuthForm />;
}
