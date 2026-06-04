import { StackHandler } from "@stackframe/stack";

export default function Handler(props: unknown) {
  return <StackHandler fullPage {...(props as Record<string, unknown>)} />;
}
