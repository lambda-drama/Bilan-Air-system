"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Mail, MessageSquare, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import {
  getDirectMessage,
  listDirectMessages,
  replyToDirectMessage,
  setDirectMessageStatus,
  type DirectMessageRow,
  type DirectMessageStatus,
} from "@/services/directMessages";
import { DetailRow, DetailSection, DetailSheet } from "@/components/portal/detail-sheet";
import { ListRowActions } from "@/components/portal/list-row-actions";
import { ListSearch } from "@/components/portal/list-search";
import { RowActionMenuItem } from "@/components/portal/row-action-menu";
import { useLiveListQuery } from "@/hooks/use-live-list-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const STATUS_TABS: Array<{ id: "" | DirectMessageStatus; label: string }> = [
  { id: "", label: "All" },
  { id: "New", label: "New" },
  { id: "In Progress", label: "In Progress" },
  { id: "Replied", label: "Replied" },
  { id: "Closed", label: "Closed" },
];

function statusClass(status: string) {
  switch (status) {
    case "New":
      return "bg-slate-100 text-slate-800";
    case "In Progress":
      return "bg-amber-100 text-amber-900";
    case "Replied":
      return "bg-blue-100 text-blue-900";
    case "Closed":
      return "bg-green-100 text-green-900";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function formatWhen(value?: string) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function DirectMessagesPage() {
  const [statusFilter, setStatusFilter] = useState<"" | DirectMessageStatus>("");
  const fetchMessages = useCallback(
    async (search: string) => {
      const res = await listDirectMessages({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        limit: 100,
      });
      return res.data;
    },
    [statusFilter],
  );
  const { search, setSearch, rows, loading, error, refresh } =
    useLiveListQuery<DirectMessageRow>(fetchMessages, { reloadKey: statusFilter });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DirectMessageRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setReplyText("");
      return;
    }
    setDetailLoading(true);
    getDirectMessage(selectedId)
      .then((row) => {
        setDetail(row);
        setReplyText(row.agent_reply || "");
      })
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  const runAction = async (
    messageId: string,
    action: () => Promise<DirectMessageRow>,
    success: string,
  ) => {
    setSubmitting(true);
    try {
      const updated = await action();
      if (selectedId === messageId) {
        setDetail(updated);
        setReplyText(updated.agent_reply || "");
      }
      toast.success(success);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkInProgress = (messageId: string) => {
    runAction(
      messageId,
      () => setDirectMessageStatus(messageId, "In Progress"),
      "Marked in progress",
    );
  };

  const handleClose = (messageId: string) => {
    runAction(
      messageId,
      () => setDirectMessageStatus(messageId, "Closed"),
      "Message closed",
    );
  };

  const handleReopen = (messageId: string) => {
    runAction(
      messageId,
      () => setDirectMessageStatus(messageId, "In Progress"),
      "Reopened",
    );
  };

  const handleReply = () => {
    if (!selectedId || !replyText.trim()) {
      toast.error("Enter a reply message");
      return;
    }
    runAction(
      selectedId,
      () => replyToDirectMessage(selectedId, replyText.trim(), true),
      "Reply sent to customer",
    );
  };

  const openMessage = (messageId: string) => {
    setSelectedId(messageId);
  };

  const selectedRow = rows.find((r) => r.name === selectedId);
  const isClosed = detail?.status === "Closed";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-gold" />
          Direct Message
        </h2>
        <p className="text-sm text-muted-foreground">
          Website contact form submissions from travelers and visitors
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.id || "all"}
            type="button"
            onClick={() => setStatusFilter(tab.id)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              statusFilter === tab.id
                ? "bg-navy text-cream"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <ListSearch
        value={search}
        onChange={setSearch}
        placeholder="Search name, email, phone, message..."
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>From</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Received</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No direct messages found
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow
                    key={row.name}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedId(row.name)}
                  >
                    <TableCell className="font-mono text-sm">{row.name}</TableCell>
                    <TableCell className="font-medium">{row.sender_name}</TableCell>
                    <TableCell>{row.email}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                          statusClass(row.status),
                        )}
                      >
                        {row.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatWhen(row.creation)}
                    </TableCell>
                    <TableCell className="text-right">
                      <ListRowActions doctype="Website Contact Message" docName={row.name}>
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={submitting}>
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <RowActionMenuItem onClick={() => openMessage(row.name)}>
                              View message
                            </RowActionMenuItem>
                            {row.status !== "Closed" && (
                              <RowActionMenuItem
                                icon={Mail}
                                accent
                                onClick={() => openMessage(row.name)}
                              >
                                Reply
                              </RowActionMenuItem>
                            )}
                            {row.status === "New" && (
                              <RowActionMenuItem
                                doctype="Website Contact Message"
                                permission="write"
                                disabled={submitting}
                                onClick={() => handleMarkInProgress(row.name)}
                              >
                                Mark in progress
                              </RowActionMenuItem>
                            )}
                            {row.status !== "Closed" && (
                              <RowActionMenuItem
                                doctype="Website Contact Message"
                                permission="write"
                                disabled={submitting}
                                onClick={() => handleClose(row.name)}
                              >
                                Close
                              </RowActionMenuItem>
                            )}
                            {row.status === "Closed" && (
                              <RowActionMenuItem
                                doctype="Website Contact Message"
                                permission="write"
                                disabled={submitting}
                                onClick={() => handleReopen(row.name)}
                              >
                                Reopen
                              </RowActionMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </ListRowActions>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <DetailSheet
        open={!!selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
        title={selectedRow?.sender_name || selectedId || "Message"}
        subtitle={selectedRow?.email}
        badge={detail ? { label: detail.status } : undefined}
        isLoading={detailLoading}
        footer={
          detail && !detailLoading ? (
            <div className="flex flex-col gap-3 w-full">
              {!isClosed && (
                <div className="space-y-2">
                  <Label htmlFor="agent-reply">Your reply</Label>
                  <textarea
                    id="agent-reply"
                    rows={4}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    disabled={submitting}
                    placeholder="Write a reply to the customer..."
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {!isClosed && detail.status === "New" && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={submitting}
                    onClick={() => selectedId && handleMarkInProgress(selectedId)}
                  >
                    Mark in progress
                  </Button>
                )}
                {!isClosed && (
                  <Button
                    type="button"
                    className="bg-gold text-navy hover:bg-gold-dark"
                    disabled={submitting || !replyText.trim()}
                    onClick={handleReply}
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Mail className="h-4 w-4 mr-2" />
                        Reply &amp; send email
                      </>
                    )}
                  </Button>
                )}
                {!isClosed && (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={submitting}
                    onClick={() => selectedId && handleClose(selectedId)}
                  >
                    Close
                  </Button>
                )}
                {isClosed && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={submitting}
                    onClick={() => selectedId && handleReopen(selectedId)}
                  >
                    Reopen
                  </Button>
                )}
              </div>
            </div>
          ) : undefined
        }
      >
        {detail && (
          <>
            <DetailSection title="Contact">
              <DetailRow label="Phone" value={detail.phone} />
              <DetailRow label="Source" value={detail.source} />
              <DetailRow label="Received" value={formatWhen(detail.creation)} />
            </DetailSection>
            <DetailSection title="Customer message">
              <p className="whitespace-pre-wrap text-sm">{detail.message}</p>
            </DetailSection>
            {detail.agent_reply && (
              <DetailSection title="Agent reply">
                <DetailRow label="Replied by" value={detail.replied_by} />
                <DetailRow label="Replied on" value={formatWhen(detail.replied_on)} />
                <p className="whitespace-pre-wrap text-sm pt-2">{detail.agent_reply}</p>
              </DetailSection>
            )}
            {detail.status === "Closed" && (
              <DetailSection title="Closed">
                <DetailRow label="Closed by" value={detail.closed_by} />
                <DetailRow label="Closed on" value={formatWhen(detail.closed_on)} />
              </DetailSection>
            )}
          </>
        )}
      </DetailSheet>
    </div>
  );
}
