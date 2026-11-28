"use client";

import { DialogFrame } from "@/components/ui/DialogFrame";

export interface OrgInviteRow {
  id: string;
  token: string;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
}

export type OrgInvitesSectionProps = {
  invites: OrgInviteRow[];
  unusedInvites: OrgInviteRow[];
  usedInvites: OrgInviteRow[];
  linkCopiedId: string | null;
  showInviteModal: boolean;
  inviteCount: number;
  generatingInvites: boolean;
  onOpenModal: () => void;
  onCloseModal: () => void;
  onInviteCountChange: (count: number) => void;
  onGenerateInvites: () => void;
  onCopyInviteLink: (inviteId: string, token: string) => void;
  onDeleteInvite: (inviteId: string) => void;
  formatDate: (iso: string | null) => string;
  t: (key: string, params?: Record<string, string | number>) => string;
  classes: {
    cardClass: string;
    labelClass: string;
    primaryBtnClass: string;
    secondaryBtnClass: string;
    dangerBtnClass: string;
    inputClass: string;
    chipClass: string;
  };
};

export function OrgInvitesSection({
  invites,
  unusedInvites,
  usedInvites,
  linkCopiedId,
  showInviteModal,
  inviteCount,
  generatingInvites,
  onOpenModal,
  onCloseModal,
  onInviteCountChange,
  onGenerateInvites,
  onCopyInviteLink,
  onDeleteInvite,
  formatDate,
  t,
  classes,
}: OrgInvitesSectionProps) {
  return (
    <>
      <section className={`${classes.cardClass} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 px-5 py-4 sm:px-6">
          <div>
            <p className={classes.labelClass}>{t("organization.inviteLinks")}</p>
            <h3 className="mt-1 text-sm font-medium text-white">
              Share single-use links to add members
            </h3>
          </div>
          <button
            type="button"
            onClick={onOpenModal}
            className={classes.primaryBtnClass}
          >
            {t("organization.generateInvites")}
          </button>
        </div>

        {invites.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-neutral-500 sm:px-6">
            {t("organization.noInvitesYet")}
          </div>
        ) : (
          <div className="divide-y divide-neutral-800/60">
            {unusedInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
              >
                <div className="min-w-0">
                  <code className="console-chip break-all px-2 py-1 font-mono text-xs text-white">
                    {invite.token}
                  </code>
                  <p className="mt-1.5 text-xs text-neutral-500">
                    {t("organization.created", {
                      date: formatDate(invite.created_at),
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => onCopyInviteLink(invite.id, invite.token)}
                    className={classes.secondaryBtnClass}
                  >
                    {linkCopiedId === invite.id
                      ? t("common.copied")
                      : t("organization.copyLink")}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteInvite(invite.id)}
                    className={classes.dangerBtnClass}
                  >
                    {t("organization.revoke")}
                  </button>
                </div>
              </div>
            ))}

            {usedInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-col gap-2 px-5 py-4 opacity-55 sm:flex-row sm:items-center sm:justify-between sm:px-6"
              >
                <div className="min-w-0">
                  <code className="console-chip break-all px-2 py-1 font-mono text-xs text-neutral-500 line-through">
                    {invite.token}
                  </code>
                  <p className="mt-1.5 text-xs text-neutral-600">
                    {t("organization.usedOn", {
                      date: formatDate(invite.used_at),
                    })}
                  </p>
                </div>
                <span className={`${classes.chipClass} text-neutral-500`}>
                  {t("organization.used")}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <DialogFrame
        open={showInviteModal}
        onClose={onCloseModal}
        size="md"
        labelledBy="org-generate-invite-title"
      >
        <div className="p-6">
          <p className={classes.labelClass}>Invites</p>
          <h3
            id="org-generate-invite-title"
            className="mt-1 text-xl font-medium tracking-[-0.5px] text-white"
          >
            {t("organization.generateInviteModal")}
          </h3>
          <div className="mt-6">
            <label
              htmlFor="org-invite-count"
              className="mb-2 block text-sm text-neutral-400"
            >
              {t("organization.numberOfInvites")}
            </label>
            <input
              id="org-invite-count"
              type="number"
              min={1}
              max={50}
              value={inviteCount}
              onChange={(e) =>
                onInviteCountChange(
                  Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 1)),
                )
              }
              className={classes.inputClass}
            />
            <p className="mt-1.5 text-xs text-neutral-500">
              {t("organization.inviteHelper")}
            </p>
          </div>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onCloseModal}
              className={`${classes.secondaryBtnClass} flex-1`}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={onGenerateInvites}
              disabled={generatingInvites}
              className={`${classes.primaryBtnClass} flex-1`}
            >
              {generatingInvites
                ? t("organization.generating")
                : t("organization.generate")}
            </button>
          </div>
        </div>
      </DialogFrame>
    </>
  );
}
