import { MessagePageSkeleton } from "../../message-page-skeleton";

/** Shown the moment the page is asked for, before the server has answered. */
export default function Loading() {
  return (
    <div className="px-6 py-8 lg:px-10">
      <MessagePageSkeleton channel="email" />
    </div>
  );
}
