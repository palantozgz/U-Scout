export type ClubActorRole = "master" | "head_coach" | "coach" | "player" | null;

export type MemberPermissionArgs = {
  meRole: ClubActorRole;
  targetRole: string;
  isOwner: boolean;
  isSelf: boolean;
};

export function canRemoveMember(args: MemberPermissionArgs): boolean {
  if (!args.meRole) return false;
  if (args.isOwner) return false;
  if (args.isSelf) return false;

  if (args.meRole === "master") return true;

  if (args.meRole === "head_coach") return args.targetRole !== "head_coach";
  if (args.meRole === "coach") return args.targetRole === "player";
  return false;
}

export function canBanMember(args: MemberPermissionArgs): boolean {
  // Same rules as remove for now (safe & conservative).
  return canRemoveMember(args);
}

export function canPromoteMember(_args: MemberPermissionArgs): boolean {
  // Not implemented in UI yet.
  return false;
}

