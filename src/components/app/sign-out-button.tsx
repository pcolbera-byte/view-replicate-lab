import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/data/workspace";

export function SignOutButton({
  variant,
  className,
  iconOnly,
}: {
  variant: "ghost" | "outline";
  className?: string | undefined;
  iconOnly?: boolean | undefined;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  async function out() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <Button
      variant={variant}
      size={iconOnly ? "icon" : "default"}
      title="Sair"
      className={className}
      onClick={out}
    >
      <LogOut />
      {!iconOnly && "Sair"}
    </Button>
  );
}
