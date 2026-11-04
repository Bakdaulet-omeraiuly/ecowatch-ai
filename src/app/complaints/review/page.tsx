import { ComplaintFeed } from "@/components/complaints/ComplaintFeed";
import { AuditLog } from "@/components/complaints/AuditLog";

export default function Page() {
  return (
    <>
      <ComplaintFeed mode="review" />
      <AuditLog />
    </>
  );
}
