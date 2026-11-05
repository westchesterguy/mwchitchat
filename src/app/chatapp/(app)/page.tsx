import { ChatIcon } from "@/components/ui/icons";

/**
 * /chatapp. On a phone the chat list (in the shell) is the whole screen; on a
 * wide screen the list sits on the left and this fills the space beside it.
 */
export default function ChatsHome() {
  return (
    <div className="anim-fade flex flex-1 flex-col items-center justify-center bg-canvas px-8 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface text-accent shadow-[var(--shadow-card)]">
        <ChatIcon className="h-8 w-8" />
      </span>
      <p className="mt-5 text-[17px] font-semibold">Select a chat</p>
      <p className="mt-1 max-w-[320px] text-[14px] text-muted">
        Conversations from westchesterguy.com and westchesterhorseproperties.com appear in the list.
      </p>
    </div>
  );
}
